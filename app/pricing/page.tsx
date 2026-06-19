import Link from "next/link";
import { requireCompany } from "@/lib/dal";
import {
  getSubscription,
  effectivePlan,
  isPaidPro,
  trialDaysLeft,
} from "@/lib/subscription";
import { formatDateRu } from "@/lib/format";
import { cn } from "@/lib/ui";
import { AppFooter } from "@/components/app-footer";
import { BrandLogo } from "@/components/brand-logo";
import { CheckoutButton, PortalButton } from "@/components/plan-actions";

const FREE_FEATURES = [
  "Счета, акты, накладные и договоры",
  "Отправка клиенту по ссылке",
  "Отслеживание статуса оплаты",
  "Дашборд: сколько вам должны",
  "Скачивание PDF и Excel",
  "Автозаполнение по БИН из реестра КГД",
];

const PRO_FEATURES = [
  "Поддержка развития Docsify",
  "Приоритетная поддержка в чате",
  "Ранний доступ к новым возможностям",
];

const btnPrimary =
  "inline-flex w-full items-center justify-center gap-2 rounded-field bg-tenge px-5 py-2.5 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press disabled:cursor-not-allowed disabled:opacity-40";
const btnGhost =
  "inline-flex w-full items-center justify-center gap-2 rounded-field border border-line bg-sheet px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-40";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const company = await requireCompany();
  const [sub, sp] = await Promise.all([
    getSubscription(company.id),
    searchParams,
  ]);

  const plan = effectivePlan(sub);
  const paid = isPaidPro(sub);
  const onTrial = plan === "pro" && !paid;
  const daysLeft = trialDaysLeft(sub);
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end)
    : null;
  const cancelAtPeriodEnd = sub?.cancel_at_period_end ?? false;

  const justUpgraded = typeof sp.upgraded === "string";
  const justCanceled = typeof sp.canceled === "string";

  const proStatus = paid
    ? cancelAtPeriodEnd && periodEnd
      ? `Активна до ${formatDateRu(periodEnd)}, продление отключено.`
      : periodEnd
        ? `Активна. Следующее списание ${formatDateRu(periodEnd)}.`
        : "Активна."
    : onTrial
      ? `Бесплатный пробный Pro - осталось ${daysLeft} ${plural(daysLeft)}.`
      : null;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/dashboard" aria-label="Docsify" className="group flex items-center">
            <BrandLogo className="size-8 transition-transform duration-200 group-hover:scale-105" />
          </Link>
          <Link
            href="/profile"
            className="group inline-flex items-center gap-1.5 rounded-field px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5">
              ←
            </span>
            В профиль
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:py-14">
        <div className="lp-rise text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Тарифы Docsify
          </h1>
          <p className="mx-auto mt-3 max-w-md text-pretty text-muted">
            Простая цена, без сюрпризов. Отменить можно в любой момент.
          </p>
        </div>

        {justUpgraded && (
          <p className="lp-rise mx-auto mt-6 max-w-md rounded-card border border-tenge/25 bg-tenge-tint/60 px-4 py-3 text-center text-sm text-tenge-ink">
            Подписка Pro оформлена. Спасибо за поддержку!
          </p>
        )}
        {justCanceled && (
          <p className="lp-rise mx-auto mt-6 max-w-md rounded-card border border-line bg-sunken px-4 py-3 text-center text-sm text-muted">
            Оплата отменена - вы остались на текущем плане.
          </p>
        )}

        <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:mt-10 sm:grid-cols-2">
          {/* Free */}
          <PlanCard
            name="Free"
            price="0 ₸"
            period="навсегда"
            tagline="Всё необходимое, чтобы выставлять счета и получать оплату."
            features={FREE_FEATURES}
            current={plan === "free"}
            delay={60}
          >
            {plan === "free" ? (
              <div className="inline-flex w-full items-center justify-center rounded-field border border-line bg-sunken px-5 py-2.5 text-sm font-medium text-muted">
                Текущий план
              </div>
            ) : (
              <p className="text-center text-xs text-faint">
                Доступен после отмены Pro
              </p>
            )}
          </PlanCard>

          {/* Pro */}
          <PlanCard
            name="Pro"
            price="$5"
            period="в месяц"
            tagline="Поддержите развитие и получите новые возможности первыми."
            features={PRO_FEATURES}
            featuresPrefix="Всё из Free, плюс:"
            highlighted
            current={plan === "pro"}
            delay={120}
          >
            {proStatus && (
              <p className="mb-3 text-center text-xs text-muted">{proStatus}</p>
            )}
            {paid ? (
              <PortalButton className={btnGhost} />
            ) : (
              <CheckoutButton
                className={btnPrimary}
                label={onTrial ? "Подключить Pro" : "Подключить Pro - $5/мес"}
              />
            )}
          </PlanCard>
        </div>

        <p className="mx-auto mt-8 max-w-md text-center text-xs text-faint">
          Оплата картой через Stripe. Цена указана без НДС. Вопросы по тарифам -
          напишите нам, поможем.
        </p>
      </main>

      <AppFooter />
    </div>
  );
}

function PlanCard({
  name,
  price,
  period,
  tagline,
  features,
  featuresPrefix,
  highlighted,
  current,
  delay,
  children,
}: {
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  featuresPrefix?: string;
  highlighted?: boolean;
  current?: boolean;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="lp-rise flex"
      style={{ animationDelay: `${delay ?? 0}ms` }}
    >
      <div
        className={cn(
          "relative flex w-full flex-col rounded-sheet bg-sheet p-6 shadow-soft transition-shadow duration-200 hover:shadow-sheet sm:p-7",
          highlighted ? "border-2 border-tenge" : "border border-line"
        )}
      >
        {highlighted && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill bg-tenge px-3 py-1 text-xs font-semibold text-on-tenge shadow-soft">
            Популярный
          </span>
        )}

        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Docsify {name}</h2>
          {current && (
            <span className="inline-flex items-center rounded-pill bg-tenge-tint px-2 py-0.5 text-xs font-medium text-tenge-ink">
              Ваш план
            </span>
          )}
        </div>

        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tracking-tight">{price}</span>
          <span className="text-sm text-faint">{period}</span>
        </div>

        <p className="mt-3 text-sm text-muted">{tagline}</p>

        <div className="mt-6">{children}</div>

        <ul className="mt-6 space-y-2.5 border-t border-line-soft pt-5 text-sm">
          {featuresPrefix && (
            <li className="mb-1 text-xs font-semibold uppercase tracking-wider text-faint">
              {featuresPrefix}
            </li>
          )}
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <IconCheck
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  highlighted ? "text-tenge" : "text-tenge-ink/70"
                )}
              />
              <span className="text-ink">{f}</span>
            </li>
          ))}
        </ul>
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

function IconCheck({ className }: { className?: string }) {
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
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}
