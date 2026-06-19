"use client";

import { useActionState } from "react";
import {
  startProCheckout,
  openBillingPortal,
  type BillingState,
} from "@/lib/actions/subscription";
import { useGlobalPending } from "@/components/loading";

// The Pro checkout and billing-portal buttons, split out so server components
// (the pricing page) can render them with their own styling. The action state
// surfaces Stripe errors inline; success ends in a redirect.

export function CheckoutButton({
  label,
  pendingLabel = "Открываем оплату…",
  className,
}: {
  label: string;
  pendingLabel?: string;
  className?: string;
}) {
  const [state, action, pending] = useActionState<BillingState, FormData>(
    startProCheckout,
    undefined
  );
  useGlobalPending(pending);
  return (
    <form action={action}>
      <button disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </button>
      {state?.error && (
        <p className="mt-2 text-center text-sm text-danger">{state.error}</p>
      )}
    </form>
  );
}

export function PortalButton({
  label = "Управлять подпиской",
  pendingLabel = "Открываем…",
  className,
}: {
  label?: string;
  pendingLabel?: string;
  className?: string;
}) {
  const [state, action, pending] = useActionState<BillingState, FormData>(
    openBillingPortal,
    undefined
  );
  useGlobalPending(pending);
  return (
    <form action={action}>
      <button disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </button>
      {state?.error && (
        <p className="mt-2 text-center text-sm text-danger">{state.error}</p>
      )}
    </form>
  );
}
