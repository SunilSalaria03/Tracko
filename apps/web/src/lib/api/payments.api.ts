import { apiFetch, parseJson } from "@/lib/api/client";

export type PaymentStatus = "pending" | "paid" | "failed" | "canceled";

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

export const paymentsQueryKey = ["payments"] as const;

export async function listPayments(): Promise<Payment[]> {
  const response = await apiFetch("/api/payments");
  return parseJson<Payment[]>(response);
}

export async function getPaymentBySession(
  sessionId: string,
): Promise<Payment> {
  const response = await apiFetch(
    `/api/payments/session/${encodeURIComponent(sessionId)}`,
  );
  return parseJson<Payment>(response);
}

export async function createCheckout(): Promise<{
  url: string;
  payment: Payment;
}> {
  const response = await apiFetch("/api/payments/checkout", {
    method: "POST",
  });
  return parseJson<{ url: string; payment: Payment }>(response);
}
