"use client";

import { useActionState, useState } from "react";
import {
  createBankProfile,
  type BankProfileState,
} from "@/lib/actions/bank-profiles";
import { BankFields } from "@/components/requisites-fields";
import { useGlobalPending } from "@/components/loading";
import { btnPrimary, btnGhost } from "@/lib/ui";

export function AddBankProfile() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<BankProfileState, FormData>(
    async (prev, formData) => {
      const res = await createBankProfile(prev, formData);
      if (res?.ok) setOpen(false); // close once the profile is saved
      return res;
    },
    undefined
  );
  useGlobalPending(pending);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-field border border-dashed border-line-strong px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-tenge/50 hover:text-tenge-ink"
      >
        + Добавить реквизиты
      </button>
    );
  }

  return (
    <form
      action={action}
      className="space-y-4 rounded-card border border-line bg-sheet p-4 sm:p-5"
    >
      <BankFields withLabel fieldErrors={state?.fieldErrors} />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex items-center gap-2">
        <button disabled={pending} className={btnPrimary}>
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          Отмена
        </button>
      </div>
    </form>
  );
}
