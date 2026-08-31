import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { PAYMENT_PAID_EVENT } from './payment-events.types';
import type { PaymentPaidPayload } from './payment-events.types';

@Controller()
export class PaymentEventsController {
  private readonly logger = new Logger(PaymentEventsController.name);

  @EventPattern(PAYMENT_PAID_EVENT)
  handlePaymentPaid(@Payload() payload: PaymentPaidPayload): void {
    this.logger.log(
      `Received ${PAYMENT_PAID_EVENT}: payment ${payload.paymentId} for user ${payload.userId} (${payload.amountCents} ${payload.currency})`,
    );
  }
}
