import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  X, 
  Loader2, 
  FolderPlus, 
  ExternalLink,
  LayoutGrid,
  ListFilter,
  Tag,
  Keyboard,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Archive,
  Filter
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { KanbanBoard } from '../../components/kanban/KanbanBoard';
import { TaskListView } from '../../components/task/TaskListView';
import { TaskDetailModal } from '../../components/task/TaskDetailModal';
import { LabelManagerModal } from '../../components/labels/LabelManagerModal';
import { KeyboardShortcutsModal } from '../../components/task/KeyboardShortcutsModal';
import { 
  TaskWithAssignee, 
  TaskStatus, 
  TaskPriority, 
  Project, 
  Label,
  User as UserType 
} from '../../types';
import { useOrg } from '../../context/OrgContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabaseClient';
import { validateStatusTransition } from '../../utils/statusTransitions';
import { notifyTaskAssigned, notifyTaskCompletedOrStatusChanged } from '../../services/notificationService';

interface TaskPreset {
  name: string;
  icon: string;
  priority: TaskPriority;
  status: TaskStatus;
  templateTitle: string;
  templateDesc: string;
}

const TASK_PRESETS: TaskPreset[] = [
  {
    name: 'Bug Report',
    icon: '🐛',
    priority: 'high',
    status: 'todo',
    templateTitle: '[BUG] ',
    templateDesc: `### 🐛 Bug Report\n**Steps to Reproduce:**\n1. \n2. \n\n**Expected Result:**\n\n**Actual Result:**\n\n**Environment:** Chrome / Windows\n`,
  },
  {
    name: 'Feature Spec',
    icon: '🚀',
    priority: 'medium',
    status: 'backlog',
    templateTitle: '[FEAT] ',
    templateDesc: `### 🚀 Feature Specification\n**User Story:**\nAs a user, I want to ... so that ...\n\n**Acceptance Criteria:**\n- [ ] Criteria 1\n- [ ] Criteria 2\n\n**Technical Notes:**\n`,
  },
  {
    name: 'Hotfix P0',
    icon: '⚡',
    priority: 'urgent',
    status: 'in_progress',
    templateTitle: '[HOTFIX] ',
    templateDesc: `### ⚡ Production Critical Hotfix (P0)\n**Incident Summary:**\n\n**Immediate Mitigation Plan:**\n1. \n\n**Testing / Verification Check:**\n`,
  },
  {
    name: 'Spike / RFC',
    icon: '📋',
    priority: 'low',
    status: 'backlog',
    templateTitle: '[SPIKE] ',
    templateDesc: `### 📋 Technical Spike & Architecture Investigation\n**Goal & Objective:**\n\n**Key Questions to Answer:**\n1. \n2. \n\n**Output Deliverable:** RFC Document\n`,
  },
];

