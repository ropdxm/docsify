"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useGlobalPending } from "@/components/loading";
import { formatDateRu, formatTenge, num } from "@/lib/format";
import { createDocument, updateDocument } from "@/lib/actions/documents";
import {
  importGoszakupkiContractDraft,
  type GoszakupkiImportResult,
} from "@/lib/actions/goszakupki";
import { STATUS } from "@/lib/status";
import { useBinLookup } from "@/components/use-bin-lookup";

/* ------------------------------------------------------------------ types -- */

type DocType = "invoice" | "avr" | "nakladnaja";

type LineItem = {
  id: string;
  description: string;
  qty: string;
  price: string;
  unit: string; // АВР only: единица измерения
};

export type Client = {
  bin: string;
  name: string;
  director: string;
  address: string;
};

export type SavedClient = {
  id: string;
  bin: string;
  name: string;
  director: string | null;
  address: string | null;
};

export type BankOption = {
  id: string;
  label: string;
  bank_name: string;
  iik: string;
  is_primary: boolean;
};

/** An existing document loaded into the form for editing. */
export type DocumentInitial = {
  type: DocType;
  status: string;
  number: string;
  date: string; // ISO yyyy-mm-dd
  client: Client;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    unit?: string | null;
  }>;
  contract?: string | null;
  bankProfileId?: string | null;
};

const TYPE_LABELS: Record<DocType, string> = {
  invoice: "Счёт",
  avr: "Акт (АВР)",
  nakladnaja: "Накладная",
};

// Parse a stored contract string ("№ 12 от 01.06.2026") back into its parts.
function parseContract(contract?: string | null): {
  no: string;
  date: Date | null;
} {
  if (!contract) return { no: "", date: null };
  const m = contract
    .trim()
    .match(/^№?\s*(.*?)(?:\s+от\s+(\d{2})\.(\d{2})\.(\d{4}))?$/);
  if (!m) return { no: contract.trim(), date: null };
  const date = m[2]
    ? new Date(Number(m[4]), Number(m[3]) - 1, Number(m[2]))
    : null;
  return { no: m[1].trim(), date };
}

// Parse an ISO date ("2026-06-12") in local time (avoids UTC off-by-one).
function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/* ------------------------------------------------------- per-type wording -- */

const COPY: Record<
  DocType,
  { prefix: string; itemsTitle: string; itemPlaceholder: string; totalLabel: string; send: string }
> = {
  invoice: {
    prefix: "СФ",
    itemsTitle: "Позиции",
    itemPlaceholder: "Что продаёте? напр. «Разработка сайта»",
    totalLabel: "Итого к оплате",
    send: "Отправить счёт",
  },
  avr: {
    prefix: "АВР",
    itemsTitle: "Выполненные работы",
    itemPlaceholder: "Какую работу выполнили?",
    totalLabel: "Стоимость работ",
    send: "Отправить акт",
  },
  nakladnaja: {
    prefix: "Накл",
    itemsTitle: "Товары и запасы",
    itemPlaceholder: "Что отгружаете? напр. «Бумага А4, 80 г/м²»",
    totalLabel: "Сумма к отпуску",
    send: "Отправить накладную",
  },
};

/* ----------------------------------------------------------------- helpers -- */

