-- ApiPay (Kaspi Pay) - replaces Stripe as the Pro plan payment method.
-- Kaspi Pay is invoice-based, NOT auto-recurring: each successful payment grants
-- PRO_PERIOD_DAYS (30) days of Pro; the user re-pays to renew. Money lands in
-- Docsify's own Kaspi Business account. Run in the Supabase SQL editor, or
-- `supabase db push`.

-- Which provider last set the live billing period (for display / debugging).
alter table public.subscriptions
  add column if not exists provider text;          -- 'stripe' | 'kaspi' | null

-- One row per Kaspi invoice we create through ApiPay. The webhook (and the
-- polling fallback) update `status`; on the first transition to `paid` we extend
-- the company's subscription.
create table if not exists public.kaspi_invoices (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  apipay_invoice_id bigint,                        -- ApiPay's numeric invoice id (set after create)
  external_order_id text not null unique,          -- our id, sent to ApiPay for reconciliation
  purpose           text not null default 'pro_subscription',
  amount            integer not null,              -- tenge (whole)
  phone             text not null,                 -- payer's Kaspi phone, 8XXXXXXXXXX
  status            text not null default 'processing', -- processing|pending|paid|cancelled|expired|error
  error_message     text,
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- apipay_invoice_id is unique once set; Postgres allows multiple NULLs, so rows
-- created before the ApiPay response arrives don't collide.
create unique index if not exists kaspi_invoices_apipay_id_idx
  on public.kaspi_invoices (apipay_invoice_id);
create index if not exists kaspi_invoices_company_idx
  on public.kaspi_invoices (company_id);

-- Keep updated_at fresh (reuses the function from 0001_init.sql).
drop trigger if exists kaspi_invoices_touch_updated_at on public.kaspi_invoices;
create trigger kaspi_invoices_touch_updated_at
  before update on public.kaspi_invoices
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------- RLS --
alter table public.kaspi_invoices enable row level security;

-- The owner can READ their own invoices (to poll payment status). All writes go
-- through service-role server code (the create-invoice action and the webhook),
-- so no insert/update policy is exposed to the auth/anon roles.
drop policy if exists "own kaspi invoices" on public.kaspi_invoices;
create policy "own kaspi invoices" on public.kaspi_invoices
  for select
  using (
    company_id in (select id from public.companies where owner_id = auth.uid())
  );
