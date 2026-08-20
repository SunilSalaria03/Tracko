import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsRepository } from './timesheets.repository';
import { TimesheetsService } from './timesheets.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TimesheetsController],
  providers: [TimesheetsRepository, TimesheetsService],
})
export class TimesheetsModule {}
