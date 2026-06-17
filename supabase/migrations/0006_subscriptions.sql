-- Subscriptions - a single Pro plan ($5/mo via Stripe) plus a Free plan.
-- New accounts get 1 month of Pro for free (a DB-only trial - no card needed at
-- signup). After the trial they fall back to Free. For now Free and Pro expose
-- identical functionality; the `effectivePlan()` helper centralises the logic so
-- feature gating can be added later without touching call sites.

create table if not exists public.subscriptions (
  company_id            uuid primary key references public.companies (id) on delete cascade,
  plan                  text not null default 'pro',       -- intended plan label
  status                text not null default 'trialing',  -- trialing | active | past_due | canceled | free
  stripe_customer_id    text,
  stripe_subscription_id text,
  trial_ends_at         timestamptz,                        -- end of the 1-month free trial
  current_period_end    timestamptz,                        -- Stripe paid period end
  cancel_at_period_end  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id);
create index if not exists subscriptions_stripe_sub_idx
  on public.subscriptions (stripe_subscription_id);

-- Keep updated_at fresh (reuses the function from 0001_init.sql).
drop trigger if exists subscriptions_touch_updated_at on public.subscriptions;
create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------- RLS --
alter table public.subscriptions enable row level security;

-- The owner can READ their own subscription. All writes go through service-role
-- server code (the trial grant at signup and the Stripe webhook), so no
-- insert/update policy is exposed to the auth/anon roles.
drop policy if exists "own subscription" on public.subscriptions;
create policy "own subscription" on public.subscriptions
  for select
  using (
    company_id in (select id from public.companies where owner_id = auth.uid())
  );

-- ------------------------------------------------------------------ backfill --
-- Give every existing company the same 1-month Pro trial new accounts get, so
-- current users aren't worse off than someone signing up today.
insert into public.subscriptions (company_id, plan, status, trial_ends_at)
select id, 'pro', 'trialing', now() + interval '1 month'
from public.companies
on conflict (company_id) do nothing;
