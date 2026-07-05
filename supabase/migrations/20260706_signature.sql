-- Uploaded signature image for the company owner. Points at an object in the
-- private 'documents' bucket ({company_id}/signature-{rand}.png|jpg). When set,
-- generated PDF documents render it on the owner's «подпись» blanks; the
-- downloadable Excel files stay unsigned by design.
alter table public.companies
  add column if not exists signature_path text;
