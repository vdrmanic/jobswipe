-- Security hardening for browser/mobile access.
-- The Expo app ships with the anon key, so ownership and workflow rules must live in Postgres.

create or replace function public.profile_user_type(check_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select user_type::text
  from public.profiles
  where id = check_user_id
$$;

create or replace function public.job_belongs_to_company(check_job_id uuid, check_company_id uuid)
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
      and job.company_id = check_company_id
  )
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
  )
$$;

create or replace function public.user_can_access_match(check_match_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches match
    where match.id = check_match_id
      and check_user_id in (match.candidate_id, match.company_id)
  )
$$;

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

revoke all on function public.profile_user_type(uuid) from public;
revoke all on function public.job_belongs_to_company(uuid, uuid) from public;
revoke all on function public.is_active_public_job(uuid) from public;
revoke all on function public.user_can_access_match(uuid, uuid) from public;
revoke all on function public.can_create_match(uuid, uuid, uuid) from public;
grant execute on function public.profile_user_type(uuid) to authenticated;
grant execute on function public.job_belongs_to_company(uuid, uuid) to authenticated;
grant execute on function public.is_active_public_job(uuid) to authenticated;
grant execute on function public.user_can_access_match(uuid, uuid) to authenticated;
grant execute on function public.can_create_match(uuid, uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.company_profiles enable row level security;
alter table public.job_listings enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Authenticated users can view public profiles" on public.profiles;
create policy "Authenticated users can view public profiles"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Authenticated users can view candidate profiles" on public.candidate_profiles;
create policy "Authenticated users can view candidate profiles"
on public.candidate_profiles for select
to authenticated
using (true);

drop policy if exists "Candidates insert own candidate profile" on public.candidate_profiles;
create policy "Candidates insert own candidate profile"
on public.candidate_profiles for insert
to authenticated
with check (id = auth.uid() and public.profile_user_type(auth.uid()) = 'candidate');

drop policy if exists "Candidates update own candidate profile" on public.candidate_profiles;
create policy "Candidates update own candidate profile"
on public.candidate_profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and public.profile_user_type(auth.uid()) = 'candidate');

drop policy if exists "Authenticated users can view company profiles" on public.company_profiles;
create policy "Authenticated users can view company profiles"
on public.company_profiles for select
to authenticated
using (true);

drop policy if exists "Companies insert own company profile" on public.company_profiles;
create policy "Companies insert own company profile"
on public.company_profiles for insert
to authenticated
with check (id = auth.uid() and public.profile_user_type(auth.uid()) = 'company');

drop policy if exists "Companies update own company profile" on public.company_profiles;
create policy "Companies update own company profile"
on public.company_profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and public.profile_user_type(auth.uid()) = 'company');

drop policy if exists "Users view active jobs and companies view own jobs" on public.job_listings;
create policy "Users view active jobs and companies view own jobs"
on public.job_listings for select
to authenticated
using (
  public.is_active_public_job(id)
  or company_id = auth.uid()
);

drop policy if exists "Companies create own jobs" on public.job_listings;
create policy "Companies create own jobs"
on public.job_listings for insert
to authenticated
with check (company_id = auth.uid() and public.profile_user_type(auth.uid()) = 'company');

drop policy if exists "Companies update own jobs" on public.job_listings;
create policy "Companies update own jobs"
on public.job_listings for update
to authenticated
using (company_id = auth.uid())
with check (company_id = auth.uid() and public.profile_user_type(auth.uid()) = 'company');

drop policy if exists "Companies delete own jobs" on public.job_listings;
create policy "Companies delete own jobs"
on public.job_listings for delete
to authenticated
using (company_id = auth.uid());

drop policy if exists "Users view own and relevant swipes" on public.swipes;
create policy "Users view own and relevant swipes"
on public.swipes for select
to authenticated
using (
  swiper_id = auth.uid()
  or (target_type = 'candidate' and target_id = auth.uid())
  or (
    target_type = 'job'
    and exists (
      select 1
      from public.job_listings job
      where job.id = swipes.job_id
        and job.company_id = auth.uid()
    )
  )
);

drop policy if exists "Users create own valid swipes" on public.swipes;
create policy "Users create own valid swipes"
on public.swipes for insert
to authenticated
with check (
  swiper_id = auth.uid()
  and direction in ('left', 'right', 'super')
  and (
    (
      public.profile_user_type(auth.uid()) = 'candidate'
      and target_type = 'job'
      and target_id = job_id
      and public.is_active_public_job(job_id)
    )
    or (
      public.profile_user_type(auth.uid()) = 'company'
      and target_type = 'candidate'
      and public.job_belongs_to_company(job_id, auth.uid())
      and exists (
        select 1 from public.candidate_profiles candidate
        where candidate.id = target_id
      )
    )
  )
);

drop policy if exists "Users update own valid swipes" on public.swipes;
create policy "Users update own valid swipes"
on public.swipes for update
to authenticated
using (swiper_id = auth.uid())
with check (
  swiper_id = auth.uid()
  and direction in ('left', 'right', 'super')
  and (
    (
      public.profile_user_type(auth.uid()) = 'candidate'
      and target_type = 'job'
      and target_id = job_id
      and public.is_active_public_job(job_id)
    )
    or (
      public.profile_user_type(auth.uid()) = 'company'
      and target_type = 'candidate'
      and public.job_belongs_to_company(job_id, auth.uid())
      and exists (
        select 1 from public.candidate_profiles candidate
        where candidate.id = target_id
      )
    )
  )
);

