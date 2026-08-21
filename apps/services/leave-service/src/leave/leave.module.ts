import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { LeaveController } from './leave.controller';
import { LeaveRepository } from './leave.repository';
import { LeaveService } from './leave.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [LeaveController],
  providers: [LeaveService, LeaveRepository],
  exports: [LeaveService],
})
export class LeaveModule {}
