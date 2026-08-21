import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { MastersController } from './masters.controller';
import { MastersRepository } from './masters.repository';
import { MastersService } from './masters.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [MastersController],
  providers: [MastersRepository, MastersService],
})
export class MastersModule {}
