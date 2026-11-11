-- =====================================================================
-- Migration: Fix Organization Creation RLS & Foreign Key Consistency
-- Resolves 403 Forbidden when creating a new organization from client
-- =====================================================================

-- 1. Ensure creators can SELECT the organization row they just inserted
-- (Prevents RLS 403 when .select() is called before membership is committed)
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where tablename = 'organizations' 
    and policyname = 'Creators can view their created organization'
  ) then
    create policy "Creators can view their created organization"
    on public.organizations for select
    using (created_by = auth.uid() or public.is_org_member(id));
  end if;
end $$;

-- 2. Ensure authenticated users can insert/upsert their own profile into public.users
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where tablename = 'users' 
    and policyname = 'Users can insert their own profile'
  ) then
    create policy "Users can insert their own profile"
    on public.users for insert
    with check (id = auth.uid());
  end if;
end $$;

-- 3. High-Integrity Atomic RPC: create_organization
-- Executes organization insertion and owner membership assignment within a single transaction
create or replace function public.create_organization(name text, slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
  new_org public.organizations;
begin
  -- Ensure user profile exists in public.users to satisfy foreign key
  insert into public.users (id, email, name)
  values (
    auth.uid(),
    coalesce(auth.jwt()->>'email', 'user@teamflow.local'),
    coalesce(auth.jwt()->'user_metadata'->>'name', auth.jwt()->'user_metadata'->>'full_name', split_part(auth.jwt()->>'email', '@', 1), 'User')
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email;

  -- Create Organization
  insert into public.organizations (id, name, slug, created_by)
  values (new_id, trim(name), lower(trim(slug)), auth.uid())
  returning * into new_org;

  -- Assign Creator as Owner
  insert into public.memberships (org_id, user_id, role)
  values (new_id, auth.uid(), 'owner');

  return to_jsonb(new_org);
end;
$$;

-- Grant execution to all authenticated users
grant execute on function public.create_organization(text, text) to authenticated;
