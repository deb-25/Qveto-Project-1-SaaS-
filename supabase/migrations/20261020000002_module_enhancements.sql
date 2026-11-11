-- Migration: Module Enhancements for TeamFlow (Modules 6, 7, 8, 9)
-- Adds email_status to notifications, Storage policies for attachments,
-- RLS policies for activity_events, labels, task_labels, Realtime publication, and RPC analytical functions.

-- 1. NOTIFICATIONS ENHANCEMENT (Module 7: FR-NTF-05)
alter table public.notifications 
add column if not exists email_status text default 'simulated_sent';

-- 2. LABELS & TASK_LABELS RLS POLICIES (Module 4)
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'View labels for org members' and tablename = 'labels') then
    create policy "View labels for org members"
    on public.labels for select
    using (public.is_org_member(org_id));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Manage labels for org members' and tablename = 'labels') then
    create policy "Manage labels for org members"
    on public.labels for all
    using (public.is_org_member(org_id));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'View task labels for org members' and tablename = 'task_labels') then
    create policy "View task labels for org members"
    on public.task_labels for select
    using (
      exists (
        select 1 from public.tasks
        where tasks.id = task_labels.task_id
          and public.is_org_member(tasks.org_id)
      )
    );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Manage task labels for org members' and tablename = 'task_labels') then
    create policy "Manage task labels for org members"
    on public.task_labels for all
    using (
      exists (
        select 1 from public.tasks
        where tasks.id = task_labels.task_id
          and public.is_org_member(tasks.org_id)
      )
    );
  end if;
end $$;

-- 3. ACTIVITY EVENTS RLS POLICIES (Module 6: FR-COL-04)
alter table public.activity_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'View activity events for org members' and tablename = 'activity_events') then
    create policy "View activity events for org members"
    on public.activity_events for select
    using (public.is_org_member(org_id));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Insert activity events for org members' and tablename = 'activity_events') then
    create policy "Insert activity events for org members"
    on public.activity_events for insert
    with check (public.is_org_member(org_id));
  end if;
end $$;

