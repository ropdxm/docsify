-- Договор (contract) - a signable document type. Unlike the structured docs it
-- has no line items; its content is a PDF (uploaded, or rendered from written
-- text) that both parties sign with ЭЦП. Signatures live in their own table.

alter type public.document_type add value if not exists 'dogovor';

alter table public.documents
  add column if not exists title     text,   -- договор heading (e.g. «Договор оказания услуг»)
  add column if not exists body      text,   -- written source text (null when uploaded)
  add column if not exists file_path text;    -- the signable PDF in the 'documents' bucket

-- --------------------------------------------------------- document_signatures --
-- One row per party signature (owner = our company, client = counterparty).
create table if not exists public.document_signatures (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents (id) on delete cascade,
  signer_role  text not null check (signer_role in ('owner', 'client')),
  signer_bin   text,                          -- ИИН/БИН extracted from the certificate
  signer_name  text,                          -- subject CN from the certificate
  cms          text not null,                 -- the CAdES/CMS signature (base64)
  is_valid     boolean not null default false,
  verification jsonb,                          -- full NCANode verify result
  signed_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (document_id, signer_role)            -- one signature per role per document
);

create index if not exists document_signatures_document_idx
  on public.document_signatures (document_id);

alter table public.document_signatures enable row level security;

-- The owner can read signatures for their own documents. All writes go through
-- the service-role server actions (owner action + public client action), so no
-- insert/update policy is exposed to anon/auth roles.
drop policy if exists "own document signatures" on public.document_signatures;
create policy "own document signatures" on public.document_signatures
  for select
  using (
    document_id in (
      select id from public.documents
      where company_id in (
        select id from public.companies where owner_id = auth.uid()
      )
    )
  );
