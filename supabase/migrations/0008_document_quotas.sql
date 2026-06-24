-- Monthly document generation quotas.
-- Free: 4 documents total per month.
-- Pro: 30 documents total per month, with 15 invoices and 15 AVR/nakladnaja
-- combined. Dogovory count toward the total cap.

create index if not exists documents_company_type_created_idx
  on public.documents (company_id, type, created_at);

create or replace function public.enforce_document_generation_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_plan text := 'free';
  month_start timestamptz := date_trunc('month', now());
  month_end timestamptz := date_trunc('month', now()) + interval '1 month';
  total_count integer := 0;
  invoice_count integer := 0;
  closing_count integer := 0;
begin
  if new.type not in ('invoice', 'avr', 'nakladnaja', 'dogovor') then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('document_quota'), hashtext(new.company_id::text));

  select
    case
      when s.status in ('active', 'trialing')
        and s.current_period_end is not null
        and s.current_period_end > now()
        then 'pro'
      when s.trial_ends_at is not null and s.trial_ends_at > now()
        then 'pro'
      else 'free'
    end
  into effective_plan
  from public.subscriptions s
  where s.company_id = new.company_id;

  effective_plan := coalesce(effective_plan, 'free');

  select count(*)
  into total_count
  from public.documents d
  where d.company_id = new.company_id
    and d.type in ('invoice', 'avr', 'nakladnaja', 'dogovor')
    and d.created_at >= month_start
    and d.created_at < month_end;

  if effective_plan = 'free' then
    if total_count >= 4 then
      raise exception 'DOC_QUOTA_FREE_TOTAL';
    end if;
    return new;
  end if;

  if total_count >= 30 then
    raise exception 'DOC_QUOTA_PRO_TOTAL';
  end if;

  if new.type = 'invoice' then
    select count(*)
    into invoice_count
    from public.documents d
    where d.company_id = new.company_id
      and d.type = 'invoice'
      and d.created_at >= month_start
      and d.created_at < month_end;

    if invoice_count >= 15 then
      raise exception 'DOC_QUOTA_PRO_INVOICE';
    end if;
  end if;

  if new.type in ('avr', 'nakladnaja') then
    select count(*)
    into closing_count
    from public.documents d
    where d.company_id = new.company_id
      and d.type in ('avr', 'nakladnaja')
      and d.created_at >= month_start
      and d.created_at < month_end;

    if closing_count >= 15 then
      raise exception 'DOC_QUOTA_PRO_CLOSING';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists documents_enforce_generation_quota on public.documents;
create trigger documents_enforce_generation_quota
  before insert on public.documents
  for each row execute function public.enforce_document_generation_quota();
