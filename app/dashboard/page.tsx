import type { ComponentType } from "react";
import Link from "next/link";
import { getCompany, requireUser } from "@/lib/dal";
import { getIncomingDocuments } from "@/lib/incoming";
import { createClient } from "@/lib/supabase/server";
import { markDocumentPaid } from "@/lib/actions/documents";
import { formatTenge, formatDateRu } from "@/lib/format";
import { STATUS, DOC_TYPE_LABEL } from "@/lib/status";
import { cn } from "@/lib/ui";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { IncomingList } from "@/components/incoming-list";
import { SubmitButton } from "@/components/loading";
import { DashboardNotice } from "@/components/dashboard-notice";

type DocRow = {
  id: string;
  type: string;
  number: string;
  date: string;
  total_amount: number;
  status: string;
  share_token: string;
  paid_at: string | null;
  counterparty: { name: string } | { name: string }[] | null;
};

function clientName(row: DocRow): string {
  const c = row.counterparty;
  if (!c) return "-";
  return Array.isArray(c) ? c[0]?.name ?? "-" : c.name;
}

/* Per-type identity: a colour-coded icon tile so the kind of document reads at
   a glance. Счёт = money (banknote, teal), Акт = signed work (plum), Накладная
   = goods (box, amber). */
type IconProps = { className?: string };

const TYPE_META: Record<
  string,
  { tile: string; Icon: ComponentType<IconProps> }
> = {
  invoice: { tile: "bg-tenge-tint text-tenge-ink", Icon: IconBanknote },
  avr: { tile: "bg-[#ece8f6] text-[#5d4b9a]", Icon: IconActCheck },
  nakladnaja: { tile: "bg-[#f4ebda] text-[#8a6516]", Icon: IconBox },
  dogovor: { tile: "bg-[#e7eef7] text-[#3a5a8c]", Icon: IconContract },
};

