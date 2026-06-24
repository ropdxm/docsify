import { createHmac, timingSafeEqual } from "crypto";
import { applyKaspiOperationStatus } from "@/lib/kaspi";
import { normalizeKaspiStatus } from "@/lib/kaspi-pos";

export const runtime = "nodejs";

// Kaspi POS Automation -> Docsify. The automation service polls Kaspi and POSTs
// signed payment.success / payment.failed / payment.expired events here.
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.KASPI_POS_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 500 });

  const signature = req.headers.get("x-webhook-signature");
  const raw = await req.text(); // RAW body - required for signature verification

  if (!signature || !verify(raw, signature, secret))
    return new Response("Invalid signature", { status: 401 });

  let payload: KaspiPosWebhookPayload;
  try {
    payload = JSON.parse(raw) as KaspiPosWebhookPayload;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  if (payload.type && payload.type !== "invoice")
    return new Response("ignored", { status: 200 });

  const operationId =
    payload.paymentId ?? stringFrom(payload.data?.Id) ?? stringFrom(payload.data?.id);
  if (!operationId) return new Response("Missing paymentId", { status: 400 });

  try {
    const status = normalizeKaspiStatus(payload.status, payload.event);
    await applyKaspiOperationStatus(
      operationId,
      status,
      status === "paid" ? payload.timestamp ?? null : null,
      {
        receiptUrl: payload.receiptUrl ?? stringFrom(payload.data?.ReceiptUrl),
        orderNumber: payload.orderNumber ?? stringFrom(payload.data?.OrderNumber),
        errorMessage: status === "error" ? payload.statusDesc ?? null : null,
      }
    );
  } catch (e) {
    // 500 -> the automation service retries transient DB errors.
    return new Response(`Handler error: ${(e as Error).message}`, { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

type KaspiPosWebhookPayload = {
  event?: string;
  paymentId?: string;
  type?: string;
  status?: string;
  statusDesc?: string;
  amount?: number | null;
  receiptUrl?: string | null;
  orderNumber?: string | null;
  data?: Record<string, unknown>;
  timestamp?: string;
};

function stringFrom(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

// Header form: `X-Webhook-Signature: sha256=<hex>` = HMAC-SHA256(rawBody, secret).
function verify(rawBody: string, signature: string, secret: string): boolean {
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
