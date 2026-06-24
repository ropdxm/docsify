"use client";

import { useRef, useState, useTransition } from "react";
import { cn } from "@/lib/ui";
import { useGlobalPending } from "@/components/loading";
import { createDogovor } from "@/lib/actions/dogovor";
import {
  documentQuotaHint,
  documentQuotaViolation,
  type DocumentQuotaSnapshot,
} from "@/lib/document-quota-shared";
import {
  ClientField,
  DatePopover,
  fieldCls,
  type Client,
  type SavedClient,
} from "../document-form";

type Mode = "write" | "upload";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function DogovorForm({
  company,
  clients,
  quota,
}: {
  company: { name: string; bin: string };
  clients: SavedClient[];
  quota?: DocumentQuotaSnapshot | null;
}) {
  const [date, setDate] = useState<Date>(() => new Date());
  const [client, setClient] = useState<Client | null>(null);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<Mode>("write");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  useGlobalPending(pending);

  const quotaError = quota ? documentQuotaViolation(quota, "dogovor") : null;
  const quotaHint = quota ? documentQuotaHint(quota, "dogovor") : null;
  const canCreate =
    client !== null &&
    (mode === "write" ? body.trim().length > 0 : file !== null) &&
    quotaError === null;

  function submit() {
    setError(null);
    if (quotaError) {
      setError(quotaError);
      return;
    }
    if (!client) {
      setError("Выберите клиента.");
      return;
    }
    if (mode === "write" && !body.trim()) {
      setError("Напишите текст договора.");
      return;
    }
    if (mode === "upload" && !file) {
      setError("Прикрепите PDF-файл договора.");
      return;
    }

    const fd = new FormData();
    fd.set("mode", mode);
    fd.set("title", title.trim());
    fd.set("date", isoDate(date));
    fd.set("clientBin", client.bin);
    fd.set("clientName", client.name);
    fd.set("clientDirector", client.director);
    fd.set("clientAddress", client.address);
    if (mode === "write") fd.set("body", body);
    if (mode === "upload" && file) fd.set("file", file);

    startTransition(async () => {
      const res = await createDogovor(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <div className="overflow-hidden rounded-sheet border border-line bg-sheet shadow-sheet">
        {/* masthead */}
        <div className="border-b border-line-soft p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center rounded-field bg-sunken px-3.5 py-1.5 text-sm font-medium text-ink">
              Договор
            </span>
            <DatePopover date={date} onChange={setDate} />
          </div>
          <div className="mt-5">
            <div className="text-xs text-faint">От кого</div>
            <div className="mt-1 text-sm font-medium">{company.name}</div>
            <div className="font-mono text-xs text-faint">БИН {company.bin}</div>
          </div>
          {quotaHint && (
            <p
              className={cn(
                "mt-4 text-xs",
                quotaError ? "text-danger" : "text-faint"
              )}
            >
              {quotaError ?? quotaHint}
            </p>
          )}
        </div>

        {/* client */}
        <section className="border-b border-line-soft p-5 sm:p-7">
          <SectionLabel>Клиент</SectionLabel>
          <ClientField clients={clients} client={client} onSelect={setClient} />
        </section>

        {/* title */}
        <section className="border-b border-line-soft p-5 sm:p-7">
          <SectionLabel>Название договора</SectionLabel>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="напр. «Договор оказания услуг»"
            className={cn(fieldCls, "max-w-md")}
            aria-label="Название договора"
          />
        </section>

        {/* content */}
        <section className="p-5 sm:p-7">
          <div className="mb-3 inline-flex rounded-field bg-sunken p-1">
            {(
              [
                ["write", "Написать"],
                ["upload", "Загрузить PDF"],
              ] as Array<[Mode, string]>
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                aria-pressed={mode === k}
                className={cn(
                  "rounded-[7px] px-3.5 py-1.5 text-sm font-medium transition-colors",
                  mode === k
                    ? "bg-sheet text-ink shadow-soft"
                    : "text-muted hover:text-ink"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "write" ? (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                "Введите текст договора.\n\nСтороны, предмет, сумма, сроки, реквизиты - всё, как обычно. Пустая строка разделяет абзацы."
              }
              rows={14}
              className={cn(fieldCls, "resize-y font-normal leading-relaxed")}
              aria-label="Текст договора"
            />
          ) : (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
                aria-label="PDF-файл договора"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-line-strong px-4 py-10 text-sm text-muted transition-colors hover:border-tenge/50 hover:text-tenge-ink"
              >
                {file ? (
                  <span className="font-medium text-ink">{file.name}</span>
                ) : (
                  <>Нажмите, чтобы выбрать PDF-файл договора</>
                )}
              </button>
              <p className="mt-1.5 text-xs text-faint">
                Только PDF, до 15 МБ. Word - экспортируйте в PDF.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-end gap-3 px-4 py-3">
          {error ? (
            <span className="text-sm text-danger">{error}</span>
          ) : quotaError ? (
            <span className="text-sm text-danger">{quotaError}</span>
          ) : (
            !canCreate && (
              <span className="hidden text-sm text-faint sm:inline">
                {!client ? "Выберите клиента" : "Добавьте текст или файл"}
              </span>
            )
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!canCreate || pending}
            className="inline-flex items-center gap-2 rounded-field bg-tenge px-5 py-2.5 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Создаём…" : "Создать договор"}
          </button>
        </div>
      </div>
    </form>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">
      {children}
    </h2>
  );
}
