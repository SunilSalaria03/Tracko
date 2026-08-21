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
      error: (err, _req, res) => {
        logger.error(err.message);
        const response = res as Response;
        if (!response.headersSent) {
          response.writeHead(502, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              statusCode: 502,
              message: `${name} service unavailable`,
            }),
          );
        }
      },
    },
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const express = app.getHttpAdapter().getInstance();

  const authUrl =
    process.env.AUTH_SERVICE_URL ?? 'http://127.0.0.1:3010';
  const timesheetUrl =
    process.env.TIMESHEET_SERVICE_URL ?? 'http://127.0.0.1:3020';
  const leaveUrl =
    process.env.LEAVE_SERVICE_URL ?? 'http://127.0.0.1:3030';

  // Register proxies before Nest route handling for reliable catch-all forwarding.
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

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  new Logger('Gateway').log(`API gateway listening on ${port}`);
}
void bootstrap();
