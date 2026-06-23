import { createHmac, timingSafeEqual } from "crypto";
import { applyKaspiInvoiceStatus } from "@/lib/kaspi";

export const runtime = "nodejs";

// ApiPay (Kaspi Pay) -> Docsify. ApiPay POSTs invoice status changes here; we
// verify the HMAC-SHA256 signature over the RAW request body, then sync the
// invoice and extend Pro on `paid`. Configure the endpoint URL + signing secret
// in the ApiPay dashboard (Settings -> "Подключение"). ApiPay retries up to ~11
// times over ~2h until it gets a 2xx, so the handler must be idempotent.
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.APIPAY_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 500 });

  const signature = req.headers.get("x-webhook-signature");
  const raw = await req.text(); // RAW body - required for signature verification

  if (!signature || !verify(raw, signature, secret))
    return new Response("Invalid signature", { status: 401 });

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  // Dashboard "Проверить уведомления" sends this - just ack it.
  if (payload.event === "webhook.test") return new Response("ok", { status: 200 });

  try {
    if (payload.event === "invoice.status_changed" && payload.invoice) {
      const { external_order_id, status, paid_at } = payload.invoice;
      if (external_order_id && status)
        await applyKaspiInvoiceStatus(external_order_id, status, paid_at ?? null);
    }
  } catch (e) {
    // 500 -> ApiPay retries, which is what we want for transient DB errors.
    return new Response(`Handler error: ${(e as Error).message}`, { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

type WebhookPayload = {
  event: string;
  invoice?: {
    id: number;
    external_order_id?: string;
    amount?: string;
    status?: string;
    paid_at?: string | null;
  };
  source?: string;
  timestamp?: string;
};

// Header form: `X-Webhook-Signature: sha256=<hex>` = HMAC-SHA256(rawBody, secret).
function verify(rawBody: string, signature: string, secret: string): boolean {
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
