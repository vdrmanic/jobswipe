alter table public.job_listings
  add column if not exists boost_until timestamptz,
  add column if not exists boost_credits_spent integer not null default 0;

create index if not exists job_listings_boost_idx
  on public.job_listings(boost_until desc)
  where boost_until is not null;

create or replace function public.boost_job_with_credits(target_job_id uuid)
returns public.job_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  new_balance integer;
  updated_job public.job_listings;
  boost_start timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.job_listings
    where id = target_job_id
      and company_id = auth.uid()
      and is_active = true
      and coalesce(status, 'active') = 'active'
      and coalesce(is_draft, false) = false
      and (expires_at is null or expires_at > now())
  ) then
    raise exception 'Boost je dostupan samo za aktivan oglas';
  end if;

  perform public.ensure_company_credit_wallet(auth.uid());

  select balance into current_balance
  from public.company_credit_wallets
  where company_id = auth.uid()
  for update;

  if coalesce(current_balance, 0) < 1 then
    raise exception 'Not enough credits';
  end if;

  new_balance := current_balance - 1;

  update public.company_credit_wallets
  set balance = new_balance
  where company_id = auth.uid();

  select greatest(coalesce(boost_until, now()), now())
  into boost_start
  from public.job_listings
  where id = target_job_id;

  update public.job_listings
  set
    boost_until = boost_start + interval '24 hours',
    boost_credits_spent = coalesce(boost_credits_spent, 0) + 1,
    credits_spent = coalesce(credits_spent, 0) + 1
  where id = target_job_id and company_id = auth.uid()
  returning * into updated_job;

  insert into public.company_credit_transactions(company_id, job_id, amount, balance_after, type, description, metadata)
  values (
    auth.uid(),
    target_job_id,
    -1,
    new_balance,
    'spend',
    'Boost oglasa 24h',
    jsonb_build_object('boost_hours', 24)
  );

  return updated_job;
end;
$$;

revoke all on function public.boost_job_with_credits(uuid) from public;
grant execute on function public.boost_job_with_credits(uuid) to authenticated;
