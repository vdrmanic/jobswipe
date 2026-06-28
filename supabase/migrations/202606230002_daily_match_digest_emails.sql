create table if not exists public.daily_match_digest_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  digest_date date not null,
  match_count integer not null default 0,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, digest_date)
);

create index if not exists daily_match_digest_emails_user_date_idx
  on public.daily_match_digest_emails(user_id, digest_date desc);

comment on table public.daily_match_digest_emails is
  'Tracks daily match digest emails so each user receives at most one digest per day.';

comment on column public.daily_match_digest_emails.digest_date is
  'Digest date in the app timezone used by the send-daily-match-digest edge function.';

alter table public.daily_match_digest_emails enable row level security;

drop policy if exists "Users view own daily match digests" on public.daily_match_digest_emails;
create policy "Users view own daily match digests" on public.daily_match_digest_emails
for select to authenticated using (user_id = auth.uid());

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'jobswipe-daily-match-digest';

select cron.schedule(
  'jobhop-daily-match-digest',
  '0 20 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'jobhop_project_url') || '/functions/v1/send-daily-match-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-digest-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'jobhop_digest_cron_secret')
      ),
      body := jsonb_build_object('timezone', 'Europe/Belgrade')
    ) as request_id;
  $$
);
