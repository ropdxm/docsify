"use client";

import { useActionState } from "react";
import { createCompany, type AuthState } from "@/lib/actions/auth";
import { RequisitesFields } from "@/components/requisites-fields";
import { useGlobalPending } from "@/components/loading";
import { btnPrimary, cn } from "@/lib/ui";

export function OnboardingForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    createCompany,
    undefined
  );
  useGlobalPending(pending);

  return (
    <form action={action} className="space-y-6">
      {next && <input type="hidden" name="next" value={next} />}
      <RequisitesFields fieldErrors={state?.fieldErrors} />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className={cn(btnPrimary, "w-full")}>
        {pending ? "Сохраняем…" : "Сохранить и продолжить"}
      </button>
    </form>
  );
}
