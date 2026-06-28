create table if not exists public.profile_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  s3_key text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null,
  duration_ms integer,
  status text not null default 'ready' check (status in ('ready', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_videos enable row level security;

drop policy if exists "Profile videos are visible to authenticated users" on public.profile_videos;
create policy "Profile videos are visible to authenticated users"
on public.profile_videos for select
to authenticated
using (status = 'ready');

drop policy if exists "Users can insert their own profile videos" on public.profile_videos;
create policy "Users can insert their own profile videos"
on public.profile_videos for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile videos" on public.profile_videos;
create policy "Users can update their own profile videos"
on public.profile_videos for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own profile videos" on public.profile_videos;
create policy "Users can delete their own profile videos"
on public.profile_videos for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists profile_videos_user_created_idx
on public.profile_videos (user_id, created_at desc);

create or replace function public.touch_profile_videos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profile_videos_updated_at on public.profile_videos;
create trigger touch_profile_videos_updated_at
before update on public.profile_videos
for each row execute function public.touch_profile_videos_updated_at();
