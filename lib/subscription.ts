import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type Plan = "pro" | "free";

/** Length of the complimentary Pro trial granted to a new company, in days. */
export const FREE_TRIAL_DAYS = 7;

export type Subscription = {
  company_id: string;
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  provider: string | null; // 'stripe' | 'kaspi' | null
};

/** Is there a live, paid subscription (Stripe or Kaspi), not just the trial? */
export function isPaidPro(sub: Subscription | null): boolean {
  if (!sub) return false;
  if (sub.status !== "active" && sub.status !== "trialing") return false;
  // Paid access is keyed on a live billing period, set by either provider: the
  // Stripe webhook or a paid Kaspi invoice. (The free trial leaves
  // current_period_end null and is handled by effectivePlan via trial_ends_at.)
  return (
    sub.current_period_end != null &&
    new Date(sub.current_period_end).getTime() > Date.now()
  );
}

/**
 * The plan that's actually in effect right now. Pro while either a paid
 * subscription is live OR the free trial hasn't ended; Free otherwise.
 * Single source of truth so feature gating can be added later in one place.
 */
export function effectivePlan(sub: Subscription | null): Plan {
  if (!sub) return "free";
  if (isPaidPro(sub)) return "pro";
  if (sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() > Date.now())
    return "pro";
  return "free";
}

/** Whole days left in the free trial (0 once it has ended or there is none). */
export function trialDaysLeft(sub: Subscription | null): number {
  if (!sub?.trial_ends_at) return 0;
  const ms = new Date(sub.trial_ends_at).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

export const getSubscription = cache(
  async (companyId: string): Promise<Subscription | null> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("subscriptions")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    return (data as Subscription | null) ?? null;
  }
);

/**
 * Grant the free Pro trial (FREE_TRIAL_DAYS) for a freshly created company.
 * Idempotent: `ignoreDuplicates` means an existing subscription (e.g. a paid one)
 * is never reset. Runs with the service role (RLS exposes no insert policy).
 */
export async function ensureTrialSubscription(companyId: string): Promise<void> {
  const admin = createAdminClient();
  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + FREE_TRIAL_DAYS);
  await admin.from("subscriptions").upsert(
    {
      company_id: companyId,
      plan: "pro",
      status: "trialing",
      trial_ends_at: trialEnds.toISOString(),
    },
    { onConflict: "company_id", ignoreDuplicates: true }
  );
}
