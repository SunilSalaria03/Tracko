import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PaymentsController, StripeWebhookController],
  providers: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule {}
