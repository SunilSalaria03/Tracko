import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { Payment, PaymentStatus } from './payment.types';

type PaymentRow = {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: Date;
  paid_at: Date | null;
};

@Injectable()
export class PaymentsRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: {
    userId: string;
    amountCents: number;
    currency: string;
    description: string;
  }): Promise<Payment> {
    const result = await this.database.query<PaymentRow>(
      `
        INSERT INTO payments (user_id, amount_cents, currency, description)
        VALUES ($1, $2, $3, $4)
        RETURNING
          id, user_id, amount_cents, currency, status, description,
          stripe_checkout_session_id, stripe_payment_intent_id, created_at, paid_at
      `,
      [input.userId, input.amountCents, input.currency, input.description],
    );

    return this.toPayment(result.rows[0]);
  }

  async listForUser(userId: string): Promise<Payment[]> {
    const result = await this.database.query<PaymentRow>(
      `
        SELECT
          id, user_id, amount_cents, currency, status, description,
          stripe_checkout_session_id, stripe_payment_intent_id, created_at, paid_at
        FROM payments
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [userId],
    );

    return result.rows.map((row) => this.toPayment(row));
  }

  async findByIdForUser(id: string, userId: string): Promise<Payment | null> {
    const result = await this.database.query<PaymentRow>(
      `
        SELECT
          id, user_id, amount_cents, currency, status, description,
          stripe_checkout_session_id, stripe_payment_intent_id, created_at, paid_at
        FROM payments
        WHERE id = $1 AND user_id = $2
      `,
      [id, userId],
    );

    const row = result.rows[0];
    return row ? this.toPayment(row) : null;
  }

  async findByPaymentIntentId(paymentIntentId: string): Promise<Payment | null> {
    const result = await this.database.query<PaymentRow>(
      `
        SELECT
          id, user_id, amount_cents, currency, status, description,
          stripe_checkout_session_id, stripe_payment_intent_id, created_at, paid_at
        FROM payments
        WHERE stripe_payment_intent_id = $1
        LIMIT 1
      `,
      [paymentIntentId],
    );

    const row = result.rows[0];
    return row ? this.toPayment(row) : null;
  }

  async findBySessionId(sessionId: string): Promise<Payment | null> {
    const result = await this.database.query<PaymentRow>(
      `
        SELECT
          id, user_id, amount_cents, currency, status, description,
          stripe_checkout_session_id, stripe_payment_intent_id, created_at, paid_at
        FROM payments
        WHERE stripe_checkout_session_id = $1
      `,
      [sessionId],
    );

    const row = result.rows[0];
    return row ? this.toPayment(row) : null;
  }

  async attachCheckoutSession(
    id: string,
    sessionId: string,
  ): Promise<Payment | null> {
    const result = await this.database.query<PaymentRow>(
      `
        UPDATE payments
        SET stripe_checkout_session_id = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING
          id, user_id, amount_cents, currency, status, description,
          stripe_checkout_session_id, stripe_payment_intent_id, created_at, paid_at
      `,
      [id, sessionId],
    );

    const row = result.rows[0];
    return row ? this.toPayment(row) : null;
  }

  async markStatus(input: {
    id: string;
    status: PaymentStatus;
    paymentIntentId?: string | null;
    paidAt?: Date | null;
  }): Promise<Payment | null> {
    const result = await this.database.query<PaymentRow>(
      `
        UPDATE payments
        SET
          status = $2,
          stripe_payment_intent_id = COALESCE($3, stripe_payment_intent_id),
          paid_at = COALESCE($4, paid_at),
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id, user_id, amount_cents, currency, status, description,
          stripe_checkout_session_id, stripe_payment_intent_id, created_at, paid_at
      `,
      [input.id, input.status, input.paymentIntentId ?? null, input.paidAt ?? null],
    );

    const row = result.rows[0];
    return row ? this.toPayment(row) : null;
  }

  async tryRecordStripeEvent(eventId: string, type: string): Promise<boolean> {
    const result = await this.database.query(
      `
        INSERT INTO stripe_events (id, type)
        VALUES ($1, $2)
        ON CONFLICT (id) DO NOTHING
      `,
      [eventId, type],
    );

    return (result.rowCount ?? 0) > 0;
  }

  private toPayment(row: PaymentRow): Payment {
    return {
      id: row.id,
      userId: row.user_id,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      status: row.status,
      description: row.description,
      stripeCheckoutSessionId: row.stripe_checkout_session_id,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      createdAt: row.created_at.toISOString(),
      paidAt: row.paid_at ? row.paid_at.toISOString() : null,
    };
  }
}
