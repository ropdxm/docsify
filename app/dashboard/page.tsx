import Link from "next/link";
import { requireCompany } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import { markDocumentPaid } from "@/lib/actions/documents";
import { formatTenge, formatDateRu } from "@/lib/format";
import { STATUS, DOC_TYPE_LABEL } from "@/lib/status";
import { cn } from "@/lib/ui";

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
  if (!c) return "—";
  return Array.isArray(c) ? c[0]?.name ?? "—" : c.name;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const company = await requireCompany();
  const sp = await searchParams;
  const justCreated = typeof sp.created === "string";

  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select(
      "id, type, number, date, total_amount, status, share_token, paid_at, counterparty:counterparties(name)"
    )
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  const docs = (data ?? []) as DocRow[];

  // Summary — the "how much am I owed?" question.
  const now = new Date();
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  let awaiting = 0;
  let overdue = 0;
  let paidThisMonth = 0;
  for (const d of docs) {
    if (d.status === "sent" || d.status === "signed") awaiting += d.total_amount;
    if (d.status === "sent" && new Date(d.date) < cutoff) overdue += d.total_amount;
    if (
      d.status === "paid" &&
      d.paid_at &&
      new Date(d.paid_at).getMonth() === now.getMonth() &&
      new Date(d.paid_at).getFullYear() === now.getFullYear()
    )
      paidThisMonth += d.total_amount;
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-tenge" />
            <span className="font-semibold tracking-tight">Быстрые деньги</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/profile"
              className="rounded-field px-2.5 py-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <span className="hidden sm:inline">{company.name}</span>
              <span className="sm:hidden">Профиль</span>
            </Link>
            <form action={logout}>
              <button className="rounded-field px-2.5 py-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink">
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Документы
          </h1>
          <Link
            href="/documents/new"
            className="inline-flex items-center gap-2 rounded-field bg-tenge px-4 py-2.5 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press"
          >
            + Новый документ
          </Link>
        </div>

        {justCreated && (
          <p className="mt-4 rounded-card border border-tenge/25 bg-tenge-tint/60 px-4 py-3 text-sm text-tenge-ink">
            Документ создан. Скопируйте ссылку и отправьте клиенту.
          </p>
        )}

        {/* Summary */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Ожидает оплаты" value={awaiting} accent />
          <SummaryCard label="Просрочено" value={overdue} danger />
          <SummaryCard label="Оплачено в этом месяце" value={paidThisMonth} />
        </div>

        {/* List */}
        <div className="mt-8">
          {docs.length === 0 ? (
            <div className="rounded-sheet border border-dashed border-line-strong bg-sheet p-10 text-center">
              <p className="font-medium">Пока нет документов</p>
              <p className="mt-1 text-sm text-muted">
                Создайте первый счёт — это займёт пару минут.
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
                const st = STATUS[d.status] ?? STATUS.draft;
                return (
                  <div
                    key={d.id}
                    className={cn(
                      "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5",
                      i > 0 && "border-t border-line-soft"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{clientName(d)}</span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-pill border px-2 py-0.5 text-xs font-medium",
                            st.cls
                          )}
                        >
                          {st.label}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-faint">
                        {DOC_TYPE_LABEL[d.type]} {d.number} ·{" "}
                        {formatDateRu(new Date(d.date))}
                      </div>
                    </div>

                    <div className="text-right font-semibold tabular-nums">
                      {formatTenge(d.total_amount)}
                    </div>

                    <div className="flex items-center gap-1 text-sm">
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
                      {d.status !== "paid" && (
                        <form action={markDocumentPaid.bind(null, d.id)}>
                          <button className="rounded-field px-2.5 py-1.5 text-paid-ink transition-colors hover:bg-paid-tint">
                            Оплачено
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
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
