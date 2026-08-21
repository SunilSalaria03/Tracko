import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';

/**
 * API Gateway (port 3001).
 * HTTP proxies are registered in main.ts:
 * - /api/auth → auth-service :3010
 * - /api/projects|/api/tasks|/api/timesheet → timesheet-service :3020
 * - /api/leave → leave-service :3030
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
