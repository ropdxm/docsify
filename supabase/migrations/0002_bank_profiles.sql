-- Bank requisite profiles. A company can keep several sets of banking
-- requisites (different banks/accounts) and pick one per document; exactly
-- one is the primary used by default.

create table if not exists public.bank_profiles (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  label      text not null default '',   -- optional display name, e.g. «Kaspi»
  iik        text not null,              -- ИИК: KZ IBAN, 20 chars
  bank_name  text not null,              -- e.g. АО «Фридом Банк Казахстан»
  bik        text not null,              -- БИК (SWIFT), e.g. KSNVKZKA
  kbe        text not null default '19', -- Кбе: 17 - ТОО, 19 - ИП
  knp        text,                       -- Код назначения платежа, optional
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- At most one primary profile per company.
create unique index if not exists bank_profiles_one_primary
  on public.bank_profiles (company_id) where is_primary;

create index if not exists bank_profiles_company_idx
  on public.bank_profiles (company_id, created_at);

alter table public.bank_profiles enable row level security;

drop policy if exists "own bank profiles" on public.bank_profiles;
create policy "own bank profiles" on public.bank_profiles
  for all
  using (company_id in (select id from public.companies where owner_id = auth.uid()))
  with check (company_id in (select id from public.companies where owner_id = auth.uid()));

-- Which requisites a document was issued with. Render falls back to the
-- company's primary profile when null (legacy docs / deleted profiles).
alter table public.documents
  add column if not exists bank_profile_id uuid references public.bank_profiles (id) on delete set null;

-- Backfill: lift the legacy single account off companies into a primary profile.
insert into public.bank_profiles (company_id, iik, bank_name, bik, is_primary)
select c.id, c.bank_account, coalesce(c.bank_name, ''), '', true
from public.companies c
where c.bank_account is not null
  and not exists (select 1 from public.bank_profiles bp where bp.company_id = c.id);
