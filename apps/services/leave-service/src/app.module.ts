import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { LeaveModule } from './leave/leave.module';
import { UsersModule } from './users/users.module';

/** Leave microservice — balances, requests, approvals. Port 3030. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    LeaveModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
