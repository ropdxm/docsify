import Link from "next/link";
import { requireCompany } from "@/lib/dal";
import { getSubscription, isPaidPro } from "@/lib/subscription";
import { PRO_PRICE_KZT, PRO_PERIOD_DAYS } from "@/lib/apipay";
import { formatTenge } from "@/lib/format";
import { BrandLogo } from "@/components/brand-logo";
import { AppFooter } from "@/components/app-footer";
import { KaspiPayFlow } from "@/components/kaspi-pay-flow";

// Focused, single-purpose checkout for Docsify Pro via Kaspi. Reached from the
// "Подключить / Продлить Pro" button on /pricing.
export default async function KaspiPayPage() {
  const company = await requireCompany();
  const sub = await getSubscription(company.id);
  const paid = isPaidPro(sub);

  return (
    <div className="relative flex min-h-full flex-col">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 lp-aurora"
        aria-hidden
      />

      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link
            href="/dashboard"
            aria-label="Docsify"
            className="group flex items-center"
          >
            <BrandLogo className="size-8 transition-transform duration-200 group-hover:scale-105" />
          </Link>
          <Link
            href="/pricing"
            className="group inline-flex items-center gap-1.5 rounded-field px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5">
              ←
            </span>
            К тарифам
          </Link>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="lp-rise mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {paid ? "Продление Pro" : "Оформление Pro"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {paid
              ? `Продлите доступ ещё на ${PRO_PERIOD_DAYS} дней.`
              : `Один платёж — ${PRO_PERIOD_DAYS} дней полного доступа.`}
          </p>
        </div>

        <KaspiPayFlow
          priceLabel={formatTenge(PRO_PRICE_KZT)}
          periodDays={PRO_PERIOD_DAYS}
          isRenewal={paid}
        />
      </main>

      <AppFooter />
    </div>
  );
}
