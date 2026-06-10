"use client";

import { useActionState } from "react";
import { createCompany, type AuthState } from "@/lib/actions/auth";
import { RequisitesFields } from "@/components/requisites-fields";
import { btnPrimary, cn } from "@/lib/ui";

export function OnboardingForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    createCompany,
    undefined
  );

  return (
    <form action={action} className="space-y-6">
      <RequisitesFields fieldErrors={state?.fieldErrors} />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className={cn(btnPrimary, "w-full")}>
        {pending ? "Сохраняем…" : "Сохранить и продолжить"}
      </button>
    </form>
  );
}
