import "server-only";

// ApiPay.kz - Kaspi Pay acceptance over HTTP API. Docs: https://apipay.kz/for-ai
// The API key authenticates via the `X-API-Key` header and is SERVER ONLY - never
// import this module into a Client Component. Payments settle into Docsify's own
// Kaspi Business account.

const DEFAULT_BASE_URL = "https://bpapi.bazarbay.site/api/v1";

/** The one paid plan: Docsify Pro. Kaspi requires a whole-tenge integer amount. */
export const PRO_PRICE_KZT = 2500; // change this single value to reprice
export const PRO_PERIOD_DAYS = 30; // one paid invoice = this many days of Pro

export type InvoiceStatus =
  | "processing"
  | "pending"
  | "paid"
  | "cancelled"
  | "expired"
  | "error";

export type ApipayInvoice = {
  id: number;
  amount: number | string;
  status: InvoiceStatus;
  phone?: string;
  external_order_id?: string;
  error_message?: string | null;
  created_at?: string;
  paid_at?: string | null;
};

export type CreateInvoiceInput = {
  phone_number: string; // 8XXXXXXXXXX (11 digits)
  amount: number; // tenge
  description?: string; // up to 500 chars
  external_order_id?: string; // our id, echoed back in the webhook
};

export class ApipayError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApipayError";
    this.status = status;
    this.body = body;
  }
}

export function apipayConfigured(): boolean {
  return Boolean(process.env.APIPAY_API_KEY);
}

function baseUrl(): string {
  return process.env.APIPAY_BASE_URL || DEFAULT_BASE_URL;
}

function messageOf(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (typeof o.error === "string") return o.error;
  }
  return `ApiPay request failed (${status})`;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const key = process.env.APIPAY_API_KEY;
  if (!key) throw new Error("APIPAY_API_KEY is not set");

  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "X-API-Key": key,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) throw new ApipayError(messageOf(body, res.status), res.status, body);
  return body as T;
}

/** Create a Kaspi invoice; the customer confirms payment in their Kaspi app. */
export function createInvoice(input: CreateInvoiceInput): Promise<ApipayInvoice> {
  return request<ApipayInvoice>("/invoices", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Fetch an invoice's current state (used by the polling fallback). */
export function getInvoice(id: number | string): Promise<ApipayInvoice> {
  return request<ApipayInvoice>(`/invoices/${id}`, { method: "GET" });
}
