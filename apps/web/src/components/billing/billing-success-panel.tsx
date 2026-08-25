"use client";

import { Button } from "@/components/ui/button";
import { getPaymentBySession, type Payment } from "@/lib/api/payments.api";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuccessBody() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";

  const paymentQuery = useQuery({
    queryKey: ["payments", "session", sessionId],
    queryFn: () => getPaymentBySession(sessionId),
    enabled: Boolean(sessionId),
    refetchInterval: (query) => {
      const payment = query.state.data as Payment | undefined;
      if (payment?.status === "paid") {
        return false;
      }
      return 1500;
    },
  });

  const payment = paymentQuery.data;

  return (
    <div className="mx-auto w-full max-w-lg min-w-0 space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Payment complete</h1>
      {!sessionId ? (
        <p className="text-sm text-muted-foreground">
          Missing Checkout session. Return to billing and try again.
        </p>
      ) : payment?.status === "paid" ? (
        <p className="text-sm text-emerald-600">
          Stripe webhook confirmed this payment. Thank you.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Stripe redirected you here. Waiting for the webhook to mark this
          payment as paid…
        </p>
      )}
      <Button asChild>
        <Link href="/billing">Back to billing</Link>
      </Button>
    </div>
  );
}

export function BillingSuccessPanel() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading payment…</p>
      }
    >
      <SuccessBody />
    </Suspense>
  );
}
