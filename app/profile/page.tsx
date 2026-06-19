import Link from "next/link";
import { requireCompany, getBankProfiles, type BankProfile } from "@/lib/dal";
import {
  setPrimaryBankProfile,
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
import { SubmitButton } from "@/components/loading";
import { BrandLogo } from "@/components/brand-logo";
import { AddBankProfile } from "./add-bank-profile";

// Subtle, warm gradient for the company monogram tile. Inline so it always uses
// the live design tokens regardless of Tailwind's gradient utility naming.
const TENGE_GRADIENT = "var(--tenge)";

export default async function ProfilePage() {
  const company = await requireCompany();
  const [profiles, sub] = await Promise.all([
    getBankProfiles(company.id),
    getSubscription(company.id),
  ]);

  const plan = effectivePlan(sub);
  const paid = isPaidPro(sub);
  const onTrial = plan === "pro" && !paid;
  const daysLeft = trialDaysLeft(sub);

  // Primary first, then the rest - so the default the client sees on every
  // invoice sits at the top of the list.
  const primaryProfile = profiles.find((p) => p.is_primary) ?? profiles[0];
  const orderedProfiles = primaryProfile
    ? [primaryProfile, ...profiles.filter((p) => p.id !== primaryProfile.id)]
    : [];

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link
            href="/dashboard"
            aria-label="Docsify"
            className="group flex items-center"
          >
            <BrandLogo className="size-8 transition-transform duration-200 group-hover:scale-105" />
          </Link>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-1.5 rounded-field px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5">
              ←
            </span>
            К документам
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-10">
        {/* Company identity - the hero. A monogram, the verified name, and the
            requisites that print on every document. */}
        <section className="lp-rise" style={{ animationDelay: "0ms" }}>
          <div className="relative overflow-hidden rounded-sheet border border-line bg-sheet p-5 shadow-sheet sm:p-7">
            <div
              className="lp-aurora pointer-events-none absolute inset-0 opacity-80"
              aria-hidden
            />
            <div className="relative flex items-start gap-4">
              <span
                className="grid size-14 shrink-0 place-items-center rounded-card text-xl font-bold text-on-tenge shadow-soft ring-1 ring-black/5 sm:size-16 sm:text-2xl"
                style={{ background: TENGE_GRADIENT }}
                aria-hidden
              >
                {companyInitials(company.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
                    {company.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-pill bg-tenge-tint px-2 py-0.5 text-xs font-medium text-tenge-ink">
                    ✓ Реестр КГД
                  </span>
                </div>
                <div className="mt-1.5 font-mono text-sm tracking-wide text-muted">
                  БИН {company.bin}
                </div>
              </div>
            </div>

            {(company.director || company.address) && (
              <dl className="relative mt-5 grid gap-4 border-t border-line-soft pt-4 sm:grid-cols-2">
                {company.director && (
                  <Field label="Руководитель" value={company.director} />
                )}
                {company.address && (
                  <Field label="Адрес" value={company.address} />
                )}
              </dl>
            )}
          </div>
        </section>

        {/* Subscription - a compact status chip; the full plans live on /pricing */}
        <section className="lp-rise mt-8" style={{ animationDelay: "80ms" }}>
          <SectionLabel>Подписка</SectionLabel>
          <Link
            href="/pricing"
            className="group flex items-center gap-3.5 rounded-card border border-tenge/30 bg-tenge-tint/30 p-3.5 transition-colors hover:border-tenge/50 hover:bg-tenge-tint/55 sm:p-4"
          >
            <span
              className="grid size-10 shrink-0 place-items-center rounded-card text-on-tenge shadow-soft"
              style={{ background: "var(--tenge)" }}
              aria-hidden
            >
              <IconSpark className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {paid ? "Docsify Pro" : "Перейти на Pro"}
                </span>
                {plan === "pro" && (
                  <span className="inline-flex items-center rounded-pill bg-tenge-tint px-2 py-0.5 text-xs font-medium text-tenge-ink">
                    {paid ? "Активна" : "Пробный"}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">
                {paid
                  ? "Управление подпиской и оплатой"
                  : onTrial
                    ? `Пробный период - осталось ${daysLeft} ${pluralDays(daysLeft)}`
                    : "$5/мес · поддержите развитие и откройте новые возможности"}
              </p>
            </div>
            <IconArrow className="size-4 shrink-0 text-faint transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </section>

        {/* Bank requisite profiles */}
        <section className="lp-rise mt-8" style={{ animationDelay: "160ms" }}>
          <SectionLabel>Реквизиты для оплаты</SectionLabel>
          <p className="mb-4 max-w-prose text-sm text-muted">
            Эти реквизиты печатаются в счёте. Профиль с меткой{" "}
            <span className="font-medium text-tenge-ink">Основной</span>{" "}
            подставляется в новые документы автоматически - при создании счёта
            его можно поменять.
          </p>

          {orderedProfiles.length === 0 ? (
            <div className="rounded-card border border-dashed border-line-strong bg-sheet/60 px-5 py-8 text-center">
              <div
                className="mx-auto grid size-11 place-items-center rounded-card bg-late-tint text-late-ink"
                aria-hidden
              >
                <IconBank className="size-5" />
              </div>
              <p className="mt-3 font-medium">Реквизиты ещё не заполнены</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                Без них в счёте не будет блока для оплаты. Добавьте хотя бы один
                профиль - это займёт минуту.
              </p>
              <div className="mt-5 flex justify-center">
                <AddBankProfile />
              </div>
            </div>
          ) : profiles.length >= 3 ? (
            /* Many profiles - a compact selector sets the default, and the rest
               collapse into expandable rows so the section stays tidy. */
            <>
              <DefaultProfileSelector
                profiles={orderedProfiles}
                primaryId={primaryProfile?.id ?? ""}
              />

              <div className="mt-3 space-y-2">
                {orderedProfiles.map((p, i) => (
                  <div
                    key={p.id}
                    className="lp-rise"
                    style={{ animationDelay: `${200 + i * 55}ms` }}
                  >
                    <CompactBankProfileRow
                      profile={p}
                      primary={p.id === primaryProfile?.id}
                      deletable={profiles.length > 1}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <AddBankProfile />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                {orderedProfiles.map((p, i) => (
                  <div
                    key={p.id}
                    className="lp-rise"
                    style={{ animationDelay: `${200 + i * 70}ms` }}
                  >
                    <BankProfileCard
                      profile={p}
                      primary={p.id === primaryProfile?.id}
                      deletable={profiles.length > 1}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <AddBankProfile />
              </div>
            </>
          )}
        </section>
      </main>

      <AppFooter />
    </div>
  );
}

function BankProfileCard({
  profile: p,
  primary,
  deletable,
}: {
  profile: BankProfile;
  primary: boolean;
  deletable: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-card border bg-sheet p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sheet sm:p-5",
        primary ? "border-tenge/40" : "border-line hover:border-line-strong"
      )}
    >
      {/* A teal spine marks the active profile at a glance. */}
      {primary && (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-tenge/70"
          aria-hidden
        />
      )}

      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-card transition-colors",
            primary ? "bg-tenge-tint text-tenge-ink" : "bg-sunken text-faint"
          )}
          aria-hidden
        >
          <IconBank className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{bankProfileTitle(p)}</span>
            {primary ? (
              <span className="inline-flex items-center rounded-pill bg-tenge-tint px-2 py-0.5 text-xs font-medium text-tenge-ink">
                Основной
              </span>
            ) : (
              <span className="inline-flex items-center rounded-pill bg-sunken px-2 py-0.5 text-xs font-medium text-muted">
                Запасной
              </span>
            )}
          </div>
          {p.label && p.bank_name && (
            <p className="mt-0.5 truncate text-sm text-muted">{p.bank_name}</p>
          )}
        </div>
      </div>

      <dl className="mt-4 grid gap-1.5 text-sm">
        <Row label="ИИК" value={p.iik} mono />
        {!(p.label && p.bank_name) && <Row label="Банк" value={p.bank_name} />}
        <Row label="БИК" value={p.bik} mono />
        <Row label="Кбе" value={p.kbe} mono />
        {p.knp && <Row label="КНП" value={p.knp} mono />}
      </dl>

      {(!primary || deletable) && (
        <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-line-soft pt-3 text-sm">
          {!primary && (
            <form action={setPrimaryBankProfile.bind(null, p.id)}>
              <SubmitButton
                className="inline-flex items-center gap-1.5 rounded-field px-2.5 py-1.5 font-medium text-tenge-ink transition-colors hover:bg-tenge-tint"
                pendingChildren="Сохраняем..."
              >
                <span aria-hidden>✓</span> Сделать основным
              </SubmitButton>
            </form>
          )}
          {deletable && (
            <form
              action={deleteBankProfile.bind(null, p.id)}
              className={cn(!primary && "ml-auto")}
            >
              <SubmitButton className="rounded-field px-2.5 py-1.5 text-muted transition-colors hover:bg-danger-tint hover:text-danger">
                Удалить
              </SubmitButton>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Default-profile picker, shown once there are 3+ profiles. A single select
 * keeps "which profile prints by default" obvious without a wall of cards.
 */
function DefaultProfileSelector({
  profiles,
  primaryId,
}: {
  profiles: BankProfile[];
  primaryId: string;
}) {
  return (
    <form
      action={setPrimaryBankProfileFromForm}
      className="rounded-card border border-tenge/35 bg-sheet p-4 shadow-soft sm:p-5"
    >
      <label
        htmlFor="primary-bank-profile"
        className="mb-1.5 block text-sm font-medium text-muted"
      >
        Основной профиль
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative w-full">
          <select
            id="primary-bank-profile"
            name="bankProfileId"
            defaultValue={primaryId}
            className="w-full appearance-none rounded-field bg-sunken py-2.5 pl-3 pr-10 text-sm text-ink outline-none transition-colors focus-visible:bg-sheet focus-visible:ring-2 focus-visible:ring-ring"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {bankProfileTitle(p)} · {p.bank_name} · {shortIik(p.iik)}
              </option>
            ))}
          </select>
          <IconChevron className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        </div>
        <SubmitButton
          className="inline-flex items-center justify-center rounded-field bg-tenge px-4 py-2.5 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press"
          pendingChildren="Сохраняем..."
        >
          Сохранить
        </SubmitButton>
      </div>
    </form>
  );
}

/**
 * Collapsed profile row for the 3+ case: the essentials on one line, full
 * requisites and delete tucked behind a native <details> disclosure.
 */
function CompactBankProfileRow({
  profile: p,
  primary,
  deletable,
}: {
  profile: BankProfile;
  primary: boolean;
  deletable: boolean;
}) {
  return (
    <details
      className={cn(
        "group overflow-hidden rounded-card border bg-sheet shadow-soft transition-colors",
        primary ? "border-tenge/40" : "border-line"
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-sunken/40 [&::-webkit-details-marker]:hidden">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-card",
            primary ? "bg-tenge-tint text-tenge-ink" : "bg-sunken text-faint"
          )}
          aria-hidden
        >
          <IconBank className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{bankProfileTitle(p)}</span>
            {primary && (
              <span className="inline-flex shrink-0 items-center rounded-pill bg-tenge-tint px-2 py-0.5 text-xs font-medium text-tenge-ink">
                Основной
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-faint">
            {p.bank_name} · {shortIik(p.iik)}
          </div>
        </div>
        <IconChevron className="size-4 shrink-0 text-faint transition-transform duration-200 group-open:rotate-180" />
      </summary>

      <div className="border-t border-line-soft px-4 py-3">
        <dl className="grid gap-1.5 text-sm">
          <Row label="ИИК" value={p.iik} mono />
          <Row label="БИК" value={p.bik} mono />
          <Row label="Кбе" value={p.kbe} mono />
          {p.knp && <Row label="КНП" value={p.knp} mono />}
        </dl>
        {deletable && (
          <div className="mt-3 flex border-t border-line-soft pt-3 text-sm">
            <form
              action={deleteBankProfile.bind(null, p.id)}
              className="ml-auto"
            >
              <SubmitButton className="rounded-field px-2.5 py-1.5 text-muted transition-colors hover:bg-danger-tint hover:text-danger">
                Удалить
              </SubmitButton>
            </form>
          </div>
        )}
      </div>
    </details>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">
      {children}
    </h2>
  );
}

function bankProfileTitle(p: BankProfile): string {
  return p.label || p.bank_name;
}

function shortIik(iik: string): string {
  return `...${iik.slice(-4)}`;
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
}

/**
 * A short monogram for the company tile. Prefers the distinctive part inside
 * quotes (ТОО «Ромашка» → «Р»), otherwise the initials of the first meaningful
 * words, skipping legal-form abbreviations (ИП, АО, …).
 */
const LEGAL_FORMS = new Set(["ТОО", "ИП", "АО", "ОО", "ЧП", "ПК", "КХ", "ГП"]);

function companyInitials(name: string): string {
  const quoted = name.match(/[«"„“]\s*([^»"”“]+)/);
  const base = (quoted?.[1] ?? name).trim();
  const words = base
    .replace(/[«»"„“”]/g, " ")
    .split(/[\s.\-]+/)
    .filter((w) => /\p{L}/u.test(w) && !LEGAL_FORMS.has(w.toUpperCase()));
  const letters = (words.length ? words : [base])
    .slice(0, 2)
    .map((w) => w.match(/\p{L}/u)?.[0] ?? "")
    .join("");
  return letters.toUpperCase() || "?";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wider text-faint">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
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
      <dt className="w-24 shrink-0 text-faint">{label}</dt>
      <dd className={cn("min-w-0 break-words text-ink", mono && "font-mono tracking-wide")}>
        {value}
      </dd>
    </div>
  );
}

function IconBank({ className }: { className?: string }) {
  // A bank card - the requisites that money lands on.
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19" />
      <path d="M6 14.5h4" />
    </svg>
  );
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconSpark({ className }: { className?: string }) {
  // A four-point sparkle - "upgrade", a little shine.
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2.5l1.9 5.3c.27.74.85 1.32 1.6 1.59L20.8 11l-5.3 1.9c-.74.27-1.32.85-1.59 1.6L12 19.8l-1.9-5.3a2.6 2.6 0 0 0-1.6-1.59L3.2 11l5.3-1.9c.74-.27 1.32-.85 1.59-1.6L12 2.5z" />
    </svg>
  );
}

function IconArrow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}
