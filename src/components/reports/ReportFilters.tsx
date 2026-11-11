import React from 'react';
import { 
  Filter, 
  Calendar, 
  FolderKanban, 
  User, 
  AlertCircle, 
  RotateCcw,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { DateRangeFilter } from '../../services/analyticsService';
import { TaskPriority } from '../../types';

interface ProjectOption {
  id: string;
  name: string;
  key?: string;
}

interface MemberOption {
  id: string;
  name: string;
  email: string;
}

interface ReportFiltersProps {
  projects: ProjectOption[];
  members: MemberOption[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
  dateRange: DateRangeFilter;
  onChangeDateRange: (range: DateRangeFilter) => void;
  selectedMemberId: string;
  onSelectMember: (memberId: string) => void;
  selectedPriority: string;
  onSelectPriority: (priority: string) => void;
  onReset: () => void;
}

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  projects,
  members,
  selectedProjectId,
  onSelectProject,
  dateRange,
  onChangeDateRange,
  selectedMemberId,
  onSelectMember,
  selectedPriority,
  onSelectPriority,
  onReset,
}) => {
  const isFiltered = 
    selectedProjectId !== 'all' || 
    dateRange.preset !== '30d' || 
    selectedMemberId !== 'all' || 
    selectedPriority !== 'all';

  const presets: { id: DateRangeFilter['preset']; label: string }[] = [
    { id: '7d', label: 'Last 7 Days' },
    { id: '14d', label: 'Last 14 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: '90d', label: 'Last 90 Days' },
    { id: 'month', label: 'This Month' },
    { id: 'all', label: 'All Time' },
    { id: 'custom', label: 'Custom Range' },
  ];

  return (
    <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 shadow-xl space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span>Analytics Scope & Filters</span>
          {isFiltered && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px]">
              Active Filters
            </span>
          )}
        </div>

        {isFiltered && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Project Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <FolderKanban className="w-3.5 h-3.5 text-cyan-400" />
            <span>Project Scope</span>
          </label>
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={(e) => onSelectProject(e.target.value)}
              className="w-full appearance-none px-3 py-2 pr-8 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Accessible Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.key ? `(${p.key})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Date Range Preset */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
            <span>Time Window</span>
          </label>
          <div className="relative">
            <select
              value={dateRange.preset}
              onChange={(e) => 
                onChangeDateRange({ 
                  preset: e.target.value as DateRangeFilter['preset'], 
                  from: dateRange.from, 
                  to: dateRange.to 
                })
              }
              className="w-full appearance-none px-3 py-2 pr-8 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Member Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-blue-400" />
            <span>Team Member</span>
          </label>
          <div className="relative">
            <select
              value={selectedMemberId}
              onChange={(e) => onSelectMember(e.target.value)}
              className="w-full appearance-none px-3 py-2 pr-8 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Members & Unassigned</option>
              <option value="unassigned">Unassigned Only</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email.split('@')[0]})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Priority Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Task Priority</span>
          </label>
          <div className="relative">
            <select
              value={selectedPriority}
              onChange={(e) => onSelectPriority(e.target.value)}
              className="w-full appearance-none px-3 py-2 pr-8 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Custom Date Range Row (visible only when preset is 'custom') */}
      {dateRange.preset === 'custom' && (
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>From:</span>
            <input
              type="date"
              value={dateRange.from || ''}
              onChange={(e) => onChangeDateRange({ ...dateRange, from: e.target.value })}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>To:</span>
            <input
              type="date"
              value={dateRange.to || ''}
              onChange={(e) => onChangeDateRange({ ...dateRange, to: e.target.value })}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <span className="text-[11px] text-slate-500 italic">
            Evaluates tasks created or completed within this specific UTC boundary.
          </span>
        </div>
      )}
    </div>
  );
};
