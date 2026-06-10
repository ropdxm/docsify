import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** OAuth (Google) redirect target: exchanges the code for a session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // New OAuth users have no requisites yet → send them to onboarding.
        const { data: company } = await supabase
          .from("companies")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();
        const dest = company ? next : "/onboarding";
        return NextResponse.redirect(new URL(dest, url.origin));
      }
    }
  }

  return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
}
