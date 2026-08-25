"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  createCheckout,
  listPayments,
  paymentsQueryKey,
  type Payment,
} from "@/lib/api/payments.api";
import { ApiError } from "@/lib/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { useState } from "react";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function statusLabel(status: Payment["status"]) {
  if (status === "paid") {
    return "Paid";
  }
  if (status === "failed") {
    return "Failed";
  }
  if (status === "canceled") {
    return "Canceled";
  }
  return "Pending webhook";
}

export function BillingPanel() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const paymentsQuery = useQuery({
    queryKey: paymentsQueryKey,
    queryFn: listPayments,
  });

  const checkoutMutation = useMutation({
    mutationFn: createCheckout,
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not start Stripe Checkout",
      );
    },
  });

  const payments = paymentsQuery.data ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Local Stripe Checkout. Paid status is set only after the webhook
          runs.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="break-words [overflow-wrap:anywhere]">
            {error}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-xl border bg-card p-4">
        <p className="font-medium">Tracko local test payment</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Server-priced $10.00 USD test charge. Use card{" "}
          <span className="font-mono">4242 4242 4242 4242</span>, any future
          expiry, any CVC.
        </p>
        <Button
          className="mt-4"
          disabled={checkoutMutation.isPending}
          onClick={() => {
            setError(null);
            checkoutMutation.mutate();
          }}
        >
          <CreditCard className="size-4" />
          {checkoutMutation.isPending ? "Redirecting…" : "Pay with Stripe"}
        </Button>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border">
        <div className="border-b px-4 py-3 text-sm font-medium">
          Your payments
        </div>
        {paymentsQuery.isLoading ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No payments yet.
          </p>
        ) : (
          <ul className="divide-y">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex min-w-0 items-start justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="break-words [overflow-wrap:anywhere] font-medium">
                    {payment.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(payment.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p>{formatMoney(payment.amountCents, payment.currency)}</p>
                  <p
                    className={
                      payment.status === "paid"
                        ? "text-xs text-emerald-600"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {statusLabel(payment.status)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="w-full border-t px-4 py-2 text-left text-xs text-muted-foreground hover:bg-muted"
          onClick={() =>
            void queryClient.invalidateQueries({ queryKey: paymentsQueryKey })
          }
        >
          Refresh status
        </button>
      </div>
    </div>
  );
}
