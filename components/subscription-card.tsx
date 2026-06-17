"use client";

import { useActionState } from "react";
import {
  startProCheckout,
  openBillingPortal,
  type BillingState,
} from "@/lib/actions/subscription";
import { useGlobalPending } from "@/components/loading";
import { formatDateRu } from "@/lib/format";
import { btnPrimary, btnGhost, cn } from "@/lib/ui";

export function SubscriptionCard({
  plan,
  isPaid,
  trialDaysLeft,
  periodEndIso,
  cancelAtPeriodEnd,
  justUpgraded,
  justCanceled,
}: {
  plan: "pro" | "free";
  isPaid: boolean;
  trialDaysLeft: number;
  periodEndIso: string | null;
  cancelAtPeriodEnd: boolean;
  justUpgraded?: boolean;
  justCanceled?: boolean;
}) {
  const isPro = plan === "pro";
  const onTrial = isPro && !isPaid;
  const periodEnd = periodEndIso ? new Date(periodEndIso) : null;

  return (
    <div
      className={cn(
        "rounded-card border bg-sheet p-5 shadow-soft sm:p-6",
        isPro ? "border-tenge/35" : "border-line"
      )}
    >
      {justUpgraded && (
        <p className="mb-4 rounded-card border border-tenge/25 bg-tenge-tint/60 px-4 py-3 text-sm text-tenge-ink">
          Подписка Pro оформлена. Спасибо!
        </p>
      )}
      {justCanceled && (
        <p className="mb-4 rounded-card border border-line bg-sunken px-4 py-3 text-sm text-muted">
          Оплата отменена - вы остались на текущем плане.
        </p>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">docsify {isPro ? "Pro" : "Free"}</span>
            <PlanBadge isPro={isPro} />
          </div>
          <p className="mt-1.5 text-sm text-muted">
            {isPaid
              ? cancelAtPeriodEnd && periodEnd
                ? `Pro активна до ${formatDateRu(periodEnd)}, продление отключено.`
                : periodEnd
                  ? `Pro активна. Следующее списание ${formatDateRu(periodEnd)}.`
                  : "Pro активна."
              : onTrial
                ? `Бесплатный Pro на 1 месяц - осталось ${trialDaysLeft} ${plural(trialDaysLeft)}.`
                : "Базовый план. Подключите Pro, чтобы поддержать развитие docsify."}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold tracking-tight">$5</div>
          <div className="text-xs text-faint">в месяц</div>
        </div>
      </div>

      <div className="mt-5">
        {isPaid ? <PortalButton /> : <CheckoutButton trial={onTrial} />}
      </div>
    </div>
  );
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
}

function PlanBadge({ isPro }: { isPro: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium",
        isPro ? "bg-tenge-tint text-tenge-ink" : "border border-line bg-paper text-muted"
      )}
    >
      {isPro ? "Активен" : "Free"}
    </span>
  );
}

function CheckoutButton({ trial }: { trial: boolean }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(
    startProCheckout,
    undefined
  );
  useGlobalPending(pending);
  return (
    <form action={action}>
      <button disabled={pending} className={cn(btnPrimary)}>
        {pending
          ? "Открываем оплату…"
          : trial
            ? "Подключить Pro - $5/мес"
            : "Перейти на Pro - $5/мес"}
      </button>
      {state?.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}
    </form>
  );
}

function PortalButton() {
  const [state, action, pending] = useActionState<BillingState, FormData>(
    openBillingPortal,
    undefined
  );
  useGlobalPending(pending);
  return (
    <form action={action}>
      <button disabled={pending} className={cn(btnGhost)}>
        {pending ? "Открываем…" : "Управлять подпиской"}
      </button>
      {state?.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
