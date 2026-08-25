import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Payment canceled</h1>
      <p className="text-sm text-muted-foreground">
        Checkout was closed before paying. You can try again anytime.
      </p>
      <Button asChild>
        <Link href="/billing">Back to billing</Link>
      </Button>
    </div>
  );
}
