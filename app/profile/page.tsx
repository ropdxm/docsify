import Link from "next/link";
import { requireCompany, getBankProfiles, type BankProfile } from "@/lib/dal";
import {
  setPrimaryBankProfileFromForm,
  deleteBankProfile,
} from "@/lib/actions/bank-profiles";
import { cn } from "@/lib/ui";
import {
  getSubscription,
  effectivePlan,
  isPaidPro,
  trialDaysLeft,
} from "@/lib/subscription";
import { AppFooter } from "@/components/app-footer";
import { SubscriptionCard } from "@/components/subscription-card";
import { SubmitButton } from "@/components/loading";
import { AddBankProfile } from "./add-bank-profile";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const company = await requireCompany();
  const [profiles, sub, sp] = await Promise.all([
    getBankProfiles(company.id),
    getSubscription(company.id),
    searchParams,
  ]);

  const plan = effectivePlan(sub);
  const paid = isPaidPro(sub);
  const daysLeft = trialDaysLeft(sub);
  const primaryProfile = profiles.find((p) => p.is_primary) ?? profiles[0];
  const otherProfiles = primaryProfile
    ? profiles.filter((p) => p.id !== primaryProfile.id)
    : [];

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-tenge" />
            <span className="font-semibold tracking-tight">docsify</span>
          </Link>
          <Link
            href="/dashboard"
            className="rounded-field px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            ← К документам
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-10">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Профиль</h1>

        {/* Company requisites */}
        <section className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">
            Ваша компания
          </h2>
          <div className="rounded-card border border-line bg-sheet p-4 shadow-soft sm:p-5">
            <div className="font-semibold">{company.name}</div>
            <dl className="mt-3 grid gap-1.5 text-sm">
              <Row label="БИН / ИИН" value={company.bin} mono />
              {company.director && (
                <Row label="Руководитель" value={company.director} />
              )}
              {company.address && <Row label="Адрес" value={company.address} />}
            </dl>
          </div>
        </section>

        {/* Subscription */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">
            Подписка
          </h2>
          <SubscriptionCard
            plan={plan}
            isPaid={paid}
            trialDaysLeft={daysLeft}
            periodEndIso={sub?.current_period_end ?? null}
            cancelAtPeriodEnd={sub?.cancel_at_period_end ?? false}
            justUpgraded={typeof sp.upgraded === "string"}
            justCanceled={typeof sp.canceled === "string"}
          />
        </section>

        {/* Bank requisite profiles */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">
            Реквизиты для оплаты
          </h2>
          <p className="mb-4 text-sm text-muted">
            Эти реквизиты печатаются в счёте. Основной профиль подставляется в
            новые документы автоматически - при создании счёта его можно
            поменять.
          </p>

          {profiles.length === 0 && (
            <p className="mb-4 rounded-card border border-late/25 bg-late-tint/40 px-4 py-3 text-sm text-late-ink">
              Реквизиты не заполнены - в счетах не будет блока для оплаты.
              Добавьте хотя бы один профиль.
            </p>
          )}

          {primaryProfile && (
            <div className="space-y-3">
              <form
                action={setPrimaryBankProfileFromForm}
                className="rounded-card border border-line bg-sheet p-4 shadow-soft sm:p-5"
              >
                <label
                  htmlFor="primary-bank-profile"
                  className="mb-1.5 block text-sm font-medium text-muted"
                >
                  Основной банковский профиль
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    id="primary-bank-profile"
                    name="bankProfileId"
                    defaultValue={primaryProfile.id}
                    disabled={profiles.length < 2}
                    className="w-full rounded-field bg-sunken px-3 py-2.5 text-sm text-ink outline-none transition-colors focus-visible:bg-sheet focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {bankProfileTitle(p)} · {p.bank_name} · {shortIik(p.iik)}
                      </option>
                    ))}
                  </select>
                  <SubmitButton
                    disabled={profiles.length < 2}
                    className="inline-flex items-center justify-center rounded-field bg-tenge px-4 py-2.5 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep disabled:cursor-not-allowed disabled:opacity-40"
                    pendingChildren="Сохраняем..."
                  >
                    Сохранить
                  </SubmitButton>
                </div>
              </form>

              <BankProfileCard
                profile={primaryProfile}
                title="Основные реквизиты"
                deletable={profiles.length > 1}
                accent
              />
            </div>
          )}


          <div className="mt-4">
            <AddBankProfile />
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}

function BankProfileCard({
  profile: p,
  title,
  deletable,
  accent,
}: {
  profile: BankProfile;
  title?: string;
  deletable: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-card border bg-sheet p-4 shadow-soft sm:p-5",
        accent ? "border-tenge/35" : "border-line"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{title ?? bankProfileTitle(p)}</span>
            {accent && (
              <span className="inline-flex items-center rounded-pill bg-tenge-tint px-2 py-0.5 text-xs font-medium text-tenge-ink">
                Основной
              </span>
            )}
          </div>
          {title && (
            <p className="mt-1 text-sm font-medium text-ink">
              {bankProfileTitle(p)}
            </p>
          )}
        </div>
        {!accent && (
          <span className="inline-flex items-center rounded-pill bg-sunken px-2 py-0.5 text-xs font-medium text-muted">
            Не основной
          </span>
        )}
      </div>

      <dl className="mt-3 grid gap-1.5 text-sm">
        <Row label="ИИК" value={p.iik} mono />
        <Row label="Банк" value={p.bank_name} />
        <Row label="БИК" value={p.bik} mono />
        <Row label="Кбе" value={p.kbe} mono />
        {p.knp && <Row label="КНП" value={p.knp} mono />}
      </dl>

      {deletable && (
        <div className="mt-4 flex items-center gap-2 border-t border-line-soft pt-3 text-sm">
          <form action={deleteBankProfile.bind(null, p.id)}>
            <SubmitButton className="rounded-field px-2.5 py-1.5 text-muted transition-colors hover:bg-danger-tint hover:text-danger">
              Удалить
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}

function bankProfileTitle(p: BankProfile): string {
  return p.label || p.bank_name;
}

function shortIik(iik: string): string {
  return `...${iik.slice(-4)}`;
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-faint">{label}</dt>
      <dd className={cn("text-ink", mono && "font-mono tracking-wide")}>
        {value}
      </dd>
    </div>
  );
}
