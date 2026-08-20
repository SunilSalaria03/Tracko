import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { MastersModule } from './masters/masters.module';
import { TimesheetsModule } from './timesheets/timesheets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    MastersModule,
    TimesheetsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
