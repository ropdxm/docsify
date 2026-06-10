"use client";

import { useState } from "react";
import { field, label, cn } from "@/lib/ui";
import { useBinLookup } from "@/components/use-bin-lookup";

/**
 * Manual requisites entry, shared by signup and onboarding. Inputs carry `name`
 * attributes so they post with the surrounding <form>. Typing a 12-digit
 * БИН/ИИН looks the company up in the KGD registry and fills the name.
 */
export function RequisitesFields({
  fieldErrors,
}: {
  fieldErrors?: Record<string, string[]>;
}) {
  const [bin, setBin] = useState("");
  const [name, setName] = useState("");
  const { state: lookup, onBinChange } = useBinLookup(setName);
  const verified = lookup.status === "found" && name === lookup.name;

  return (
    <div className="space-y-4">
      <div>
        <label className={label} htmlFor="bin">
          Ваш БИН / ИИН
        </label>
        <input
          id="bin"
          name="bin"
          inputMode="numeric"
          maxLength={12}
          placeholder="12 цифр"
          value={bin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 12);
            setBin(v);
            onBinChange(v);
          }}
          className={`${field} font-mono tracking-wider`}
        />
        {lookup.status === "loading" && (
          <p className="mt-1 text-sm text-faint">Ищем в реестре КГД…</p>
        )}
        {lookup.status === "notfound" && (
          <p className="mt-1 text-sm text-danger">{lookup.error}</p>
        )}
        {lookup.status === "found" && lookup.liquidated && (
          <p className="mt-1 text-sm text-danger">
            По данным КГД налогоплательщик снят с учёта (ликвидирован).
          </p>
        )}
        {fieldErrors?.bin && (
          <p className="mt-1 text-sm text-danger">{fieldErrors.bin[0]}</p>
        )}
      </div>

      <div>
        <label className={label} htmlFor="name">
          Название компании
          {verified && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-pill bg-tenge-tint px-2 py-0.5 text-xs font-medium text-tenge-ink">
              ✓ Реестр КГД
            </span>
          )}
        </label>
        <input
          id="name"
          name="name"
          placeholder="ТОО «...» или ИП"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
        />
        {fieldErrors?.name && (
          <p className="mt-1 text-sm text-danger">{fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="director">
            Руководитель
          </label>
          <input id="director" name="director" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="address">
            Адрес
          </label>
          <input id="address" name="address" className={field} />
        </div>
      </div>

      <div className="border-t border-line-soft pt-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-faint">
          Банковские реквизиты
        </p>
        <BankFields fieldErrors={fieldErrors} />
      </div>
    </div>
  );
}

/**
 * The requisites printed in the «Платежное поручение» block of the official
 * счёт template: ИИК, банк, БИК, Кбе, КНП. Shared by signup and the profile
 * page's "add bank profile" form.
 */
export function BankFields({
  fieldErrors,
  withLabel,
}: {
  fieldErrors?: Record<string, string[]>;
  withLabel?: boolean;
}) {
  const err = (key: string) =>
    fieldErrors?.[key] && (
      <p className="mt-1 text-sm text-danger">{fieldErrors[key][0]}</p>
    );

  return (
    <div className="space-y-4">
      {withLabel && (
        <div>
          <label className={label} htmlFor="bank-label">
            Название профиля
          </label>
          <input
            id="bank-label"
            name="label"
            placeholder="напр. «Основной счёт»"
            className={field}
          />
          {err("label")}
        </div>
      )}

      <div>
        <label className={label} htmlFor="iik">
          ИИК (номер счёта)
        </label>
        <input
          id="iik"
          name="iik"
          placeholder="KZ00000000000000000000"
          maxLength={20}
          className={cn(field, "font-mono tracking-wider uppercase")}
        />
        {err("iik")}
      </div>

      <div>
        <label className={label} htmlFor="bank_name">
          Банк
        </label>
        <input
          id="bank_name"
          name="bank_name"
          placeholder="АО «...»"
          className={field}
        />
        {err("bank_name")}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="bik">
            БИК
          </label>
          <input
            id="bik"
            name="bik"
            placeholder="KSNVKZKA"
            maxLength={11}
            className={cn(field, "font-mono tracking-wider uppercase")}
          />
          {err("bik")}
        </div>
        <div>
          <label className={label} htmlFor="kbe">
            Кбе
          </label>
          <input
            id="kbe"
            name="kbe"
            inputMode="numeric"
            maxLength={2}
            placeholder="17 — ТОО, 19 — ИП"
            className={field}
          />
          {err("kbe")}
        </div>
        <div>
          <label className={label} htmlFor="knp">
            КНП{" "}
            <span className="font-normal text-faint">(необязательно)</span>
          </label>
          <input
            id="knp"
            name="knp"
            inputMode="numeric"
            maxLength={3}
            placeholder="859"
            className={field}
          />
          {err("knp")}
        </div>
      </div>
    </div>
  );
}
