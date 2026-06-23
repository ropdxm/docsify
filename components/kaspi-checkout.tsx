"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startKaspiCheckout,
  getKaspiInvoiceStatus,
  type KaspiCheckoutState,
} from "@/lib/actions/kaspi";
import { useGlobalPending } from "@/components/loading";

// Kaspi (ApiPay) checkout for Docsify Pro. The user enters their Kaspi phone, we
// create an invoice, then poll until they confirm payment in the Kaspi app.
// Server styling is passed in via `className` so the pricing page owns the look.

const TERMINAL_FAIL = ["cancelled", "expired", "error"];

export function KaspiCheckout({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const [state, action, pending] = useActionState<KaspiCheckoutState, FormData>(
    startKaspiCheckout,
    undefined
  );
  useGlobalPending(pending);
  const router = useRouter();

  // `failed`/`doneOrderId` are only ever set from the async poll callback below
  // (never synchronously in an effect), so polling is derived straight from the
  // action result rather than mirrored into state.
  const [failed, setFailed] = useState<string | null>(null);
  const [doneOrderId, setDoneOrderId] = useState<string | null>(null);

  const orderId = state?.ok ? state.orderId : null;
  const polling = orderId != null && orderId !== doneOrderId;

  useEffect(() => {
    if (!polling || !orderId) return;
    let active = true;
    const id = setInterval(async () => {
      const status = await getKaspiInvoiceStatus(orderId);
      if (!active) return;
      if (status === "paid") {
        clearInterval(id);
        router.push("/pricing?upgraded=1");
        router.refresh();
      } else if (status && TERMINAL_FAIL.includes(status)) {
        clearInterval(id);
        setFailed(
          status === "expired"
            ? "Срок счёта истёк. Попробуйте ещё раз."
            : status === "cancelled"
              ? "Оплата отменена."
              : "Не удалось провести оплату. Попробуйте ещё раз."
        );
        setDoneOrderId(orderId);
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [polling, orderId, router]);

  if (polling) {
    return (
      <div className="rounded-field border border-line bg-sunken px-4 py-3 text-center text-sm text-muted">
        <span className="font-medium text-ink">Откройте Kaspi</span> и подтвердите
        оплату — статус обновится автоматически.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder="Номер Kaspi: 8XXXXXXXXXX"
        required
        className="w-full rounded-field border border-line bg-paper px-3 py-2 text-center text-sm text-ink placeholder:text-faint focus:border-tenge focus:outline-none"
      />
      <button disabled={pending} className={className}>
        {pending ? "Создаём счёт…" : label}
      </button>
      {state && !state.ok && (
        <p className="text-center text-sm text-danger">{state.error}</p>
      )}
      {failed && <p className="text-center text-sm text-danger">{failed}</p>}
    </form>
  );
}
