-- Seed Data for TeamFlow (Project 2)
-- Demonstrates multi-tenancy, cross-org isolation, roles, workspaces, projects, Kanban tasks, comments, and activity

-- Note: In production / Supabase Studio, demo users can be registered via Auth or seeded directly.
-- Org A: Acme Labs
-- Org B: BrightWave Studio

do $$
declare
  org_a_id uuid := 'a0000000-0000-0000-0000-000000000001';
  org_b_id uuid := 'b0000000-0000-0000-0000-000000000002';
  ws_a1_id uuid := 'a1000000-0000-0000-0000-000000000001';
  ws_b1_id uuid := 'b1000000-0000-0000-0000-000000000001';
  prj_a1_id uuid := 'aa100000-0000-0000-0000-000000000001';
  prj_b1_id uuid := 'bb100000-0000-0000-0000-000000000001';
begin
  -- 1. Insert Organizations
  insert into public.organizations (id, name, slug, default_timezone)
  values 
    (org_a_id, 'Acme Labs', 'acme-labs', 'UTC'),
    (org_b_id, 'BrightWave Studio', 'brightwave', 'America/New_York')
  on conflict (id) do nothing;

  -- 2. Insert Workspaces
  insert into public.workspaces (id, org_id, name, description)
  values
    (ws_a1_id, org_a_id, 'Engineering', 'Core engineering & product development workspace'),
    (ws_b1_id, org_b_id, 'Design Studio', 'Creative design and brand asset workspace')
  on conflict (id) do nothing;

  -- 3. Insert Projects
  insert into public.projects (id, org_id, workspace_id, key, name, description, status, start_date, target_date)
  values
    (prj_a1_id, org_a_id, ws_a1_id, 'ENG', 'NextGen Platform 2.0', 'Re-architecting core services into serverless micro-frontends', 'active', current_date - 14, current_date + 45),
    (prj_b1_id, org_b_id, ws_b1_id, 'DES', 'Brand Identity Refresh', 'Design system upgrade and brand style guide', 'active', current_date - 7, current_date + 21)
  on conflict (id) do nothing;

  -- 4. Insert Labels
  insert into public.labels (org_id, project_id, name, color)
  values
    (org_a_id, prj_a1_id, 'Frontend', '#3b82f6'),
    (org_a_id, prj_a1_id, 'Backend', '#10b981'),
    (org_a_id, prj_a1_id, 'Urgent Bug', '#ef4444'),
    (org_a_id, prj_a1_id, 'Security', '#8b5cf6')
  on conflict do nothing;

  -- 5. Insert Sample Tasks for Kanban Board
  insert into public.tasks (id, org_id, project_id, title, description, status, priority, position, due_date)
  values
    ('c1000000-0000-0000-0000-000000000001', org_a_id, prj_a1_id, 'Implement Supabase Auth & Session Flow', 'Connect Supabase Auth with React context provider and protected routes.', 'done', 'high', 1000, current_date - 2),
    ('c2000000-0000-0000-0000-000000000002', org_a_id, prj_a1_id, 'Build Interactive Kanban Board with dnd-kit', 'Implement drag-and-drop between columns with keyboard accessible move dialog.', 'in_progress', 'urgent', 2000, current_date + 3),
    ('c3000000-0000-0000-0000-000000000003', org_a_id, prj_a1_id, 'Design Multi-tenant RLS Policies in PostgreSQL', 'Enforce organization isolation and role permissions across all queries.', 'in_review', 'high', 3000, current_date + 1),
    ('c4000000-0000-0000-0000-000000000004', org_a_id, prj_a1_id, 'Setup Scheduled Overdue Task Detector', 'Create serverless function or cron job to notify assignees of overdue tasks.', 'todo', 'medium', 4000, current_date + 7),
    ('c5000000-0000-0000-0000-000000000005', org_a_id, prj_a1_id, 'Build Reports and KPI Analytics Charts', 'Calculate task completion rate, on-time percentage, and member workload.', 'backlog', 'low', 5000, current_date + 14)
  on conflict (id) do nothing;
end $$;
