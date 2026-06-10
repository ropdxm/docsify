"use client";

import { useActionState } from "react";
import { login, type AuthState } from "@/lib/actions/auth";
import { field, label, btnPrimary, cn } from "@/lib/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    login,
    undefined
  );

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
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
          <p className="mt-1 text-sm text-danger">{state.fieldErrors.email[0]}</p>
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
          autoComplete="current-password"
          required
          className={field}
        />
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className={cn(btnPrimary, "w-full")}>
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
