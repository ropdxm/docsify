import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlan, getSubscription } from "@/lib/subscription";
import {
  documentQuotaViolation,
  type DocumentQuotaBucket,
  type DocumentQuotaSnapshot,
  type LimitedDocumentType,
} from "@/lib/document-quota-shared";

const FREE_TOTAL_LIMIT = 4;
const PRO_TOTAL_LIMIT = 30;
const PRO_INVOICE_LIMIT = 15;
const PRO_CLOSING_LIMIT = 15;
const COUNTED_TYPES: LimitedDocumentType[] = [
  "invoice",
  "avr",
  "nakladnaja",
  "dogovor",
];

function currentMonthWindow(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

function bucket(used: number, limit: number): DocumentQuotaBucket {
  return { used, limit, remaining: Math.max(limit - used, 0) };
}

async function countMonthlyDocuments(
  companyId: string,
  types: LimitedDocumentType[],
  monthStart: string,
  monthEnd: string
): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .in("type", types)
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getDocumentQuotaSnapshot(
  companyId: string
): Promise<DocumentQuotaSnapshot> {
  const { start, end } = currentMonthWindow();
  const monthStart = start.toISOString();
  const monthEnd = end.toISOString();
  const plan = effectivePlan(await getSubscription(companyId));
  const totalUsed = await countMonthlyDocuments(
    companyId,
    COUNTED_TYPES,
    monthStart,
    monthEnd
  );

  if (plan === "free") {
    return {
      plan,
      monthStart,
      monthEnd,
      total: bucket(totalUsed, FREE_TOTAL_LIMIT),
      invoice: null,
      closing: null,
    };
  }

  const [invoiceUsed, closingUsed] = await Promise.all([
    countMonthlyDocuments(companyId, ["invoice"], monthStart, monthEnd),
    countMonthlyDocuments(companyId, ["avr", "nakladnaja"], monthStart, monthEnd),
  ]);

  return {
    plan,
    monthStart,
    monthEnd,
    total: bucket(totalUsed, PRO_TOTAL_LIMIT),
    invoice: bucket(invoiceUsed, PRO_INVOICE_LIMIT),
    closing: bucket(closingUsed, PRO_CLOSING_LIMIT),
  };
}

export async function getDocumentQuotaError(
  companyId: string,
  type: LimitedDocumentType
): Promise<string | null> {
  return documentQuotaViolation(await getDocumentQuotaSnapshot(companyId), type);
}
