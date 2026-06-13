-- Накладная на отпуск запасов на сторону (Форма З-2) as a third document type.
-- Line items (наименование, ед. изм., количество, цена) reuse the existing
-- `items` jsonb, so only the enum needs extending.
alter type public.document_type add value if not exists 'nakladnaja';
