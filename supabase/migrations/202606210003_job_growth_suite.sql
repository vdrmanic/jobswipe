-- Rich job details, drafts, candidate pipeline, interviews, and analytics.

alter table public.job_listings add column if not exists salary_min integer;
alter table public.job_listings add column if not exists salary_max integer;
alter table public.job_listings add column if not exists salary_currency text not null default 'EUR';
alter table public.job_listings add column if not exists work_mode text;
alter table public.job_listings add column if not exists seniority text;
alter table public.job_listings add column if not exists schedule text;
alter table public.job_listings add column if not exists benefits text[];
alter table public.job_listings add column if not exists is_draft boolean not null default false;
alter table public.job_listings add column if not exists published_at timestamptz;

update public.job_listings
set published_at = coalesce(published_at, created_at)
where is_active = true and is_draft = false;

alter table public.matches add column if not exists pipeline_stage text not null default 'new';
alter table public.matches add column if not exists interview_at timestamptz;
alter table public.matches add column if not exists interview_location text;
alter table public.matches add column if not exists interview_note text;
alter table public.matches add column if not exists pipeline_updated_at timestamptz not null default now();

create table if not exists public.job_view_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_listings(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);

create index if not exists matches_job_pipeline_idx
  on public.matches(job_id, pipeline_stage, created_at desc);

create index if not exists job_view_events_job_idx
  on public.job_view_events(job_id, created_at desc);

alter table public.job_view_events enable row level security;
alter table public.matches enable row level security;

drop policy if exists "Companies update own match pipeline" on public.matches;
create policy "Companies update own match pipeline" on public.matches
for update to authenticated
using (company_id = auth.uid())
with check (company_id = auth.uid());

drop policy if exists "Candidates record own job views" on public.job_view_events;
create policy "Candidates record own job views" on public.job_view_events
for insert to authenticated
with check (candidate_id = auth.uid());

drop policy if exists "Candidates view own job views" on public.job_view_events;
create policy "Candidates view own job views" on public.job_view_events
for select to authenticated
using (
  candidate_id = auth.uid()
  or exists (
    select 1 from public.job_listings job
    where job.id = job_id and job.company_id = auth.uid()
  )
);

create or replace function public.notify_pipeline_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $notify_pipeline$
declare
  job_title text;
  stage_label text;
begin
  if old.pipeline_stage is distinct from new.pipeline_stage then
    select title into job_title from public.job_listings where id = new.job_id;
    stage_label := case new.pipeline_stage
      when 'contacted' then 'Kontaktirani ste'
      when 'interview' then 'Pozvani ste na intervju'
      when 'offer' then 'Stigla je ponuda'
      when 'rejected' then 'Proces je zavrsen'
      else 'Prijava je azurirana'
    end;

    insert into public.app_notifications (user_id, type, title, body, data)
    values (
      new.candidate_id,
      'system',
      stage_label,
      'Promenjen je status za ' || coalesce(job_title, 'oglas') || '.',
      jsonb_build_object('match_id', new.id, 'job_id', new.job_id, 'pipeline_stage', new.pipeline_stage)
    );
  end if;

  if old.interview_at is distinct from new.interview_at and new.interview_at is not null then
    select title into job_title from public.job_listings where id = new.job_id;
    insert into public.app_notifications (user_id, type, title, body, data)
    values (
      new.candidate_id,
      'system',
      'Zakazan intervju',
      coalesce(job_title, 'Pozicija') || ': ' || to_char(new.interview_at at time zone 'Europe/Belgrade', 'DD.MM.YYYY HH24:MI'),
      jsonb_build_object('match_id', new.id, 'job_id', new.job_id, 'interview_at', new.interview_at, 'location', new.interview_location)
    );
  end if;

  new.pipeline_updated_at := now();
  return new;
end;
$notify_pipeline$;

drop trigger if exists notify_match_pipeline_changed on public.matches;
create trigger notify_match_pipeline_changed
before update of pipeline_stage, interview_at, interview_location, interview_note on public.matches
for each row execute function public.notify_pipeline_change();

comment on column public.matches.pipeline_stage is
  'Company hiring stage: new, contacted, interview, offer, rejected.';
