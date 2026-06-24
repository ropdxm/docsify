"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startKaspiCheckout,
  getKaspiInvoiceStatus,
  getProPeriodEnd,
} from "@/lib/actions/kaspi";
import { useGlobalPending } from "@/components/loading";
import { formatDateRu } from "@/lib/format";
import { cn } from "@/lib/ui";

// The full Kaspi POS payment flow as a self-contained step machine:
//   form  -> enter the Kaspi phone, create the invoice
//   wait  -> poll while the customer confirms the charge in the Kaspi app
//   done  -> Pro granted; offer the dashboard
//   fail  -> invoice cancelled/expired/errored; offer a retry
// The server actions do all the real work; this component is purely the UX.

type Step = "form" | "waiting" | "success" | "failed";

const TERMINAL_FAIL: Record<string, string> = {
  expired: "Срок счёта истёк. Попробуйте ещё раз.",
  cancelled: "Оплата отменена в приложении Kaspi.",
  error: "Не удалось провести оплату. Попробуйте ещё раз.",
};

const btnPrimary =
  "inline-flex w-full items-center justify-center gap-2 rounded-field bg-tenge px-5 py-3 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press disabled:cursor-not-allowed disabled:opacity-50";

export function KaspiPayFlow({
  priceLabel,
  periodDays,
  isRenewal,
}: {
  priceLabel: string;
  periodDays: number;
  isRenewal: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useGlobalPending(pending);

  const [step, setStep] = useState<Step>("form");
  const [phone, setPhone] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidUntil, setPaidUntil] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("phone", phone);
    startTransition(async () => {
      const res = await startKaspiCheckout(undefined, fd);
      if (res?.ok) {
        setOrderId(res.orderId);
        setStep("waiting");
      } else {
        setError(res?.error ?? "Не удалось открыть оплату.");
      }
    });
  }

  // Poll while the customer confirms the charge in Kaspi. setState here lives in
  // an async callback (not synchronously in the effect body), so it's safe.
  useEffect(() => {
    if (step !== "waiting" || !orderId) return;
    let active = true;
    const id = setInterval(async () => {
      const status = await getKaspiInvoiceStatus(orderId);
      if (!active) return;
      if (status === "paid") {
        clearInterval(id);
        const until = await getProPeriodEnd();
        if (!active) return;
        setPaidUntil(until);
        setStep("success");
        router.refresh(); // let server components pick up the new Pro state
      } else if (status && status in TERMINAL_FAIL) {
        clearInterval(id);
        setError(TERMINAL_FAIL[status]);
        setStep("failed");
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [step, orderId, router]);

  return (
    // key={step} replays the lp-rise entrance on every transition.
    <Shell key={step} center={step !== "form"}>
      {step === "form" && (
        <>
          <div className="flex items-center gap-2.5">
            <KaspiMark className="h-9 rounded-lg px-2.5 text-sm" />
            <div>
              <p className="text-sm font-semibold text-ink">Оплата через Kaspi</p>
              <p className="text-xs text-faint">
                Безопасно, прямо в приложении Kaspi
              </p>
            </div>
          </div>

          <div className="my-5 h-px bg-line" />

          <PlanSummary priceLabel={priceLabel} periodDays={periodDays} />

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="kaspi-phone"
                className="mb-1.5 block text-sm font-medium text-ink"
              >
                Номер Kaspi
              </label>
              <input
                id="kaspi-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (700) 000-00-00"
                required
                className="w-full rounded-field border border-line bg-sunken px-4 py-3 text-base text-ink placeholder:text-ghost focus:border-tenge focus:outline-none focus:ring-4 focus:ring-ring/30"
              />
              <p className="mt-1.5 text-xs text-faint">
                Счёт придёт в приложение Kaspi на этот номер.
              </p>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button type="submit" disabled={pending} className={btnPrimary}>
              {pending ? "Создаём счёт…" : `Оплатить ${priceLabel}`}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-faint">
            Мы не видим и не храним данные вашей карты.
          </p>
        </>
      )}

      {step === "waiting" && (
        <>
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-2xl bg-[#F14635]/25" />
            <KaspiMark className="relative h-20 w-20 rounded-2xl text-base" />
          </div>

          <h2 className="mt-6 text-lg font-semibold text-ink">
            Подтвердите оплату в Kaspi
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
            Откройте приложение <span className="font-medium text-ink">Kaspi</span>{" "}
            — мы отправили счёт на <span className="font-medium text-ink">{priceLabel}</span>.
            Доступ откроется здесь автоматически.
          </p>

          <div className="mt-6 flex justify-center">
            <div className="loader" aria-label="Ожидаем оплату" />
          </div>
          <p className="mt-4 text-sm text-faint">Ожидаем оплату…</p>

          <button
            type="button"
            onClick={() => setStep("form")}
            className="mt-6 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Отменить
          </button>
        </>
      )}

      {step === "success" && (
        <>
          <div className="kp-pop mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-paid-tint">
            <CheckIcon className="h-10 w-10 text-paid" />
          </div>
          <h2 className="mt-6 text-xl font-bold text-ink">Оплата прошла!</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
            {isRenewal ? "Подписка продлена. " : "Docsify Pro активирован. "}
            {paidUntil ? (
              <>
                Доступ открыт до{" "}
                <span className="font-medium text-ink">
                  {formatDateRu(new Date(paidUntil))}
                </span>
                .
              </>
            ) : (
              <>Доступ открыт на {periodDays} дней.</>
            )}
          </p>
          <Link href="/dashboard" className={cn(btnPrimary, "mt-6")}>
            Перейти в дашборд
          </Link>
          <Link
            href="/pricing"
            className="mt-3 block text-sm text-muted hover:text-ink"
          >
            К тарифам
          </Link>
        </>
      )}

      {step === "failed" && (
        <>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-late-tint">
            <BangIcon className="h-8 w-8 text-late" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-ink">
            Оплата не завершена
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOrderId(null);
              setStep("form");
            }}
            className={cn(btnPrimary, "mt-6")}
          >
            Попробовать снова
          </button>
          <Link
            href="/pricing"
            className="mt-3 block text-sm text-muted hover:text-ink"
          >
            К тарифам
          </Link>
        </>
      )}
    </Shell>
  );
}

function Shell({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div
      className={cn(
        "lp-rise w-full rounded-sheet border border-line bg-sheet p-6 shadow-sheet sm:p-8",
        center && "text-center"
      )}
    >
      {children}
    </div>
  );
}

function PlanSummary({
  priceLabel,
  periodDays,
}: {
  priceLabel: string;
  periodDays: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper/60 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-ink">Docsify Pro</p>
        <p className="text-xs text-faint">
          {periodDays} дней доступа · без автосписаний
        </p>
      </div>
      <p className="text-lg font-bold text-ink">{priceLabel}</p>
    </div>
  );
}

// Kaspi wordmark chip in the brand's signature red. Sizing comes from className.
function KaspiMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center bg-[#F14635] font-bold lowercase tracking-tight text-white",
        className
      )}
    >
      kaspi
    </span>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

function BangIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 8v5" />
      <path d="M12 16.5h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
