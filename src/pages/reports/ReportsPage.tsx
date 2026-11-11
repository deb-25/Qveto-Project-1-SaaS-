import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';
import { 
  Download, 
  HelpCircle, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Loader2,
  FolderKanban,
  CheckCircle2,
  Scale,
  Users,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  BarChart2,
  Activity,
  FileSpreadsheet
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOrg } from '../../context/OrgContext';
import { supabase } from '../../api/supabaseClient';
import { Task, TaskStatus, TaskPriority, Project } from '../../types';
import { 
  DateRangeFilter, 
  MemberProfile, 
  filterTasksByDateRange, 
  computeAnalyticsSummary, 
  computeMemberWorkloads, 
  computeProgressTrend, 
  generateAnalyticsCsv,
  PRIORITY_WEIGHTS
} from '../../services/analyticsService';
import { ReportFilters } from '../../components/reports/ReportFilters';
import { CalculationRulesModal } from '../../components/reports/CalculationRulesModal';

export const ReportsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialProject = searchParams.get('project') || 'all';

  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrg();

  const [loading, setLoading] = useState(true);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [membersMap, setMembersMap] = useState<Record<string, string>>({});
  const [projectMap, setProjectMap] = useState<Record<string, string>>({});

  // Filter States
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProject);
  const [dateRange, setDateRange] = useState<DateRangeFilter>({ preset: '30d' });
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // Chart Views
  const [trendView, setTrendView] = useState<'cumulative' | 'daily'>('cumulative');
  const [workloadMetric, setWorkloadMetric] = useState<'count' | 'weighted'>('count');

  // Calculation Modal
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  useEffect(() => {
    if (currentOrg) {
      loadData();
    }
  }, [currentOrg, currentRole, user]);

  const loadData = async () => {
    if (!currentOrg) return;
    try {
      setLoading(true);

      // 1. Fetch Projects (Role-based access per Doc 1 §8)
      // Owners & Managers see all projects; Employees see only projects they belong to
      let allowedProjectIds: string[] = [];
      const isManagerOrOwner = currentRole === 'owner' || currentRole === 'manager';

      if (isManagerOrOwner) {
        const { data: projData, error: projErr } = await (supabase.from('projects') as any)
          .select('*')
          .eq('org_id', currentOrg.id)
          .order('name');
        if (projErr) throw projErr;
        setProjects(projData || []);
        allowedProjectIds = (projData || []).map((p: any) => p.id);
      } else if (user) {
        const { data: myMemberData, error: memErr } = await (supabase.from('project_members') as any)
          .select('project_id, projects (*)')
          .eq('user_id', user.id);
        if (memErr) throw memErr;

        const myProjects = (myMemberData || [])
          .map((item: any) => item.projects)
          .filter(Boolean);
        setProjects(myProjects);
        allowedProjectIds = myProjects.map((p: any) => p.id);
      }

      // Map project names
      const pMap: Record<string, string> = {};
      projects.forEach((p) => { pMap[p.id] = p.name; });
      setProjectMap(pMap);

      // 2. Fetch Members of Organization
      const { data: membersData } = await (supabase.from('memberships') as any)
        .select('user_id, users (id, name, email, avatar_url)')
        .eq('org_id', currentOrg.id);

      const memList: MemberProfile[] = [];
      const mMap: Record<string, string> = {};
      if (membersData) {
        (membersData as any[]).forEach((m) => {
          if (m.users?.id) {
            const displayName = m.users.name || m.users.email?.split('@')[0] || 'Member';
            memList.push({
              id: m.users.id,
              name: displayName,
              email: m.users.email || 'unknown',
              avatar_url: m.users.avatar_url,
            });
            mMap[m.users.id] = displayName;
          }
        });
      }
      setMembers(memList);
      setMembersMap(mMap);

      // 3. Fetch Tasks (Org-scoped and project-restricted for Employees)
      let tasksQuery = (supabase.from('tasks') as any)
        .select('*')
        .eq('org_id', currentOrg.id)
        .is('archived_at', null);

      if (!isManagerOrOwner && allowedProjectIds.length > 0) {
        tasksQuery = tasksQuery.in('project_id', allowedProjectIds);
      }

      const { data: tasksData, error: tasksError } = await tasksQuery;
      if (tasksError) throw tasksError;

      setAllTasks(tasksData || []);
    } catch (err) {
      console.error('Failed to load report analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter Tasks by Active Filters
  const filteredTasks = useMemo(() => {
    let result = [...allTasks];

    // Project filter
    if (selectedProjectId !== 'all') {
      result = result.filter((t) => t.project_id === selectedProjectId);
    }

    // Member filter
    if (selectedMemberId !== 'all') {
      if (selectedMemberId === 'unassigned') {
        result = result.filter((t) => !t.assignee_id);
      } else {
        result = result.filter((t) => t.assignee_id === selectedMemberId);
      }
    }

    // Priority filter
    if (selectedPriority !== 'all') {
      result = result.filter((t) => t.priority === selectedPriority);
    }

    // Date range filter
    result = filterTasksByDateRange(result, dateRange);

    return result;
  }, [allTasks, selectedProjectId, selectedMemberId, selectedPriority, dateRange]);

  // Document 1 §9 Calculated Summary
  const summary = useMemo(() => {
    return computeAnalyticsSummary(filteredTasks);
  }, [filteredTasks]);

  // Per-Member Workload Metrics
  const workloads = useMemo(() => {
    return computeMemberWorkloads(filteredTasks, members);
  }, [filteredTasks, members]);

  // Progress Trend Timeline (14-day slotting)
  const trendData = useMemo(() => {
    const days = dateRange.preset === '7d' ? 7 : dateRange.preset === '90d' ? 30 : 14;
    return computeProgressTrend(filteredTasks, days);
  }, [filteredTasks, dateRange]);

  // Status Breakdown for Donut Chart
  const statusChartData = useMemo(() => {
    const counts: Record<TaskStatus, number> = {
      backlog: 0,
      todo: 0,
      in_progress: 0,
      in_review: 0,
      done: 0,
      cancelled: 0,
    };
    filteredTasks.forEach((t) => {
      if (counts[t.status] !== undefined) counts[t.status]++;
    });

    return [
      { name: 'Done', count: counts.done, color: '#10b981' },
      { name: 'In Review', count: counts.in_review, color: '#a855f7' },
      { name: 'In Progress', count: counts.in_progress, color: '#f59e0b' },
      { name: 'To Do', count: counts.todo, color: '#3b82f6' },
      { name: 'Backlog', count: counts.backlog, color: '#64748b' },
      { name: 'Cancelled', count: counts.cancelled, color: '#ef4444' },
    ].filter((item) => item.count > 0);
  }, [filteredTasks]);

  // Priority Breakdown
  const priorityBreakdown = useMemo(() => {
    const counts: Record<TaskPriority, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
    filteredTasks.forEach((t) => {
      if (counts[t.priority] !== undefined) counts[t.priority]++;
    });
    return counts;
  }, [filteredTasks]);

  // CSV Export Trigger
  const handleExportCsv = () => {
    if (!currentOrg) return;
    const activeProjectName = selectedProjectId !== 'all' 
      ? projects.find((p) => p.id === selectedProjectId)?.name 
      : 'All Projects';

    const dateRangeLabel = dateRange.preset === 'custom'
      ? `${dateRange.from || 'Start'} to ${dateRange.to || 'Now'}`
      : `Preset: ${dateRange.preset.toUpperCase()}`;

    const csvContent = generateAnalyticsCsv({
      orgName: currentOrg.name,
      projectName: activeProjectName,
      dateRangeLabel,
      summary,
      workloads,
      tasks: filteredTasks,
      membersMap,
      projectMap,
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `teamflow_analytics_${currentOrg.slug}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetFilters = () => {
    setSelectedProjectId('all');
    setDateRange({ preset: '30d' });
    setSelectedMemberId('all');
    setSelectedPriority('all');
  };

  if (!currentOrg) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p className="text-sm">No active organization selected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              Module 8 · Reports & Analytics
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Live Supabase Telemetry
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            <span>Executive Progress & KPI Dashboard</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Auditable metrics calculated strictly using Document 1 §9 formulas for <strong className="text-white">{currentOrg.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsRulesModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition shadow-sm"
          >
            <HelpCircle className="w-4 h-4" />
            <span>How This Is Calculated</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={loading || filteredTasks.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition shadow-lg shadow-cyan-900/30 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <ReportFilters
        projects={projects}
        members={members}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        dateRange={dateRange}
        onChangeDateRange={setDateRange}
        selectedMemberId={selectedMemberId}
        onSelectMember={setSelectedMemberId}
        selectedPriority={selectedPriority}
        onSelectPriority={setSelectedPriority}
        onReset={handleResetFilters}
      />

      {loading ? (
        <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="text-xs font-medium tracking-wide">Evaluating live database metrics across {currentOrg.name}...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-14 text-center rounded-3xl bg-[#0c1018] border border-slate-800 space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
            <FolderKanban className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-white">No Matching Tasks Found</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No tasks matched the selected project scope or time window filters. Adjust your filters or create new tasks on the board to view live KPIs.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              Reset Filters
            </button>
            <Link
              to="/board"
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-900/30 transition"
            >
              Go to Kanban Board
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Executive KPI Cards Row (6 Document 1 §9 Metrics) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            {/* KPI 1: Completion Rate */}
            <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 hover:border-slate-700 transition space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Completion</span>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-1.5">
                {summary.completionRate !== null ? (
                  <>
                    <span className="text-2xl font-black text-white">{summary.completionRate.toFixed(1)}%</span>
                    <span className="text-[11px] font-semibold text-emerald-400">
                      ({summary.doneCount}/{summary.eligibleTasksCount})
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    No data
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                <HelpCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">Done ÷ Eligible tasks</span>
              </div>
            </div>

            {/* KPI 2: On-Time Rate */}
            <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 hover:border-slate-700 transition space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">On-Time Rate</span>
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex items-baseline gap-1.5">
                {summary.onTimeRate !== null ? (
                  <>
                    <span className="text-2xl font-black text-white">{summary.onTimeRate.toFixed(1)}%</span>
                    <span className="text-[11px] font-semibold text-cyan-400">
                      ({summary.onTimeDoneCount}/{summary.completedWithDueDateCount})
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    No data
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                <HelpCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">completed_at &lt;= due_date</span>
              </div>
            </div>

            {/* KPI 3: Overdue Count */}
            <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 hover:border-slate-700 transition space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Overdue Items</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-rose-400">{summary.overdueCount}</span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {summary.overduePercentOfActive !== null ? `(${summary.overduePercentOfActive.toFixed(0)}% active)` : ''}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                <HelpCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">due_date &lt; now (UTC)</span>
              </div>
            </div>

            {/* KPI 4: Project Progress */}
            <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 hover:border-slate-700 transition space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Top-Level Progress</span>
                <TrendingUp className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex items-baseline gap-1.5">
                {summary.projectProgress !== null ? (
                  <>
                    <span className="text-2xl font-black text-white">{summary.projectProgress.toFixed(1)}%</span>
                    <span className="text-[11px] font-semibold text-purple-400">
                      ({summary.topLevelDoneCount}/{summary.topLevelCount})
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    No data
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                <HelpCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">Done top-level tasks</span>
              </div>
            </div>

            {/* KPI 5: Assignment Coverage */}
            <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 hover:border-slate-700 transition space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Assignee Coverage</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex items-baseline gap-1.5">
                {summary.assignmentCoverageRate !== null ? (
                  <>
                    <span className="text-2xl font-black text-white">{summary.assignmentCoverageRate.toFixed(1)}%</span>
                    <span className="text-[11px] font-semibold text-blue-400">
                      ({summary.assignedActiveCount}/{summary.activeTasksCount})
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    No data
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                <HelpCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">Assigned active open</span>
              </div>
            </div>

            {/* KPI 6: Cognitive Workload Points */}
            <div className="p-4 rounded-2xl bg-[#0c1018] border border-slate-800 hover:border-slate-700 transition space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Cognitive Points</span>
                <Scale className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-400">{summary.totalWeightedPoints}</span>
                <span className="text-[11px] font-semibold text-slate-400">pts active</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                <HelpCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">Urgent:4, High:3, Med:2, Low:1</span>
              </div>
            </div>
          </div>

          {/* Charts Row: Progress Timeline & Status Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Timeline Progress Chart (2 Cols) */}
            <div className="lg:col-span-2 p-5 rounded-3xl bg-[#0c1018] border border-slate-800 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span>Progress Velocity & Delivery Trend</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tracks cumulative burn-up deliveries versus incoming task requests.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  <button
                    onClick={() => setTrendView('cumulative')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      trendView === 'cumulative' 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Cumulative
                  </button>
                  <button
                    onClick={() => setTrendView('daily')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      trendView === 'daily' 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Daily Volume
                  </button>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradientCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="gradientCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#07090e', borderColor: '#334155', borderRadius: '12px' }}
                      itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                    />
                    {trendView === 'cumulative' ? (
                      <>
                        <Area
                          type="monotone"
                          dataKey="createdCumulative"
                          name="Total Created"
                          stroke="#06b6d4"
                          strokeWidth={2}
                          fill="url(#gradientCreated)"
                        />
                        <Area
                          type="monotone"
                          dataKey="completedCumulative"
                          name="Total Completed"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          fill="url(#gradientCompleted)"
                        />
                      </>
                    ) : (
                      <>
                        <Area
                          type="monotone"
                          dataKey="createdDaily"
                          name="Created Daily"
                          stroke="#06b6d4"
                          strokeWidth={2}
                          fill="url(#gradientCreated)"
                        />
                        <Area
                          type="monotone"
                          dataKey="completedDaily"
                          name="Completed Daily"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#gradientCompleted)"
                        />
                      </>
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-center gap-6 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-1 rounded-full bg-cyan-400" />
                  <span>Tasks Created</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-1 rounded-full bg-emerald-400" />
                  <span>Tasks Completed</span>
                </div>
              </div>
            </div>

            {/* Status Breakdown Donut Chart (1 Col) */}
            <div className="p-5 rounded-3xl bg-[#0c1018] border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>Status Distribution</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {filteredTasks.length} total tasks in current filter
                  </p>
                </div>
              </div>

              <div className="h-52 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={78}
                      paddingAngle={3}
                      dataKey="count"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#07090e', borderColor: '#334155', borderRadius: '12px' }}
                      itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-white">{summary.eligibleTasksCount}</span>
                  <span className="text-[10px] text-slate-400 font-medium">Eligible</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/80">
                {statusChartData.map((s) => (
                  <div key={s.name} className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-900/60">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-slate-300 text-[11px]">{s.name}</span>
                    </div>
                    <span className="text-white font-mono text-[11px] font-bold">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Member Workload & Capacity Section */}
          <div className="p-5 rounded-3xl bg-[#0c1018] border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Team Member Capacity & Workload Balance</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparison of assigned tasks, active backlog load, and on-time completion rates.
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                <button
                  onClick={() => setWorkloadMetric('count')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    workloadMetric === 'count' 
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Task Count
                </button>
                <button
                  onClick={() => setWorkloadMetric('weighted')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    workloadMetric === 'weighted' 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Priority Weighted (Points)
                </button>
              </div>
            </div>

            {/* Workload Bar Chart */}
            <div className="h-64">
              {workloads.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  No member assignments recorded for current filter criteria.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workloads} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#07090e', borderColor: '#334155', borderRadius: '12px' }}
                      itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                    />
                    {workloadMetric === 'count' ? (
                      <>
                        <Bar dataKey="active" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Active Open" />
                        <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} name="Completed" />
                        <Bar dataKey="overdue" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Overdue" />
                      </>
                    ) : (
                      <>
                        <Bar dataKey="weightedPoints" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Workload Points" />
                        <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} name="Completed Tasks" />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Member Performance Breakdown Table */}
            <div className="overflow-x-auto pt-2 border-t border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Team Member</th>
                    <th className="py-2.5 px-3 text-center">Active Open</th>
                    <th className="py-2.5 px-3 text-center">Completed</th>
                    <th className="py-2.5 px-3 text-center">Overdue</th>
                    <th className="py-2.5 px-3 text-center">On-Time Rate</th>
                    <th className="py-2.5 px-3 text-right">Workload Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {workloads.map((w) => (
                    <tr key={w.memberId} className="hover:bg-slate-900/40 transition">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[10px]">
                            {w.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-white font-semibold">{w.name}</span>
                            <span className="text-[10px] text-slate-500 block">{w.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center text-blue-400 font-mono font-bold">
                        {w.active}
                      </td>
                      <td className="py-2.5 px-3 text-center text-emerald-400 font-mono font-bold">
                        {w.completed}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {w.overdue > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-bold">
                            {w.overdue}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {w.onTimeRate !== null ? (
                          <span className="text-cyan-400 font-mono font-bold">
                            {w.onTimeRate.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">No data</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                        {w.weightedPoints} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Priority Distribution Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-1">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Urgent (4 pts)</span>
              <div className="text-xl font-black text-rose-300">{priorityBreakdown.urgent}</div>
              <div className="text-[10px] text-rose-400/80">Immediate attention</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">High (3 pts)</span>
              <div className="text-xl font-black text-amber-300">{priorityBreakdown.high}</div>
              <div className="text-[10px] text-amber-400/80">Active sprint blockers</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-1">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Medium (2 pts)</span>
              <div className="text-xl font-black text-blue-300">{priorityBreakdown.medium}</div>
              <div className="text-[10px] text-blue-400/80">Standard sprint work</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Low (1 pt)</span>
              <div className="text-xl font-black text-slate-300">{priorityBreakdown.low}</div>
              <div className="text-[10px] text-slate-500">Backlog refinements</div>
            </div>
          </div>
        </>
      )}

      {/* Audit & Calculation Rules Modal */}
      <CalculationRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
      />
    </div>
  );
};
