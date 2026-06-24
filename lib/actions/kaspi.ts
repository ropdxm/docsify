"use server";

import { requireCompany } from "@/lib/dal";
import {
  kaspiPosConfigured,
  createKaspiInvoice,
  getKaspiInvoice,
  KaspiPosError,
  PRO_PRICE_KZT,
  PRO_PERIOD_DAYS,
} from "@/lib/kaspi-pos";
import { applyKaspiInvoiceStatus } from "@/lib/kaspi";
import { createAdminClient } from "@/lib/supabase/admin";

// Server actions backing the Kaspi POS checkout on /pricing. The phone form
// submits to startKaspiCheckout; the pending UI then polls getKaspiInvoiceStatus.

export type KaspiCheckoutState =
  | { ok: true; orderId: string }
  | { ok: false; error: string }
  | undefined;

const TERMINAL = ["paid", "cancelled", "expired", "error"];

/** Accept 8XXXXXXXXXX / +7XXXXXXXXXX / 7XXXXXXXXXX / XXXXXXXXXX -> 7XXXXXXXXXX. */
function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10) d = "7" + d;
  return /^7\d{10}$/.test(d) ? d : null;
}

function friendlyError(e: unknown): string {
  if (e instanceof KaspiPosError) {
    switch (e.status) {
      case 401:
        return "Оплата временно недоступна: сессия Kaspi POS не настроена или истекла.";
      case 400:
      case 422:
        return "Неверный номер. Используйте формат +7 700 000 00 00.";
      case 429:
        return "Слишком много попыток. Подождите немного и повторите.";
      case 500:
      case 502:
      case 503:
        return "Kaspi-касса не подключена. Напишите в поддержку Docsify.";
      default:
        return "Не удалось открыть оплату. Попробуйте позже.";
    }
  }
  return "Не удалось открыть оплату. Попробуйте позже.";
}

export async function startKaspiCheckout(
  _prev: KaspiCheckoutState,
  formData: FormData
): Promise<KaspiCheckoutState> {
  if (!kaspiPosConfigured())
    return { ok: false, error: "Оплата временно недоступна." };

  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phone)
    return {
      ok: false,
      error: "Введите номер Kaspi в формате +7 700 000 00 00.",
    };

  const company = await requireCompany();
  const admin = createAdminClient();
  const orderId = `pro_${company.id}_${Date.now()}`;

  // Insert the row BEFORE calling Kaspi POS, so a webhook that arrives before the
  // create-response can still match by external_order_id.
  const { error: insErr } = await admin.from("kaspi_invoices").insert({
    company_id: company.id,
    external_order_id: orderId,
    purpose: "pro_subscription",
    amount: PRO_PRICE_KZT,
    phone,
    status: "processing",
  });
  if (insErr)
    return {
      ok: false,
      error: "Не удалось создать счёт. Попробуйте ещё раз.",
    };

  try {
    const invoice = await createKaspiInvoice({
      phoneNumber: phone,
      amount: PRO_PRICE_KZT,
      comment: `Docsify Pro - ${PRO_PERIOD_DAYS} дней`,
    });
    await admin
      .from("kaspi_invoices")
      .update({
        kaspi_operation_id: invoice.id,
        status: invoice.status,
        kaspi_receipt_url: invoice.receiptUrl,
        kaspi_order_number: invoice.orderNumber,
      })
      .eq("external_order_id", orderId);
    return { ok: true, orderId };
  } catch (e) {
    await admin
      .from("kaspi_invoices")
      .update({ status: "error", error_message: (e as Error).message })
      .eq("external_order_id", orderId);
    return { ok: false, error: friendlyError(e) };
  }
}

/**
 * Current status of the pending invoice for the polling UI. Reads our own row
 * (kept in sync by the webhook) and, while non-terminal, actively pulls the
 * latest from Kaspi POS - so the flow also completes without a public webhook URL
 * (e.g. local dev without a tunnel).
 */
export async function getKaspiInvoiceStatus(orderId: string): Promise<string | null> {
  const company = await requireCompany();
  const admin = createAdminClient();

  const { data } = await admin
    .from("kaspi_invoices")
    .select("status, kaspi_operation_id")
    .eq("external_order_id", orderId)
    .eq("company_id", company.id)
    .maybeSingle();
  const row = data as {
    status: string;
    kaspi_operation_id: string | null;
  } | null;
  if (!row) return null;

  if (TERMINAL.includes(row.status) || !row.kaspi_operation_id || !kaspiPosConfigured())
    return row.status;

  try {
    const fresh = await getKaspiInvoice(row.kaspi_operation_id);
    if (fresh.status && fresh.status !== row.status) {
      await applyKaspiInvoiceStatus(orderId, fresh.status, fresh.paidAt ?? null, {
        receiptUrl: fresh.receiptUrl,
        orderNumber: fresh.orderNumber,
      });
      return fresh.status;
    }
  } catch {
    // Network/API hiccup - fall back to the stored status.
  }
  return row.status;
}

/**
 * The company's current Pro period end (ISO), or null. Used by the pay page's
 * success screen to show the date access is granted until.
 */
export async function getProPeriodEnd(): Promise<string | null> {
  const company = await requireCompany();
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("current_period_end")
    .eq("company_id", company.id)
    .maybeSingle();
  return (
    (data as { current_period_end: string | null } | null)?.current_period_end ??
    null
  );
}
