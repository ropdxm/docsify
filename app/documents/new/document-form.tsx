"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatDateRu, formatTenge, num } from "@/lib/format";
import { createDocument } from "@/lib/actions/documents";

/* ------------------------------------------------------------------ types -- */

type DocType = "invoice" | "avr";

type LineItem = {
  id: string;
  description: string;
  qty: string;
  price: string;
};

type Client = {
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
};

/* ----------------------------------------------------------------- helpers -- */

function cn(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

const fieldCls =
  "w-full rounded-field bg-sunken px-3 py-2 text-sm text-ink placeholder:text-ghost outline-none transition-colors focus-visible:bg-sheet focus-visible:ring-2 focus-visible:ring-ring";

function rowTotal(item: LineItem): number {
  return num(item.qty) * num(item.price);
}

let _seq = 1;
function newItem(): LineItem {
  return { id: `item-${++_seq}`, description: "", qty: "1", price: "" };
}

/* ================================================================== form == */

export function DocumentForm({
  company,
  clients,
}: {
  company: { name: string; bin: string };
  clients: SavedClient[];
}) {
  const [docType, setDocType] = useState<DocType>("invoice");
  const [date, setDate] = useState<Date>(() => new Date());
  const [client, setClient] = useState<Client | null>(null);

  const [items, setItems] = useState<LineItem[]>([
    { id: "item-1", description: "", qty: "1", price: "" },
  ]);

  const copy = COPY[docType];
  const number = `${copy.prefix}-${date.getFullYear()}-001`;
  const total = items.reduce((sum, it) => sum + rowTotal(it), 0);

  const hasValidItem = items.some((it) => rowTotal(it) > 0);
  const canSend = client !== null && hasValidItem;

  const [pending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      }))
      .filter((it) => it.quantity > 0 && it.unitPrice > 0);
    if (built.length === 0) {
      setSubmitError("Добавьте хотя бы одну позицию с ценой.");
      return;
    }
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    startTransition(async () => {
      const res = await createDocument(
        {
          type: docType,
          date: iso,
          client: {
            bin: client.bin,
            name: client.name,
            director: client.director,
            address: client.address,
          },
          items: built,
        },
        mode
      );
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
      {/* The document sheet — one elevated piece of paper materialising. */}
      <div className="overflow-hidden rounded-sheet border border-line bg-sheet shadow-sheet">
        {/* ---- masthead ---- */}
        <div className="border-b border-line-soft p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented value={docType} onChange={setDocType} />
            <StatusPill />
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

        {/* ---- client ---- */}
        <section className="border-b border-line-soft p-5 sm:p-7">
          <SectionLabel>Клиент</SectionLabel>
          <ClientField clients={clients} client={client} onSelect={setClient} />
        </section>

        {/* ---- line items ---- */}
        <section className="p-5 sm:p-7">
          <SectionLabel>{copy.itemsTitle}</SectionLabel>

          <div className="space-y-3">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                placeholder={copy.itemPlaceholder}
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
            Добавить {docType === "avr" ? "работу" : "позицию"}
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
          <button
            type="button"
            onClick={() => submit("draft")}
            disabled={pending}
            className="rounded-field px-3.5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-40"
          >
            Сохранить черновик
          </button>

          <div className="flex items-center gap-3">
            {submitError ? (
              <span className="text-sm text-danger">{submitError}</span>
            ) : (
              !canSend && (
                <span className="hidden text-sm text-faint sm:inline">
                  {!client ? "Выберите клиента" : "Добавьте позицию"}
                </span>
              )
            )}
            <button
              type="button"
              onClick={() => submit("send")}
              disabled={!canSend || pending}
              className="inline-flex items-center gap-2 rounded-field bg-tenge px-5 py-2.5 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Отправляем…" : copy.send}
              <IconArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/* ============================================================ client field == */

function ClientField({
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
          У вас пока нет сохранённых клиентов — добавьте первого.
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

  const valid = name.trim().length > 0 && /^\d{12}$/.test(bin);

  return (
    <div className="rounded-card border border-line bg-sheet p-4">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-faint">Название</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ТОО «...» или ИП"
            className={fieldCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-faint">БИН / ИИН</label>
          <input
            value={bin}
            onChange={(e) => setBin(e.target.value.replace(/\D/g, "").slice(0, 12))}
            inputMode="numeric"
            placeholder="12 цифр"
            className={cn(fieldCls, "font-mono tracking-wider")}
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

function StatusPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-paper px-2.5 py-1 text-xs font-medium text-muted">
      <span className="size-1.5 rounded-full bg-faint" />
      Черновик
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
    { k: "invoice", label: "Счёт на оплату" },
    { k: "avr", label: "Акт (АВР)" },
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
  canRemove,
  onChange,
  onRemove,
}: {
  item: LineItem;
  placeholder: string;
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

function DatePopover({
  date,
  onChange,
}: {
  date: Date;
  onChange: (d: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => ({ y: date.getFullYear(), m: date.getMonth() }));
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date();

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
        className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <IconCalendar className="size-4 text-faint" />
        от {formatDateRu(date)}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-card border border-line bg-raised p-3 shadow-pop">
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
              const selected = sameDay(cellDate, date);
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
/* One set, 24-grid, currentColor — consistent throughout. */

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
