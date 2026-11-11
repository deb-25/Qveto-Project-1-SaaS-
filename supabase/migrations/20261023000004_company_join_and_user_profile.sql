-- =====================================================================
-- Migration: User Profile Extensions & Company Join Request System
-- =====================================================================

-- 1. Extend public.users with personal profile attributes
alter table public.users add column if not exists phone text;
alter table public.users add column if not exists job_title text;
alter table public.users add column if not exists department text;
alter table public.users add column if not exists bio text;

-- 2. Create Company Join Requests Table
create table if not exists public.org_join_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  role_requested text not null default 'employee' check (role_requested in ('employee', 'manager')),
  note text,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz default now()
);

-- Index for speedy lookup by user and target org
create index if not exists idx_join_requests_user on public.org_join_requests(user_id, status);
create index if not exists idx_join_requests_org on public.org_join_requests(org_id, status);

-- Enable RLS
alter table public.org_join_requests enable row level security;

-- 3. RLS Policies on org_join_requests
-- Users can view requests they sent
create policy "Users can view their own join requests"
on public.org_join_requests for select
using (user_id = auth.uid());

-- Org owners and managers can view requests sent to their organization
create policy "Org owners and managers can view incoming join requests"
on public.org_join_requests for select
using (public.get_org_role(org_id) in ('owner', 'manager'));

-- Authenticated users can submit a join request for themselves
create policy "Users can submit join requests"
on public.org_join_requests for insert
with check (user_id = auth.uid() and auth.role() = 'authenticated');

-- Org owners and managers can update join request status (approve/reject)
create policy "Org owners and managers can decide join requests"
on public.org_join_requests for update
using (public.get_org_role(org_id) in ('owner', 'manager'));

-- Users can cancel their own pending join requests
create policy "Users can cancel their own pending requests"
on public.org_join_requests for delete
using (user_id = auth.uid() and status = 'pending');

-- 4. Organization Search Helper Function
-- Allows authenticated users to look up company names and slugs to join
create or replace function public.search_organizations(search_query text)
returns table (
  id uuid,
  name text,
  slug text,
  created_at timestamptz,
  member_count bigint
) language plpgsql security definer as $$
begin
  return query
  select 
    o.id,
    o.name,
    o.slug,
    o.created_at,
    count(m.id)::bigint as member_count
  from public.organizations o
  left join public.memberships m on m.org_id = o.id
  where 
    o.name ilike '%' || search_query || '%' or 
    o.slug ilike '%' || search_query || '%'
  group by o.id, o.name, o.slug, o.created_at
  order by o.name asc
  limit 20;
end;
$$;

grant execute on function public.search_organizations(text) to authenticated;

-- 5. Atomic Join Request Approval RPC
create or replace function public.approve_join_request(
  request_id uuid,
  assigned_role text default 'employee'
) returns jsonb language plpgsql security definer as $$
declare
  req record;
  caller_role text;
  new_mem public.memberships;
begin
  -- Fetch the join request
  select * into req from public.org_join_requests where id = request_id;
  if not found then
    raise exception 'Join request not found';
  end if;

  -- Validate caller has owner or manager role in this organization
  caller_role := public.get_org_role(req.org_id);
  if caller_role not in ('owner', 'manager') then
    raise exception 'Permission denied: caller must be owner or manager';
  end if;

  -- Add user to memberships (or update if already exists)
  insert into public.memberships (org_id, user_id, role)
  values (req.org_id, req.user_id, assigned_role)
  on conflict (org_id, user_id) do update set role = excluded.role
  returning * into new_mem;

  -- Mark request as approved
  update public.org_join_requests
  set status = 'approved',
      decided_by = auth.uid(),
      decided_at = now()
  where id = request_id;

  -- Dispatch notification to requester
  insert into public.notifications (org_id, recipient_id, type, payload_json)
  values (
    req.org_id,
    req.user_id,
    'join_approved',
    jsonb_build_object(
      'title', 'Join Request Approved',
      'message', 'Your request to join the organization has been approved as ' || assigned_role,
      'role', assigned_role,
      'approved_by', auth.uid()
    )
  );

  return to_jsonb(new_mem);
end;
$$;

grant execute on function public.approve_join_request(uuid, text) to authenticated;
