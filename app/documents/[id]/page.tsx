import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCompany } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDateRu } from "@/lib/format";
import { STATUS } from "@/lib/status";
import { cn } from "@/lib/ui";
import { NcaSign } from "@/components/nca-sign";

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
  // Only договоры have a detail/sign view; the structured docs use the editor.
  if (doc.type !== "dogovor") redirect(`/documents/${id}/edit`);

  const { data: sigData } = await supabase
    .from("document_signatures")
    .select("signer_role, signer_bin, signer_name, signed_at, is_valid")
    .eq("document_id", id);
  const sigs = (sigData ?? []) as Signature[];
  const ownerSig = sigs.find((s) => s.signer_role === "owner") ?? null;
  const clientSig = sigs.find((s) => s.signer_role === "client") ?? null;

  const cp = Array.isArray(doc.counterparty)
    ? doc.counterparty[0]
    : doc.counterparty;
  const st = STATUS[doc.status] ?? STATUS.draft;

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
          <SignatureCard role="Заказчик" party={cp?.name ?? "—"} sig={clientSig} />
        </div>

        {/* Sign action (NCALayer ЭЦП). */}
        <div className="mt-5">
          {ownerSig ? (
            <p className="text-sm text-muted">
              Вы подписали договор. Отправьте клиенту ссылку выше — он подпишет
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
