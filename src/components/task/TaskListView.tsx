import React, { useState } from 'react';
import { 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  CircleDot, 
  AlertOctagon, 
  ChevronUp, 
  ChevronDown, 
  ArrowUpDown,
  CheckSquare,
  MessageSquare,
  Plus,
  Filter
} from 'lucide-react';
import { TaskWithAssignee, TaskStatus, TaskPriority } from '../../types';
import { STATUS_LABELS } from '../../utils/statusTransitions';

interface TaskListViewProps {
  tasks: TaskWithAssignee[];
  onSelectTask: (task: TaskWithAssignee) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onAddTask: () => void;
}

type SortField = 'title' | 'status' | 'priority' | 'due_date' | 'created_at';
type SortOrder = 'asc' | 'desc';

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  onSelectTask,
  onStatusChange,
  onAddTask,
}) => {
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const priorityWeights: Record<TaskPriority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const statusWeights: Record<TaskStatus, number> = {
    backlog: 1,
    todo: 2,
    in_progress: 3,
    in_review: 4,
    done: 5,
    cancelled: 6,
  };

  const priorityStyles: Record<TaskPriority, { bg: string; text: string; border: string }> = {
    urgent: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
    high: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    medium: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    low: { bg: 'bg-slate-700/40', text: 'text-slate-400', border: 'border-slate-700' },
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'title') {
      comparison = a.title.localeCompare(b.title);
    } else if (sortField === 'status') {
      comparison = (statusWeights[a.status] || 0) - (statusWeights[b.status] || 0);
    } else if (sortField === 'priority') {
      comparison = (priorityWeights[a.priority] || 0) - (priorityWeights[b.priority] || 0);
    } else if (sortField === 'due_date') {
      const aTime = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bTime = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      comparison = aTime - bTime;
    } else if (sortField === 'created_at') {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const statuses: { label: string; value: TaskStatus }[] = [
    { label: 'Backlog', value: 'backlog' },
    { label: 'To Do', value: 'todo' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'In Review', value: 'in_review' },
    { label: 'Done', value: 'done' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  return (
    <div className="bg-[#0c1018] border border-slate-800 rounded-2xl overflow-hidden shadow-xl font-sans">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60 font-mono text-[11px] uppercase tracking-wider text-slate-400">
              <th className="py-3.5 px-4 font-semibold">
                <button
                  onClick={() => handleSort('title')}
                  className="flex items-center gap-1.5 hover:text-white transition"
                >
                  <span>Task Title & Labels</span>
                  {sortField === 'title' ? (
                    sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  )}
                </button>
              </th>
              <th className="py-3.5 px-3 font-semibold">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center gap-1.5 hover:text-white transition"
                >
                  <span>Status</span>
                  {sortField === 'status' ? (
                    sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  )}
                </button>
              </th>
              <th className="py-3.5 px-3 font-semibold">
                <button
                  onClick={() => handleSort('priority')}
                  className="flex items-center gap-1.5 hover:text-white transition"
                >
                  <span>Priority</span>
                  {sortField === 'priority' ? (
                    sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  )}
                </button>
              </th>
              <th className="py-3.5 px-3 font-semibold">
                <button
                  onClick={() => handleSort('due_date')}
                  className="flex items-center gap-1.5 hover:text-white transition"
                >
                  <span>Due Date</span>
                  {sortField === 'due_date' ? (
                    sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  )}
                </button>
              </th>
              <th className="py-3.5 px-3 font-semibold">Subtasks</th>
              <th className="py-3.5 px-3 font-semibold">Assignee</th>
              <th className="py-3.5 px-4 text-right font-semibold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans text-xs">
            {sortedTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Filter className="w-6 h-6 text-slate-600" />
                    <span>No tasks match the active filters or query.</span>
                    <button
                      onClick={onAddTask}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs"
                    >
                      Create First Task
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              sortedTasks.map((task) => {
                const isOverdue =
                  task.due_date &&
                  new Date(task.due_date) < new Date() &&
                  task.status !== 'done' &&
                  task.status !== 'cancelled';

                const totalSub = task.subtasks_count || 0;
                const completedSub = task.completed_subtasks_count || 0;

                return (
                  <tr
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="group hover:bg-slate-900/60 transition cursor-pointer select-none"
                  >
                    {/* Title & Description & Labels */}
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100 group-hover:text-amber-400 transition-colors">
                            {task.title}
                          </span>
                          {(task.comments_count || 0) > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                              <MessageSquare className="w-3 h-3" />
                              {task.comments_count}
                            </span>
                          )}
                        </div>

                        {task.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1">
                            {task.description}
                          </p>
                        )}

                        {/* Labels row */}
                        {task.labels && task.labels.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {task.labels.map((lbl) => (
                              <span
                                key={lbl.id}
                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 font-mono"
                                style={{
                                  backgroundColor: `${lbl.color}15`,
                                  color: lbl.color,
                                  borderColor: `${lbl.color}35`,
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: lbl.color }}
                                />
                                {lbl.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status Dropdown */}
                    <td className="py-3.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={task.status}
                        onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
                        className="px-2 py-1 rounded-lg text-xs font-mono font-bold bg-slate-900 border border-slate-750 text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                      >
                        {statuses.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Priority Badge */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border font-mono ${
                          priorityStyles[task.priority].bg
                        } ${priorityStyles[task.priority].text} ${priorityStyles[task.priority].border}`}
                      >
                        {task.priority}
                      </span>
                    </td>

                    {/* Due Date & Overdue Badge */}
                    <td className="py-3.5 px-3 whitespace-nowrap font-mono text-xs">
                      {task.due_date ? (
                        <div className="flex items-center gap-1.5">
                          {isOverdue ? (
                            <span className="flex items-center gap-1 text-rose-400 font-bold bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">
                              <AlertCircle className="w-3 h-3 text-rose-400 animate-pulse" />
                              <span>
                                {new Date(task.due_date).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>
                                {new Date(task.due_date).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Subtasks Progress */}
                    <td className="py-3.5 px-3 whitespace-nowrap font-mono">
                      {totalSub > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-14 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-amber-400 h-1.5 rounded-full"
                              style={{ width: `${(completedSub / totalSub) * 100}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {completedSub}/{totalSub}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[11px]">None</span>
                      )}
                    </td>

                    {/* Assignee */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {task.assignee ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm font-mono">
                            {task.assignee.name ? task.assignee.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <span className="text-xs text-slate-300 font-medium">
                            {task.assignee.name || task.assignee.email.split('@')[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600 font-mono">Unassigned</span>
                      )}
                    </td>

                    {/* Details Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTask(task);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-300 text-[11px] font-mono transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-3 bg-slate-900/40 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400 px-4">
        <span>Showing {sortedTasks.length} task(s)</span>
        <button
          onClick={onAddTask}
          className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-bold transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </button>
      </div>
    </div>
  );
};
