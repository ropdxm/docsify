import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Stripe → docsify sync. Stripe POSTs subscription lifecycle events here; we
// verify the signature and mirror the relevant fields into `subscriptions`.
// Configure the endpoint URL + signing secret in the Stripe Dashboard (or via
// `stripe listen --forward-to .../api/stripe/webhook` in development).
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 500 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const stripe = getStripe();
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (e) {
    return new Response(`Invalid signature: ${(e as Error).message}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break; // ignore everything else
    }
  } catch (e) {
    // 500 makes Stripe retry, which is what we want for transient DB errors.
    return new Response(`Handler error: ${(e as Error).message}`, {
      status: 500,
    });
  }

  return new Response("ok", { status: 200 });
}

// Mirror a Stripe Subscription into our `subscriptions` row. Maps by the
// `company_id` we stamped into the subscription metadata, falling back to the
// Stripe customer id.
async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const admin = createAdminClient();

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // `current_period_end` lives on the subscription item in recent API versions;
  // fall back to the (older) top-level field if present.
  const item = sub.items?.data?.[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number })
    | undefined;
  const periodEndSec =
    item?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    null;

  // Collapse Stripe's terminal/failed states into our "canceled".
  const dead: Stripe.Subscription.Status[] = [
    "canceled",
    "unpaid",
    "incomplete_expired",
  ];
  const status = dead.includes(sub.status) ? "canceled" : sub.status;

  const patch = {
    plan: "pro",
    status,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    current_period_end: periodEndSec
      ? new Date(periodEndSec * 1000).toISOString()
      : null,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
  };

  const companyId = sub.metadata?.company_id;
  if (companyId) {
    await admin
      .from("subscriptions")
      .upsert({ company_id: companyId, ...patch }, { onConflict: "company_id" });
  } else {
    await admin
      .from("subscriptions")
      .update(patch)
      .eq("stripe_customer_id", customerId);
  }
}
