import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTenge, formatDateRu } from "@/lib/format";
import { STATUS } from "@/lib/status";
import { cn } from "@/lib/ui";

type Item = { description: string; quantity: number; unitPrice: number };

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

  const isInvoice = doc.type === "invoice";
  const items = (doc.items ?? []) as Item[];
  const st = STATUS[doc.status] ?? STATUS.draft;
  const company = doc.company;
  const cp = doc.counterparty;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-14">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-tenge" />
          <span className="font-semibold tracking-tight">Быстрые деньги</span>
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
            {isInvoice ? "Счёт на оплату" : "Акт выполненных работ"} {doc.number}
          </h1>
          <p className="mt-1 text-sm text-muted">
            от {formatDateRu(new Date(doc.date))}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Party
              label={isInvoice ? "Поставщик" : "Исполнитель"}
              name={company?.name}
              bin={company?.bin}
              address={company?.address}
            />
            <Party
              label={isInvoice ? "Покупатель" : "Заказчик"}
              name={cp?.name}
              bin={cp?.bin}
              address={cp?.address}
            />
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="space-y-2">
            {items.map((it, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 border-b border-line-soft pb-2 text-sm last:border-0"
              >
                <span className="min-w-0 flex-1">{it.description || "—"}</span>
                <span className="text-faint tabular-nums">
                  {it.quantity} × {formatTenge(it.unitPrice)}
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
              {isInvoice ? "Итого к оплате" : "Стоимость работ"}
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
          Скачать {isInvoice ? "счёт" : "акт"}
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
      <div className="mt-1 font-medium">{name ?? "—"}</div>
      {bin ? <div className="text-sm text-muted">БИН/ИИН: {bin}</div> : null}
      {address ? <div className="text-sm text-muted">{address}</div> : null}
    </div>
  );
}
