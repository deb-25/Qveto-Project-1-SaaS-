import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { 
  Plus, 
  CheckCircle, 
  Clock, 
  CircleDot, 
  AlertOctagon,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ArrowUpDown,
  Volume2
} from 'lucide-react';
import { TaskWithAssignee, TaskStatus, TaskPriority } from '../../types';
import { TaskCard } from './TaskCard';
import { STATUS_LABELS } from '../../utils/statusTransitions';

interface KanbanBoardProps {
  tasks: TaskWithAssignee[];
  onTaskMove: (taskId: string, newStatus: TaskStatus, newPosition: number) => Promise<void>;
  onAddTask?: (status: TaskStatus) => void;
  onSelectTask?: (task: TaskWithAssignee) => void;
  projectId?: string;
}

interface ColumnConfig {
  id: TaskStatus;
  title: string;
  icon: any;
  color: string;
  accentBg: string;
  borderHover: string;
  defaultWipLimit: number | null;
}

const COLUMNS: ColumnConfig[] = [
  { 
    id: 'backlog', 
    title: 'Backlog', 
    icon: CircleDot, 
    color: 'text-slate-400', 
    accentBg: 'bg-slate-500/5',
    borderHover: 'hover:border-slate-700',
    defaultWipLimit: null 
  },
  { 
    id: 'todo', 
    title: 'To Do', 
    icon: Clock, 
    color: 'text-blue-400', 
    accentBg: 'bg-blue-500/5',
    borderHover: 'hover:border-blue-500/30',
    defaultWipLimit: 10 
  },
  { 
    id: 'in_progress', 
    title: 'In Progress', 
    icon: AlertOctagon, 
    color: 'text-amber-400', 
    accentBg: 'bg-amber-500/5',
    borderHover: 'hover:border-amber-500/30',
    defaultWipLimit: 5 
  },
  { 
    id: 'in_review', 
    title: 'In Review', 
    icon: Clock, 
    color: 'text-purple-400', 
    accentBg: 'bg-purple-500/5',
    borderHover: 'hover:border-purple-500/30',
    defaultWipLimit: 3 
  },
  { 
    id: 'done', 
    title: 'Done', 
    icon: CheckCircle, 
    color: 'text-emerald-400', 
    accentBg: 'bg-emerald-500/5',
    borderHover: 'hover:border-emerald-500/30',
    defaultWipLimit: null 
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
  tasks, 
  onTaskMove, 
  onAddTask, 
  onSelectTask,
  projectId = 'default'
}) => {
  const [activeTask, setActiveTask] = useState<TaskWithAssignee | null>(null);
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string>('');

  // WIP Limits State (FR-KAN-05) - Persisted in local storage per project
  const storageKey = `teamflow_wip_${projectId}`;
  const [wipLimits, setWipLimits] = useState<Record<TaskStatus, number | null>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      backlog: null,
      todo: 10,
      in_progress: 5,
      in_review: 3,
      done: null,
      cancelled: null,
    };
  });

  // Collapsed columns state
  const [collapsedColumns, setCollapsedColumns] = useState<Record<TaskStatus, boolean>>({
    backlog: false,
    todo: false,
    in_progress: false,
    in_review: false,
    done: false,
    cancelled: true,
  });

  // WIP Settings popover
  const [editingWipStatus, setEditingWipStatus] = useState<TaskStatus | null>(null);
  const [tempWipLimit, setTempWipLimit] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getColumnTasks = (status: TaskStatus) => {
    return tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.position - b.position);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
      setAriaAnnouncement(
        `Picked up task "${task.title}". Currently in ${STATUS_LABELS[task.status]}. Use arrow keys or drag to reorder.`
      );
    }
  };

  // Fractional / Gapped Indexing Calculation (FR-KAN-02)
  const calculatePosition = (
    columnTasks: TaskWithAssignee[],
    activeTaskId: string,
    overTaskId: string | null
  ): number => {
    const list = columnTasks.filter((t) => t.id !== activeTaskId);
    if (list.length === 0) return 1000;

    if (!overTaskId) {
      // Placed at end of column
      return list[list.length - 1].position + 1000;
    }

    const overIndex = list.findIndex((t) => t.id === overTaskId);
    if (overIndex === -1) {
      return list[list.length - 1].position + 1000;
    }

    if (overIndex === 0) {
      // Placed before the first item
      return Math.max(1, list[0].position - 1000);
    }

    // Placed between overIndex - 1 and overIndex
    const prevPos = list[overIndex - 1].position;
    const nextPos = list[overIndex].position;
    return (prevPos + nextPos) / 2;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      setAriaAnnouncement('Drag cancelled. Task returned to original position.');
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const draggedTask = tasks.find((t) => t.id === activeId);
    if (!draggedTask) return;

    // Determine target status
    let targetStatus: TaskStatus = draggedTask.status;
    let overTaskId: string | null = null;

    const isColumnOver = COLUMNS.some((col) => col.id === overId);
    if (isColumnOver) {
      targetStatus = overId as TaskStatus;
      overTaskId = null;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetStatus = overTask.status;
        overTaskId = overTask.id;
      }
    }

    const targetColumnTasks = getColumnTasks(targetStatus);
    const newPosition = calculatePosition(targetColumnTasks, activeId, overTaskId);

    // Announce to screen readers (FR-KAN-03)
    setAriaAnnouncement(
      `Task "${draggedTask.title}" moved to ${STATUS_LABELS[targetStatus]} at position ${Math.round(
        newPosition
      )}.`
    );

    await onTaskMove(activeId, targetStatus, newPosition);
  };

  const handleSaveWipLimit = (status: TaskStatus) => {
    const parsed = parseInt(tempWipLimit, 10);
    const newLimit = isNaN(parsed) || parsed <= 0 ? null : parsed;
    const updated = { ...wipLimits, [status]: newLimit };
    setWipLimits(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
    setEditingWipStatus(null);
  };

  const toggleColumnCollapse = (status: TaskStatus) => {
    setCollapsedColumns((prev) => ({
      ...prev,
      [status]: !prev[status],
    }));
  };

  return (
    <div className="space-y-3 font-sans">
      {/* Screen Reader ARIA Live Region (FR-KAN-03) */}
      <div 
        aria-live="polite" 
        role="status" 
        className="sr-only"
      >
        {ariaAnnouncement}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar items-start min-h-[550px]">
          {COLUMNS.map((column) => {
            const columnTasks = getColumnTasks(column.id);
            const Icon = column.icon;
            const isCollapsed = collapsedColumns[column.id];
            const wipLimit = wipLimits[column.id];
            const isWipExceeded = wipLimit !== null && columnTasks.length > wipLimit;

            // Collapsed Column View
            if (isCollapsed) {
              return (
                <div
                  key={column.id}
                  onClick={() => toggleColumnCollapse(column.id)}
                  title={`Expand ${column.title} column`}
                  className="flex flex-col items-center justify-between py-4 px-2 bg-slate-900/60 border border-slate-800 rounded-2xl w-14 hover:border-slate-700 cursor-pointer transition select-none h-[400px]"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Icon className={`w-4 h-4 ${column.color}`} />
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 font-mono">
                      {columnTasks.length}
                    </span>
                  </div>

                  <div className="rotate-90 origin-center text-xs font-mono font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                    {column.title}
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-500 hover:text-white" />
                </div>
              );
            }

            // Normal Column View
            return (
              <div
                key={column.id}
                className={`flex flex-col bg-[#0c1018] border rounded-2xl p-3 min-w-[280px] w-72 lg:w-80 shrink-0 backdrop-blur-sm transition-all ${
                  isWipExceeded
                    ? 'border-rose-500/40 shadow-lg shadow-rose-950/20'
                    : 'border-slate-800/80 hover:border-slate-750'
                }`}
              >
                {/* Column Header */}
                <div className="pb-3 px-1 border-b border-slate-800/70 mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${column.color}`} />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                        {column.title}
                      </h3>
                      {/* Count Badge */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                          isWipExceeded
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {columnTasks.length}
                      </span>
                    </div>

                    {/* Column Controls */}
                    <div className="flex items-center gap-1">
                      {/* WIP Config Toggle */}
                      <button
                        onClick={() => {
                          setEditingWipStatus(
                            editingWipStatus === column.id ? null : column.id
                          );
                          setTempWipLimit(wipLimit ? String(wipLimit) : '');
                        }}
                        title="Configure Column WIP Limit"
                        className={`p-1 rounded-lg transition ${
                          editingWipStatus === column.id
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {/* Add Task Button */}
                      <button
                        onClick={() => onAddTask?.(column.id)}
                        title={`Add task in ${column.title}`}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      {/* Collapse Column Button */}
                      <button
                        onClick={() => toggleColumnCollapse(column.id)}
                        title="Collapse column"
                        className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* WIP Indicator Banner (FR-KAN-05) */}
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500">
                      {wipLimit ? `WIP Limit: ${wipLimit}` : 'WIP Limit: None'}
                    </span>
                    {isWipExceeded ? (
                      <span className="flex items-center gap-1 text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        <span>OVER WIP (+{columnTasks.length - wipLimit!})</span>
                      </span>
                    ) : wipLimit ? (
                      <span className="text-emerald-400">
                        {wipLimit - columnTasks.length} slots free
                      </span>
                    ) : null}
                  </div>

                  {/* WIP Limit Inline Editor */}
                  {editingWipStatus === column.id && (
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-750 font-mono space-y-2 animate-in fade-in duration-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Set Max Tasks Allowed:
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          max="50"
                          placeholder="No limit"
                          value={tempWipLimit}
                          onChange={(e) => setTempWipLimit(e.target.value)}
                          className="w-full px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-white font-mono"
                        />
                        <button
                          onClick={() => handleSaveWipLimit(column.id)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-amber-500 text-slate-950 rounded hover:bg-amber-400"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tasks Sortable Droppable Container (FR-KAN-02) */}
                <SortableContext
                  id={column.id}
                  items={columnTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex-1 flex flex-col gap-2.5 min-h-[380px]">
                    {columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onStatusChange={(id, status) => {
                          const targetTasks = getColumnTasks(status);
                          const newPos =
                            targetTasks.length > 0
                              ? targetTasks[targetTasks.length - 1].position + 1000
                              : 1000;
                          onTaskMove(id, status, newPos);
                        }}
                        onSelectTask={onSelectTask}
                      />
                    ))}
                    {columnTasks.length === 0 && (
                      <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800/60 rounded-xl p-4 text-center group hover:border-slate-700 transition">
                        <span className="text-xs text-slate-600 font-mono font-medium">
                          Empty Bay
                        </span>
                        <button
                          onClick={() => onAddTask?.(column.id)}
                          className="mt-1 text-[11px] text-amber-400/80 hover:text-amber-300 font-mono"
                        >
                          + Drop or Add Task
                        </button>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>

        {/* Drag Overlay with Drop Shadow */}
        <DragOverlay>
          {activeTask ? (
            <div className="rotate-2 scale-105 shadow-2xl opacity-90 transition-transform">
              <TaskCard task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
