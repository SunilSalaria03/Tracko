import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  PAYMENTS_CLIENT,
  PAYMENT_PAID_EVENT,
} from './rabbitmq.constants';
import type { PaymentPaidPayload } from './payment-events.types';

@Injectable()
export class PaymentEventsPublisher {
  private readonly logger = new Logger(PaymentEventsPublisher.name);
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(PAYMENTS_CLIENT) private readonly client?: ClientProxy,
  ) {
    this.enabled = config.get<string>('RABBITMQ_ENABLED') === 'true';
  }

  async publishPaid(payload: PaymentPaidPayload): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      await firstValueFrom(
        this.client.emit(PAYMENT_PAID_EVENT, payload).pipe(timeout(5000)),
      );
      this.logger.log(
        `Published ${PAYMENT_PAID_EVENT} for payment ${payload.paymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `RabbitMQ publish failed for payment ${payload.paymentId}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }
}
