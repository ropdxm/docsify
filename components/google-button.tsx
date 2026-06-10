"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { btnGhost, cn } from "@/lib/ui";

export function GoogleButton({ next = "/dashboard" }: { next?: string }) {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setPending(false);
  }

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={pending}
      className={cn(btnGhost, "w-full")}
    >
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path fill="#4285F4" d="M22.5 12.2c0-.7-.06-1.4-.18-2.06H12v3.9h5.9a5.05 5.05 0 0 1-2.19 3.32v2.76h3.54c2.07-1.9 3.25-4.71 3.25-7.92Z" />
        <path fill="#34A853" d="M12 23c2.95 0 5.43-.98 7.24-2.64l-3.54-2.76c-.98.66-2.24 1.05-3.7 1.05-2.85 0-5.26-1.92-6.12-4.5H2.13v2.85A11 11 0 0 0 12 23Z" />
        <path fill="#FBBC05" d="M5.88 14.15a6.6 6.6 0 0 1 0-4.3V7H2.13a11 11 0 0 0 0 9.85l3.75-2.7Z" />
        <path fill="#EA4335" d="M12 5.2c1.6 0 3.05.55 4.18 1.63l3.14-3.14A11 11 0 0 0 2.13 7l3.75 2.85C6.74 7.12 9.15 5.2 12 5.2Z" />
      </svg>
      Продолжить с Google
    </button>
  );
}
