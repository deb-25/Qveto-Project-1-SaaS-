import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  FolderKanban, 
  Users, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Edit3, 
  ArrowLeft, 
  ArrowRight,
  Shield, 
  UserPlus, 
  Flag,
  Archive,
  RefreshCw,
  Loader2,
  Check,
  X,
  AlertCircle,
  Activity,
  MessageSquare,
  Paperclip,
  CheckSquare,
  Filter,
  FileText,
  BarChart3
} from 'lucide-react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useOrg } from '../../context/OrgContext';
import { Project, Task, OrgRole, TaskWithAssignee } from '../../types';
import { TaskDetailModal } from '../../components/task/TaskDetailModal';

interface Milestone {
  id: string;
  project_id: string;
  name: string;
  due_date?: string;
  created_at: string;
}

interface ProjectMemberItem {
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface ProjectActivityItem {
  id: string;
  actor_id?: string | null;
  task_id?: string | null;
  type: string;
  before_json?: any;
  after_json?: any;
  created_at: string;
}

export const ProjectOverviewPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrg();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [members, setMembers] = useState<ProjectMemberItem[]>([]);
  const [allOrgUsers, setAllOrgUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Module 6 Collaboration & Views State
  const [projectTab, setProjectTab] = useState<'roadmap' | 'activity' | 'tasks' | 'members'>('roadmap');
  const [projectActivities, setProjectActivities] = useState<ProjectActivityItem[]>([]);
  const [activityFilter, setActivityFilter] = useState<'all' | 'status' | 'comments' | 'files' | 'milestones'>('all');
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignee | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Modals state
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [milestoneName, setMilestoneName] = useState('');
  const [milestoneDueDate, setMilestoneDueDate] = useState('');
  const [savingMilestone, setSavingMilestone] = useState(false);

  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedUserIdToAdd, setSelectedUserIdToAdd] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Edit project state
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editLeadId, setEditLeadId] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  const isManagerOrOwner = currentRole === 'owner' || currentRole === 'manager';

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const loadProjectOverview = async () => {
    if (!projectId || !currentOrg) return;
    try {
      setLoading(true);

      // 1. Fetch Project details
      const { data: projData, error: projError } = await (supabase.from('projects') as any)
        .select('*')
        .eq('id', projectId)
        .eq('org_id', currentOrg.id)
        .single();

      if (projError || !projData) {
        throw new Error('Project not found or accessible.');
      }
      setProject(projData);
      setEditName(projData.name);
      setEditDesc(projData.description || '');
      setEditStatus(projData.status);
      setEditTargetDate(projData.target_date || '');
      setEditLeadId(projData.lead_id || '');

      // 2. Fetch Tasks in this project
      const { data: taskData } = await (supabase.from('tasks') as any)
        .select('*')
        .eq('project_id', projectId)
        .is('archived_at', null);

      setTasks(taskData || []);

      // 3. Fetch Milestones (FR-PRJ-04)
      const { data: msData } = await (supabase.from('milestones') as any)
        .select('*')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true });

      setMilestones(msData || []);

      // 4. Fetch Project Members (FR-PRJ-02)
      const { data: pmData } = await (supabase.from('project_members') as any)
        .select('user_id, users (id, name, email, avatar_url)')
        .eq('project_id', projectId);

      if (pmData) {
        const pMembers: ProjectMemberItem[] = (pmData as any[])
          .map((item) => ({
            user_id: item.user_id,
            name: item.users?.name || item.users?.email?.split('@')[0] || 'Member',
            email: item.users?.email || 'unknown',
            avatar_url: item.users?.avatar_url,
          }));
        setMembers(pMembers);
      }

      // 5. Fetch all organization members to allow adding to project
      const { data: orgMembersData } = await (supabase.from('memberships') as any)
        .select('user_id, users (id, name, email)')
        .eq('org_id', currentOrg.id);

      if (orgMembersData) {
        const uList = (orgMembersData as any[])
          .map((m) => m.users)
          .filter(Boolean)
          .map((u) => ({
            id: u.id,
            name: u.name || u.email?.split('@')[0] || 'Member',
            email: u.email,
          }));
        setAllOrgUsers(uList);
      }

      // 6. Fetch Project Activities (GET /projects/:id/activity)
      const { data: actData } = await (supabase.from('activity_events') as any)
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(60);

      setProjectActivities(actData || []);
    } catch (err: any) {
      console.error('Failed to load project overview:', err);
      notify(err.message || 'Error loading project.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectOverview();

    if (projectId) {
      const channel = supabase
        .channel(`project-collab-${projectId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'activity_events', filter: `project_id=eq.${projectId}` },
          () => {
            (supabase.from('activity_events') as any)
              .select('*')
              .eq('project_id', projectId)
              .order('created_at', { ascending: false })
              .limit(60)
              .then(({ data }: any) => {
                if (data) setProjectActivities(data);
              });
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
          () => {
            loadProjectOverview();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [projectId, currentOrg]);

  // Project Progress Calculation (Doc 1 §9: Done tasks ÷ Active eligible tasks)
  const eligibleTasks = tasks.filter((t) => t.status !== 'cancelled');
  const doneTasks = eligibleTasks.filter((t) => t.status === 'done');
  const progressPercent = eligibleTasks.length > 0
    ? Math.round((doneTasks.length / eligibleTasks.length) * 100)
    : 0;

  const now = new Date().getTime();
  const overdueTasksCount = eligibleTasks.filter((t) => {
    if (!t.due_date || t.status === 'done') return false;
    return new Date(t.due_date).getTime() < now;
  }).length;

  // Assignment Coverage (Doc 1 §9 / FR-RPT-02: Active tasks with assignee ÷ Total active tasks)
  const activeTasks = eligibleTasks.filter((t) => t.status !== 'done');
  const assignedActiveTasks = activeTasks.filter((t) => !!t.assignee_id);
  const assignmentCoveragePercent = activeTasks.length > 0
    ? Math.round((assignedActiveTasks.length / activeTasks.length) * 100)
    : null;

  // Add Milestone
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneName.trim() || !project || !currentOrg) return;

    setSavingMilestone(true);
    try {
      const { error } = await (supabase.from('milestones') as any).insert({
        project_id: project.id,
        org_id: currentOrg.id,
        name: milestoneName.trim(),
        due_date: milestoneDueDate || null,
      });

      if (error) throw error;

      // Log activity (FR-COL-04)
      await (supabase.from('activity_events') as any).insert({
        org_id: currentOrg.id,
        project_id: project.id,
        actor_id: user?.id,
        type: 'milestone_created',
        after_json: { name: milestoneName.trim(), due_date: milestoneDueDate || null },
      });

      notify(`Milestone "${milestoneName}" added.`);
      setMilestoneName('');
      setMilestoneDueDate('');
      setIsMilestoneModalOpen(false);
      await loadProjectOverview();
    } catch (err: any) {
      notify(err.message || 'Failed to add milestone.');
    } finally {
      setSavingMilestone(false);
    }
  };

  // Delete Milestone
  const handleDeleteMilestone = async (msId: string) => {
    if (!confirm('Remove this milestone?')) return;
    try {
      const { error } = await (supabase.from('milestones') as any)
        .delete()
        .eq('id', msId);

      if (error) throw error;

      if (currentOrg && project) {
        await (supabase.from('activity_events') as any).insert({
          org_id: currentOrg.id,
          project_id: project.id,
          actor_id: user?.id,
          type: 'milestone_deleted',
        });
      }

      notify('Milestone deleted.');
      await loadProjectOverview();
    } catch (err: any) {
      notify('Failed to delete milestone.');
    }
  };

  // Add Project Member (FR-PRJ-02)
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserIdToAdd || !project || !currentOrg) return;

    setAddingMember(true);
    try {
      const { error } = await (supabase.from('project_members') as any).insert({
        project_id: project.id,
        user_id: selectedUserIdToAdd,
        org_id: currentOrg.id,
      });

      if (error) throw error;

      const addedUser = allOrgUsers.find((u) => u.id === selectedUserIdToAdd);
      await (supabase.from('activity_events') as any).insert({
        org_id: currentOrg.id,
        project_id: project.id,
        actor_id: user?.id,
        type: 'member_added',
        after_json: { user_id: selectedUserIdToAdd, name: addedUser?.name || 'Member' },
      });

      notify('Member added to project.');
      setSelectedUserIdToAdd('');
      setIsAddMemberModalOpen(false);
      await loadProjectOverview();
    } catch (err: any) {
      notify(err.message || 'User is already a project member or error occurred.');
    } finally {
      setAddingMember(false);
    }
  };

  // Remove Project Member
  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from this project?`)) return;
    try {
      const { error } = await (supabase.from('project_members') as any)
        .delete()
        .eq('project_id', project!.id)
        .eq('user_id', userId);

      if (error) throw error;

      if (currentOrg && project) {
        await (supabase.from('activity_events') as any).insert({
          org_id: currentOrg.id,
          project_id: project.id,
          actor_id: user?.id,
          type: 'member_removed',
          after_json: { user_id: userId, name },
        });
      }

      notify(`Removed ${name} from project.`);
      await loadProjectOverview();
    } catch (err: any) {
      notify(err.message || 'Failed to remove member.');
    }
  };

  const handleOpenTask = (t: Task) => {
    const assignee = allOrgUsers.find((u) => u.id === t.assignee_id) as any;
    setSelectedTask({ ...t, assignee });
    setIsTaskModalOpen(true);
  };

  // Save Project Changes
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !editName.trim()) return;

    setSavingProject(true);
    try {
      const { error } = await (supabase.from('projects') as any)
        .update({
          name: editName.trim(),
          description: editDesc.trim() || null,
          status: editStatus,
          target_date: editTargetDate || null,
          lead_id: editLeadId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id);

      if (error) throw error;
      notify('Project updated.');
      setIsEditProjectOpen(false);
      await loadProjectOverview();
    } catch (err: any) {
      notify(err.message || 'Failed to update project.');
    } finally {
      setSavingProject(false);
    }
  };

  // Archive / Restore Project (FR-PRJ-05)
  const handleToggleArchive = async () => {
    if (!project) return;
    const isArchived = !!project.archived_at;
    const action = isArchived ? 'restore' : 'archive';
    if (!confirm(`Are you sure you want to ${action} this project?`)) return;

    try {
      const { error } = await (supabase.from('projects') as any)
        .update({
          archived_at: isArchived ? null : new Date().toISOString(),
          status: isArchived ? 'active' : 'archived',
        })
        .eq('id', project.id);

      if (error) throw error;
      notify(`Project ${action}d successfully.`);
      await loadProjectOverview();
    } catch (err: any) {
      notify(`Failed to ${action} project.`);
    }
  };

  const leadMember = allOrgUsers.find((u) => u.id === project?.lead_id);
  const isArchived = project?.status === 'archived' || !!project?.archived_at;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] font-mono text-xs text-slate-400 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
        <span>Loading project telemetry...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono space-y-4">
        <p className="text-sm">Project not found or access restricted.</p>
        <Link to="/workspaces" className="text-amber-400 underline text-xs">
          Return to Workspaces
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-sans">
      {/* Top Navigation breadcrumb */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 font-mono">
        <div className="flex items-center gap-3">
          <Link
            to="/workspaces"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                {project.key}
              </span>
              <span className="text-xs text-slate-400">Project Overview (Module 3)</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mt-0.5">
              {project.name}
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <Link
            to={`/board`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition active:scale-95"
          >
            <FolderKanban className="w-4 h-4" />
            <span>Open Sprint Board</span>
          </Link>

          <Link
            to={`/reports?project=${project.id}`}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition shadow-sm"
          >
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span>Analytics</span>
          </Link>

          {isManagerOrOwner && (
            <>
              <button
                onClick={() => setIsEditProjectOpen(true)}
                title="Edit Project Settings"
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-300 transition"
              >
                <Edit3 className="w-4 h-4 text-amber-400" />
              </button>
              <button
                onClick={handleToggleArchive}
                title={isArchived ? 'Restore Project' : 'Archive Project'}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-300 hover:text-rose-400 transition"
              >
                <Archive className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Progress & Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 font-mono">
        {/* Card 1: Progress % */}
        <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] uppercase tracking-wider font-bold">Progress Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{progressPercent}%</span>
            <span className="text-xs text-slate-400">
              {doneTasks.length} / {eligibleTasks.length} tasks
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-850 overflow-hidden mt-1">
            <div
              className="h-full bg-emerald-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Card 2: Active Tasks */}
        <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] uppercase tracking-wider font-bold">Total Workload</span>
            <FolderKanban className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{tasks.length}</span>
            <span className="text-xs text-slate-400">tasks scheduled</span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate">
            {eligibleTasks.filter((t) => t.status === 'in_progress').length} In Progress &middot; {eligibleTasks.filter((t) => t.status === 'in_review').length} In Review
          </span>
        </div>

        {/* Card 3: Overdue Items */}
        <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] uppercase tracking-wider font-bold">Overdue Risks</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{overdueTasksCount}</span>
            <span className="text-xs text-rose-400 font-semibold">past target</span>
          </div>
          <span className="text-[10px] text-slate-500 block">
            Requires sprint re-allocation
          </span>
        </div>

        {/* Card 4: Assignment Coverage (FR-RPT-02) */}
        <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] uppercase tracking-wider font-bold">Coverage</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">
              {assignmentCoveragePercent !== null ? `${assignmentCoveragePercent}%` : 'No data'}
            </span>
            <span className="text-xs text-slate-400">
              {assignedActiveTasks.length} / {activeTasks.length} active
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate">
            Active tasks with assigned owner
          </span>
        </div>

        {/* Card 5: Project Lead */}
        <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] uppercase tracking-wider font-bold">Project Lead</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
              {leadMember?.name ? leadMember.name.charAt(0).toUpperCase() : 'L'}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-slate-200 truncate">{leadMember?.name || 'Unassigned Lead'}</p>
              <p className="text-[10px] text-slate-500 truncate">{leadMember?.email || 'Assign in settings'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Module 3 & Module 6 Collaboration) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3 font-mono text-xs">
        <button
          onClick={() => setProjectTab('roadmap')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition ${
            projectTab === 'roadmap'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Flag className="w-3.5 h-3.5" />
          <span>Roadmap & Milestones</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
            {milestones.length}
          </span>
        </button>

        <button
          onClick={() => setProjectTab('activity')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition ${
            projectTab === 'activity'
              ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>Project Activity Stream</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
            {projectActivities.length}
          </span>
        </button>

        <button
          onClick={() => setProjectTab('tasks')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition ${
            projectTab === 'tasks'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Sprint Tasks</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
            {tasks.length}
          </span>
        </button>

        <button
          onClick={() => setProjectTab('members')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition ${
            projectTab === 'members'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Team Roster</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
            {members.length}
          </span>
        </button>
      </div>

      {/* TAB 1: ROADMAP & MILESTONES */}
      {projectTab === 'roadmap' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Milestones (FR-PRJ-04) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-[#0c1018] border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono">
                <div className="flex items-center gap-2.5">
                  <Flag className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Project Milestones ({milestones.length})
                  </h3>
                </div>
                {isManagerOrOwner && (
                  <button
                    onClick={() => setIsMilestoneModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Milestone</span>
                  </button>
                )}
              </div>

              {milestones.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl font-mono">
                  No milestones defined. Create key target dates and phases for your engineering sprint.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 overflow-hidden font-mono">
                  {milestones.map((ms) => {
                    const isPast = ms.due_date && new Date(ms.due_date).getTime() < now;
                    return (
                      <div
                        key={ms.id}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                            <Flag className="w-3 h-3" />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-200 truncate">{ms.name}</p>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-sans">
                              <Calendar className="w-3 h-3" />
                              {ms.due_date ? `Due ${new Date(ms.due_date).toLocaleDateString()}` : 'No deadline'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {ms.due_date && (
                            <span className={`text-[10px] px-2 py-0.5 rounded ${
                              isPast ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20' : 'bg-slate-800 text-slate-300'
                            }`}>
                              {isPast ? 'Passed' : 'Upcoming'}
                            </span>
                          )}

                          {isManagerOrOwner && (
                            <button
                              onClick={() => handleDeleteMilestone(ms.id)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Project Tasks Overview */}
            <div className="p-6 rounded-2xl bg-[#0c1018] border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Sprint Tasks ({tasks.length})
                </h3>
                <Link
                  to="/board"
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                >
                  <span>Kanban Board</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {tasks.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl font-mono">
                  No tasks created in this project yet. Use the Kanban Board to dispatch tasks.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 overflow-hidden font-mono">
                  {tasks.slice(0, 6).map((t) => (
                    <div 
                      key={t.id} 
                      onClick={() => handleOpenTask(t)}
                      className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-900/60 cursor-pointer transition"
                    >
                      <div className="truncate">
                        <p className="font-semibold text-slate-200 truncate hover:text-amber-400">{t.title}</p>
                        <span className="text-[10px] text-slate-500">
                          Priority: {t.priority} &middot; {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : 'No date'}
                        </span>
                      </div>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-850 text-slate-300">
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Project Members (FR-PRJ-02) */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-[#0c1018] border border-slate-800 space-y-4 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Project Members ({members.length})
                  </h3>
                </div>
                {isManagerOrOwner && (
                  <button
                    onClick={() => setIsAddMemberModalOpen(true)}
                    className="p-1 rounded-lg text-amber-400 hover:bg-slate-850 transition"
                    title="Add Member to Project"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {members.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No members assigned to this project.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {members.map((m) => {
                    const isLead = m.user_id === project.lead_id;
                    return (
                      <div key={m.user_id} className="py-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-200 truncate">{m.name}</p>
                              {isLead && (
                                <span className="text-[9px] px-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  Lead
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">{m.email}</p>
                          </div>
                        </div>

                        {isManagerOrOwner && !isLead && (
                          <button
                            onClick={() => handleRemoveMember(m.user_id, m.name)}
                            title="Remove from project"
                            className="p-1 text-slate-500 hover:text-rose-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROJECT ACTIVITY STREAM (MODULE 6: GET /projects/:id/activity) */}
      {projectTab === 'activity' && (
        <div className="space-y-4 font-mono">
          {/* Header & Filter Controls */}
          <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Live Audit Stream & Collaboration Feed
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Filter:
              </span>
              {[
                { id: 'all', label: 'All Events' },
                { id: 'status', label: 'Status Moves' },
                { id: 'comments', label: 'Comments' },
                { id: 'files', label: 'Attachments' },
                { id: 'milestones', label: 'Milestones' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActivityFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg border transition ${
                    activityFilter === f.id
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 font-bold'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Events List */}
          {(() => {
            const filteredActivities = projectActivities.filter((act) => {
              if (activityFilter === 'status') return act.type.includes('status') || act.type.includes('move');
              if (activityFilter === 'comments') return act.type.includes('comment');
              if (activityFilter === 'files') return act.type.includes('attachment');
              if (activityFilter === 'milestones') return act.type.includes('milestone');
              return true;
            });

            if (filteredActivities.length === 0) {
              return (
                <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl bg-[#0c1018]">
                  No activity events recorded for the selected filter.
                </div>
              );
            }

            return (
              <div className="divide-y divide-slate-800/80 rounded-2xl bg-[#0c1018] border border-slate-800 overflow-hidden">
                {filteredActivities.map((act) => {
                  const actor = allOrgUsers.find((u) => u.id === act.actor_id);
                  const targetTask = tasks.find((t) => t.id === act.task_id);

                  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                  let icon = <Activity className="w-3.5 h-3.5 text-cyan-400" />;
                  let label = act.type.replace(/_/g, ' ');

                  if (act.type.includes('comment')) {
                    badgeColor = 'bg-purple-500/10 text-purple-300 border-purple-500/20';
                    icon = <MessageSquare className="w-3.5 h-3.5 text-purple-400" />;
                    label = act.type === 'comment_added' ? 'Comment Added' : 'Comment Edited';
                  } else if (act.type.includes('attachment')) {
                    badgeColor = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
                    icon = <Paperclip className="w-3.5 h-3.5 text-indigo-400" />;
                    label = act.type === 'attachment_added' ? 'File Uploaded' : 'File Removed';
                  } else if (act.type.includes('status') || act.type.includes('move')) {
                    badgeColor = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
                    icon = <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />;
                    label = 'Status Moved';
                  } else if (act.type.includes('milestone')) {
                    badgeColor = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                    icon = <Flag className="w-3.5 h-3.5 text-emerald-400" />;
                    label = act.type === 'milestone_created' ? 'Milestone Created' : 'Milestone Removed';
                  } else if (act.type.includes('member')) {
                    badgeColor = 'bg-blue-500/10 text-blue-300 border-blue-500/20';
                    icon = <Users className="w-3.5 h-3.5 text-blue-400" />;
                    label = act.type === 'member_added' ? 'Member Added' : 'Member Removed';
                  }

                  return (
                    <div
                      key={act.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/40 transition"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-750 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                          {icon}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${badgeColor}`}>
                              {label}
                            </span>
                            <span className="text-xs font-semibold text-slate-200">
                              {actor?.name || 'TeamFlow User'}
                            </span>
                            {targetTask && (
                              <button
                                onClick={() => handleOpenTask(targetTask)}
                                className="text-xs text-amber-400 hover:underline flex items-center gap-1 truncate max-w-xs"
                                title="Open task details"
                              >
                                &rarr; {targetTask.title}
                              </button>
                            )}
                          </div>

                          {/* Event details summary */}
                          <p className="text-xs text-slate-400 font-sans">
                            {act.type.includes('status') && act.after_json?.status && (
                              <span>
                                Changed status from <code className="text-slate-300 font-mono">{act.before_json?.status || 'todo'}</code> to <code className="text-amber-300 font-mono">{act.after_json?.status}</code>
                              </span>
                            )}
                            {act.type.includes('attachment') && act.after_json?.file_name && (
                              <span>
                                Attached file <strong className="text-slate-200">{act.after_json.file_name}</strong>
                              </span>
                            )}
                            {act.type.includes('comment') && (
                              <span>Posted a new comment in discussion</span>
                            )}
                            {act.type.includes('milestone') && act.after_json?.name && (
                              <span>Milestone: <strong className="text-slate-200">{act.after_json.name}</strong></span>
                            )}
                            {act.type.includes('member') && act.after_json?.name && (
                              <span>Member: <strong className="text-slate-200">{act.after_json.name}</strong></span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 shrink-0 sm:text-right font-mono">
                        {new Date(act.created_at).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 3: ALL SPRINT TASKS MANIFEST */}
      {projectTab === 'tasks' && (
        <div className="p-6 rounded-2xl bg-[#0c1018] border border-slate-800 space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Sprint Tasks Manifest ({tasks.length})
            </h3>
            <Link
              to="/board"
              className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-bold"
            >
              <span>Kanban Board</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {tasks.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              No tasks created in this project. Open the Kanban board to create and dispatch tasks.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 overflow-hidden">
              {tasks.map((t) => {
                const assignee = allOrgUsers.find((u) => u.id === t.assignee_id);
                const isOverdue = t.due_date && t.status !== 'done' && new Date(t.due_date).getTime() < now;

                return (
                  <div
                    key={t.id}
                    onClick={() => handleOpenTask(t)}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-900/60 cursor-pointer transition"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-200 truncate hover:text-amber-400">
                        {t.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-500">
                        <span>Priority: <strong className="text-slate-400">{t.priority}</strong></span>
                        <span>&middot;</span>
                        <span>Assignee: <strong className="text-slate-400">{assignee?.name || 'Unassigned'}</strong></span>
                        {t.due_date && (
                          <>
                            <span>&middot;</span>
                            <span className={isOverdue ? 'text-rose-400 font-bold' : ''}>
                              Due {new Date(t.due_date).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-850 text-slate-300">
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TEAM ROSTER */}
      {projectTab === 'members' && (
        <div className="p-6 rounded-2xl bg-[#0c1018] border border-slate-800 space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Project Team Access ({members.length})
              </h3>
            </div>
            {isManagerOrOwner && (
              <button
                onClick={() => setIsAddMemberModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Member</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {members.map((m) => {
              const isLead = m.user_id === project.lead_id;
              return (
                <div
                  key={m.user_id}
                  className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-200 truncate">{m.name}</p>
                        {isLead && (
                          <span className="text-[9px] px-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            Lead
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{m.email}</p>
                    </div>
                  </div>

                  {isManagerOrOwner && !isLead && (
                    <button
                      onClick={() => handleRemoveMember(m.user_id, m.name)}
                      title="Remove from project"
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Milestone Modal (FR-PRJ-04) */}
      {isMilestoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono">
          <div className="bg-[#0c1018] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Add Milestone
              </h3>
              <button
                onClick={() => setIsMilestoneModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMilestone} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Milestone Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Beta Release v1.0, Security Audit"
                  value={milestoneName}
                  onChange={(e) => setMilestoneName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Target Due Date
                </label>
                <input
                  type="date"
                  value={milestoneDueDate}
                  onChange={(e) => setMilestoneDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMilestoneModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMilestone}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingMilestone && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Milestone</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal (FR-PRJ-02) */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono">
          <div className="bg-[#0c1018] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Add Member to Project
              </h3>
              <button
                onClick={() => setIsAddMemberModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Select Organization Member
                </label>
                <select
                  required
                  value={selectedUserIdToAdd}
                  onChange={(e) => setSelectedUserIdToAdd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- Choose colleague --</option>
                  {allOrgUsers
                    .filter((u) => !members.some((m) => m.user_id === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingMember || !selectedUserIdToAdd}
                  className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {addingMember && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add to Project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {isEditProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono">
          <div className="bg-[#0c1018] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Edit Project Settings
              </h3>
              <button
                onClick={() => setIsEditProjectOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                  >
                    <option value="active">Active</option>
                    <option value="planned">Planned</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={editTargetDate}
                    onChange={(e) => setEditTargetDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Project Lead (FR-PRJ-02)
                </label>
                <select
                  value={editLeadId}
                  onChange={(e) => setEditLeadId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- No Lead Assigned --</option>
                  {allOrgUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditProjectOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProject}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingProject && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail Modal (Module 6 Collaboration: Comments, Attachments, Subtasks, Activity) */}
      {isTaskModalOpen && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
          onTaskUpdated={loadProjectOverview}
        />
      )}
    </div>
  );
};
