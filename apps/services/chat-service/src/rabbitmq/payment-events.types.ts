export const PAYMENTS_QUEUE = 'tracko_payments_paid';
export const PAYMENT_PAID_EVENT = 'payment.paid';
export type PaymentPaidPayload = {
  paymentId: string;
  userId: string;
  amountCents: number;
  currency: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  paidAt: string;
};