-- 4. ATTACHMENTS RLS POLICIES (Module 6: FR-COL-02 / FR-COL-03)
alter table public.attachments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'View attachments for accessible tasks' and tablename = 'attachments') then
    create policy "View attachments for accessible tasks"
    on public.attachments for select
    using (public.is_org_member(org_id));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Insert attachments for accessible tasks' and tablename = 'attachments') then
    create policy "Insert attachments for accessible tasks"
    on public.attachments for insert
    with check (public.is_org_member(org_id) and uploader_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Delete own attachments or manager/owner' and tablename = 'attachments') then
    create policy "Delete own attachments or manager/owner"
    on public.attachments for delete
    using (
      uploader_id = auth.uid() 
      or public.get_org_role(org_id) in ('owner', 'manager')
    );
  end if;
end $$;

-- 5. REALTIME REPLICATION CONFIGURATION
-- Allows UI clients to react immediately to changes across boards, tasks, comments, and notifications
do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.comments;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.attachments;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.activity_events;
exception when others then null;
end $$;

-- 6. RPC: OVERDUE AUDIT SCANNER (Module 7: FR-NTF-03)
-- Idempotent engine that detects overdue tasks and creates deduplicated notifications
create or replace function public.run_overdue_scan(target_org_id uuid)
returns json as $$
declare
  t record;
  now_ts timestamptz := now();
  scanned_count integer := 0;
  notifications_created integer := 0;
  d_key text;
begin
  for t in
    select id, org_id, title, due_date, assignee_id, priority
    from public.tasks
    where org_id = target_org_id
      and archived_at is null
      and status not in ('done', 'cancelled')
      and due_date is not null
      and due_date < now_ts
      and assignee_id is not null
  loop
    scanned_count := scanned_count + 1;
    d_key := 'overdue:' || t.id || ':' || to_char(t.due_date, 'YYYY-MM-DD');

    -- Insert notification if not exists (dedupe_key unique constraint)
    insert into public.notifications (
      org_id,
      recipient_id,
      type,
      task_id,
      dedupe_key,
      payload_json,
      email_status
    )
    values (
      t.org_id,
      t.assignee_id,
      'due_date',
      t.id,
      d_key,
      jsonb_build_object(
        'title', 'Task Overdue: ' || t.title,
        'task_title', t.title,
        'message', 'Target deadline passed on ' || to_char(t.due_date, 'Mon DD, YYYY') || '. Immediate action required.',
        'priority', t.priority,
        'due_date', t.due_date
      ),
      'simulated_sent'
    )
    on conflict (dedupe_key) do nothing;

    if found then
      notifications_created := notifications_created + 1;
    end if;
  end loop;

  return json_build_object(
    'scanned_count', scanned_count,
    'notifications_created', notifications_created
  );
end;
$$ language plpgsql security definer;

-- 7. RPC: PROJECT KPI CALCULATOR (Module 8: FR-RPT-02 & Doc 1 §9)
create or replace function public.get_project_kpis(target_project_id uuid, target_org_id uuid)
returns json as $$
declare
  total_eligible integer;
  done_count integer;
  completion_rate numeric;
  completed_with_due integer;
  on_time_count integer;
  on_time_rate numeric;
  overdue_count integer;
  active_count integer;
  assigned_active_count integer;
  coverage_rate numeric;
  total_points integer;
begin
  -- Eligible tasks (archived_at is null and status != 'cancelled')
  select count(*) into total_eligible
  from public.tasks
  where project_id = target_project_id
    and org_id = target_org_id
    and archived_at is null
    and status != 'cancelled';

  -- Done tasks
  select count(*) into done_count
  from public.tasks
  where project_id = target_project_id
    and org_id = target_org_id
    and archived_at is null
    and status = 'done';

  -- Completion rate (null if zero denominator)
  if total_eligible > 0 then
    completion_rate := round((done_count::numeric / total_eligible::numeric) * 100, 1);
  else
    completion_rate := null;
  end if;

  -- Completed with due date
  select count(*) into completed_with_due
  from public.tasks
  where project_id = target_project_id
    and org_id = target_org_id
    and archived_at is null
    and status = 'done'
    and due_date is not null;

  -- On-time completed
  select count(*) into on_time_count
  from public.tasks
  where project_id = target_project_id
    and org_id = target_org_id
    and archived_at is null
    and status = 'done'
    and due_date is not null
    and coalesce(completed_at, updated_at) <= due_date;

  if completed_with_due > 0 then
    on_time_rate := round((on_time_count::numeric / completed_with_due::numeric) * 100, 1);
  else
    on_time_rate := null;
  end if;

  -- Overdue count (active eligible tasks where due_date < now())
  select count(*) into overdue_count
  from public.tasks
  where project_id = target_project_id
    and org_id = target_org_id
    and archived_at is null
    and status not in ('done', 'cancelled')
    and due_date is not null
    and due_date < now();

  -- Active open tasks
  select count(*) into active_count
  from public.tasks
  where project_id = target_project_id
    and org_id = target_org_id
    and archived_at is null
    and status not in ('done', 'cancelled');

  -- Assigned active tasks
  select count(*) into assigned_active_count
  from public.tasks
  where project_id = target_project_id
    and org_id = target_org_id
    and archived_at is null
    and status not in ('done', 'cancelled')
    and assignee_id is not null;

  if active_count > 0 then
    coverage_rate := round((assigned_active_count::numeric / active_count::numeric) * 100, 1);
  else
    coverage_rate := null;
  end if;

  -- Workload points (urgent:4, high:3, medium:2, low:1)
  select coalesce(sum(
    case priority
      when 'urgent' then 4
      when 'high' then 3
      when 'medium' then 2
      when 'low' then 1
      else 2
    end
  ), 0) into total_points
  from public.tasks
  where project_id = target_project_id
    and org_id = target_org_id
    and archived_at is null
    and status not in ('done', 'cancelled');

  return json_build_object(
    'total_eligible', total_eligible,
    'done_count', done_count,
    'completion_rate', completion_rate,
    'overdue_count', overdue_count,
    'active_count', active_count,
    'assigned_active_count', assigned_active_count,
    'coverage_rate', coverage_rate,
    'total_workload_points', total_points
  );
end;
$$ language plpgsql security definer;
