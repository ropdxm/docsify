import "server-only";

const DEFAULT_BASE_URL = "http://localhost:3000";

/** The one paid plan: Docsify Pro. Kaspi requires a whole-tenge integer amount. */
export const PRO_PRICE_KZT = 2990;
export const PRO_PERIOD_DAYS = 30;

export type KaspiInvoiceStatus =
  | "processing"
  | "pending"
  | "paid"
  | "cancelled"
  | "expired"
  | "error";

export type KaspiPosInvoice = {
  id: string;
  amount: number | string | null;
  status: KaspiInvoiceStatus;
  remoteStatus: string | null;
  phone?: string | null;
  receiptUrl?: string | null;
  orderNumber?: string | null;
  paidAt?: string | null;
  raw: unknown;
};

export type CreateKaspiInvoiceInput = {
  phoneNumber: string; // 7XXXXXXXXXX
  amount: number; // tenge
  comment?: string;
};

export class KaspiPosError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "KaspiPosError";
    this.status = status;
    this.body = body;
  }
}

export function kaspiPosConfigured(): boolean {
  return Boolean(
    process.env.KASPI_POS_BASE_URL &&
      process.env.KASPI_POS_TOKEN_SN &&
      process.env.KASPI_POS_VTOKEN_SECRET
  );
}

export function normalizeKaspiStatus(
  status?: string | null,
  event?: string | null
): KaspiInvoiceStatus {
  if (event === "payment.success") return "paid";
  if (event === "payment.expired") return "expired";

  const s = (status ?? "").trim().toLowerCase();
  switch (s) {
    case "processed":
    case "remotepaymentpaid":
    case "paid":
    case "success":
      return "paid";
    case "remotepaymentcreated":
    case "processing":
    case "pending":
    case "wait":
      return "pending";
    case "expired":
    case "remotepaymentexpired":
    case "qrtokendiscarded":
      return "expired";
    case "remotepaymentcanceled":
    case "remotepaymentcancelled":
    case "remotepaymentrejected":
    case "cancelledbyuser":
    case "canceled":
    case "cancelled":
    case "notconfirmedbyuser":
    case "cancelledbyexternalsource":
    case "rejected":
    case "insufficientfunds":
    case "insufficientfundserror":
      return "cancelled";
    case "sessionexpired":
    case "processingfailed":
    case "error":
      return "error";
    default:
      return event === "payment.failed" ? "error" : "pending";
  }
}

export function createKaspiInvoice(
  input: CreateKaspiInvoiceInput
): Promise<KaspiPosInvoice> {
  return request("/api/invoice/create", {
    method: "POST",
    body: JSON.stringify({
      phoneNumber: input.phoneNumber,
      amount: input.amount,
      comment: input.comment ?? "",
    }),
  }).then((body) => invoiceFromResponse(body));
}

export function getKaspiInvoice(operationId: string): Promise<KaspiPosInvoice> {
  return request(
    `/api/invoice/details?operationId=${encodeURIComponent(operationId)}`,
    { method: "GET" }
  ).then((body) => invoiceFromResponse(body, operationId));
}

function baseUrl(): string {
  return (process.env.KASPI_POS_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function buildUrl(path: string): string {
  const root = baseUrl();
  const normalizedPath =
    root.endsWith("/api") && path.startsWith("/api/")
      ? path.slice("/api".length)
      : path;
  return `${root}${normalizedPath}`;
}

function sessionHeaders(): Record<string, string> {
  const tokenSN = process.env.KASPI_POS_TOKEN_SN;
  const vtokenSecret = process.env.KASPI_POS_VTOKEN_SECRET;
  if (!tokenSN || !vtokenSecret)
    throw new Error("Kaspi POS session headers are not configured");

  const headers: Record<string, string> = {
    "X-Token-SN": tokenSN,
    "X-Vtoken-Secret": vtokenSecret,
  };
  if (process.env.KASPI_POS_PROFILE_ID)
    headers["X-Profile-Id"] = process.env.KASPI_POS_PROFILE_ID;
  return headers;
}

async function request(path: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(buildUrl(path), {
    ...init,
    headers: {
      ...sessionHeaders(),
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

  if (!res.ok) throw new KaspiPosError(messageOf(body, res.status), res.status, body);
  assertKaspiSuccess(body);
  return body;
}

function assertKaspiSuccess(body: unknown): void {
  if (!body || typeof body !== "object") return;
  const code = (body as Record<string, unknown>).StatusCode;
  if (typeof code === "number" && code !== 0)
    throw new KaspiPosError(messageOf(body, 502), 502, body);
}

function invoiceFromResponse(
  body: unknown,
  fallbackId?: string
): KaspiPosInvoice {
  const data = dataOf(body);
  const id =
    stringField(data, "Id") ??
    stringField(data, "id") ??
    stringField(data, "QrOperationId") ??
    stringField(data, "qrOperationId") ??
    stringField(data, "OperationId") ??
    stringField(data, "operationId") ??
    stringField(data, "PaymentId") ??
    stringField(data, "paymentId") ??
    fallbackId;
  if (!id)
    throw new KaspiPosError(
      "Kaspi POS response did not include an invoice id",
      502,
      body
    );

  const remoteStatus = stringField(data, "Status") ?? stringField(data, "status");
  return {
    id,
    amount: valueOf(data, "Amount") ?? valueOf(data, "amount") ?? null,
    status: normalizeKaspiStatus(remoteStatus),
    remoteStatus,
    phone:
      stringField(data, "ClientMobile") ??
      stringField(data, "PhoneNumber") ??
      stringField(data, "phoneNumber"),
    receiptUrl:
      stringField(data, "ReceiptUrl") ?? stringField(data, "receiptUrl") ?? null,
    orderNumber:
      stringField(data, "OrderNumber") ?? stringField(data, "orderNumber") ?? null,
    paidAt:
      stringField(data, "PaidAt") ??
      stringField(data, "paidAt") ??
      stringField(data, "timestamp") ??
      null,
    raw: body,
  };
}

function dataOf(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const obj = body as Record<string, unknown>;
  const data = obj.Data ?? obj.data;
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

function valueOf(
  obj: Record<string, unknown>,
  key: string
): string | number | null {
  const value = obj[key];
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function stringField(obj: Record<string, unknown>, key: string): string | null {
  const value = valueOf(obj, key);
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function messageOf(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    const data = dataOf(body);
    for (const key of ["message", "error", "Message", "Error", "StatusDesc"]) {
      const value = o[key] ?? data[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return `Kaspi POS request failed (${status})`;
}
