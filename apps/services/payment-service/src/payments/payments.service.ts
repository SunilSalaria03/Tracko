import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { PublicUser } from '../users/user.types';
import { PaymentEventsPublisher } from '../rabbitmq/payment-events.publisher';
import type { Payment } from './payment.types';
import { PaymentsRepository } from './payments.repository';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly frontendOrigin: string;
  private readonly amountCents: number;
  private readonly currency: string;
  private readonly productName: string;

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly paymentEventsPublisher: PaymentEventsPublisher,
    config: ConfigService,
  ) {
    this.secretKey = config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    this.frontendOrigin =
      config.get<string>('FRONTEND_ORIGIN') ?? 'http://localhost:3000';
    this.amountCents = Number(config.get<string>('PAYMENT_AMOUNT_CENTS') ?? '1000');
    this.currency = (config.get<string>('PAYMENT_CURRENCY') ?? 'usd').toLowerCase();
    this.productName =
      config.get<string>('PAYMENT_PRODUCT_NAME') ?? 'Tracko local test payment';

    this.stripe = new Stripe(this.secretKey || 'sk_test_placeholder', {
      typescript: true,
    });
  }

  private assertStripeConfigured(): void {
    const key = this.secretKey.trim();
    if (!key.startsWith('sk_test_') && !key.startsWith('sk_live_')) {
      throw new ServiceUnavailableException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY in payment-service .env',
      );
    }
    if (key.includes('replace_me') || key.length < 20) {
      throw new ServiceUnavailableException(
        'Replace STRIPE_SECRET_KEY with a real test key from https://dashboard.stripe.com/test/apikeys',
      );
    }
  }

  listMine(user: PublicUser): Promise<Payment[]> {
    return this.paymentsRepository.listForUser(user.id);
  }

  async getMine(id: string, user: PublicUser): Promise<Payment> {
    const payment = await this.paymentsRepository.findByIdForUser(id, user.id);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async getBySession(sessionId: string, user: PublicUser): Promise<Payment> {
    const payment = await this.paymentsRepository.findBySessionId(sessionId);
    if (!payment || payment.userId !== user.id) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async createCheckout(
    user: PublicUser,
  ): Promise<{ url: string; payment: Payment }> {
    this.assertStripeConfigured();

    const payment = await this.paymentsRepository.create({
      userId: user.id,
      amountCents: this.amountCents,
      currency: this.currency,
      description: this.productName,
    });

    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: user.id,
        customer_email: user.email,
        success_url: `${this.frontendOrigin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.frontendOrigin}/billing/cancel`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: this.currency,
              unit_amount: this.amountCents,
              product_data: {
                name: this.productName,
              },
            },
          },
        ],
        metadata: {
          paymentId: payment.id,
          userId: user.id,
        },
      });
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'Stripe checkout failed',
      );
      if (error instanceof Stripe.errors.StripeAuthenticationError) {
        throw new ServiceUnavailableException(
          'Invalid STRIPE_SECRET_KEY. Use a real sk_test_ key from the Stripe Dashboard.',
        );
      }
      throw new ServiceUnavailableException(
        'Stripe Checkout failed. Check payment-service logs and your Stripe test keys.',
      );
    }

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }

    const updated = await this.paymentsRepository.attachCheckoutSession(
      payment.id,
      session.id,
    );

    return { url: session.url, payment: updated ?? payment };
  }

  async handleWebhook(
    signature: string | undefined,
    rawBody: Buffer | undefined,
  ) {
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException('STRIPE_WEBHOOK_SECRET is not set');
    }
    if (!signature || !rawBody) {
      throw new BadRequestException('Missing Stripe signature or body');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (error) {
      this.logger.warn(
        `Webhook signature failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      throw new BadRequestException('Invalid Stripe signature');
    }

    const isNew = await this.paymentsRepository.tryRecordStripeEvent(
      event.id,
      event.type,
    );
    if (!isNew) {
      return { received: true, duplicate: true };
    }

    await this.applyEvent(event);
    return { received: true };
  }

  private async applyEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        await this.completeFromSession(event.data.object);
        break;
      }
      case 'checkout.session.async_payment_failed': {
        await this.failFromSession(event.data.object, 'failed');
        break;
      }
      case 'checkout.session.expired': {
        await this.failFromSession(event.data.object, 'canceled');
        break;
      }
      case 'payment_intent.payment_failed': {
        await this.failFromPaymentIntent(event.data.object.id);
        break;
      }
      default:
        this.logger.debug(`Ignored Stripe event ${event.type}`);
    }
  }

  private async completeFromSession(session: Stripe.Checkout.Session) {
    const paymentId = session.metadata?.paymentId;
    if (!paymentId) {
      this.logger.warn('checkout.session.completed missing paymentId metadata');
      return;
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    const paidAt = new Date();
    const payment = await this.paymentsRepository.markStatus({
      id: paymentId,
      status: 'paid',
      paymentIntentId,
      paidAt,
    });

    if (payment) {
      await this.paymentEventsPublisher.publishPaid({
        paymentId: payment.id,
        userId: payment.userId,
        amountCents: payment.amountCents,
        currency: payment.currency,
        stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        paidAt: payment.paidAt ?? paidAt.toISOString(),
      });
    }
  }

  private async failFromSession(
    session: Stripe.Checkout.Session,
    status: 'failed' | 'canceled',
  ) {
    const paymentId = session.metadata?.paymentId;
    if (!paymentId) {
      return;
    }

    await this.paymentsRepository.markStatus({
      id: paymentId,
      status,
    });
  }

  private async failFromPaymentIntent(paymentIntentId: string) {
    const payment =
      await this.paymentsRepository.findByPaymentIntentId(paymentIntentId);
    if (!payment || payment.status === 'paid') {
      return;
    }

    await this.paymentsRepository.markStatus({
      id: payment.id,
      status: 'failed',
      paymentIntentId,
    });
  }
}
