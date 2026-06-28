alter table public.swipes
  add column if not exists decided_at timestamptz;

update public.swipes
set decided_at = now()
where decided_at is null;

alter table public.swipes
  alter column decided_at set default now(),
  alter column decided_at set not null;

create index if not exists swipes_recent_discovery_idx
  on public.swipes(swiper_id, target_type, job_id, decided_at desc);

comment on column public.swipes.decided_at is
  'When this decision was made. Discovery ignores decisions older than 30 days so users can choose again.';

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
        and candidate_swipe.decided_at >= now() - interval '30 days'
    )
    and exists (
      select 1
      from public.swipes company_swipe
      where company_swipe.swiper_id = check_company_id
        and company_swipe.target_type = 'candidate'
        and company_swipe.target_id = check_candidate_id
        and company_swipe.job_id = check_job_id
        and company_swipe.direction = 'right'
        and company_swipe.decided_at >= now() - interval '30 days'
    )
$$;

revoke all on function public.can_create_match(uuid, uuid, uuid) from public;
grant execute on function public.can_create_match(uuid, uuid, uuid) to authenticated;
