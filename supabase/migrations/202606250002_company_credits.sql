alter table public.job_listings
  add column if not exists credits_spent integer not null default 0,
  add column if not exists expires_at timestamptz;

create table if not exists public.company_credit_wallets (
  company_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid references public.job_listings(id) on delete set null,
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  type text not null check (type in ('test_purchase', 'purchase', 'spend', 'refund', 'admin_adjustment')),
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists company_credit_transactions_company_created_idx
  on public.company_credit_transactions(company_id, created_at desc);

create index if not exists job_listings_expiry_idx
  on public.job_listings(status, is_active, expires_at);

alter table public.company_credit_wallets enable row level security;
alter table public.company_credit_transactions enable row level security;

drop policy if exists "Companies view own credit wallet" on public.company_credit_wallets;
create policy "Companies view own credit wallet"
on public.company_credit_wallets for select
using (company_id = auth.uid());

drop policy if exists "Companies view own credit transactions" on public.company_credit_transactions;
create policy "Companies view own credit transactions"
on public.company_credit_transactions for select
using (company_id = auth.uid());

create or replace function public.touch_company_credit_wallet()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_company_credit_wallet on public.company_credit_wallets;
create trigger touch_company_credit_wallet
before update on public.company_credit_wallets
for each row execute function public.touch_company_credit_wallet();

create or replace function public.ensure_company_credit_wallet(target_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.company_credit_wallets(company_id, balance)
  values (target_company_id, 0)
  on conflict (company_id) do nothing;
end;
$$;

create or replace function public.get_company_credit_balance()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_company_credit_wallet(auth.uid());

  select balance into current_balance
  from public.company_credit_wallets
  where company_id = auth.uid();

  return coalesce(current_balance, 0);
end;
$$;

create or replace function public.grant_company_test_credits(credit_count integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if credit_count not in (1, 3, 5, 10) then
    raise exception 'Invalid credit package';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and user_type = 'company'
  ) then
    raise exception 'Only companies can receive credits';
  end if;

  perform public.ensure_company_credit_wallet(auth.uid());

  update public.company_credit_wallets
  set balance = balance + credit_count
  where company_id = auth.uid()
  returning balance into new_balance;

  insert into public.company_credit_transactions(company_id, amount, balance_after, type, description)
  values (
    auth.uid(),
    credit_count,
    new_balance,
    'test_purchase',
    'Test paket kredita'
  );

  return new_balance;
end;
$$;

create or replace function public.activate_job_with_credits(target_job_id uuid, credit_count integer)
returns public.job_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  duration_days integer;
  current_balance integer;
  new_balance integer;
  updated_job public.job_listings;
  start_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  duration_days := case credit_count
    when 1 then 7
    when 2 then 14
    when 3 then 30
    else null
  end;

  if duration_days is null then
    raise exception 'Invalid credit duration';
  end if;

  if not exists (
    select 1
    from public.job_listings
    where id = target_job_id and company_id = auth.uid()
  ) then
    raise exception 'Job not found';
  end if;

  perform public.ensure_company_credit_wallet(auth.uid());

  select balance into current_balance
  from public.company_credit_wallets
  where company_id = auth.uid()
  for update;

  if coalesce(current_balance, 0) < credit_count then
    raise exception 'Not enough credits';
  end if;

  new_balance := current_balance - credit_count;

  update public.company_credit_wallets
  set balance = new_balance
  where company_id = auth.uid();

  select greatest(coalesce(expires_at, now()), now())
  into start_at
  from public.job_listings
  where id = target_job_id;

  update public.job_listings
  set
    status = 'active',
    is_active = true,
    is_draft = false,
    published_at = coalesce(published_at, now()),
    credits_spent = coalesce(credits_spent, 0) + credit_count,
    expires_at = start_at + make_interval(days => duration_days)
  where id = target_job_id and company_id = auth.uid()
  returning * into updated_job;

  insert into public.company_credit_transactions(company_id, job_id, amount, balance_after, type, description, metadata)
  values (
    auth.uid(),
    target_job_id,
    -credit_count,
    new_balance,
    'spend',
    'Aktiviranje/produženje oglasa',
    jsonb_build_object('days', duration_days)
  );

  return updated_job;
end;
$$;

create or replace function public.expire_old_job_listings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  update public.job_listings
  set status = 'expired', is_active = false
  where status = 'active'
    and is_active = true
    and expires_at is not null
    and expires_at <= now();

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

create or replace function public.is_active_public_job(check_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.job_listings job
    where job.id = check_job_id
      and job.is_active = true
      and coalesce(job.is_draft, false) = false
      and coalesce(job.status, 'active') = 'active'
      and (job.expires_at is null or job.expires_at > now())
      and not exists (
        select 1
        from public.user_blocks block
        where (block.blocker_id = auth.uid() and block.blocked_user_id = job.company_id)
           or (block.blocker_id = job.company_id and block.blocked_user_id = auth.uid())
      )
  );
$$;

revoke all on function public.ensure_company_credit_wallet(uuid) from public;
revoke all on function public.get_company_credit_balance() from public;
revoke all on function public.grant_company_test_credits(integer) from public;
revoke all on function public.activate_job_with_credits(uuid, integer) from public;
revoke all on function public.expire_old_job_listings() from public;
grant execute on function public.get_company_credit_balance() to authenticated;
grant execute on function public.grant_company_test_credits(integer) to authenticated;
grant execute on function public.activate_job_with_credits(uuid, integer) to authenticated;
grant execute on function public.expire_old_job_listings() to authenticated;
