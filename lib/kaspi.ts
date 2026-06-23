import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRO_PERIOD_DAYS } from "@/lib/apipay";

// Fulfillment for Kaspi (ApiPay) payments. Shared by the webhook and the polling
// fallback so the "mark paid -> extend Pro" logic lives in exactly one place.
// Runs with the service role (the kaspi_invoices / subscriptions tables expose no
// write policy to the auth/anon roles).

type InvoiceRow = {
  id: string;
  company_id: string;
  status: string;
};

/**
 * Apply a status update to a Kaspi invoice and, on the FIRST transition to
 * `paid`, extend the company's Pro subscription by PRO_PERIOD_DAYS. Idempotent:
 * a repeat `paid` (ApiPay retries webhooks up to ~11x) is a no-op for billing.
 */
export async function applyKaspiInvoiceStatus(
  orderId: string,
  status: string,
  paidAt?: string | null
): Promise<void> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("kaspi_invoices")
    .select("id, company_id, status")
    .eq("external_order_id", orderId)
    .maybeSingle();
  const row = data as InvoiceRow | null;
  if (!row) return; // unknown invoice - ignore

  if (row.status === status) return; // nothing changed

  await admin
    .from("kaspi_invoices")
    .update({
      status,
      paid_at: status === "paid" ? paidAt ?? new Date().toISOString() : null,
    })
    .eq("id", row.id);

  // Only grant on the edge into `paid` (row.status was something else above).
  if (status === "paid") await grantProPeriod(row.company_id);
}

/**
 * Extend Pro by PRO_PERIOD_DAYS. Stacks onto an unexpired period (paying early
 * adds time rather than discarding it); otherwise starts from now.
 */
async function grantProPeriod(companyId: string): Promise<void> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("subscriptions")
    .select("current_period_end")
    .eq("company_id", companyId)
    .maybeSingle();
  const existingEnd = (data as { current_period_end: string | null } | null)
    ?.current_period_end;

  const base =
    existingEnd && new Date(existingEnd).getTime() > Date.now()
      ? new Date(existingEnd)
      : new Date();
  base.setDate(base.getDate() + PRO_PERIOD_DAYS);

  await admin.from("subscriptions").upsert(
    {
      company_id: companyId,
      plan: "pro",
      status: "active",
      provider: "kaspi",
      current_period_end: base.toISOString(),
      cancel_at_period_end: false,
    },
    { onConflict: "company_id" }
  );
}
