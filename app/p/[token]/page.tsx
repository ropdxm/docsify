import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { bankForDocument } from "@/lib/bank";
import { formatTenge, formatDateRu } from "@/lib/format";
import { STATUS } from "@/lib/status";
import { cn } from "@/lib/ui";
import { NcaSign } from "@/components/nca-sign";
import { BrandLogo } from "@/components/brand-logo";

type Item = {
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string | null;
};

// Per-type wording for the public view. Накладная uses sender/receiver and is
// not a payment request, so its bank block is hidden below.
const TYPE_UI = {
  invoice: {
    title: "Счёт на оплату",
    supplier: "Поставщик",
    buyer: "Покупатель",
    total: "Итого к оплате",
    download: "счёт",
  },
  avr: {
    title: "Акт выполненных работ",
    supplier: "Исполнитель",
    buyer: "Заказчик",
    total: "Стоимость работ",
    download: "акт",
  },
  nakladnaja: {
    title: "Накладная на отпуск запасов",
    supplier: "Отправитель",
    buyer: "Получатель",
    total: "Сумма к отпуску",
    download: "накладную",
  },
} as const;

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Public read by share token via the service role (filtered to one row).
  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("documents")
    .select("*, company:companies(*), counterparty:counterparties(*)")
    .eq("share_token", token)
    .maybeSingle();

  if (!doc) notFound();

  const st = STATUS[doc.status] ?? STATUS.draft;
  const company = doc.company;
  const cp = doc.counterparty;

  // Договор is a signable PDF, not a structured document - its own public view.
  if (doc.type === "dogovor") {
    const { data: sigData } = await admin
      .from("document_signatures")
      .select("signer_role, signer_bin, signed_at")
      .eq("document_id", doc.id);
    const sigs = (sigData ?? []) as Array<{
      signer_role: string;
      signer_bin: string | null;
      signed_at: string;
    }>;
    return (
      <DogovorShareView
        token={token}
        doc={doc}
        st={st}
        company={company}
        cp={cp}
        ownerSig={sigs.find((s) => s.signer_role === "owner") ?? null}
        clientSig={sigs.find((s) => s.signer_role === "client") ?? null}
      />
    );
  }

  const ui = TYPE_UI[doc.type as keyof typeof TYPE_UI] ?? TYPE_UI.invoice;
  const items = (doc.items ?? []) as Item[];
  const bank = await bankForDocument(admin, doc);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-14">
      <div className="mb-5 flex items-center justify-between">
        <div aria-label="Docsify" className="flex items-center">
          <BrandLogo className="size-8" />
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

      <div className="overflow-hidden rounded-sheet border border-line bg-sheet shadow-sheet">
        <div className="border-b border-line-soft p-5 sm:p-7">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {ui.title} {doc.number}
          </h1>
          <p className="mt-1 text-sm text-muted">
            от {formatDateRu(new Date(doc.date))}
          </p>
          {doc.type === "avr" && doc.contract ? (
            <p className="text-sm text-muted">Договор: {doc.contract}</p>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Party
              label={ui.supplier}
              name={company?.name}
              bin={company?.bin}
              address={company?.address}
            />
            <Party
              label={ui.buyer}
              name={cp?.name}
              bin={cp?.bin}
              address={cp?.address}
            />
          </div>

          {bank && doc.type !== "nakladnaja" && (
            <div className="mt-4 rounded-card border border-tenge/25 bg-tenge-tint/40 p-3">
              <div className="text-xs uppercase tracking-wider text-faint">
                Реквизиты для оплаты
              </div>
              <div className="mt-1 font-medium">{bank.bank_name}</div>
              <div className="font-mono text-sm text-muted">
                ИИК: {bank.iik}
              </div>
              <div className="text-sm text-muted">
                БИК: {bank.bik} · Кбе: {bank.kbe}
                {bank.knp ? ` · КНП: ${bank.knp}` : ""}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 sm:p-7">
          <div className="space-y-2">
            {items.map((it, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 border-b border-line-soft pb-2 text-sm last:border-0"
              >
                <span className="min-w-0 flex-1">{it.description || "-"}</span>
                <span className="text-faint tabular-nums">
                  {it.quantity}
                  {it.unit ? ` ${it.unit}` : ""} × {formatTenge(it.unitPrice)}
                </span>
                <span className="w-28 text-right font-medium tabular-nums">
                  {formatTenge(it.quantity * it.unitPrice)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-end justify-between border-t border-line bg-tenge-tint/40 p-5 sm:p-7">
          <div>
            <div className="text-sm font-medium text-muted">
              {ui.total}
            </div>
            <div className="mt-0.5 text-xs text-faint">НДС не облагается</div>
          </div>
          <div className="text-2xl font-bold tracking-tight tabular-nums text-tenge-ink sm:text-3xl">
            {formatTenge(doc.total_amount)}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a
          href={`/api/documents/${doc.id}/xlsx?token=${token}`}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-field bg-tenge px-5 py-3 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep"
        >
          Скачать {ui.download}
        </a>
        <button
          disabled
          title="Подписание появится в следующей версии"
          className="inline-flex flex-1 items-center justify-center rounded-field border border-line bg-sheet px-5 py-3 text-sm font-medium text-faint"
        >
          Подписать документ
        </button>
      </div>
    </div>
  );
}

function Party({
  label,
  name,
  bin,
  address,
}: {
  label: string;
  name?: string | null;
  bin?: string | null;
  address?: string | null;
}) {
  return (
    <div className="rounded-card border border-line-soft p-3">
      <div className="text-xs uppercase tracking-wider text-faint">{label}</div>
      <div className="mt-1 font-medium">{name ?? "-"}</div>
      {bin ? <div className="text-sm text-muted">БИН/ИИН: {bin}</div> : null}
      {address ? <div className="text-sm text-muted">{address}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------- договор view -- */

type PartyInfo = { name?: string | null; bin?: string | null; address?: string | null } | null;
type SigRow = { signer_role: string; signer_bin: string | null; signed_at: string } | null;

function DogovorShareView({
  token,
  doc,
  st,
  company,
  cp,
  ownerSig,
  clientSig,
}: {
  token: string;
  doc: { id: string; number: string; date: string; title?: string | null };
  st: { label: string; cls: string };
  company: PartyInfo;
  cp: PartyInfo;
  ownerSig: SigRow;
  clientSig: SigRow;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-14">
      <div className="mb-5 flex items-center justify-between">
        <div aria-label="Docsify" className="flex items-center">
          <BrandLogo className="size-8" />
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

      <div className="overflow-hidden rounded-sheet border border-line bg-sheet shadow-sheet">
        <div className="border-b border-line-soft p-5 sm:p-7">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {doc.title?.trim() || "Договор"} {doc.number}
          </h1>
          <p className="mt-1 text-sm text-muted">
            от {formatDateRu(new Date(doc.date))}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Party label="Исполнитель" name={company?.name} bin={company?.bin} address={company?.address} />
            <Party label="Заказчик" name={cp?.name} bin={cp?.bin} address={cp?.address} />
          </div>
        </div>

        <iframe
          src={`/api/documents/${doc.id}/file?token=${token}`}
          title="Договор (PDF)"
          className="h-[60vh] w-full bg-sunken"
        />

        <div className="grid gap-3 border-t border-line-soft p-5 sm:grid-cols-2 sm:p-7">
          <SigRowView label="Исполнитель" sig={ownerSig} />
          <SigRowView label="Заказчик" sig={clientSig} />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a
          href={`/api/documents/${doc.id}/file?token=${token}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-field border border-line bg-sheet px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-sunken"
        >
          Открыть PDF
        </a>
        {clientSig ? (
          <div className="inline-flex flex-1 items-center justify-center rounded-field bg-tenge-tint px-5 py-3 text-sm font-medium text-tenge-ink">
            Вы подписали договор
          </div>
        ) : ownerSig ? (
          <NcaSign
            documentId={doc.id}
            role="client"
            token={token}
            fileUrl={`/api/documents/${doc.id}/file?token=${token}`}
            label="Подписать договор (ЭЦП)"
          />
        ) : (
          <div className="inline-flex flex-1 items-center justify-center rounded-field border border-line bg-sheet px-5 py-3 text-center text-sm text-faint">
            Ожидает подписи исполнителя
          </div>
        )}
      </div>
    </div>
  );
}

function SigRowView({ label, sig }: { label: string; sig: SigRow }) {
  return (
    <div
      className={cn(
        "rounded-card border p-3",
        sig ? "border-tenge/30 bg-tenge-tint/40" : "border-line-soft"
      )}
    >
      <div className="text-xs uppercase tracking-wider text-faint">{label}</div>
      {sig ? (
        <div className="mt-1 text-sm text-tenge-ink">
          ✓ Подписано {formatDateRu(new Date(sig.signed_at))}
          {sig.signer_bin ? (
            <span className="text-muted"> · БИН {sig.signer_bin}</span>
          ) : null}
        </div>
      ) : (
        <div className="mt-1 text-sm text-faint">Ожидает подписи</div>
      )}
    </div>
  );
}
