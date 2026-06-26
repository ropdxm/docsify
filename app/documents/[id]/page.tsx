import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCompany } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDateRu, formatTenge } from "@/lib/format";
import { STATUS, DOC_TYPE_LABEL } from "@/lib/status";
import { cn } from "@/lib/ui";
import { NcaSign } from "@/components/nca-sign";
import { BrandLogo } from "@/components/brand-logo";

type Signature = {
  signer_role: "owner" | "client";
  signer_bin: string | null;
  signer_name: string | null;
  signed_at: string;
  is_valid: boolean;
};

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await requireCompany();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("*, counterparty:counterparties(*)")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!doc) notFound();

  const cp = Array.isArray(doc.counterparty)
    ? doc.counterparty[0]
    : doc.counterparty;
  const st = STATUS[doc.status] ?? STATUS.draft;

  // Structured docs (счёт / АВР / накладная): a draft opens the editor; once it
  // has been sent it becomes view-only and is rendered read-only here.
  if (doc.type !== "dogovor") {
    if (doc.status === "draft") redirect(`/documents/${id}/edit`);
    return <StructuredView doc={doc} cp={cp} st={st} />;
  }

  const { data: sigData } = await supabase
    .from("document_signatures")
    .select("signer_role, signer_bin, signer_name, signed_at, is_valid")
    .eq("document_id", id);
  const sigs = (sigData ?? []) as Signature[];
  const ownerSig = sigs.find((s) => s.signer_role === "owner") ?? null;
  const clientSig = sigs.find((s) => s.signer_role === "client") ?? null;

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/dashboard" aria-label="Docsify" className="flex items-center">
            <BrandLogo className="size-8" />
          </Link>
          <Link
            href="/dashboard"
            className="-mr-1 inline-flex size-9 items-center justify-center rounded-field text-faint transition-colors hover:bg-sunken hover:text-ink"
            aria-label="Закрыть"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {doc.title?.trim() || "Договор"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {doc.number} · от {formatDateRu(new Date(doc.date))} · {cp?.name}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-pill border px-2.5 py-1 text-xs font-medium",
              st.cls
            )}
          >
            {st.label}
          </span>
        </div>

        {/* PDF preview */}
        <div className="overflow-hidden rounded-sheet border border-line bg-sheet shadow-sheet">
          <iframe
            src={`/api/documents/${doc.id}/file`}
            title="Договор (PDF)"
            className="h-[70vh] w-full bg-sunken"
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-line-soft p-3 text-sm">
            <a
              href={`/api/documents/${doc.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="rounded-field px-2.5 py-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              Открыть PDF
            </a>
            <a
              href={`/p/${doc.share_token}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-field px-2.5 py-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              Ссылка для клиента
            </a>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <SignatureCard role="Исполнитель (вы)" party={company.name} sig={ownerSig} />
          <SignatureCard role="Заказчик" party={cp?.name ?? "-"} sig={clientSig} />
        </div>

        {/* Sign action (NCALayer ЭЦП). */}
        <div className="mt-5">
          {ownerSig ? (
            <p className="text-sm text-muted">
              Вы подписали договор. Отправьте клиенту ссылку выше - он подпишет
              его своей ЭЦП.
            </p>
          ) : (
            <NcaSign
              documentId={doc.id}
              role="owner"
              fileUrl={`/api/documents/${doc.id}/file`}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function SignatureCard({
  role,
  party,
  sig,
}: {
  role: string;
  party: string;
  sig: Signature | null;
}) {
  return (
    <div
      className={cn(
        "rounded-card border p-4",
        sig ? "border-tenge/30 bg-tenge-tint/40" : "border-line-soft"
      )}
    >
      <div className="text-xs uppercase tracking-wider text-faint">{role}</div>
      <div className="mt-1 font-medium">{party}</div>
      {sig ? (
        <div className="mt-2 text-sm text-tenge-ink">
          ✓ Подписано {formatDateRu(new Date(sig.signed_at))}
          {sig.signer_bin ? (
            <span className="text-muted"> · БИН {sig.signer_bin}</span>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 text-sm text-faint">Ожидает подписи</div>
      )}
    </div>
  );
}

/* Read-only view of a sent structured document (счёт / АВР / накладная). Once a
   document leaves draft it can't be edited - only viewed and downloaded. */
function StructuredView({
  doc,
  cp,
  st,
}: {
  doc: {
    id: string;
    type: string;
    number: string;
    date: string;
    status: string;
    share_token: string;
    items: unknown;
  };
  cp: { name?: string | null } | null;
  st: { label: string; cls: string };
}) {
  const items = (Array.isArray(doc.items) ? doc.items : []) as Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number;
    unit?: string | null;
  }>;
  const isAvr = doc.type === "avr";
  const total = items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0
  );

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/dashboard" aria-label="Docsify" className="flex items-center">
            <BrandLogo className="size-8" />
          </Link>
          <Link
            href="/dashboard"
            className="-mr-1 inline-flex size-9 items-center justify-center rounded-field text-faint transition-colors hover:bg-sunken hover:text-ink"
            aria-label="Закрыть"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {DOC_TYPE_LABEL[doc.type] ?? "Документ"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {doc.number} · от {formatDateRu(new Date(doc.date))}
              {cp?.name ? ` · ${cp.name}` : ""}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-pill border px-2.5 py-1 text-xs font-medium",
              st.cls
            )}
          >
            {st.label}
          </span>
        </div>

        <p className="mb-5 rounded-card border border-line-soft bg-sunken/50 px-4 py-3 text-sm text-muted">
          Документ отправлен - доступен только для просмотра. Редактировать можно
          только черновик.
        </p>

        <div className="overflow-hidden rounded-sheet border border-line bg-sheet shadow-sheet">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-soft text-left text-xs text-faint">
                <th className="px-4 py-2.5 font-medium">Наименование</th>
                {isAvr && <th className="px-2 py-2.5 font-medium">Ед.</th>}
                <th className="px-2 py-2.5 text-right font-medium">Кол-во</th>
                <th className="px-2 py-2.5 text-right font-medium">Цена</th>
                <th className="px-4 py-2.5 text-right font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const qty = Number(it.quantity) || 0;
                const price = Number(it.unitPrice) || 0;
                return (
                  <tr
                    key={i}
                    className={cn(i > 0 && "border-t border-line-soft")}
                  >
                    <td className="px-4 py-2.5">{it.description || "-"}</td>
                    {isAvr && (
                      <td className="px-2 py-2.5 text-muted">{it.unit || "-"}</td>
                    )}
                    <td className="px-2 py-2.5 text-right tabular-nums">{qty}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {formatTenge(price)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {formatTenge(qty * price)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-line bg-tenge-tint/40 px-4 py-3">
            <span className="text-sm font-medium text-muted">Итого</span>
            <span className="text-lg font-bold tabular-nums text-tenge-ink">
              {formatTenge(total)}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          <a
            href={`/api/documents/${doc.id}/xlsx`}
            className="rounded-field border border-line bg-sheet px-4 py-2.5 font-medium text-ink shadow-soft transition-colors hover:bg-sunken"
          >
            Скачать Excel
          </a>
          <a
            href={`/p/${doc.share_token}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-field px-3 py-2.5 text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            Ссылка для клиента
          </a>
        </div>
      </main>
    </div>
  );
}
