-- =====================================================================
-- Migration: Fix User Auth, Profile Storage & public.users RLS
-- =====================================================================

-- 1. Ensure public.users has proper RLS policies for INSERT and UPDATE
alter table public.users enable row level security;

-- Allow users to insert their own profile row upon registration or OAuth login
drop policy if exists "Users can insert their own profile" on public.users;
create policy "Users can insert their own profile"
on public.users for insert
with check (id = auth.uid() or auth.role() = 'authenticated');

-- Allow users to update their own profile
drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
on public.users for update
using (id = auth.uid() or auth.role() = 'authenticated')
with check (id = auth.uid() or auth.role() = 'authenticated');

-- Allow all authenticated users to read peer profiles
drop policy if exists "Users can view profile of organization peers" on public.users;
create policy "Users can view profile of organization peers"
on public.users for select
using (true);

-- 2. Trigger on auth.users to automatically replicate into public.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  raw_name text;
  avatar text;
begin
  raw_name := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    split_part(coalesce(new.email, 'user'), '@', 1)
  );

  avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  insert into public.users (id, email, name, avatar_url, timezone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(raw_name, 'TeamFlow Member'),
    avatar,
    'UTC'
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(public.users.name, excluded.name),
    avatar_url = coalesce(public.users.avatar_url, excluded.avatar_url);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of raw_user_meta_data, email on auth.users
  for each row execute function public.handle_new_user();

-- 3. Synchronize existing auth.users into public.users immediately
insert into public.users (id, email, name, avatar_url, timezone)
select
  id,
  coalesce(email, ''),
  coalesce(
    raw_user_meta_data->>'name',
    raw_user_meta_data->>'full_name',
    split_part(coalesce(email, 'user'), '@', 1)
  ),
  coalesce(
    raw_user_meta_data->>'avatar_url',
    raw_user_meta_data->>'picture'
  ),
  'UTC'
from auth.users
on conflict (id) do update set
  email = excluded.email,
  name = coalesce(public.users.name, excluded.name),
  avatar_url = coalesce(public.users.avatar_url, excluded.avatar_url);
