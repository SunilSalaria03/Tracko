import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import {
  createProxyMiddleware,
  type RequestHandler,
} from 'http-proxy-middleware';
import type { Response } from 'express';
import { AppModule } from './app.module';

/**
 * Mounted proxies strip the mount path (e.g. /api/auth/signin → /signin).
 * Restore the prefix so Nest services still receive /api/...
 */
function proxyErrorHandler(name: string, logger: Logger) {
  return (err: Error, _req: unknown, res: unknown) => {
    logger.error(err.message);
    const response = res as Response;
    if (response && typeof response.headersSent === 'boolean' && !response.headersSent) {
      response.writeHead(502, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          statusCode: 502,
          message: `${name} service unavailable`,
        }),
      );
    }
  };
}

function buildProxy(
  name: string,
  target: string,
  pathPrefix: string,
): RequestHandler {
  const logger = new Logger(`Gateway:${name}`);
  logger.log(`Routing ${pathPrefix} → ${target}`);
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    xfwd: true,
    pathRewrite: (path) => `${pathPrefix}${path}`,
    on: {
      proxyReq: (proxyReq, req) => {
        const cookie = req.headers.cookie;
        if (cookie) {
          proxyReq.setHeader('cookie', cookie);
        }
        const authorization = req.headers.authorization;
        if (authorization) {
          proxyReq.setHeader('authorization', authorization);
        }
      },
      error: proxyErrorHandler(name, logger),
    },
  });
}

async function bootstrap() {
  // Do not parse JSON here — proxies must forward the raw stream.
  // Stripe webhooks fail signature checks (and can reset the socket) if the
  // gateway consumes or re-serializes the body first.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  app.use(cookieParser());
  const express = app.getHttpAdapter().getInstance();

  const authUrl =
    process.env.AUTH_SERVICE_URL ?? 'http://127.0.0.1:3010';
  const timesheetUrl =
    process.env.TIMESHEET_SERVICE_URL ?? 'http://127.0.0.1:3020';
  const leaveUrl =
    process.env.LEAVE_SERVICE_URL ?? 'http://127.0.0.1:3030';
  const chatUrl = process.env.CHAT_SERVICE_URL ?? 'http://127.0.0.1:3040';
  const paymentUrl =
    process.env.PAYMENT_SERVICE_URL ?? 'http://127.0.0.1:3050';

  // Register proxies before Nest route handling for reliable catch-all forwarding.
  const socketLogger = new Logger('Gateway:chat-ws');
  socketLogger.log(`Routing /socket.io → ${chatUrl}`);
  const socketProxy = createProxyMiddleware({
    target: chatUrl,
    changeOrigin: true,
    ws: true,
    xfwd: true,
    // Express strips the mount path; Socket.IO must still receive /socket.io/...
    pathRewrite: (path) => `/socket.io${path}`,
    on: {
      proxyReq: (proxyReq, req) => {
        const cookie = req.headers.cookie;
        if (cookie) {
          proxyReq.setHeader('cookie', cookie);
        }
      },
      error: proxyErrorHandler('chat-ws', socketLogger),
    },
  });
  express.use('/socket.io', socketProxy);
  express.use('/api/auth', buildProxy('auth', authUrl, '/api/auth'));
  express.use(
    '/api/timesheet',
    buildProxy('timesheet', timesheetUrl, '/api/timesheet'),
  );
  express.use(
    '/api/projects',
    buildProxy('projects', timesheetUrl, '/api/projects'),
  );
  express.use('/api/tasks', buildProxy('tasks', timesheetUrl, '/api/tasks'));
  express.use('/api/leave', buildProxy('leave', leaveUrl, '/api/leave'));
  express.use('/api/chat', buildProxy('chat', chatUrl, '/api/chat'));
  express.use(
    '/api/webhooks',
    buildProxy('stripe-webhooks', paymentUrl, '/api/webhooks'),
  );
  express.use(
    '/api/payments',
    buildProxy('payments', paymentUrl, '/api/payments'),
  );

  app.setGlobalPrefix('api');
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  const httpServer = app.getHttpServer() as {
    on: (
      event: string,
      listener: (...args: unknown[]) => void,
    ) => void;
  };
  httpServer.on('upgrade', (...args: unknown[]) => {
    const req = args[0] as { url?: string };
    if (req.url?.startsWith('/socket.io')) {
      const upgrade = (
        socketProxy as RequestHandler & {
          upgrade?: (...upgradeArgs: unknown[]) => void;
        }
      ).upgrade;
      upgrade?.(...args);
    }
  });
  new Logger('Gateway').log(`API gateway listening on ${port}`);
}
void bootstrap();
