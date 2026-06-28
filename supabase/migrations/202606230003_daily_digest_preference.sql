alter table public.profiles
  add column if not exists daily_match_digest_enabled boolean not null default true;

comment on column public.profiles.daily_match_digest_enabled is
  'When false, the user is skipped by the daily match digest email job.';
