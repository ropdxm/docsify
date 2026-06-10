-- АВР (act of completed work) needs a contract reference that invoices don't.
-- Per-item unit of measure ("ед. изм.") lives inside the existing items jsonb,
-- so only this document-level field needs a column.
alter table public.documents
  add column if not exists contract text;
