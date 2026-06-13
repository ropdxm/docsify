"use client";

import { useActionState } from "react";
import { signup, type AuthState } from "@/lib/actions/auth";
import { RequisitesFields } from "@/components/requisites-fields";
import { useGlobalPending } from "@/components/loading";
import { field, label, btnPrimary, cn } from "@/lib/ui";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signup,
    undefined
  );
  useGlobalPending(pending);

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className={label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={field}
          />
          {state?.fieldErrors?.email && (
            <p className="mt-1 text-sm text-danger">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>
        <div>
          <label className={label} htmlFor="password">
            Пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className={field}
          />
          {state?.fieldErrors?.password && (
            <p className="mt-1 text-sm text-danger">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-line-soft pt-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-faint">
          Реквизиты вашей компании
        </p>
        <RequisitesFields fieldErrors={state?.fieldErrors} />
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}

      <button disabled={pending} className={cn(btnPrimary, "w-full")}>
        {pending ? "Создаём…" : "Создать аккаунт"}
      </button>
    </form>
  );
}