drop policy if exists "Users delete own swipes" on public.swipes;
create policy "Users delete own swipes"
on public.swipes for delete
to authenticated
using (swiper_id = auth.uid());

drop policy if exists "Match participants can view matches" on public.matches;
create policy "Match participants can view matches"
on public.matches for select
to authenticated
using (auth.uid() in (candidate_id, company_id));

drop policy if exists "Participants can create mutual matches" on public.matches;
create policy "Participants can create mutual matches"
on public.matches for insert
to authenticated
with check (
  auth.uid() in (candidate_id, company_id)
  and public.can_create_match(candidate_id, company_id, job_id)
);

drop policy if exists "Companies update own match pipeline" on public.matches;
create policy "Companies update own match pipeline"
on public.matches for update
to authenticated
using (company_id = auth.uid())
with check (
  company_id = auth.uid()
  and public.job_belongs_to_company(job_id, auth.uid())
);

drop policy if exists "Match participants can view messages" on public.messages;
create policy "Match participants can view messages"
on public.messages for select
to authenticated
using (public.user_can_access_match(match_id, auth.uid()));

drop policy if exists "Match participants can send messages" on public.messages;
create policy "Match participants can send messages"
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.user_can_access_match(match_id, auth.uid())
  and length(btrim(content)) between 1 and 500
);

drop policy if exists "Match participants can mark incoming messages read" on public.messages;
create policy "Match participants can mark incoming messages read"
on public.messages for update
to authenticated
using (
  public.user_can_access_match(match_id, auth.uid())
  and sender_id <> auth.uid()
)
with check (
  public.user_can_access_match(match_id, auth.uid())
  and sender_id <> auth.uid()
);

create unique index if not exists matches_candidate_company_job_key
  on public.matches(candidate_id, company_id, job_id);

create index if not exists swipes_match_lookup_idx
  on public.swipes(swiper_id, target_type, target_id, job_id, direction);

create index if not exists messages_match_created_idx
  on public.messages(match_id, created_at asc);

create or replace function public.protect_job_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and tg_op = 'UPDATE' and old.company_id is distinct from new.company_id then
    raise exception 'Job owner cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_job_owner on public.job_listings;
create trigger protect_job_owner
before update on public.job_listings
for each row execute function public.protect_job_owner();

create or replace function public.protect_match_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'UPDATE' and (
      old.candidate_id is distinct from new.candidate_id
      or old.company_id is distinct from new.company_id
      or old.job_id is distinct from new.job_id
    ) then
      raise exception 'Match participants and job cannot be changed';
    end if;

    if tg_op = 'INSERT' and not public.can_create_match(new.candidate_id, new.company_id, new.job_id) then
      raise exception 'A match requires mutual right swipes for the same job';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_match_identity on public.matches;
create trigger protect_match_identity
before insert or update on public.matches
for each row execute function public.protect_match_identity();

create or replace function public.protect_message_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      new.content := btrim(new.content);
      if length(new.content) < 1 or length(new.content) > 500 then
        raise exception 'Message must be between 1 and 500 characters';
      end if;
    elsif tg_op = 'UPDATE' then
      if old.match_id is distinct from new.match_id
        or old.sender_id is distinct from new.sender_id
        or old.content is distinct from new.content
        or old.created_at is distinct from new.created_at then
        raise exception 'Only message read status can be updated';
      end if;

      if new.read is distinct from true then
        raise exception 'Messages can only be marked as read';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_message_update on public.messages;
create trigger protect_message_update
before insert or update on public.messages
for each row execute function public.protect_message_update();

create or replace function public.protect_notification_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' then
    if old.user_id is distinct from new.user_id
      or old.type is distinct from new.type
      or old.title is distinct from new.title
      or old.body is distinct from new.body
      or old.data is distinct from new.data
      or old.created_at is distinct from new.created_at
      or old.push_sent_at is distinct from new.push_sent_at then
      raise exception 'Only notification read status can be updated';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_notification_update on public.app_notifications;
create trigger protect_notification_update
before update on public.app_notifications
for each row execute function public.protect_notification_update();

alter table public.job_view_events drop constraint if exists job_view_events_candidate_job_role_check;
alter table public.job_view_events
  add constraint job_view_events_candidate_job_role_check
  check (
    candidate_id is not null
  )
  not valid;

drop policy if exists "Candidates record own job views" on public.job_view_events;
create policy "Candidates record own job views"
on public.job_view_events for insert
to authenticated
with check (
  candidate_id = auth.uid()
  and public.profile_user_type(auth.uid()) = 'candidate'
  and public.is_active_public_job(job_id)
);

drop policy if exists "Candidates view own job views" on public.job_view_events;
create policy "Candidates view own job views"
on public.job_view_events for select
to authenticated
using (
  candidate_id = auth.uid()
  or public.job_belongs_to_company(job_id, auth.uid())
);

alter table public.device_push_tokens drop constraint if exists device_push_tokens_platform_check;
alter table public.device_push_tokens
  add constraint device_push_tokens_platform_check
  check (platform in ('ios', 'android', 'web', 'unknown'))
  not valid;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view avatars" on storage.objects;
create policy "Anyone can view avatars"
on storage.objects for select
to public
using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
