create or replace function public.protect_paid_job_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated'
    and tg_op = 'UPDATE'
    and old.expires_at is not null
    and old.expires_at > now()
    and (
      old.title is distinct from new.title
      or old.location is distinct from new.location
    )
  then
    raise exception 'Pozicija i lokacija ne mogu da se menjaju dok traje plaćeni period oglasa';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_paid_job_identity on public.job_listings;
create trigger protect_paid_job_identity
before update on public.job_listings
for each row execute function public.protect_paid_job_identity();
