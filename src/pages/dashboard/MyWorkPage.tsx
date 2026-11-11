import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  Loader2,
  Inbox,
  Filter,
  Search,
  FolderKanban,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  CheckSquare,
  Sparkles,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Tag,
  Check,
  Scale
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Task, TaskWithAssignee, TaskStatus, TaskPriority, Project, Label } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useOrg } from '../../context/OrgContext';
import { supabase } from '../../api/supabaseClient';
import { TaskDetailModal } from '../../components/task/TaskDetailModal';
import { validateStatusTransition, STATUS_LABELS } from '../../utils/statusTransitions';
import { notifyTaskCompletedOrStatusChanged } from '../../services/notificationService';

interface TaskWithMetadata extends TaskWithAssignee {
  project?: { id: string; name: string; key: string } | null;
  labelsList?: Label[];
  subtasksCount?: number;
  completedSubtasksCount?: number;
  commentsCount?: number;
}

export const MyWorkPage: React.FC = () => {
  const { user } = useAuth();
  const { currentOrg } = useOrg();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<TaskWithMetadata[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignee | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'today' | 'upcoming' | 'completed'>('all');
  const [showCompletedSection, setShowCompletedSection] = useState(false);

  // Feedback Notification
  const [feedback, setFeedback] = useState<string | null>(null);

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const fetchMyTasks = async () => {
    if (!user || !currentOrg) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch user assigned tasks
      const { data: taskData, error: taskError } = await (supabase.from('tasks') as any)
        .select('*')
        .eq('org_id', currentOrg.id)
        .eq('assignee_id', user.id)
        .is('archived_at', null)
        .order('due_date', { ascending: true });

      if (taskError) throw taskError;

      const rawTasks: Task[] = taskData || [];
      if (rawTasks.length === 0) {
        setTasks([]);
        return;
      }

      const taskIds = rawTasks.map((t) => t.id);

      // 2. Fetch Projects, Labels, Subtasks, and Comments in parallel
      const [projectsRes, labelsRes, subtasksRes, commentsRes] = await Promise.all([
        (supabase.from('projects') as any)
          .select('id, name, key')
          .eq('org_id', currentOrg.id),

        (supabase.from('task_labels') as any)
          .select('task_id, labels (*)')
          .in('task_id', taskIds),

        (supabase.from('tasks') as any)
          .select('id, parent_task_id, status')
          .in('parent_task_id', taskIds)
          .is('archived_at', null),

        (supabase.from('comments') as any)
          .select('id, task_id')
          .in('task_id', taskIds),
      ]);

      // Project dictionary
      const projectMap: Record<string, { id: string; name: string; key: string }> = {};
      (projectsRes.data || []).forEach((p: any) => {
        projectMap[p.id] = p;
      });

      // Labels per task
      const labelMap: Record<string, Label[]> = {};
      (labelsRes.data || []).forEach((row: any) => {
        if (!labelMap[row.task_id]) labelMap[row.task_id] = [];
        if (row.labels) labelMap[row.task_id].push(row.labels);
      });

      // Subtasks counts
      const subtaskCountMap: Record<string, { total: number; done: number }> = {};
      (subtasksRes.data || []).forEach((st: any) => {
        if (st.parent_task_id) {
          if (!subtaskCountMap[st.parent_task_id]) {
            subtaskCountMap[st.parent_task_id] = { total: 0, done: 0 };
          }
          subtaskCountMap[st.parent_task_id].total++;
          if (st.status === 'done') {
            subtaskCountMap[st.parent_task_id].done++;
          }
        }
      });

      // Comments count
      const commentCountMap: Record<string, number> = {};
      (commentsRes.data || []).forEach((c: any) => {
        commentCountMap[c.task_id] = (commentCountMap[c.task_id] || 0) + 1;
      });

      // Assemble enriched tasks
      const enriched: TaskWithMetadata[] = rawTasks.map((t) => ({
        ...t,
        assignee: user as any,
        project: projectMap[t.project_id] || null,
        labelsList: labelMap[t.id] || [],
        subtasksCount: subtaskCountMap[t.id]?.total || 0,
        completedSubtasksCount: subtaskCountMap[t.id]?.done || 0,
        commentsCount: commentCountMap[t.id] || 0,
      }));

      setTasks(enriched);
    } catch (err: any) {
      console.error('Error fetching My Work tasks:', err);
      notify('Failed to refresh tasks.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchMyTasks();

    if (!user || !currentOrg) return;

    // Realtime channel: sync whenever tasks assigned to user update
    const myWorkChannel = supabase
      .channel(`my-work-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `assignee_id=eq.${user.id}` },
        () => {
          fetchMyTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(myWorkChannel);
    };
  }, [user?.id, currentOrg?.id]);

  // Fast Status Transition Handler (Doc 1 §10 Workflow Rules)
  const handleStatusChange = async (task: TaskWithMetadata, targetStatus: TaskStatus) => {
    if (!currentOrg || !user) return;

    const transitionCheck = validateStatusTransition(task.status, targetStatus, {
      hasOpenSubtasks: (task.subtasksCount || 0) > (task.completedSubtasksCount || 0),
      isArchived: !!task.archived_at,
    });

    if (!transitionCheck.valid) {
      notify(transitionCheck.error || 'Invalid status transition.');
      return;
    }

    const previousStatus = task.status;
    const completedAt = targetStatus === 'done' ? new Date().toISOString() : null;

    // Optimistic Update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: targetStatus, completed_at: completedAt } : t
      )
    );

    try {
      const { error } = await (supabase.from('tasks') as any)
        .update({
          status: targetStatus,
          completed_at: completedAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      if (error) throw error;

      // Log activity event
      await (supabase.from('activity_events') as any).insert({
        org_id: currentOrg.id,
        project_id: task.project_id,
        task_id: task.id,
        actor_id: user.id,
        type: 'task_moved',
        before_json: { status: previousStatus },
        after_json: { status: targetStatus },
      });

      // Notification to task creator / followers (Module 7)
      await notifyTaskCompletedOrStatusChanged({
        orgId: currentOrg.id,
        task: { ...task, status: targetStatus },
        oldStatus: previousStatus,
        newStatus: targetStatus,
        actorUser: user,
      });

      notify(`Task updated to ${STATUS_LABELS[targetStatus]}.`);
    } catch (err: any) {
      console.error('Failed to change status:', err);
      notify('Failed to update task.');
      fetchMyTasks();
    }
  };

  // Date Boundaries for Canonical Grouping (Document 2 §3 M9)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;
  const endOfWeek = startOfToday + 7 * 24 * 60 * 60 * 1000 - 1;

  // Filter tasks based on Search, Project, and Priority
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(query);
        const matchDesc = t.description?.toLowerCase().includes(query);
        const matchProject = t.project?.name.toLowerCase().includes(query) || t.project?.key.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchProject) return false;
      }

      // Project filter
      if (selectedProjectId !== 'all' && t.project_id !== selectedProjectId) {
        return false;
      }

      // Priority filter
      if (selectedPriority !== 'all' && t.priority !== selectedPriority) {
        return false;
      }

      return true;
    });
  }, [tasks, searchQuery, selectedProjectId, selectedPriority]);

  // Canonical Groups (Document 2 §3 M9 / Document 3 §3 S3-UX-03)
  const overdueTasks = useMemo(() => {
    return filteredTasks.filter((t) => {
      if (t.status === 'done' || t.status === 'cancelled' || !t.due_date) return false;
      return new Date(t.due_date).getTime() < startOfToday;
    });
  }, [filteredTasks, startOfToday]);

  const todayTasks = useMemo(() => {
    return filteredTasks.filter((t) => {
      if (t.status === 'done' || t.status === 'cancelled' || !t.due_date) return false;
      const dueTime = new Date(t.due_date).getTime();
      return dueTime >= startOfToday && dueTime <= endOfToday;
    });
  }, [filteredTasks, startOfToday, endOfToday]);

  const thisWeekTasks = useMemo(() => {
    return filteredTasks.filter((t) => {
      if (t.status === 'done' || t.status === 'cancelled' || !t.due_date) return false;
      const dueTime = new Date(t.due_date).getTime();
      return dueTime > endOfToday && dueTime <= endOfWeek;
    });
  }, [filteredTasks, endOfToday, endOfWeek]);

  const laterTasks = useMemo(() => {
    return filteredTasks.filter((t) => {
      if (t.status === 'done' || t.status === 'cancelled') return false;
      if (!t.due_date) return true; // No deadline tasks belong in Later
      return new Date(t.due_date).getTime() > endOfWeek;
    });
  }, [filteredTasks, endOfWeek]);

  const completedTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.status === 'done');
  }, [filteredTasks]);

  // Unique Projects for Filter Dropdown
  const assignedProjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; key: string }>();
    tasks.forEach((t) => {
      if (t.project) map.set(t.project.id, t.project);
    });
    return Array.from(map.values());
  }, [tasks]);

  // Personal Metrics & Health Telemetry
  const priorityPoints = useMemo(() => {
    const weights: Record<TaskPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
    return tasks
      .filter((t) => t.status !== 'done' && t.status !== 'cancelled')
      .reduce((sum, t) => sum + (weights[t.priority] || 2), 0);
  }, [tasks]);

  const personalOnTimeRate = useMemo(() => {
    const doneWithDeadline = completedTasks.filter((t) => !!t.due_date);
    if (doneWithDeadline.length === 0) return null;
    const onTime = doneWithDeadline.filter((t) => {
      const fin = t.completed_at ? new Date(t.completed_at).getTime() : new Date(t.updated_at).getTime();
      return fin <= new Date(t.due_date!).getTime();
    });
    return Math.round((onTime.length / doneWithDeadline.length) * 100);
  }, [completedTasks]);

  if (!currentOrg) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p className="text-sm">No active organization selected.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-xs text-slate-400 gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="font-medium tracking-wide">Syncing personal focus stream from Supabase...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans pb-16">
      {/* Top Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              Module 9 · Personal Focus
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {tasks.length} Assigned Items
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            <span>My Work Dashboard</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Personal delivery stream for <strong className="text-white">{user?.email}</strong> in <strong className="text-cyan-400">{currentOrg?.name}</strong>.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setRefreshing(true);
              fetchMyTasks();
            }}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <Link
            to="/board"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-xs font-bold text-slate-200 transition"
          >
            <FolderKanban className="w-4 h-4 text-amber-400" />
            <span>Sprint Board</span>
          </Link>

          <Link
            to="/reports"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-500/30 text-xs font-bold text-cyan-300 transition"
          >
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>Reports</span>
          </Link>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2 shadow-lg animate-in fade-in duration-200">
          <Sparkles className="w-4 h-4 shrink-0 text-cyan-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Personal Productivity & Health Telemetry Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Overdue */}
        <div 
          onClick={() => setActiveTab('overdue')}
          className={`p-4 rounded-2xl bg-[#0c1018] border transition cursor-pointer ${
            overdueTasks.length > 0 
              ? 'border-rose-500/30 hover:border-rose-500/50 bg-rose-500/5' 
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">Overdue</span>
            <AlertTriangle className={`w-4 h-4 ${overdueTasks.length > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-600'}`} />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-rose-400">{overdueTasks.length}</span>
            <span className="text-[11px] text-slate-400">items</span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate mt-1">
            {overdueTasks.length > 0 ? 'Requires immediate action' : 'All deadlines clear'}
          </span>
        </div>

        {/* Metric 2: Due Today */}
        <div 
          onClick={() => setActiveTab('today')}
          className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 hover:border-slate-700 transition cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Due Today</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-400">{todayTasks.length}</span>
            <span className="text-[11px] text-slate-400">tasks</span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate mt-1">
            Target end of day
          </span>
        </div>

        {/* Metric 3: Next 7 Days */}
        <div 
          onClick={() => setActiveTab('upcoming')}
          className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 hover:border-slate-700 transition cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">This Week</span>
            <Calendar className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-cyan-400">{thisWeekTasks.length}</span>
            <span className="text-[11px] text-slate-400">tasks</span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate mt-1">
            Next 7 calendar days
          </span>
        </div>

        {/* Metric 4: Cognitive Workload Points */}
        <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 hover:border-slate-700 transition space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400">Active Load</span>
            <Scale className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-purple-300">{priorityPoints}</span>
            <span className="text-[11px] text-slate-400">pts</span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate mt-1">
            Priority weighted
          </span>
        </div>

        {/* Metric 5: On-Time Rate */}
        <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 hover:border-slate-700 transition space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">On-Time Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-white">
              {personalOnTimeRate !== null ? `${personalOnTimeRate}%` : 'No data'}
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold">
              ({completedTasks.length} done)
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block truncate mt-1">
            Personal delivery track
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search my tasks by title, description, or project key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        {/* Project Selector */}
        <div className="relative min-w-[160px]">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">All Projects ({assignedProjects.length})</option>
            {assignedProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} [{p.key}]
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Priority Selector */}
        <div className="relative min-w-[140px]">
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Tab Filter Mode */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'all'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Timeline Flow
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'overdue'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Overdue ({overdueTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'completed'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Done ({completedTasks.length})
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="p-16 text-center rounded-3xl bg-[#0c1018] border border-slate-800 space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
            <Inbox className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-white">No Assigned Tasks in this Workspace</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              You do not currently have any active tasks assigned to you in {currentOrg.name}. Visit the Kanban board to pick up unassigned sprint items.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/board"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-900/30 transition"
            >
              <span>Explore Kanban Board</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0c1018] border border-slate-800 text-xs text-slate-400">
          No tasks match your active search and filter criteria.
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: OVERDUE (Document 2 §3 M9 / Document 3 §3 S3-UX-03) */}
          {(activeTab === 'all' || activeTab === 'overdue') && overdueTasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-rose-500/20">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4 animate-bounce" />
                  <span>1. Overdue Items ({overdueTasks.length})</span>
                </div>
                <span className="text-[11px] text-rose-400/80 font-mono">
                  Target deadline has passed
                </span>
              </div>

              <div className="space-y-2.5">
                {overdueTasks.map((t) => (
                  <TaskItemCard
                    key={t.id}
                    task={t}
                    urgencyVariant="overdue"
                    onSelect={() => setSelectedTask(t)}
                    onStatusChange={(status) => handleStatusChange(t, status)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: TODAY (Document 2 §3 M9) */}
          {(activeTab === 'all' || activeTab === 'today') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-amber-500/20">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <Clock className="w-4 h-4" />
                  <span>2. Due Today ({todayTasks.length})</span>
                </div>
                <span className="text-[11px] text-amber-400/80 font-mono">
                  Immediate focus for today
                </span>
              </div>

              {todayTasks.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/80 text-xs text-slate-500 italic">
                  No deadlines due today. Great job!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {todayTasks.map((t) => (
                    <TaskItemCard
                      key={t.id}
                      task={t}
                      urgencyVariant="today"
                      onSelect={() => setSelectedTask(t)}
                      onStatusChange={(status) => handleStatusChange(t, status)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: THIS WEEK (Document 2 §3 M9 / Document 1 §4.8 FR-RPT-01) */}
          {(activeTab === 'all' || activeTab === 'upcoming') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-cyan-500/20">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
                  <Calendar className="w-4 h-4" />
                  <span>3. Upcoming This Week ({thisWeekTasks.length})</span>
                </div>
                <span className="text-[11px] text-cyan-400/80 font-mono">
                  Due within next 7 days
                </span>
              </div>

              {thisWeekTasks.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/80 text-xs text-slate-500 italic">
                  No upcoming deadlines in the next 7 days.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {thisWeekTasks.map((t) => (
                    <TaskItemCard
                      key={t.id}
                      task={t}
                      urgencyVariant="this-week"
                      onSelect={() => setSelectedTask(t)}
                      onStatusChange={(status) => handleStatusChange(t, status)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 4: LATER & UNSCHEDULED (Document 2 §3 M9) */}
          {activeTab === 'all' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-wider">
                  <Inbox className="w-4 h-4 text-purple-400" />
                  <span>4. Later & Unscheduled ({laterTasks.length})</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  Future sprints & backlog items
                </span>
              </div>

              {laterTasks.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/80 text-xs text-slate-500 italic">
                  No tasks queued for later.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {laterTasks.map((t) => (
                    <TaskItemCard
                      key={t.id}
                      task={t}
                      urgencyVariant="later"
                      onSelect={() => setSelectedTask(t)}
                      onStatusChange={(status) => handleStatusChange(t, status)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 5: COMPLETED RECENTLY (Collapsible) */}
          {(activeTab === 'all' || activeTab === 'completed') && (
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowCompletedSection(!showCompletedSection)}
                className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider hover:text-emerald-300 transition"
              >
                {showCompletedSection ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <span>Completed Tasks ({completedTasks.length})</span>
              </button>

              {(showCompletedSection || activeTab === 'completed') && (
                <div className="space-y-2.5">
                  {completedTasks.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/80 text-xs text-slate-500 italic">
                      No completed tasks yet. Finish active tasks to view achievements here!
                    </div>
                  ) : (
                    completedTasks.map((t) => (
                      <TaskItemCard
                        key={t.id}
                        task={t}
                        urgencyVariant="completed"
                        onSelect={() => setSelectedTask(t)}
                        onStatusChange={(status) => handleStatusChange(t, status)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Task Details & Collaboration Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={fetchMyTasks}
      />
    </div>
  );
};

// ============================================================================
// TASK ITEM CARD SUBCOMPONENT
// ============================================================================

interface TaskItemCardProps {
  task: TaskWithMetadata;
  urgencyVariant: 'overdue' | 'today' | 'this-week' | 'later' | 'completed';
  onSelect: () => void;
  onStatusChange: (newStatus: TaskStatus) => void;
}

const TaskItemCard: React.FC<TaskItemCardProps> = ({
  task,
  urgencyVariant,
  onSelect,
  onStatusChange,
}) => {
  const isDone = task.status === 'done';

  const priorityStyles: Record<TaskPriority, { bg: string; text: string; border: string }> = {
    urgent: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
    high: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    medium: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    low: { bg: 'bg-slate-700/40', text: 'text-slate-400', border: 'border-slate-700' },
  };

  const pStyle = priorityStyles[task.priority] || priorityStyles.medium;

  const cardBorderClasses = {
    overdue: 'border-rose-900/50 hover:border-rose-700/80 bg-rose-950/10',
    today: 'border-amber-500/30 hover:border-amber-500/50 bg-amber-500/5',
    'this-week': 'border-slate-800 hover:border-cyan-500/40 bg-[#0c1018]',
    later: 'border-slate-800/80 hover:border-slate-700 bg-[#0c1018]',
    completed: 'border-slate-800/60 bg-slate-900/30 opacity-75 hover:opacity-100',
  }[urgencyVariant];

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return 'No due date';
    const due = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.round((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)}d (${due.toLocaleDateString()})`;
    } else if (diffDays === 0) {
      return 'Due Today';
    } else if (diffDays === 1) {
      return 'Due Tomorrow';
    } else {
      return `Due in ${diffDays}d (${due.toLocaleDateString()})`;
    }
  };

  return (
    <div
      className={`p-4 rounded-2xl border transition-all shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${cardBorderClasses}`}
    >
      {/* Left: Checkbox + Title + Metadata */}
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <button
          onClick={() => onStatusChange(isDone ? 'todo' : 'done')}
          className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition shrink-0 ${
            isDone
              ? 'bg-emerald-500 border-emerald-400 text-white shadow-sm'
              : urgencyVariant === 'overdue'
              ? 'border-rose-500/60 hover:border-rose-400 hover:bg-rose-500/10'
              : 'border-slate-600 hover:border-cyan-400 hover:bg-cyan-500/10'
          }`}
          title={isDone ? 'Reopen Task' : 'Mark Task as Done'}
        >
          {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>

        <div className="space-y-1 min-w-0 flex-1">
          {/* Top row: Project Key & Labels */}
          <div className="flex flex-wrap items-center gap-1.5">
            {task.project && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-800/80 border border-slate-700 text-slate-300">
                {task.project.key}
              </span>
            )}
            <span
              className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded border ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}
            >
              {task.priority}
            </span>

            {task.labelsList?.slice(0, 3).map((lbl) => (
              <span
                key={lbl.id}
                className="text-[10px] font-medium px-1.5 py-0.2 rounded-full border"
                style={{
                  backgroundColor: `${lbl.color}15`,
                  borderColor: `${lbl.color}40`,
                  color: lbl.color,
                }}
              >
                {lbl.name}
              </span>
            ))}
          </div>

          {/* Task Title */}
          <h4
            onClick={onSelect}
            className={`text-sm font-semibold cursor-pointer transition line-clamp-1 ${
              isDone
                ? 'line-through text-slate-500'
                : 'text-slate-100 hover:text-cyan-300'
            }`}
          >
            {task.title}
          </h4>

          {/* Metadata Row: Subtasks + Comments + Deadline */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-0.5">
            {/* Subtask count */}
            {(task.subtasksCount || 0) > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                <CheckSquare className="w-3 h-3 text-cyan-400" />
                <span>{task.completedSubtasksCount}/{task.subtasksCount}</span>
              </span>
            )}

            {/* Comment count */}
            {(task.commentsCount || 0) > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                <MessageSquare className="w-3 h-3 text-purple-400" />
                <span>{task.commentsCount}</span>
              </span>
            )}

            {/* Deadline */}
            <span
              className={`text-[11px] font-mono flex items-center gap-1 ${
                urgencyVariant === 'overdue'
                  ? 'text-rose-400 font-bold'
                  : urgencyVariant === 'today'
                  ? 'text-amber-400 font-bold'
                  : 'text-slate-400'
              }`}
            >
              <Clock className="w-3 h-3 shrink-0" />
              <span>{formatDueDate(task.due_date)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Right: Inline Status Selector */}
      <div className="flex items-center gap-2 self-end sm:self-center">
        <div className="relative">
          <select
            value={task.status}
            onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
            className="appearance-none pl-2.5 pr-7 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="backlog">Backlog</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="done">Done</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <button
          onClick={onSelect}
          className="p-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-300 transition"
          title="Open Task Details"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
