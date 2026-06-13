import "server-only";
import Stripe from "stripe";

// Lazily-created singleton. The Stripe constructor throws on an empty key, so we
// must NOT instantiate at module load (that would break `next build` and any
// request before billing is configured). Callers gate on `stripeConfigured()`
// and only reach `getStripe()` once the key is known to be present.
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, { appInfo: { name: "docsify" } });
  }
  return client;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// The one paid plan: docsify Pro, $5/month. Defined inline (price_data) so there's
// no Stripe Dashboard price to create and keep in sync — the amount lives here.
export const PRO_PRICE = {
  currency: "usd",
  unitAmount: 500, // $5.00, in cents
  interval: "month" as const,
  productName: "docsify Pro",
} as const;
