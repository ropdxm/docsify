export type LimitedDocumentType = "invoice" | "avr" | "nakladnaja" | "dogovor";
export type QuotaPlan = "free" | "pro";
export type DocumentQuotaCode =
  | "DOC_QUOTA_FREE_TOTAL"
  | "DOC_QUOTA_PRO_TOTAL"
  | "DOC_QUOTA_PRO_INVOICE"
  | "DOC_QUOTA_PRO_CLOSING";

export type DocumentQuotaBucket = {
  used: number;
  limit: number;
  remaining: number;
};

export type DocumentQuotaSnapshot = {
  plan: QuotaPlan;
  monthStart: string;
  monthEnd: string;
  total: DocumentQuotaBucket;
  invoice: DocumentQuotaBucket | null;
  closing: DocumentQuotaBucket | null;
};

export const DOCUMENT_QUOTA_MESSAGES: Record<DocumentQuotaCode, string> = {
  DOC_QUOTA_FREE_TOTAL:
    "Лимит Free: 4 документа в месяц. В этом месяце лимит уже использован.",
  DOC_QUOTA_PRO_TOTAL:
    "Лимит Pro: 30 документов в месяц. В этом месяце лимит уже использован.",
  DOC_QUOTA_PRO_INVOICE:
    "Лимит Pro: 15 счетов в месяц. В этом месяце лимит уже использован.",
  DOC_QUOTA_PRO_CLOSING:
    "Лимит Pro: 15 АВР и накладных вместе в месяц. В этом месяце лимит уже использован.",
};

export function documentQuotaMessageFromError(message: string): string | null {
  for (const [code, text] of Object.entries(DOCUMENT_QUOTA_MESSAGES)) {
    if (message.includes(code)) return text;
  }
  return null;
}

export function documentQuotaViolation(
  quota: DocumentQuotaSnapshot,
  type: LimitedDocumentType
): string | null {
  if (quota.total.remaining <= 0) {
    return quota.plan === "pro"
      ? DOCUMENT_QUOTA_MESSAGES.DOC_QUOTA_PRO_TOTAL
      : DOCUMENT_QUOTA_MESSAGES.DOC_QUOTA_FREE_TOTAL;
  }

  if (quota.plan !== "pro") return null;

  if (type === "invoice" && quota.invoice && quota.invoice.remaining <= 0) {
    return DOCUMENT_QUOTA_MESSAGES.DOC_QUOTA_PRO_INVOICE;
  }

  if (
    (type === "avr" || type === "nakladnaja") &&
    quota.closing &&
    quota.closing.remaining <= 0
  ) {
    return DOCUMENT_QUOTA_MESSAGES.DOC_QUOTA_PRO_CLOSING;
  }

  return null;
}

export function documentQuotaHint(
  quota: DocumentQuotaSnapshot,
  type: LimitedDocumentType
): string {
  if (quota.plan === "free") {
    return `Free: ${quota.total.used}/${quota.total.limit} документов в этом месяце`;
  }

  if (type === "invoice" && quota.invoice) {
    return `Pro: ${quota.invoice.used}/${quota.invoice.limit} счетов, всего ${quota.total.used}/${quota.total.limit}`;
  }

  if ((type === "avr" || type === "nakladnaja") && quota.closing) {
    return `Pro: ${quota.closing.used}/${quota.closing.limit} АВР/накладных, всего ${quota.total.used}/${quota.total.limit}`;
  }

  return `Pro: ${quota.total.used}/${quota.total.limit} документов в этом месяце`;
}
