import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Calendar, 
  MoreVertical, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare,
  ArrowRight,
  CheckSquare
} from 'lucide-react';
import { TaskWithAssignee, TaskPriority, TaskStatus } from '../../types';

interface TaskCardProps {
  task: TaskWithAssignee;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onSelectTask?: (task: TaskWithAssignee) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange, onSelectTask }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const priorityStyles: Record<TaskPriority, { bg: string; text: string; border: string }> = {
    urgent: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
    high: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    medium: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    low: { bg: 'bg-slate-700/40', text: 'text-slate-400', border: 'border-slate-700' },
  };

  const isOverdue =
    task.due_date &&
    new Date(task.due_date) < new Date() &&
    task.status !== 'done' &&
    task.status !== 'cancelled';

  const totalSub = task.subtasks_count || 0;
  const completedSub = task.completed_subtasks_count || 0;

  const statuses: { label: string; value: TaskStatus }[] = [
    { label: 'Backlog', value: 'backlog' },
    { label: 'To Do', value: 'todo' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'In Review', value: 'in_review' },
    { label: 'Done', value: 'done' },
  ];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      tabIndex={0}
      role="button"
      aria-label={`Task: ${task.title}. Priority: ${task.priority}. Status: ${task.status}. Press Enter to view, M to open move menu.`}
      onClick={() => onSelectTask?.(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSelectTask?.(task);
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          setMenuOpen((prev) => !prev);
        }
      }}
      className="group relative bg-[#0e131d] hover:bg-[#121824] focus:outline-none focus:ring-1 focus:ring-amber-400 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3.5 shadow-md shadow-black/30 transition-all select-none cursor-pointer"
    >
      {/* Top Header: Priority badge and Action menu */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border font-mono ${priorityStyles[task.priority].bg} ${priorityStyles[task.priority].text} ${priorityStyles[task.priority].border}`}
        >
          {task.priority}
        </span>

        {/* Accessible Keyboard "Move To" Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            aria-label={`Options for ${task.title}`}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-slate-900 border border-slate-750 shadow-2xl py-1 z-30 font-mono">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Move status to:
              </div>
              {statuses.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  disabled={task.status === s.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange?.(task.id, s.value);
                    setMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                    task.status === s.value ? 'text-slate-500 cursor-not-allowed' : 'text-slate-200'
                  }`}
                >
                  <span>{s.label}</span>
                  {task.status !== s.value && <ArrowRight className="w-3 h-3 text-slate-500" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Task Drag Handle / Title */}
      <div {...listeners} className="cursor-grab active:cursor-grabbing mb-2">
        <h4 className="text-sm font-semibold text-slate-100 leading-snug group-hover:text-amber-400 transition-colors">
          {task.title}
        </h4>
        {task.description && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>

      {/* Labels Pills (FR-TSK-05) */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
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

      {/* Footer Info: Due date, subtasks, comments, assignee */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-2.5">
          {task.due_date && (
            <span
              className={`flex items-center gap-1 font-medium ${
                isOverdue ? 'text-rose-400 font-bold' : 'text-slate-400'
              }`}
            >
              {isOverdue ? (
                <AlertCircle className="w-3 h-3 text-rose-400 animate-pulse" />
              ) : (
                <Calendar className="w-3 h-3 text-slate-500" />
              )}
              {new Date(task.due_date).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}

          {/* Subtasks Progress (FR-TSK-04) */}
          {totalSub > 0 && (
            <span
              title={`Subtasks: ${completedSub} of ${totalSub} completed`}
              className={`flex items-center gap-1 ${
                completedSub === totalSub ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              <CheckSquare className="w-3 h-3" />
              <span>
                {completedSub}/{totalSub}
              </span>
            </span>
          )}

          {(task.comments_count || 0) > 0 && (
            <span className="flex items-center gap-1 text-slate-500">
              <MessageSquare className="w-3 h-3" />
              {task.comments_count}
            </span>
          )}
        </div>

        {/* Assignee Avatar */}
        <div className="flex items-center gap-1.5">
          <div
            title={task.assignee?.name || task.assignee?.email || 'Unassigned'}
            className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm font-mono"
          >
            {task.assignee?.name
              ? task.assignee.name.charAt(0).toUpperCase()
              : task.assignee?.email
              ? task.assignee.email.charAt(0).toUpperCase()
              : 'U'}
          </div>
        </div>
      </div>
    </div>
  );
};

