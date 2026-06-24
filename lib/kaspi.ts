import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRO_PERIOD_DAYS, type KaspiInvoiceStatus } from "@/lib/kaspi-pos";

type InvoiceRow = {
  id: string;
  company_id: string;
  status: string;
};

type InvoiceUpdateMeta = {
  receiptUrl?: string | null;
  orderNumber?: string | null;
  errorMessage?: string | null;
};

/**
 * Apply a status update to a Kaspi invoice and, on the FIRST transition to
 * `paid`, extend the company's Pro subscription by PRO_PERIOD_DAYS. Idempotent:
 * a repeat `paid` is a no-op for billing.
 */
export async function applyKaspiInvoiceStatus(
  orderId: string,
  status: KaspiInvoiceStatus,
  paidAt?: string | null,
  meta?: InvoiceUpdateMeta
): Promise<void> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("kaspi_invoices")
    .select("id, company_id, status")
    .eq("external_order_id", orderId)
    .maybeSingle();
  const row = data as InvoiceRow | null;
  if (!row) return; // unknown invoice - ignore

  await applyKaspiInvoiceRowStatus(row, status, paidAt, meta);
}

export async function applyKaspiOperationStatus(
  operationId: string,
  status: KaspiInvoiceStatus,
  paidAt?: string | null,
  meta?: InvoiceUpdateMeta
): Promise<void> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("kaspi_invoices")
    .select("id, company_id, status")
    .eq("kaspi_operation_id", operationId)
    .maybeSingle();
  const row = data as InvoiceRow | null;

  if (!row) return; // unknown invoice - ignore

  await applyKaspiInvoiceRowStatus(row, status, paidAt, meta);
}

async function applyKaspiInvoiceRowStatus(
  row: InvoiceRow,
  status: KaspiInvoiceStatus,
  paidAt?: string | null,
  meta?: InvoiceUpdateMeta
): Promise<void> {
  const admin = createAdminClient();
  const hasMeta =
    meta?.receiptUrl != null || meta?.orderNumber != null || meta?.errorMessage != null;

  if (row.status === status && !hasMeta) return; // nothing changed

  const update: Record<string, string | null> = { status };
  if (status === "paid" && row.status !== "paid")
    update.paid_at = paidAt ?? new Date().toISOString();
  if (status !== "paid") update.paid_at = null;
  if (meta?.receiptUrl != null) update.kaspi_receipt_url = meta.receiptUrl;
  if (meta?.orderNumber != null) update.kaspi_order_number = meta.orderNumber;
  if (meta?.errorMessage != null) update.error_message = meta.errorMessage;

  await admin.from("kaspi_invoices").update(update).eq("id", row.id);

  // Only grant on the edge into `paid` (row.status was something else above).
  if (status === "paid" && row.status !== "paid") await grantProPeriod(row.company_id);
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
