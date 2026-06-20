create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('match', 'message', 'verification', 'system')),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  push_sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.app_notifications add column if not exists push_sent_at timestamptz;

create index if not exists app_notifications_user_idx
  on public.app_notifications(user_id, created_at desc);

create table if not exists public.device_push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  check (blocker_id <> blocked_user_id)
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'explicit', 'fake_profile', 'discrimination', 'other')),
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed', 'actioned')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);

create index if not exists user_reports_queue_idx on public.user_reports(status, created_at asc);

create or replace function public.notify_new_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $notify_match$
declare
  job_title text;
begin
  select title into job_title from public.job_listings where id = new.job_id;

  insert into public.app_notifications (user_id, type, title, body, data)
  values
    (new.candidate_id, 'match', 'Novi match!', 'Firma je takodje pokazala interesovanje za ' || coalesce(job_title, 'oglas') || '.', jsonb_build_object('match_id', new.id, 'job_id', new.job_id)),
    (new.company_id, 'match', 'Novi match!', 'Kandidat je takodje pokazao interesovanje za ' || coalesce(job_title, 'oglas') || '.', jsonb_build_object('match_id', new.id, 'job_id', new.job_id));
  return new;
end;
$notify_match$;

drop trigger if exists notify_match_created on public.matches;
create trigger notify_match_created
after insert on public.matches
for each row execute function public.notify_new_match();

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $notify_message$
declare
  recipient_id uuid;
  sender_name text;
begin
  select
    case when candidate_id = new.sender_id then company_id else candidate_id end
  into recipient_id
  from public.matches
  where id = new.match_id;

  select full_name into sender_name from public.profiles where id = new.sender_id;

  if recipient_id is not null then
    insert into public.app_notifications (user_id, type, title, body, data)
    values (
      recipient_id,
      'message',
      'Nova poruka',
      coalesce(sender_name, 'Kontakt') || ': ' || left(new.content, 100),
      jsonb_build_object('match_id', new.match_id)
    );
  end if;
  return new;
end;
$notify_message$;

drop trigger if exists notify_message_created on public.messages;
create trigger notify_message_created
after insert on public.messages
for each row execute function public.notify_new_message();

create or replace function public.notify_verification_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $notify_verification$
begin
  if old.status is distinct from new.status and new.status <> 'pending' then
    insert into public.app_notifications (user_id, type, title, body, data)
    values (
      new.candidate_id,
      'verification',
      case when new.status = 'verified' then 'Iskustvo je verifikovano' else 'Promenjen status verifikacije' end,
      case
        when new.status = 'verified' then new.position || ' je sada verifikovano.'
        when new.status = 'changes_requested' then 'Potreban je novi dokument za ' || new.position || '.'
        else 'Zahtev za ' || new.position || ' nije odobren.'
      end,
      jsonb_build_object('verification_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$notify_verification$;

drop trigger if exists notify_verification_reviewed on public.experience_verifications;
create trigger notify_verification_reviewed
after update of status on public.experience_verifications
for each row execute function public.notify_verification_review();

create or replace function public.prepare_report_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $review_report$
begin
  if not public.is_verification_admin(auth.uid()) then
    raise exception 'Only admins can review reports';
  end if;
  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  return new;
end;
$review_report$;

drop trigger if exists prepare_report_review on public.user_reports;
create trigger prepare_report_review
before update of status, admin_note on public.user_reports
for each row execute function public.prepare_report_review();

alter table public.app_notifications enable row level security;
alter table public.device_push_tokens enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;

drop policy if exists "Users view own notifications" on public.app_notifications;
create policy "Users view own notifications" on public.app_notifications
for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users update own notifications" on public.app_notifications;
create policy "Users update own notifications" on public.app_notifications
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage own push tokens" on public.device_push_tokens;
create policy "Users manage own push tokens" on public.device_push_tokens
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users view relevant blocks" on public.user_blocks;
create policy "Users view relevant blocks" on public.user_blocks
for select to authenticated using (blocker_id = auth.uid() or blocked_user_id = auth.uid());

drop policy if exists "Users create own blocks" on public.user_blocks;
create policy "Users create own blocks" on public.user_blocks
for insert to authenticated with check (blocker_id = auth.uid());

drop policy if exists "Users remove own blocks" on public.user_blocks;
create policy "Users remove own blocks" on public.user_blocks
for delete to authenticated using (blocker_id = auth.uid());

drop policy if exists "Users and admins view reports" on public.user_reports;
create policy "Users and admins view reports" on public.user_reports
for select to authenticated using (reporter_id = auth.uid() or public.is_verification_admin(auth.uid()));

drop policy if exists "Users create reports" on public.user_reports;
create policy "Users create reports" on public.user_reports
for insert to authenticated with check (reporter_id = auth.uid() and status = 'pending');

drop policy if exists "Admins review reports" on public.user_reports;
create policy "Admins review reports" on public.user_reports
for update to authenticated
using (public.is_verification_admin(auth.uid()))
with check (public.is_verification_admin(auth.uid()));

do $realtime$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_notifications'
  ) then
    alter publication supabase_realtime add table public.app_notifications;
  end if;
end
$realtime$;
