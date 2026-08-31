export type PaymentPaidPayload = {
  paymentId: string;
  userId: string;
  amountCents: number;
  currency: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  paidAt: string;
};
