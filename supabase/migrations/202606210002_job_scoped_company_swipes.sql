-- Company decisions must belong to one concrete job listing.
-- Legacy company -> candidate swipes are ambiguous, so they are reset.

alter table public.swipes
  add column if not exists job_id uuid references public.job_listings(id) on delete cascade;

update public.swipes
set job_id = target_id
where target_type = 'job'
  and job_id is null;

delete from public.swipes
where target_type = 'candidate'
  and job_id is null;

alter table public.swipes
  alter column job_id set not null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.swipes'::regclass
      and con.contype = 'u'
      and (
        select array_agg(att.attname::text order by key_columns.ordinality)
        from unnest(con.conkey) with ordinality as key_columns(attnum, ordinality)
        join pg_attribute att
          on att.attrelid = con.conrelid
         and att.attnum = key_columns.attnum
      ) = array['swiper_id', 'target_id']
  loop
    execute format('alter table public.swipes drop constraint %I', constraint_name);
  end loop;
end
$$;

drop index if exists public.swipes_swiper_id_target_id_idx;
drop index if exists public.swipes_swiper_target_unique;

alter table public.swipes
  drop constraint if exists swipes_user_target_job_key;

alter table public.swipes
  add constraint swipes_user_target_job_key
  unique (swiper_id, target_id, target_type, job_id);

create index if not exists swipes_company_job_discovery_idx
  on public.swipes (swiper_id, job_id, target_type);

create index if not exists swipes_candidate_job_interest_idx
  on public.swipes (swiper_id, job_id, direction)
  where target_type = 'job';

comment on column public.swipes.job_id is
  'Concrete job context for candidate job swipes and company candidate swipes.';