function IconBanknote({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5h.01M18 14.5h.01" />
    </svg>
  );
}
function IconActCheck({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M8.75 14l2 2 3.75-3.75" />
    </svg>
  );
}
function IconBox({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5 12 12l8.5-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}
function IconContract({ className }: IconProps) {
  // A signature on a line - a contract you sign.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16c1.7 0 2.1-7 3.5-7 1.2 0 1 5 2.2 5 1 0 1.3-2.3 2.5-2.3 1 0 1.2 1.8 2.3 1.8 1 0 1.6-1.2 2.5-1.2" />
      <path d="M3 20h18" />
    </svg>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const company = await getCompany();
  const sp = await searchParams;
  const notice =
    typeof sp.created === "string"
      ? "created"
      : typeof sp.updated === "string"
        ? "updated"
        : null;

  const supabase = await createClient();
  const [{ data }, incoming] = company
    ? await Promise.all([
        supabase
          .from("documents")
          .select(
            "id, type, number, date, total_amount, status, share_token, paid_at, counterparty:counterparties(name)"
          )
          .eq("company_id", company.id)
          .order("created_at", { ascending: false }),
        getIncomingDocuments(company),
      ])
    : [{ data: [] }, []];

  const docs = (data ?? []) as DocRow[];

  // Summary - the "how much am I owed?" question.
  const now = new Date();
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  let awaiting = 0;
  let overdue = 0;
  let paidThisMonth = 0;
  for (const d of docs) {
    // Only invoices (счёт) are a request for payment - АВР and накладные are
    // supporting documents, so they don't count toward money owed.
    const isInvoice = d.type === "invoice";
    if (isInvoice && (d.status === "sent" || d.status === "signed"))
      awaiting += d.total_amount;
    if (isInvoice && d.status === "sent" && new Date(d.date) < cutoff)
      overdue += d.total_amount;
    if (
      d.status === "paid" &&
      d.paid_at &&
      new Date(d.paid_at).getMonth() === now.getMonth() &&
      new Date(d.paid_at).getFullYear() === now.getFullYear()
    )
      paidThisMonth += d.total_amount;
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        companyName={company?.name ?? "Профиль"}
        active="documents"
        incomingCount={incoming.length}
      />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Документы
          </h1>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/documents/new/dogovor"
              className="inline-flex items-center gap-2 rounded-field border border-line bg-sheet px-4 py-2.5 text-sm font-semibold text-ink shadow-soft transition-colors hover:bg-sunken"
            >
              + Договор
            </Link>
            <Link
              href="/documents/new"
              className="inline-flex items-center gap-2 rounded-field bg-tenge px-4 py-2.5 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press"
            >
              + Документ
            </Link>
          </div>
        </div>

        <DashboardNotice kind={notice} />

        {/* Summary */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Ожидает оплаты" value={awaiting} accent />
          <SummaryCard label="Просрочено" value={overdue} danger />
          <SummaryCard label="Оплачено в этом месяце" value={paidThisMonth} />
        </div>

        {/* Documents sent to our БИН/ИИН by another company. */}
        {incoming.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-faint">
                Входящие
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-pill bg-tenge px-1.5 text-[11px] font-semibold text-on-tenge">
                  {incoming.length}
                </span>
              </h2>
              {incoming.length > 3 && (
                <Link
                  href="/incoming"
                  className="text-sm font-medium text-tenge-ink transition-colors hover:text-tenge-deep"
                >
                  Все входящие →
                </Link>
              )}
            </div>
            <IncomingList items={incoming.slice(0, 3)} />
          </section>
        )}

        {/* List */}
        <div className="mt-8">
          {docs.length === 0 ? (
            <div className="rounded-sheet border border-dashed border-line-strong bg-sheet p-10 text-center">
              <p className="font-medium">Пока нет документов</p>
              <p className="mt-1 text-sm text-muted">
                Создайте первый счёт - это займёт пару минут.
              </p>
              <Link
                href="/documents/new"
                className="mt-4 inline-flex rounded-field bg-tenge px-4 py-2.5 text-sm font-semibold text-on-tenge"
              >
                Новый документ
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-sheet border border-line bg-sheet shadow-sheet">
              {docs.map((d, i) => {
                const isInvoice = d.type === "invoice";
                const isDogovor = d.type === "dogovor";
                const meta = TYPE_META[d.type] ?? TYPE_META.invoice;
                const Icon = meta.Icon;
                const st = STATUS[d.status] ?? STATUS.draft;
                // Status matters for invoices (payment) and договоры (signing).
                const showStatus = isInvoice || isDogovor;
                // Договоры open the sign view. Structured docs: a draft opens
                // the editor; once sent it's view-only (detail page).
                const href =
                  isDogovor || d.status !== "draft"
                    ? `/documents/${d.id}`
                    : `/documents/${d.id}/edit`;
                return (
                  <div
                    key={d.id}
                    className={cn(
                      "relative px-4 py-3.5 transition-colors hover:bg-sunken/40 sm:px-5",
                      i > 0 && "border-t border-line-soft"
                    )}
                  >
                    {/* The whole row opens the document; the action buttons sit
                        above this stretched link via z-10. */}
                    <Link
                      href={href}
                      className="absolute inset-0"
                      aria-label={`Открыть ${DOC_TYPE_LABEL[d.type]} ${d.number}`}
                    />
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                      {/* Identity */}
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span
                          className={cn(
                            "inline-flex size-9 shrink-0 items-center justify-center rounded-card",
                            meta.tile
                          )}
                          aria-hidden
                        >
                          <Icon className="size-[18px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">
                              {clientName(d)}
                            </span>
                            {showStatus && (
                              <span
                                className={cn(
                                  "inline-flex shrink-0 items-center rounded-pill border px-2 py-0.5 text-xs font-medium",
                                  st.cls
                                )}
                              >
                                {st.label}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-faint">
                            <span className="font-medium text-muted">
                              {DOC_TYPE_LABEL[d.type]}
                            </span>{" "}
                            {d.number} · {formatDateRu(new Date(d.date))}
                          </div>
                        </div>
                      </div>

                      {/* Amount + actions: a divided bar on mobile, inline on desktop */}
                      <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-2.5 sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
                        <div className="shrink-0 font-semibold tabular-nums">
                          {formatTenge(d.total_amount)}
                        </div>
                        <div className="relative z-10 flex items-center gap-0.5 text-sm">
                          <a
                            href={`/api/documents/${d.id}/xlsx`}
                            className="rounded-field px-2.5 py-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink"
                          >
                            Скачать
                          </a>
                          <a
                            href={`/p/${d.share_token}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-field px-2.5 py-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink"
                          >
                            Ссылка
                          </a>
                          {/* "Mark as paid" only makes sense for invoices. */}
                          {isInvoice && d.status !== "paid" && (
                            <form action={markDocumentPaid.bind(null, d.id)}>
                              <SubmitButton className="rounded-field bg-paid px-2.5 py-1.5 font-medium text-white opacity-80 transition-opacity hover:opacity-100">
                                Оплачено
                              </SubmitButton>
                            </form>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: number;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-card border bg-sheet p-4 shadow-soft",
        accent ? "border-tenge/25" : danger ? "border-late/25" : "border-line"
      )}
    >
      <div className="text-xs text-faint">{label}</div>
      <div
        className={cn(
          "mt-1 text-xl font-bold tracking-tight tabular-nums",
          accent ? "text-tenge-ink" : danger ? "text-late-ink" : "text-ink"
        )}
      >
        {formatTenge(value)}
      </div>
    </div>
  );
}