export const ProjectBoardPage: React.FC = () => {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Core Data States
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [members, setMembers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  // View Mode & Modals
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignee | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isLabelManagerOpen, setIsLabelManagerOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Filtering States (FR-TSK-07)
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Feedback & Validation Alert
  const [moveError, setMoveError] = useState<string | null>(null);

  // Form states for Create Task
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newAssigneeId, setNewAssigneeId] = useState<string>('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [targetColumnStatus, setTargetColumnStatus] = useState<TaskStatus>('todo');
  const [submittingTask, setSubmittingTask] = useState(false);

  // Form states for New Project
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectKey, setNewProjectKey] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // 1. Fetch Projects
  const fetchProjects = async () => {
    if (!currentOrg) return;
    try {
      const { data, error } = await (supabase.from('projects') as any)
        .select('*')
        .eq('org_id', currentOrg.id)
        .is('archived_at', null)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        setProjects(data);
        if (!activeProject || !data.some((p: Project) => p.id === activeProject.id)) {
          setActiveProject(data[0]);
        }
      } else {
        setProjects([]);
        setActiveProject(null);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  // 2. Fetch Labels for Org & Project
  const fetchLabels = async () => {
    if (!currentOrg) return;
    try {
      let query = (supabase.from('labels') as any)
        .select('*')
        .eq('org_id', currentOrg.id);

      if (activeProject) {
        query = query.or(`project_id.is.null,project_id.eq.${activeProject.id}`);
      }

      const { data } = await query.order('name', { ascending: true });
      if (data) setLabels(data);
    } catch (err) {
      console.error('Error fetching labels:', err);
    }
  };

  // 3. Fetch Project Members
  const fetchMembers = async () => {
    if (!currentOrg) return;
    try {
      const { data } = await (supabase.from('memberships') as any)
        .select('user_id, users (*)')
        .eq('org_id', currentOrg.id);

      if (data) {
        const uList = (data as any[]).map((m) => m.users).filter(Boolean);
        setMembers(uList);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  // 4. Fetch Tasks with Subtask Rollup and Labels (FR-TSK-04, FR-TSK-05)
  const fetchTasks = async (projId: string) => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      let query = (supabase.from('tasks') as any)
        .select('*, assignee:users(*)')
        .eq('org_id', currentOrg.id)
        .eq('project_id', projId);

      if (!showArchived) {
        query = query.is('archived_at', null);
      }

      const { data: allTasks, error } = await query.order('position', { ascending: true });

      if (!error && allTasks && allTasks.length > 0) {
        // Group subtasks by parent_task_id
        const subtasksByParent: Record<string, any[]> = {};
        allTasks.forEach((t: any) => {
          if (t.parent_task_id) {
            if (!subtasksByParent[t.parent_task_id]) {
              subtasksByParent[t.parent_task_id] = [];
            }
            subtasksByParent[t.parent_task_id].push(t);
          }
        });

        // Fetch task_labels mapping for these tasks
        const taskIds = allTasks.map((t: any) => t.id);
        const { data: tlData } = await (supabase.from('task_labels') as any)
          .select('task_id, labels (*)')
          .in('task_id', taskIds);

        const labelsByTaskId: Record<string, Label[]> = {};
        if (tlData) {
          tlData.forEach((item: any) => {
            if (item.labels) {
              if (!labelsByTaskId[item.task_id]) labelsByTaskId[item.task_id] = [];
              labelsByTaskId[item.task_id].push(item.labels);
            }
          });
        }

        // Top-level tasks show subtask progress and attached labels
        const topLevelTasks: TaskWithAssignee[] = allTasks
          .filter((t: any) => !t.parent_task_id)
          .map((t: any) => {
            const subs = subtasksByParent[t.id] || [];
            return {
              ...t,
              subtasks_count: subs.length,
              completed_subtasks_count: subs.filter((s: any) => s.status === 'done').length,
              labels: labelsByTaskId[t.id] || [],
            };
          });

        setTasks(topLevelTasks);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchMembers();
  }, [currentOrg]);

  useEffect(() => {
    if (activeProject) {
      fetchTasks(activeProject.id);
      fetchLabels();
    } else {
      setTasks([]);
      setLoading(false);
    }
  }, [activeProject, showArchived]);

  // Global Keyboard Shortcuts (Press '?' for help, '1' for board, '2' for list, 'C' for create)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setTargetColumnStatus('todo');
        setIsTaskModalOpen(true);
      } else if (e.key === '1') {
        setViewMode('board');
      } else if (e.key === '2') {
        setViewMode('list');
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setIsLabelManagerOpen(true);
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setIsTaskModalOpen(false);
        setIsProjectModalOpen(false);
        setIsShortcutsModalOpen(false);
        setIsLabelManagerOpen(false);
        setSelectedTask(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Strict Section 10 Validated Task Move Handler
  const handleTaskMove = async (taskId: string, newStatus: TaskStatus, newPosition: number) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    if (targetTask.status === newStatus && targetTask.position === newPosition) return;

    // Validate transition
    const hasOpenSubtasks = (targetTask.subtasks_count || 0) > (targetTask.completed_subtasks_count || 0);
    const validation = validateStatusTransition(targetTask.status, newStatus, {
      hasOpenSubtasks,
      isArchived: !!targetTask.archived_at,
      userRole: currentRole,
    });

    if (!validation.valid) {
      setMoveError(validation.error || 'Invalid status transition.');
      setTimeout(() => setMoveError(null), 4500);
      return;
    }

    const completedAt = newStatus === 'done' ? new Date().toISOString() : null;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: newStatus, position: newPosition, completed_at: completedAt }
          : t
      )
    );

    try {
      const { error } = await (supabase.from('tasks') as any)
        .update({
          status: newStatus,
          position: newPosition,
          completed_at: completedAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (error) throw error;

      // Log activity
      if (user && currentOrg && activeProject) {
        await (supabase.from('activity_events') as any).insert({
          org_id: currentOrg.id,
          project_id: activeProject.id,
          task_id: taskId,
          actor_id: user.id,
          type: 'task_moved',
          after_json: { status: newStatus, position: newPosition },
        });

        // Module 7: Notification Trigger for Status Move
        const movingTask = tasks.find((t) => t.id === taskId);
        if (movingTask) {
          await notifyTaskCompletedOrStatusChanged({
            orgId: currentOrg.id,
            task: movingTask,
            oldStatus: movingTask.status,
            newStatus,
            actorUser: user,
          });
        }
      }
    } catch (err) {
      console.error('Failed to update task move in Supabase:', err);
      if (activeProject) fetchTasks(activeProject.id);
    }
  };

  // Apply Quick Task Template
  const handleApplyPreset = (preset: TaskPreset) => {
    setNewTitle(preset.templateTitle);
    setNewDescription(preset.templateDesc);
    setNewPriority(preset.priority);
    setTargetColumnStatus(preset.status);
  };

  // Create Task with Labels
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !activeProject || !currentOrg || !user) return;

    setSubmittingTask(true);
    try {
      const newTaskPayload = {
        org_id: currentOrg.id,
        project_id: activeProject.id,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        status: targetColumnStatus,
        priority: newPriority,
        assignee_id: newAssigneeId || null,
        position: tasks.length * 1000 + 1000,
        created_by: user.id,
        due_date: new Date(Date.now() + 86400000 * 5).toISOString(),
      };

      const { data, error } = await (supabase.from('tasks') as any)
        .insert(newTaskPayload)
        .select('*, assignee:users(*)')
        .single();

      if (!error && data) {
        // Attach selected labels if any
        if (selectedLabelIds.length > 0) {
          const labelRows = selectedLabelIds.map((lId) => ({
            task_id: data.id,
            label_id: lId,
          }));
          await (supabase.from('task_labels') as any).insert(labelRows);
        }

        // Log creation event
        await (supabase.from('activity_events') as any).insert({
          org_id: currentOrg.id,
          project_id: activeProject.id,
          task_id: data.id,
          actor_id: user.id,
          type: 'task_created',
          after_json: { title: data.title, status: data.status, priority: data.priority },
        });

        // Module 7: Notification Trigger for Task Assignment
        if (data.assignee_id && currentOrg) {
          await notifyTaskAssigned({
            orgId: currentOrg.id,
            task: data,
            newAssigneeId: data.assignee_id,
            actorUser: user,
          });
        }

        await fetchTasks(activeProject.id);
        setNewTitle('');
        setNewDescription('');
        setNewAssigneeId('');
        setSelectedLabelIds([]);
        setIsTaskModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setSubmittingTask(false);
    }
  };

  // Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectKey.trim() || !currentOrg) return;

    setCreatingProject(true);
    try {
      let workspaceId = '';
      const { data: wsData } = await (supabase.from('workspaces') as any)
        .select('id')
        .eq('org_id', currentOrg.id)
        .limit(1);

      if (wsData && wsData.length > 0) {
        workspaceId = wsData[0].id;
      } else {
        const { data: newWs } = await (supabase.from('workspaces') as any)
          .insert({
            org_id: currentOrg.id,
            name: 'General Workspace',
          })
          .select('id')
          .single();
        workspaceId = newWs?.id;
      }

      const { data: prjData, error: prjError } = await (supabase.from('projects') as any)
        .insert({
          org_id: currentOrg.id,
          workspace_id: workspaceId,
          name: newProjectName.trim(),
          key: newProjectKey.trim().toUpperCase(),
          status: 'active',
          lead_id: user?.id,
        })
        .select()
        .single();

      if (!prjError && prjData) {
        if (user) {
          await (supabase.from('project_members') as any).insert({
            project_id: prjData.id,
            user_id: user.id,
            org_id: currentOrg.id,
          });
        }
        await fetchProjects();
        setActiveProject(prjData);
        setIsProjectModalOpen(false);
        setNewProjectName('');
        setNewProjectKey('');
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setCreatingProject(false);
    }
  };

  // Multi-Filter Logic (FR-TSK-07)
  const filteredTasks = tasks.filter((t) => {
    // 1. Search Query
    const matchesSearch =
      searchQuery.trim() === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));

    // 2. Priority Filter
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;

    // 3. Status Filter
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

    // 4. Assignee Filter
    let matchesAssignee = true;
    if (assigneeFilter === 'me') {
      matchesAssignee = t.assignee_id === user?.id;
    } else if (assigneeFilter === 'unassigned') {
      matchesAssignee = !t.assignee_id;
    } else if (assigneeFilter !== 'all') {
      matchesAssignee = t.assignee_id === assigneeFilter;
    }

    // 5. Label Filter
    const matchesLabel =
      labelFilter === 'all' ||
      (t.labels && t.labels.some((lbl) => lbl.id === labelFilter));

    return matchesSearch && matchesPriority && matchesStatus && matchesAssignee && matchesLabel;
  });

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    priorityFilter !== 'all' ||
    statusFilter !== 'all' ||
    assigneeFilter !== 'all' ||
    labelFilter !== 'all' ||
    showArchived;

  const handleResetFilters = () => {
    setSearchQuery('');
    setPriorityFilter('all');
    setStatusFilter('all');
    setAssigneeFilter('all');
    setLabelFilter('all');
    setShowArchived(false);
  };

  return (
    <div className="space-y-5 font-sans animate-in fade-in duration-150">
      {/* Workflow Transition Alert Notification */}
      {moveError && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono shadow-lg animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{moveError}</span>
          </div>
          <button
            onClick={() => setMoveError(null)}
            className="p-1 hover:text-white rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Board Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1 font-mono">
            {activeProject ? (
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                {activeProject.key} &middot; {activeProject.name}
              </span>
            ) : (
              <span className="text-xs text-slate-500">No project selected</span>
            )}
            <span className="text-[11px] text-slate-500 font-mono">
              ({filteredTasks.length} active tasks)
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5 font-mono">
            Sprint Control & Task Engine
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-sans">
            Strict Section 10 state transitions, label taxonomies, and subtask rollups.
          </p>
        </div>

        {/* Action Controls & Switchers */}
        <div className="flex flex-wrap items-center gap-2.5 font-mono">
          {/* Project Switcher */}
          {projects.length > 0 && (
            <select
              value={activeProject?.id || ''}
              onChange={(e) => {
                const found = projects.find((p) => p.id === e.target.value);
                if (found) setActiveProject(found);
              }}
              className="px-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-750 text-slate-200 focus:outline-none focus:border-amber-400"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.key} - {p.name}
                </option>
              ))}
            </select>
          )}

          {/* Project Overview Link */}
          {activeProject && (
            <Link
              to={`/projects/${activeProject.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 text-xs transition"
              title="View Project Milestones & Members"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Overview</span>
            </Link>
          )}

          {/* Manage Labels Button */}
          <button
            onClick={() => setIsLabelManagerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 text-xs transition"
            title="Manage Labels & Tags"
          >
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Labels</span>
            {labels.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-amber-300 font-bold">
                {labels.length}
              </span>
            )}
          </button>

          {/* Dual View Mode Toggle */}
          <div className="flex items-center rounded-xl bg-slate-900 border border-slate-750 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              title="Kanban Board View (Hotkey: 1)"
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg transition ${
                viewMode === 'board'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="Task List / Table View (Hotkey: 2)"
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg transition ${
                viewMode === 'list'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          {/* Keyboard Shortcuts Button */}
          <button
            onClick={() => setIsShortcutsModalOpen(true)}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-400 hover:text-amber-400 transition"
            title="Keyboard Shortcuts & Pro Tips (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {/* New Project (Owner/Manager) */}
          {currentRole !== 'employee' && (
            <button
              onClick={() => setIsProjectModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 text-xs transition"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">New Project</span>
            </button>
          )}

          {/* Create Task Button */}
          {activeProject && (
            <button
              onClick={() => {
                setTargetColumnStatus('todo');
                setIsTaskModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-Filter Toolbar (FR-TSK-07) */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl bg-[#0c1018] border border-slate-800/80 font-mono text-xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search tasks by title or criteria... (/)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-750 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-sans"
          />
        </div>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-750 text-slate-200 focus:outline-none focus:border-amber-400"
        >
          <option value="all">Priority: All</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-750 text-slate-200 focus:outline-none focus:border-amber-400"
        >
          <option value="all">Status: All</option>
          <option value="backlog">Backlog</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="in_review">In Review</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Assignee Filter */}
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-750 text-slate-200 focus:outline-none focus:border-amber-400"
        >
          <option value="all">Assignee: All</option>
          <option value="me">Assigned to Me</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.email.split('@')[0]}
            </option>
          ))}
        </select>

        {/* Label Filter */}
        {labels.length > 0 && (
          <select
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-750 text-slate-200 focus:outline-none focus:border-amber-400"
          >
            <option value="all">Label: All</option>
            {labels.map((lbl) => (
              <option key={lbl.id} value={lbl.id}>
                {lbl.name}
              </option>
            ))}
          </select>
        )}

        {/* Show Archived Toggle */}
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-750 text-slate-300 text-xs cursor-pointer select-none hover:text-white">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
          />
          <Archive className="w-3 h-3 text-slate-400" />
          <span>Archived</span>
        </label>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 text-xs transition"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] font-mono text-xs text-slate-400 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Synchronizing project tasks from Supabase...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0c1018] border border-slate-800 space-y-4 font-mono">
          <FolderPlus className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No Projects in Organization</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto font-sans">
            Create your first project to unlock the Kanban board and start scheduling team sprints.
          </p>
          <button
            onClick={() => setIsProjectModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition"
          >
            Create First Project
          </button>
        </div>
      ) : viewMode === 'board' ? (
        <KanbanBoard
          tasks={filteredTasks}
          onTaskMove={handleTaskMove}
          onAddTask={(colStatus) => {
            setTargetColumnStatus(colStatus);
            setIsTaskModalOpen(true);
          }}
          onSelectTask={(task) => setSelectedTask(task)}
          projectId={activeProject?.id}
        />
      ) : (
        <TaskListView
          tasks={filteredTasks}
          onSelectTask={(task) => setSelectedTask(task)}
          onStatusChange={(taskId, newStatus) => handleTaskMove(taskId, newStatus, 0)}
          onAddTask={() => {
            setTargetColumnStatus('todo');
            setIsTaskModalOpen(true);
          }}
        />
      )}

      {/* Task Details & Collaboration Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={() => activeProject && fetchTasks(activeProject.id)}
      />

      {/* Label Manager Modal */}
      <LabelManagerModal
        isOpen={isLabelManagerOpen}
        onClose={() => {
          setIsLabelManagerOpen(false);
          fetchLabels();
          if (activeProject) fetchTasks(activeProject.id);
        }}
        activeProject={activeProject}
        onLabelsChanged={() => {
          fetchLabels();
          if (activeProject) fetchTasks(activeProject.id);
        }}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Create Task Modal with Quick Templates */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans animate-in fade-in duration-150">
          <div className="bg-[#0c1018] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 font-mono max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Create Task &middot; {activeProject?.key}
                </h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Quick templates auto-populate specifications and priorities
                </p>
              </div>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets / Templates */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Rapid Presets:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TASK_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-amber-300 text-left text-xs transition flex flex-col gap-0.5"
                  >
                    <span className="text-sm">{p.icon}</span>
                    <span className="font-bold text-[11px] truncate">{p.name}</span>
                    <span className="text-[9px] uppercase text-slate-500">{p.priority}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement edge rate limiting"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400 font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                  Description & Specifications
                </label>
                <textarea
                  rows={4}
                  placeholder="Acceptance criteria, reproduction steps, or architecture notes..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400 font-sans leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                    Initial Column
                  </label>
                  <select
                    value={targetColumnStatus}
                    onChange={(e) => setTargetColumnStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                  Assignee (Project Member FR-TSK-03)
                </label>
                <select
                  value={newAssigneeId}
                  onChange={(e) => setNewAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Labels Multi-Select */}
              {labels.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1.5 flex items-center gap-1.5">
                    <Tag className="w-3 h-3 text-amber-400" />
                    <span>Attach Labels</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {labels.map((lbl) => {
                      const isChecked = selectedLabelIds.includes(lbl.id);
                      return (
                        <button
                          key={lbl.id}
                          type="button"
                          onClick={() => {
                            setSelectedLabelIds((prev) =>
                              isChecked ? prev.filter((id) => id !== lbl.id) : [...prev, lbl.id]
                            );
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition ${
                            isChecked
                              ? 'border-amber-400 bg-amber-500/20 text-amber-300 font-bold'
                              : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: lbl.color }}
                          />
                          <span>{lbl.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTask || !newTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingTask && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans animate-in fade-in duration-150">
          <div className="bg-[#0c1018] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Create Project
              </h3>
              <button
                onClick={() => setIsProjectModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Core Engine Infrastructure"
                  value={newProjectName}
                  onChange={(e) => {
                    setNewProjectName(e.target.value);
                    if (!newProjectKey && e.target.value) {
                      const words = e.target.value.trim().split(/\s+/);
                      const keySuggestion = words
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 4)
                        .toUpperCase();
                      setNewProjectKey(keySuggestion);
                    }
                  }}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400 font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                  Project Key (Prefix for tasks) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. ENG, CORE, OPS"
                  value={newProjectKey}
                  onChange={(e) => setNewProjectKey(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs uppercase focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingProject || !newProjectName.trim() || !newProjectKey.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  {creatingProject && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
