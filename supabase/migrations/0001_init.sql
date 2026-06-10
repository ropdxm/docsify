-- Быстрые деньги — initial schema.
-- NOTE: the CLAUDE.md "Data Models (Firestore)" section is stale; the stack is
-- Supabase. These are the Postgres equivalents (Timestamp -> timestamptz,
-- Firebase Storage -> Supabase Storage). Run this in the Supabase SQL editor,
-- or `supabase db push` with the CLI.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- companies --
-- The user's OWN business requisites, captured at registration. One per user.
create table if not exists public.companies (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  bin          text not null,            -- БИН (12) или ИИН для ИП
  name         text not null,
  director     text,
  address      text,
  bank_account text,                      -- IBAN, entered manually
  bank_name    text,
  created_at   timestamptz not null default now(),
  unique (owner_id)
);

-- ----------------------------------------------------------- counterparties --
-- The user's clients, reused across documents.
create table if not exists public.counterparties (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  bin           text not null,
  name          text not null,
  director      text,
  address       text,
  contact_email text,
  contact_phone text,
  created_at    timestamptz not null default now(),
  unique (company_id, bin)
);

-- -------------------------------------------------------------------- enums --
do $$ begin
  create type public.document_type as enum ('invoice', 'avr');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_status as enum ('draft', 'sent', 'signed', 'paid');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- documents --
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  counterparty_id uuid references public.counterparties (id) on delete set null,
  type            public.document_type not null,
  number          text not null,                 -- e.g. СФ-2026-001
  date            date not null default current_date,
  items           jsonb not null default '[]'::jsonb,
  total_amount    numeric(14, 2) not null default 0,
  currency        text not null default 'KZT',
  status          public.document_status not null default 'draft',
  share_token     text not null unique,          -- public link token
  pdf_path        text,                            -- path in the 'documents' bucket
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  paid_at         timestamptz
);

create index if not exists documents_company_created_idx
  on public.documents (company_id, created_at desc);

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists documents_touch_updated_at on public.documents;
create trigger documents_touch_updated_at
  before update on public.documents
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------- RLS --
alter table public.companies      enable row level security;
alter table public.counterparties enable row level security;
alter table public.documents      enable row level security;

drop policy if exists "own company" on public.companies;
create policy "own company" on public.companies
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "own counterparties" on public.counterparties;
create policy "own counterparties" on public.counterparties
  for all
  using (company_id in (select id from public.companies where owner_id = auth.uid()))
  with check (company_id in (select id from public.companies where owner_id = auth.uid()));

drop policy if exists "own documents" on public.documents;
create policy "own documents" on public.documents
  for all
  using (company_id in (select id from public.companies where owner_id = auth.uid()))
  with check (company_id in (select id from public.companies where owner_id = auth.uid()));

-- Public access to a document (the /p/[token] share page) and PDF storage is
-- served server-side with the service-role key filtered by share_token, so no
-- anon RLS policy is needed here.

-- ------------------------------------------------------------------ storage --
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
