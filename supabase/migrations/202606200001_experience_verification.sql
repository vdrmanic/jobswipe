create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'experience_verification_status') then
    create type public.experience_verification_status as enum (
      'pending',
      'verified',
      'rejected',
      'changes_requested'
    );
  end if;
end
$$;

create table if not exists public.verification_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_verification_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $is_admin$
  select exists (
    select 1
    from public.verification_admins
    where user_id = check_user_id
  );
$is_admin$;

revoke all on function public.is_verification_admin(uuid) from public;
grant execute on function public.is_verification_admin(uuid) to authenticated;

create table if not exists public.experience_verifications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  experience_index integer not null check (experience_index between 0 and 14),
  company_name text not null default '',
  position text not null,
  duration text not null,
  description text not null default '',
  document_path text not null,
  document_name text not null,
  document_mime_type text not null,
  status public.experience_verification_status not null default 'pending',
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists experience_verifications_candidate_idx
  on public.experience_verifications(candidate_id, experience_index, created_at desc);

create index if not exists experience_verifications_review_queue_idx
  on public.experience_verifications(status, created_at asc);

create unique index if not exists experience_verifications_one_pending_idx
  on public.experience_verifications(candidate_id, experience_index)
  where status = 'pending';

create or replace function public.prepare_experience_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $prepare_verification$
declare
  pending_count integer;
begin
  if new.candidate_id <> auth.uid() then
    raise exception 'Candidate id must match authenticated user';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and user_type = 'candidate'
  ) then
    raise exception 'Only candidate profiles can submit experience verification';
  end if;

  if new.document_path not like (auth.uid()::text || '/%') then
    raise exception 'Document path must belong to the authenticated user';
  end if;

  select count(*) into pending_count
  from public.experience_verifications
  where candidate_id = auth.uid() and status = 'pending';

  if pending_count >= 3 then
    raise exception 'You can have at most 3 pending verification requests';
  end if;

  new.status := 'pending';
  new.review_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  return new;
end;
$prepare_verification$;

drop trigger if exists experience_verification_prepare on public.experience_verifications;
create trigger experience_verification_prepare
before insert on public.experience_verifications
for each row execute function public.prepare_experience_verification();

create or replace function public.review_experience_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $review_verification$
begin
  if not public.is_verification_admin(auth.uid()) then
    raise exception 'Only verification admins can review requests';
  end if;

  if new.status = 'pending' then
    raise exception 'A reviewed request cannot return to pending';
  end if;

  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  new.updated_at := now();
  return new;
end;
$review_verification$;

drop trigger if exists experience_verification_review on public.experience_verifications;
create trigger experience_verification_review
before update of status, review_note on public.experience_verifications
for each row execute function public.review_experience_verification();

alter table public.verification_admins enable row level security;
alter table public.experience_verifications enable row level security;

drop policy if exists "Admins can view their membership" on public.verification_admins;
create policy "Admins can view their membership"
on public.verification_admins for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Candidates and admins can view verifications" on public.experience_verifications;
create policy "Candidates and admins can view verifications"
on public.experience_verifications for select
to authenticated
using (
  candidate_id = auth.uid()
  or public.is_verification_admin(auth.uid())
);

create or replace view public.verified_experience_badges
with (security_barrier = true)
as
select
  id,
  candidate_id,
  experience_index,
  company_name,
  position,
  duration,
  description,
  status,
  reviewed_at
from public.experience_verifications
where status = 'verified';

revoke all on public.verified_experience_badges from anon, public;
grant select on public.verified_experience_badges to authenticated;

drop policy if exists "Candidates can submit verifications" on public.experience_verifications;
create policy "Candidates can submit verifications"
on public.experience_verifications for insert
to authenticated
with check (candidate_id = auth.uid() and status = 'pending');

drop policy if exists "Admins can review verifications" on public.experience_verifications;
create policy "Admins can review verifications"
on public.experience_verifications for update
to authenticated
using (public.is_verification_admin(auth.uid()))
with check (public.is_verification_admin(auth.uid()));

drop policy if exists "Candidates can remove non-verified requests" on public.experience_verifications;
create policy "Candidates can remove non-verified requests"
on public.experience_verifications for delete
to authenticated
using (
  candidate_id = auth.uid()
  and status in ('rejected', 'changes_requested')
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'experience-verification-documents',
  'experience-verification-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Candidates upload own verification documents" on storage.objects;
create policy "Candidates upload own verification documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'experience-verification-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Candidates and admins view verification documents" on storage.objects;
create policy "Candidates and admins view verification documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'experience-verification-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_verification_admin(auth.uid())
  )
);

drop policy if exists "Candidates delete own verification documents" on storage.objects;
create policy "Candidates delete own verification documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'experience-verification-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);
