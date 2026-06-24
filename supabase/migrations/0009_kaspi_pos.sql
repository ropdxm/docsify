-- Kaspi POS Automation metadata for the Pro payment flow.
-- Keeps the old apipay_invoice_id column for existing installs, but stores the
-- canonical operation id from tapter-dev/kaspi-pos-automation separately.

alter table public.kaspi_invoices
  add column if not exists kaspi_operation_id text,
  add column if not exists kaspi_receipt_url text,
  add column if not exists kaspi_order_number text;

update public.kaspi_invoices
set kaspi_operation_id = apipay_invoice_id::text
where kaspi_operation_id is null
  and apipay_invoice_id is not null;

create unique index if not exists kaspi_invoices_kaspi_operation_id_idx
  on public.kaspi_invoices (kaspi_operation_id)
  where kaspi_operation_id is not null;

comment on column public.kaspi_invoices.kaspi_operation_id is
  'Kaspi POS Automation invoice operation id (webhook paymentId).';
comment on column public.kaspi_invoices.kaspi_receipt_url is
  'Receipt URL returned by Kaspi POS Automation when available.';
comment on column public.kaspi_invoices.kaspi_order_number is
  'Kaspi order number returned by Kaspi POS Automation when available.';
