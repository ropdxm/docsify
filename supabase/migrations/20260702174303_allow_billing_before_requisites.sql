-- A signed-in user can start checkout before entering business requisites.
-- Billing-only company rows keep the existing company-scoped subscription and
-- invoice model intact, then get completed in place during onboarding.
alter table public.companies
  add column if not exists is_profile_complete boolean not null default true;

comment on column public.companies.is_profile_complete is
  'False for an internal billing-only row; true after legal and bank requisites are provided.';
