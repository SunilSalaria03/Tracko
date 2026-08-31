import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { MicroserviceOptions } from '@nestjs/microservices';
import { Transport } from '@nestjs/microservices';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PAYMENTS_QUEUE } from './rabbitmq/payment-events.types';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  if (process.env.RABBITMQ_ENABLED === 'true') {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [
          process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
        ],
        queue: PAYMENTS_QUEUE,
        queueOptions: { durable: true },
      },
    });
    await app.startAllMicroservices();
    // eslint-disable-next-line no-console
    console.log('RabbitMQ consumer connected');
  }

  const port = process.env.PORT ?? 3040;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Chat service listening on ${port}`);
}
void bootstrap();