function cn(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

export const fieldCls =
  "w-full rounded-field bg-sunken px-3 py-2 text-sm text-ink placeholder:text-ghost outline-none transition-colors focus-visible:bg-sheet focus-visible:ring-2 focus-visible:ring-ring";

// Common KZ units of measure, offered alongside the ones the user typed before.
const COMMON_UNITS = [
  "шт",
  "услуга",
  "работа",
  "ед",
  "компл",
  "набор",
  "пара",
  "упак",
  "пачка",
  "коробка",
  "ящик",
  "рулон",
  "мешок",
  "баллон",
  "бутылка",
  "лист",
  "кг",
  "г",
  "т",
  "л",
  "мл",
  "м",
  "см",
  "км",
  "м²",
  "см²",
  "м³",
  "га",
  "кВт·ч",
  "мин",
  "час",
  "день",
  "сутки",
  "мес",
  "год",
  "рейс",
];

function rowTotal(item: LineItem): number {
  return num(item.qty) * num(item.price);
}

let _seq = 1;
function newItem(): LineItem {
  return { id: `item-${++_seq}`, description: "", qty: "1", price: "", unit: "" };
}

/* ================================================================== form == */

export function DocumentForm({
  company,
  clients,
  bankProfiles,
  unitOptions,
  initialImportOpen = false,
  documentId,
  initial,
}: {
  company: { name: string; bin: string };
  clients: SavedClient[];
  bankProfiles: BankOption[];
  unitOptions: string[];
  initialImportOpen?: boolean;
  /** Present when editing an existing document. */
  documentId?: string;
  initial?: DocumentInitial;
}) {
  const isEdit = !!documentId;
  const initialStatus = initial?.status ?? "draft";
  // A draft (or a brand-new doc) shows the "save draft + send" pair; an already
  // sent/paid doc shows a single "save changes" action.
  const isDraftDoc = !isEdit || initialStatus === "draft";
  const initialContract = parseContract(initial?.contract);
  const initialDocType = initial?.type ?? (initialImportOpen ? "avr" : "invoice");

  const [docType, setDocType] = useState<DocType>(initialDocType);
  const [date, setDate] = useState<Date>(() =>
    initial ? parseIsoDate(initial.date) : new Date()
  );
  const [client, setClient] = useState<Client | null>(initial?.client ?? null);
  // The primary profile is preselected; any other can be picked per document.
  const [bankProfileId, setBankProfileId] = useState<string | null>(() =>
    initial
      ? initial.bankProfileId ?? null
      : bankProfiles.find((p) => p.is_primary)?.id ?? bankProfiles[0]?.id ?? null
  );

  const [items, setItems] = useState<LineItem[]>(() =>
    initial && initial.items.length
      ? initial.items.map((it, i) => ({
          id: `init-${i}`,
          description: it.description,
          qty: String(it.quantity),
          price: String(it.unitPrice),
          unit: it.unit ?? "",
        }))
      : [{ id: "item-1", description: "", qty: "1", price: "", unit: "" }]
  );
  // АВР only: «Договор (контракт)» reference printed on the act - number and
  // date are entered separately, then combined into "№ 12 от 01.06.2026".
  const [contractNo, setContractNo] = useState(initialContract.no);
  const [contractDate, setContractDate] = useState<Date | null>(
    initialContract.date
  );
  const isAvr = docType === "avr";
  const isNakladnaja = docType === "nakladnaja";
  const canUseGoszakupki = isAvr || isNakladnaja;
  // Both АВР and накладная carry a per-line unit of measure («ед. изм.»).
  const showUnit = isAvr || isNakladnaja;

  const copy = COPY[docType];
  // Past-entered units first (most relevant), then common fallbacks; deduped.
  const unitChoices = [...new Set([...unitOptions, ...COMMON_UNITS])];
  const number = isEdit ? initial!.number : `${copy.prefix}-${date.getFullYear()}-001`;
  const total = items.reduce((sum, it) => sum + rowTotal(it), 0);

  const hasValidItem = items.some((it) => rowTotal(it) > 0);
  const canSend = client !== null && hasValidItem;

  const [pending, startTransition] = useTransition();
  const [importPending, startImportTransition] = useTransition();
  const [importOpen, setImportOpen] = useState(initialImportOpen);
  const [importQuery, setImportQuery] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  useGlobalPending(pending || importPending);

  function changeDocType(next: DocType) {
    setDocType(next);
    if (next === "invoice") {
      setImportOpen(false);
      setImportError(null);
      setImportNotice(null);
    }
  }

  function applyGoszakupkiImport(
    result: Extract<GoszakupkiImportResult, { found: true }>["draft"]
  ) {
    setClient(result.client);
    setItems(
      result.items.map((it, i) => ({
        id: `goszakupki-${result.contractId}-${i}`,
        description: it.description,
        qty: String(it.quantity),
        price: String(it.unitPrice),
        unit: it.unit ?? "",
      }))
    );
    setContractNo(
      (result.contractNumber || result.contractNumberSys || String(result.contractId))
        .replace(/^№\s*/, "")
        .trim()
    );
    if (result.contractDate) setContractDate(parseIsoDate(result.contractDate));
    const warning = result.warnings[0] ? ` ${result.warnings[0]}` : "";
    setImportNotice(`Договор ${result.sourceLabel} загружен.${warning}`);
  }

  function importFromGoszakupki() {
    const query = importQuery.trim();
    setImportError(null);
    setImportNotice(null);
    if (!canUseGoszakupki) {
      setImportError("Госзакупки доступны только для АВР и накладной.");
      return;
    }
    if (!query) {
      setImportError("Укажите ID или системный номер договора.");
      return;
    }
    startImportTransition(async () => {
      const res = await importGoszakupkiContractDraft(query);
      if (res.found) {
        applyGoszakupkiImport(res.draft);
      } else {
        setImportError(res.error);
      }
    });
  }

  function submit(mode: "draft" | "send") {
    setSubmitError(null);
    if (!client) {
      setSubmitError("Выберите или добавьте клиента.");
      return;
    }
    const built = items
      .map((it) => ({
        description: it.description,
        quantity: num(it.qty),
        unitPrice: num(it.price),
        unit: showUnit ? it.unit.trim() || undefined : undefined,
      }))
      .filter((it) => it.quantity > 0 && it.unitPrice > 0);
    if (built.length === 0) {
      setSubmitError("Добавьте хотя бы одну позицию с ценой.");
      return;
    }
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    // Combine the contract number (with an auto-prepended «№») and optional date.
    const contractNumber = contractNo.trim().replace(/^№\s*/, "");
    const contract =
      isAvr && contractNumber
        ? `№ ${contractNumber}${contractDate ? ` от ${formatDateRu(contractDate)}` : ""}`
        : undefined;
    const payload = {
      type: docType,
      date: iso,
      client: {
        bin: client.bin,
        name: client.name,
        director: client.director,
        address: client.address,
      },
      items: built,
      bankProfileId,
      contract,
    };
    startTransition(async () => {
      const res =
        isEdit && documentId
          ? await updateDocument(documentId, payload, mode)
          : await createDocument(payload, mode);
      if (res?.error) setSubmitError(res.error);
    });
  }

  function updateItem(id: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {/* The document sheet - one elevated piece of paper materialising. */}
      <div className="overflow-hidden rounded-sheet border border-line bg-sheet shadow-sheet">
        {/* ---- masthead ---- */}
        <div className="border-b border-line-soft p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Type is fixed once the document exists (the number is tied to it). */}
            {isEdit ? (
              <span className="inline-flex items-center rounded-field bg-sunken px-3.5 py-1.5 text-sm font-medium text-ink">
                {TYPE_LABELS[docType]}
              </span>
            ) : (
              <Segmented value={docType} onChange={changeDocType} />
            )}
            <StatusPill status={isEdit ? initialStatus : "draft"} />
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div>
              <div className="text-xs text-faint">От кого</div>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                {company.name}
                <IconCheck className="size-4 text-tenge" />
              </div>
              <div className="font-mono text-xs text-faint">
                БИН {company.bin}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-base font-medium tracking-tight">
                {number}
              </div>
              <DatePopover date={date} onChange={setDate} />
            </div>
          </div>
        </div>

        {!isEdit && canUseGoszakupki && (
          <section className="border-b border-line-soft p-5 sm:p-7">
            {importOpen ? (
              <div className="rounded-card border border-line bg-sunken/60 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
                      Госзакупки
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      Реквизиты подставятся в документ автоматически
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImportOpen(false);
                      setImportError(null);
                      setImportNotice(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-field px-2.5 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-sheet hover:text-ink"
                  >
                    <IconClose className="size-4" />
                    Убрать привязку
                  </button>
                </div>

                <label className="mt-6 mb-2 block text-sm font-semibold text-muted">
                  ID или системный номер договора
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={importQuery}
                    onChange={(e) => setImportQuery(e.target.value)}
                    placeholder="409548 или 000140001536/160089/00"
                    className={cn(
                      fieldCls,
                      "min-h-12 flex-1 bg-sheet px-4 text-base font-mono"
                    )}
                  />
                  <button
                    type="button"
                    onClick={importFromGoszakupki}
                    disabled={importPending}
                    className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-field bg-tenge px-6 text-base font-semibold text-on-tenge transition-colors hover:bg-tenge-deep disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {importPending ? "Загружаем…" : "Загрузить"}
                    <IconArrowRight className="size-4" />
                  </button>
                </div>
                {importError && (
                  <p className="mt-2 text-sm text-danger">{importError}</p>
                )}
                {importNotice && (
                  <p className="mt-2 text-sm text-tenge-ink">{importNotice}</p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="group flex w-full items-center gap-4 rounded-card border border-dashed border-line-strong bg-sheet p-4 text-left transition-colors hover:border-tenge/45 hover:bg-tenge-tint/20 sm:p-5"
              >
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-card bg-tenge-tint text-tenge-ink">
                  <IconLink className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-ink">
                    Привязать к Госзакупкам
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    Подтянуть реквизиты договора из портала автоматически
                  </span>
                </span>
                <span className="hidden rounded-field bg-sunken px-3 py-1.5 text-xs font-semibold text-muted sm:inline-flex">
                  необязательно
                </span>
                <IconPlus className="size-5 shrink-0 text-muted transition-colors group-hover:text-tenge-ink" />
              </button>
            )}
          </section>
        )}

        {/* ---- client ---- */}
        <section className="border-b border-line-soft p-5 sm:p-7">
          <SectionLabel>Клиент</SectionLabel>
          <ClientField clients={clients} client={client} onSelect={setClient} />
        </section>

        {/* ---- bank requisites (invoice) / contract reference (АВР) ----
            Накладная needs neither, so it shows nothing here. */}
        {docType === "invoice" && (
          <section className="border-b border-line-soft p-5 sm:p-7">
            <SectionLabel>Реквизиты для оплаты</SectionLabel>
            <BankProfilePicker
              profiles={bankProfiles}
              value={bankProfileId}
              onChange={setBankProfileId}
            />
          </section>
        )}
        {isAvr && (
          <section className="border-b border-line-soft p-5 sm:p-7">
            <SectionLabel>Договор (контракт)</SectionLabel>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-faint">Номер</label>
                <div className="relative w-36">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
                    №
                  </span>
                  <input
                    value={contractNo}
                    onChange={(e) => setContractNo(e.target.value)}
                    placeholder="12"
                    className={cn(fieldCls, "pl-7")}
                    aria-label="Номер договора"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-faint">Дата</label>
                <DatePopover
                  date={contractDate}
                  onChange={setContractDate}
                  prefix=""
                  placeholder="Выберите дату"
                  align="left"
                  triggerClassName={cn(
                    "flex w-44 items-center gap-2 rounded-field bg-sunken px-3 py-2 text-sm transition-colors hover:bg-sunken/70",
                    contractDate ? "text-ink" : "text-ghost"
                  )}
                />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-faint">
              Необязательно - печатается в шапке акта: «Договор № 12 от 01.06.2026».
            </p>
          </section>
        )}

        {/* ---- line items ---- */}
        <section className="p-5 sm:p-7">
          <SectionLabel>{copy.itemsTitle}</SectionLabel>

          <div className="space-y-3">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                placeholder={copy.itemPlaceholder}
                showUnit={showUnit}
                unitOptions={unitChoices}
                canRemove={items.length > 1}
                onChange={(patch) => updateItem(item.id, patch)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, newItem()])}
            className="mt-3 inline-flex items-center gap-2 rounded-field border border-dashed border-line-strong px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-tenge/50 hover:text-tenge-ink"
          >
            <IconPlus className="size-4" />
            Добавить{" "}
            {docType === "avr"
              ? "работу"
              : docType === "nakladnaja"
                ? "товар"
                : "позицию"}
          </button>
        </section>

        {/* ---- total ---- the money, alive in tenge teal */}
        <div className="flex items-end justify-between gap-4 border-t border-line bg-tenge-tint/40 p-5 sm:p-7">
          <div>
            <div className="text-sm font-medium text-muted">{copy.totalLabel}</div>
            <div className="mt-0.5 text-xs text-faint">НДС не облагается</div>
          </div>
          <div className="text-3xl font-bold tracking-tight tabular-nums text-tenge-ink sm:text-4xl">
            {formatTenge(total)}
          </div>
        </div>
      </div>

      {/* ---- sticky action bar ---- */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          {/* Draft / new docs: "save draft" on the left. Already-sent docs save
              changes with a single primary button, so the left slot is empty. */}
          {isDraftDoc ? (
            <button
              type="button"
              onClick={() => submit("draft")}
              disabled={pending}
              className="rounded-field px-3.5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-40"
            >
              Сохранить черновик
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-3">
            {submitError ? (
              <span className="text-sm text-danger">{submitError}</span>
            ) : (
              isDraftDoc &&
              !canSend && (
                <span className="hidden text-sm text-faint sm:inline">
                  {!client ? "Выберите клиента" : "Добавьте позицию"}
                </span>
              )
            )}
            {isDraftDoc ? (
              <button
                type="button"
                onClick={() => submit("send")}
                disabled={!canSend || pending}
                className="inline-flex items-center gap-2 rounded-field bg-tenge px-5 py-2.5 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Отправляем…" : copy.send}
                <IconArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => submit("draft")}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-field bg-tenge px-5 py-2.5 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Сохраняем…" : "Сохранить изменения"}
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

/* ===================================================== bank profile picker == */

function BankProfilePicker({
  profiles,
  value,
  onChange,
}: {
  profiles: BankOption[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  if (profiles.length === 0) {
    return (
      <p className="text-sm text-faint">
        Банковские реквизиты не заполнены - счёт выйдет без блока для оплаты.{" "}
        <a
          href="/profile"
          className="font-medium text-tenge-ink hover:underline"
        >
          Добавить в профиле
        </a>
      </p>
    );
  }

  const selected = profiles.find((p) => p.id === value) ?? profiles[0];

  return (
    <div className="max-w-md space-y-2">
      {profiles.length > 1 && (
        <div className="relative">
          <select
            value={selected.id}
            onChange={(e) => onChange(e.target.value)}
            className={cn(fieldCls, "appearance-none pr-10")}
            aria-label="Банковские реквизиты"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.label || p.bank_name) + (p.is_primary ? " - основной" : "")}
              </option>
            ))}
          </select>
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      )}
      <div className="rounded-card border border-line-soft px-3.5 py-2.5 text-sm">
        <div className="font-medium">{selected.bank_name}</div>
        <div className="mt-0.5 font-mono text-xs text-faint">{selected.iik}</div>
      </div>
    </div>
  );
}

/* ============================================================ client field == */

export function ClientField({
  clients,
  client,
  onSelect,
}: {
  clients: SavedClient[];
  client: Client | null;
  onSelect: (c: Client | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  if (client) {
    return <SelectedClient client={client} onChange={() => onSelect(null)} />;
  }

  if (adding) {
    return (
      <NewClient
        initialName={query.trim()}
        onCancel={() => setAdding(false)}
        onSave={(c) => {
          onSelect(c);
          setAdding(false);
          setQuery("");
        }}
      />
    );
  }

  const q = query.trim().toLowerCase();
  const matches = q
    ? clients.filter(
        (c) => c.name.toLowerCase().includes(q) || c.bin.includes(q)
      )
    : clients;

  return (
    <div>
      <div className="relative max-w-md">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Имя или БИН клиента"
          className={cn(fieldCls, "pl-9")}
          aria-label="Поиск клиента"
        />
      </div>

      {clients.length === 0 ? (
        <p className="mt-2 text-sm text-faint">
          У вас пока нет сохранённых клиентов - добавьте первого.
        </p>
      ) : matches.length > 0 ? (
        <ul className="mt-2 max-w-md divide-y divide-line-soft overflow-hidden rounded-card border border-line-soft">
          {matches.slice(0, 6).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() =>
                  onSelect({
                    bin: c.bin,
                    name: c.name,
                    director: c.director ?? "",
                    address: c.address ?? "",
                  })
                }
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-sunken"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {c.name}
                </span>
                <span className="font-mono text-xs text-faint">{c.bin}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-faint">Ничего не найдено.</p>
      )}

      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-2 inline-flex items-center gap-2 rounded-field border border-dashed border-line-strong px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-tenge/50 hover:text-tenge-ink"
      >
        <IconPlus className="size-4" />
        {query.trim() ? `Добавить «${query.trim()}»` : "Новый клиент"}
      </button>
    </div>
  );
}

function SelectedClient({
  client,
  onChange,
}: {
  client: Client;
  onChange: () => void;
}) {
  return (
    <div className="rounded-card border border-tenge/25 bg-tenge-tint/60 p-4">
      <div className="flex items-start gap-2">
        <span className="font-semibold text-ink">{client.name}</span>
        <button
          type="button"
          onClick={onChange}
          className="ml-auto shrink-0 rounded-field px-2 py-0.5 text-xs font-medium text-tenge-ink transition-colors hover:bg-tenge-tint"
        >
          Изменить
        </button>
      </div>
      <dl className="mt-3 grid gap-1.5 text-sm">
        <VerifiedRow label="БИН / ИИН" value={client.bin} mono />
        {client.director ? (
          <VerifiedRow label="Руководитель" value={client.director} />
        ) : null}
        {client.address ? (
          <VerifiedRow label="Адрес" value={client.address} />
        ) : null}
      </dl>
    </div>
  );
}

function NewClient({
  initialName,
  onCancel,
  onSave,
}: {
  initialName: string;
  onCancel: () => void;
  onSave: (c: Client) => void;
}) {
  const [name, setName] = useState(initialName);
  const [bin, setBin] = useState("");
  const [director, setDirector] = useState("");
  const [address, setAddress] = useState("");

  // 12 digits typed → look the client up in the KGD registry, fill the name.
  const { state: lookup, onBinChange } = useBinLookup(setName);
  const verified = lookup.status === "found" && name === lookup.name;

  const valid = name.trim().length > 0 && /^\d{12}$/.test(bin);

  return (
    <div className="rounded-card border border-line bg-sheet p-4">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-faint">БИН / ИИН</label>
          <input
            value={bin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 12);
              setBin(v);
              onBinChange(v);
            }}
            inputMode="numeric"
            placeholder="12 цифр - найдём в реестре КГД"
            className={cn(fieldCls, "font-mono tracking-wider")}
          />
          {lookup.status === "loading" && (
            <p className="mt-1 text-xs text-faint">Ищем в реестре КГД…</p>
          )}
          {lookup.status === "notfound" && (
            <p className="mt-1 text-xs text-danger">{lookup.error}</p>
          )}
          {lookup.status === "found" && lookup.liquidated && (
            <p className="mt-1 text-xs text-danger">
              По данным КГД налогоплательщик снят с учёта (ликвидирован).
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-faint">
            Название
            {verified && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-pill bg-tenge-tint px-1.5 py-0.5 text-[11px] font-medium text-tenge-ink">
                ✓ Реестр КГД
              </span>
            )}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ТОО «...» или ИП"
            className={fieldCls}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-faint">Руководитель</label>
            <input
              value={director}
              onChange={(e) => setDirector(e.target.value)}
              className={fieldCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-faint">Адрес</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={fieldCls}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={!valid}
          onClick={() =>
            onSave({
              name: name.trim(),
              bin,
              director: director.trim(),
              address: address.trim(),
            })
          }
          className="rounded-field bg-tenge px-4 py-2 text-sm font-semibold text-on-tenge transition-colors hover:bg-tenge-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          Готово
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-field px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-sunken"
        >
          Отмена
        </button>
        {!valid && (
          <span className="text-xs text-faint">
            Нужны название и БИН/ИИН из 12 цифр.
          </span>
        )}
      </div>
    </div>
  );
}

/* =============================================================== pieces == */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">
      {children}
    </h2>
  );
}

function StatusPill({ status }: { status: string }) {
  const st = STATUS[status] ?? STATUS.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border px-2.5 py-1 text-xs font-medium",
        st.cls
      )}
    >
      {st.label}
    </span>
  );
}

function VerifiedRow({
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
      <dd className={cn("text-ink", mono && "font-mono tracking-wide")}>{value}</dd>
    </div>
  );
}

function Segmented({
  value,
  onChange,
}: {
  value: DocType;
  onChange: (v: DocType) => void;
}) {
  const opts: Array<{ k: DocType; label: string }> = [
    { k: "invoice", label: "Счёт" },
    { k: "avr", label: "Акт (АВР)" },
    { k: "nakladnaja", label: "Накладная" },
  ];
  return (
    <div className="inline-flex rounded-field bg-sunken p-1">
      {opts.map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => onChange(o.k)}
          aria-pressed={value === o.k}
          className={cn(
            "rounded-[7px] px-3.5 py-1.5 text-sm font-medium transition-colors",
            value === o.k
              ? "bg-sheet text-ink shadow-soft"
              : "text-muted hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ItemCard({
  item,
  placeholder,
  showUnit,
  unitOptions,
  canRemove,
  onChange,
  onRemove,
}: {
  item: LineItem;
  placeholder: string;
  showUnit: boolean;
  unitOptions: string[];
  canRemove: boolean;
  onChange: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-card border border-line-soft bg-sheet p-3 sm:p-4">
      <div className="flex items-start gap-2">
        <input
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={placeholder}
          className={fieldCls}
          aria-label="Наименование"
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Удалить позицию"
          className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-field text-ghost transition-colors hover:bg-danger-tint hover:text-danger disabled:pointer-events-none disabled:opacity-0"
        >
          <IconTrash className="size-[18px]" />
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            value={item.qty}
            onChange={(e) => onChange({ qty: e.target.value })}
            inputMode="decimal"
            placeholder="1"
            className={cn(fieldCls, "w-16 text-center tabular-nums")}
            aria-label="Количество"
          />
          {showUnit && (
            <UnitField
              value={item.unit}
              options={unitOptions}
              onChange={(v) => onChange({ unit: v })}
            />
          )}
          <span className="text-faint">×</span>
          <div className="relative">
            <input
              value={item.price}
              onChange={(e) => onChange({ price: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              className={cn(fieldCls, "w-32 pr-7 text-right tabular-nums")}
              aria-label="Цена за единицу"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint">
              ₸
            </span>
          </div>
        </div>

        <div className="ml-auto text-right">
          <div className="text-xs text-faint">Сумма</div>
          <div className="font-semibold tabular-nums text-ink">
            {formatTenge(rowTotal(item))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- unit field -- */
/* Combobox for «ед. изм.»: pick a previously-used unit or type a new one. */

function UnitField({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const q = value.trim().toLowerCase();
  const matches = options.filter(
    (o) => o.toLowerCase().includes(q) && o.toLowerCase() !== q
  );

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="ед. изм."
        className={cn(fieldCls, "w-24 text-center")}
        aria-label="Единица измерения"
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <ul className="absolute left-0 z-30 mt-1 max-h-44 w-32 overflow-auto rounded-card border border-line bg-raised p-1 shadow-pop">
          {matches.slice(0, 8).map((o) => (
            <li key={o}>
              <button
                type="button"
                // Fire before the input's blur so the click registers.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:bg-sunken"
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- date popover -- */

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function monthCells(year: number, month: number): Array<number | null> {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon = 0
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = Array(firstWeekday).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DatePopover({
  date,
  onChange,
  prefix = "от",
  placeholder = "дата",
  triggerClassName,
  align = "right",
}: {
  date: Date | null;
  onChange: (d: Date) => void;
  /** Word before the date in the trigger, e.g. "от". */
  prefix?: string;
  /** Trigger text shown when no date is selected. */
  placeholder?: string;
  /** Override the trigger styling (defaults to the inline doc-date look). */
  triggerClassName?: string;
  /** Which edge the dropdown aligns to. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [view, setView] = useState(() => {
    const base = date ?? today;
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          triggerClassName ??
          "mt-1 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        }
      >
        <IconCalendar className="size-4 text-faint" />
        {date ? `${prefix} ${formatDateRu(date)}`.trim() : placeholder}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-30 mt-2 w-64 rounded-card border border-line bg-raised p-3 shadow-pop",
            align === "left" ? "left-0" : "right-0"
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Предыдущий месяц"
              className="inline-flex size-7 items-center justify-center rounded-md text-faint hover:bg-sunken hover:text-ink"
            >
              <IconChevron className="size-4 rotate-180" />
            </button>
            <span className="text-sm font-semibold">
              {MONTHS[view.m]} {view.y}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Следующий месяц"
              className="inline-flex size-7 items-center justify-center rounded-md text-faint hover:bg-sunken hover:text-ink"
            >
              <IconChevron className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1 text-center text-[11px] font-medium text-faint">
                {w}
              </div>
            ))}
            {monthCells(view.y, view.m).map((d, i) => {
              if (d === null) return <span key={i} />;
              const cellDate = new Date(view.y, view.m, d);
              const selected = date ? sameDay(cellDate, date) : false;
              const isToday = sameDay(cellDate, today);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onChange(cellDate);
                    setOpen(false);
                  }}
                  className={cn(
                    "mx-auto flex size-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors",
                    selected
                      ? "bg-tenge font-semibold text-on-tenge"
                      : isToday
                        ? "font-semibold text-tenge-ink hover:bg-tenge-tint"
                        : "text-ink hover:bg-sunken"
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- icons -- */
/* One set, 24-grid, currentColor - consistent throughout. */

type IconProps = { className?: string };

function IconCheck({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}
function IconSearch({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}
function IconPlus({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconLink({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
    </svg>
  );
}
function IconClose({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <path d="M7 7l10 10M17 7 7 17" />
    </svg>
  );
}
function IconTrash({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </svg>
  );
}
function IconArrowRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function IconCalendar({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </svg>
  );
}
function IconChevron({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
