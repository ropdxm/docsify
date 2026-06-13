import Link from "next/link";
import { requireCompany, getBankProfiles, type BankProfile } from "@/lib/dal";
import {
  setPrimaryBankProfile,
  deleteBankProfile,
} from "@/lib/actions/bank-profiles";
import { cn } from "@/lib/ui";
import { AddBankProfile } from "./add-bank-profile";

export default async function ProfilePage() {
  const company = await requireCompany();
  const profiles = await getBankProfiles(company.id);

  return (
    <div className="min-h-full">
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

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
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

        {/* Bank requisite profiles */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">
            Реквизиты для оплаты
          </h2>
          <p className="mb-4 text-sm text-muted">
            Эти реквизиты печатаются в счёте. Основной профиль подставляется в
            новые документы автоматически — при создании счёта его можно
            поменять.
          </p>

          {profiles.length === 0 && (
            <p className="mb-4 rounded-card border border-late/25 bg-late-tint/40 px-4 py-3 text-sm text-late-ink">
              Реквизиты не заполнены — в счетах не будет блока для оплаты.
              Добавьте хотя бы один профиль.
            </p>
          )}

          <div className="space-y-3">
            {profiles.map((p) => (
              <BankProfileCard
                key={p.id}
                profile={p}
                deletable={profiles.length > 1}
              />
            ))}
          </div>

          <div className="mt-4">
            <AddBankProfile />
          </div>
        </section>
      </main>
    </div>
  );
}

function BankProfileCard({
  profile: p,
  deletable,
}: {
  profile: BankProfile;
  deletable: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-card border bg-sheet p-4 shadow-soft sm:p-5",
        p.is_primary ? "border-tenge/35" : "border-line"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{p.label || p.bank_name}</span>
        {p.is_primary && (
          <span className="inline-flex items-center rounded-pill bg-tenge-tint px-2 py-0.5 text-xs font-medium text-tenge-ink">
            Основной
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

      {(!p.is_primary || deletable) && (
        <div className="mt-4 flex items-center gap-2 border-t border-line-soft pt-3 text-sm">
          {!p.is_primary && (
            <form action={setPrimaryBankProfile.bind(null, p.id)}>
              <button className="rounded-field px-2.5 py-1.5 font-medium text-tenge-ink transition-colors hover:bg-tenge-tint">
                Сделать основным
              </button>
            </form>
          )}
          {deletable && (
            <form action={deleteBankProfile.bind(null, p.id)}>
              <button className="rounded-field px-2.5 py-1.5 text-muted transition-colors hover:bg-danger-tint hover:text-danger">
                Удалить
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
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
