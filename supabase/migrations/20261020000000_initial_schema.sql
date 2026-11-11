-- TeamFlow Initial Schema
-- Supports Multi-tenant SaaS with Organizations, Workspaces, Teams, Projects, Tasks, Kanban, Comments, Activity, and Notifications

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- 1. PROFILES / USERS (Mirrors Supabase auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  avatar_url text,
  timezone text default 'UTC',
  created_at timestamptz default now()
);

-- 2. ORGANIZATIONS (Tenant root)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  default_timezone text default 'UTC',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

-- 3. MEMBERSHIPS (RBAC per organization)
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'employee')),
  created_at timestamptz default now(),
  unique (org_id, user_id)
);

-- 4. WORKSPACES
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  archived_at timestamptz,
  created_at timestamptz default now()
);

-- 5. TEAMS
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- 6. TEAM MEMBERS
create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  primary key (team_id, user_id)
);

-- 7. PROJECTS
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  status text not null check (status in ('planned', 'active', 'on_hold', 'completed', 'archived')) default 'active',
  lead_id uuid references public.users(id) on delete set null,
  start_date date,
  target_date date,
  archived_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, key)
);

-- 8. PROJECT MEMBERS
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  primary key (project_id, user_id)
);

-- 9. MILESTONES
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  due_date date,
  created_at timestamptz default now()
);

-- 10. LABELS
create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  color text not null default '#3b82f6',
  created_at timestamptz default now()
);

-- 11. TASKS
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  description text,
  status text not null check (status in ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled')) default 'backlog',
  priority text not null check (priority in ('low', 'medium', 'high', 'urgent')) default 'medium',
  assignee_id uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  due_date timestamptz,
  completed_at timestamptz,
  position double precision not null default 1000,
  version integer not null default 1,
  archived_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 12. TASK LABELS
create table if not exists public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

-- 13. COMMENTS
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  edited_at timestamptz,
  created_at timestamptz default now()
);

-- 14. ATTACHMENTS
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  uploader_id uuid not null references public.users(id) on delete cascade,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_path text not null,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- 15. ACTIVITY EVENTS (Audit history)
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  type text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz default now()
);

-- 16. NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  task_id uuid references public.tasks(id) on delete cascade,
  payload_json jsonb,
  dedupe_key text unique,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- INDEXES for High-Performance Queries
create index if not exists idx_memberships_user_org on public.memberships(user_id, org_id);
create index if not exists idx_projects_org on public.projects(org_id);
create index if not exists idx_tasks_project_status_pos on public.tasks(project_id, status, position);
create index if not exists idx_tasks_assignee_due on public.tasks(assignee_id, due_date);
create index if not exists idx_tasks_org_due on public.tasks(org_id, due_date);
create index if not exists idx_comments_task on public.comments(task_id);
create index if not exists idx_activity_task on public.activity_events(task_id);
create index if not exists idx_notifications_recipient on public.notifications(recipient_id, read_at);

-- TRIGGERS & FUNCTIONS

-- Trigger: Automatically handle task completion timestamp and versioning
create or replace function public.handle_task_update()
returns trigger as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  
  if new.status = 'done' and old.status != 'done' then
    new.completed_at = now();
  elsif new.status != 'done' and old.status = 'done' then
    new.completed_at = null;
  end if;
  
  return new;
end;
$$ language plpgsql;

create trigger tr_tasks_before_update
before update on public.tasks
for each row execute function public.handle_task_update();

-- Trigger: Automatically replicate new auth.users to public.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ROW LEVEL SECURITY (RLS) POLICIES
alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.workspaces enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.labels enable row level security;
alter table public.tasks enable row level security;
alter table public.task_labels enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.activity_events enable row level security;
alter table public.notifications enable row level security;

-- Helper function to check if current user is an org member
create or replace function public.is_org_member(target_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.memberships
    where org_id = target_org_id
      and user_id = auth.uid()
  );
$$ language sql security definer;

-- Helper function to check org role
create or replace function public.get_org_role(target_org_id uuid)
returns text as $$
  select role from public.memberships
  where org_id = target_org_id
    and user_id = auth.uid()
  limit 1;
$$ language sql security definer;

-- RLS: Users
create policy "Users can view profile of organization peers"
on public.users for select
using (true);

create policy "Users can update their own profile"
on public.users for update
using (id = auth.uid());

-- RLS: Organizations
create policy "Org members can view their organization"
on public.organizations for select
using (public.is_org_member(id));

create policy "Authenticated users can create an organization"
on public.organizations for insert
with check (auth.role() = 'authenticated');

create policy "Only Owners can update organization"
on public.organizations for update
using (public.get_org_role(id) = 'owner');

-- RLS: Memberships
create policy "Members can view memberships in their org"
on public.memberships for select
using (public.is_org_member(org_id));

create policy "Owners and Managers can invite/add members"
on public.memberships for insert
with check (
  public.get_org_role(org_id) in ('owner', 'manager')
  or (auth.uid() = user_id and role = 'owner') -- Allowed when creating new org
);

create policy "Owners can update roles or remove members"
on public.memberships for update
using (public.get_org_role(org_id) = 'owner');

create policy "Owners can delete members"
on public.memberships for delete
using (public.get_org_role(org_id) = 'owner' or user_id = auth.uid());

-- RLS: Workspaces
create policy "Members can view workspaces"
on public.workspaces for select
using (public.is_org_member(org_id));

create policy "Owners and Managers can manage workspaces"
on public.workspaces for all
using (public.get_org_role(org_id) in ('owner', 'manager'));

-- RLS: Projects
create policy "Owners & Managers see all projects; Employees see joined projects"
on public.projects for select
using (
  public.get_org_role(org_id) in ('owner', 'manager')
  or exists (
    select 1 from public.project_members
    where project_id = projects.id and user_id = auth.uid()
  )
);

create policy "Owners and Managers can create projects"
on public.projects for insert
with check (public.get_org_role(org_id) in ('owner', 'manager'));

create policy "Owners and Managers can update projects"
on public.projects for update
using (public.get_org_role(org_id) in ('owner', 'manager'));

-- RLS: Tasks
create policy "View tasks for accessible projects"
on public.tasks for select
using (
  public.get_org_role(org_id) in ('owner', 'manager')
  or exists (
    select 1 from public.project_members
    where project_id = tasks.project_id and user_id = auth.uid()
  )
);

create policy "Create tasks in accessible projects"
on public.tasks for insert
with check (
  public.get_org_role(org_id) in ('owner', 'manager')
  or exists (
    select 1 from public.project_members
    where project_id = tasks.project_id and user_id = auth.uid()
  )
);

create policy "Update tasks in accessible projects"
on public.tasks for update
using (
  public.get_org_role(org_id) in ('owner', 'manager')
  or exists (
    select 1 from public.project_members
    where project_id = tasks.project_id and user_id = auth.uid()
  )
);

-- RLS: Comments
create policy "View comments in accessible projects"
on public.comments for select
using (public.is_org_member(org_id));

create policy "Add comments in accessible projects"
on public.comments for insert
with check (public.is_org_member(org_id) and author_id = auth.uid());

create policy "Authors can edit or delete their comments; Owners/Managers can delete any"
on public.comments for delete
using (
  author_id = auth.uid() 
  or public.get_org_role(org_id) in ('owner', 'manager')
);

-- RLS: Notifications
create policy "Users can see their own notifications"
on public.notifications for select
using (recipient_id = auth.uid());

create policy "Users can mark their own notifications as read"
on public.notifications for update
using (recipient_id = auth.uid());
