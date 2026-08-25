export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'canceled';

export type Payment = {
  id: string;
  userId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
  paidAt: string | null;
};
