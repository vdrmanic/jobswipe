create or replace function public.can_create_match(check_candidate_id uuid, check_company_id uuid, check_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.profile_user_type(check_candidate_id) = 'candidate'
    and public.profile_user_type(check_company_id) = 'company'
    and public.job_belongs_to_company(check_job_id, check_company_id)
    and exists (
      select 1
      from public.swipes candidate_swipe
      where candidate_swipe.swiper_id = check_candidate_id
        and candidate_swipe.target_type = 'job'
        and candidate_swipe.target_id = check_job_id
        and candidate_swipe.job_id = check_job_id
        and candidate_swipe.direction = 'right'
    )
    and exists (
      select 1
      from public.swipes company_swipe
      where company_swipe.swiper_id = check_company_id
        and company_swipe.target_type = 'candidate'
        and company_swipe.target_id = check_candidate_id
        and company_swipe.job_id = check_job_id
        and company_swipe.direction = 'right'
    )
$$;

create or replace function public.reset_candidate_swipes_after_30_days()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.swipes
  where swiper_id = auth.uid()
    and target_type = 'job'
    and decided_at < now() - interval '30 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.reset_company_job_swipes_after_30_days(target_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.job_listings job
    where job.id = target_job_id
      and job.company_id = auth.uid()
  ) then
    raise exception 'Only the job owner can reset decisions for this job';
  end if;

  delete from public.swipes
  where swiper_id = auth.uid()
    and target_type = 'candidate'
    and job_id = target_job_id
    and decided_at < now() - interval '30 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.can_create_match(uuid, uuid, uuid) from public;
revoke all on function public.reset_candidate_swipes_after_30_days() from public;
revoke all on function public.reset_company_job_swipes_after_30_days(uuid) from public;

grant execute on function public.can_create_match(uuid, uuid, uuid) to authenticated;
grant execute on function public.reset_candidate_swipes_after_30_days() to authenticated;
grant execute on function public.reset_company_job_swipes_after_30_days(uuid) to authenticated;
