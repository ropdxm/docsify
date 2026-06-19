"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireCompany, requireUser } from "@/lib/dal";
import { getStripe, stripeConfigured, PRO_PRICE } from "@/lib/stripe";
import { getSubscription } from "@/lib/subscription";
import { createAdminClient } from "@/lib/supabase/admin";

// Returned to the client only on failure; success ends in a redirect to Stripe.
export type BillingState = { error?: string } | undefined;

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Start a Stripe Checkout for Docsify Pro ($5/mo) and redirect the user to it.
 * Reuses the company's Stripe customer if one exists; the resulting subscription
 * carries `company_id` in its metadata so the webhook can map it back.
 */
export async function startProCheckout(
  _prev: BillingState,
  formData: FormData
): Promise<BillingState> {
  void formData; // no form fields - params satisfy the useActionState signature
  if (!stripeConfigured()) return { error: "Оплата временно недоступна." };
  const stripe = getStripe();

  const company = await requireCompany();
  const user = await requireUser();

  const sub = await getSubscription(company.id);
  let customerId = sub?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: company.name,
      metadata: { company_id: company.id, user_id: user.id },
    });
    customerId = customer.id;
    const admin = createAdminClient();
    await admin.from("subscriptions").upsert(
      { company_id: company.id, stripe_customer_id: customerId },
      { onConflict: "company_id" }
    );
  }

  const url = await baseUrl();
  let checkoutUrl: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: company.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: PRO_PRICE.currency,
            unit_amount: PRO_PRICE.unitAmount,
            recurring: { interval: PRO_PRICE.interval },
            product_data: { name: PRO_PRICE.productName },
          },
        },
      ],
      subscription_data: { metadata: { company_id: company.id } },
      allow_promotion_codes: true,
      success_url: `${url}/pricing?upgraded=1`,
      cancel_url: `${url}/pricing?canceled=1`,
    });
    checkoutUrl = session.url;
  } catch (e) {
    return { error: `Не удалось открыть оплату: ${(e as Error).message}` };
  }
  if (!checkoutUrl) return { error: "Не удалось создать сессию оплаты." };

  redirect(checkoutUrl);
}

/**
 * Open the Stripe billing portal so the user can update the card or cancel.
 */
export async function openBillingPortal(
  _prev: BillingState,
  formData: FormData
): Promise<BillingState> {
  void formData; // no form fields - params satisfy the useActionState signature
  if (!stripeConfigured()) return { error: "Оплата временно недоступна." };
  const stripe = getStripe();

  const company = await requireCompany();
  const sub = await getSubscription(company.id);
  if (!sub?.stripe_customer_id) return { error: "Активная подписка не найдена." };

  const url = await baseUrl();
  let portalUrl: string | null = null;
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${url}/pricing`,
    });
    portalUrl = portal.url;
  } catch (e) {
    return { error: `Не удалось открыть управление: ${(e as Error).message}` };
  }

  redirect(portalUrl);
}
