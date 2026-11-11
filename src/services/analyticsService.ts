import { Task, TaskPriority, TaskStatus } from '../types';

export interface DateRangeFilter {
  preset: '7d' | '14d' | '30d' | '90d' | 'month' | 'all' | 'custom';
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
}

export interface MemberWorkloadMetrics {
  memberId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  totalAssigned: number;
  completed: number;
  active: number;
  overdue: number;
  weightedPoints: number;
  onTimeCompleted: number;
  completedWithDueDate: number;
  onTimeRate: number | null; // null represents "No data" (Doc 1 §9)
}

export interface TrendDataPoint {
  dateKey: string;
  displayDate: string;
  createdDaily: number;
  completedDaily: number;
  createdCumulative: number;
  completedCumulative: number;
}

export interface AnalyticsSummary {
  totalTasks: number;
  eligibleTasksCount: number;
  doneCount: number;
  completionRate: number | null; // null represents "No data"
  onTimeDoneCount: number;
  completedWithDueDateCount: number;
  onTimeRate: number | null; // null represents "No data"
  overdueCount: number;
  overduePercentOfActive: number | null;
  topLevelCount: number;
  topLevelDoneCount: number;
  projectProgress: number | null; // null represents "No data"
  activeTasksCount: number;
  assignedActiveCount: number;
  assignmentCoverageRate: number | null; // null represents "No data"
  totalWeightedPoints: number;
}

// Document 1 §9 Priority Weights for cognitive workload calculation
export const PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Filter tasks by date window.
 * Window evaluates created_at or completed_at against provided bounds.
 */
export function filterTasksByDateRange(tasks: Task[], range: DateRangeFilter): Task[] {
  if (range.preset === 'all' && !range.from && !range.to) {
    return tasks;
  }

  const now = new Date();
  let fromDate: Date | null = null;
  let toDate: Date | null = null;

  if (range.preset === '7d') {
    fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (range.preset === '14d') {
    fromDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  } else if (range.preset === '30d') {
    fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (range.preset === '90d') {
    fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else if (range.preset === 'month') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (range.from || range.to) {
    if (range.from) fromDate = new Date(range.from);
    if (range.to) {
      toDate = new Date(range.to);
      toDate.setHours(23, 59, 59, 999);
    }
  }

  return tasks.filter((t) => {
    const createdTime = new Date(t.created_at).getTime();
    if (fromDate && createdTime < fromDate.getTime()) {
      // If task was created before start of window, check if it was completed within window
      if (t.completed_at) {
        const completedTime = new Date(t.completed_at).getTime();
        if (completedTime >= fromDate.getTime() && (!toDate || completedTime <= toDate.getTime())) {
          return true;
        }
      }
      return false;
    }
    if (toDate && createdTime > toDate.getTime()) {
      return false;
    }
    return true;
  });
}

/**
 * Calculates core KPI metrics strictly adhering to Document 1 §9:
 * - Eligible task: archived_at IS NULL AND status != 'cancelled'
 * - Zero denominator rule: Returns null instead of 0% or NaN so UI renders "No data".
 */
export function computeAnalyticsSummary(tasks: Task[]): AnalyticsSummary {
  const totalTasks = tasks.length;

  // 1. Eligible tasks (Doc 1 §9: archived_at IS NULL and status != 'cancelled')
  const eligibleTasks = tasks.filter((t) => !t.archived_at && t.status !== 'cancelled');
  const doneTasks = eligibleTasks.filter((t) => t.status === 'done');
  const completionRate = eligibleTasks.length > 0 
    ? (doneTasks.length / eligibleTasks.length) * 100 
    : null;

  // 2. On-Time Completion Rate (completed_at <= due_date ÷ completed with due date)
  const completedWithDueDate = doneTasks.filter((t) => !!t.due_date);
  const onTimeDone = completedWithDueDate.filter((t) => {
    const finishedAt = t.completed_at 
      ? new Date(t.completed_at).getTime() 
      : new Date(t.updated_at).getTime();
    const deadline = new Date(t.due_date!).getTime();
    return finishedAt <= deadline;
  });
  const onTimeRate = completedWithDueDate.length > 0
    ? (onTimeDone.length / completedWithDueDate.length) * 100
    : null;

  // 3. Overdue task count (open eligible tasks with due_date < now)
  const nowUtc = Date.now();
  const overdueTasks = eligibleTasks.filter((t) => {
    if (!t.due_date) return false;
    if (t.status === 'done') return false;
    return new Date(t.due_date).getTime() < nowUtc;
  });

  const activeTasks = eligibleTasks.filter((t) => t.status !== 'done');
  const overduePercentOfActive = activeTasks.length > 0
    ? (overdueTasks.length / activeTasks.length) * 100
    : null;

  // 4. Project Progress (Done top-level tasks ÷ all top-level eligible tasks)
  const topLevelTasks = eligibleTasks.filter((t) => !t.parent_task_id);
  const topLevelDone = topLevelTasks.filter((t) => t.status === 'done');
  const projectProgress = topLevelTasks.length > 0
    ? (topLevelDone.length / topLevelTasks.length) * 100
    : null;

  // 5. Assignment coverage (Active tasks with assignee ÷ all active tasks)
  const assignedActive = activeTasks.filter((t) => !!t.assignee_id);
  const assignmentCoverageRate = activeTasks.length > 0
    ? (assignedActive.length / activeTasks.length) * 100
    : null;

  // 6. Weighted Cognitive Points of Active Workload
  const totalWeightedPoints = activeTasks.reduce((sum, t) => {
    const weight = PRIORITY_WEIGHTS[t.priority] || 2;
    return sum + weight;
  }, 0);

  return {
    totalTasks,
    eligibleTasksCount: eligibleTasks.length,
    doneCount: doneTasks.length,
    completionRate,
    onTimeDoneCount: onTimeDone.length,
    completedWithDueDateCount: completedWithDueDate.length,
    onTimeRate,
    overdueCount: overdueTasks.length,
    overduePercentOfActive,
    topLevelCount: topLevelTasks.length,
    topLevelDoneCount: topLevelDone.length,
    projectProgress,
    activeTasksCount: activeTasks.length,
    assignedActiveCount: assignedActive.length,
    assignmentCoverageRate,
    totalWeightedPoints,
  };
}

/**
 * Calculates per-member workload, capacity, and on-time performance.
 */
export function computeMemberWorkloads(
  tasks: Task[],
  members: MemberProfile[]
): MemberWorkloadMetrics[] {
  const eligible = tasks.filter((t) => !t.archived_at && t.status !== 'cancelled');
  const nowUtc = Date.now();

  const metricsMap: Record<string, MemberWorkloadMetrics> = {};

  // Initialize known members
  members.forEach((m) => {
    metricsMap[m.id] = {
      memberId: m.id,
      name: m.name,
      email: m.email,
      avatarUrl: m.avatar_url,
      totalAssigned: 0,
      completed: 0,
      active: 0,
      overdue: 0,
      weightedPoints: 0,
      onTimeCompleted: 0,
      completedWithDueDate: 0,
      onTimeRate: null,
    };
  });

  // Track unassigned category
  const UNASSIGNED_ID = 'unassigned';
  metricsMap[UNASSIGNED_ID] = {
    memberId: UNASSIGNED_ID,
    name: 'Unassigned',
    email: 'unassigned@teamflow.local',
    totalAssigned: 0,
    completed: 0,
    active: 0,
    overdue: 0,
    weightedPoints: 0,
    onTimeCompleted: 0,
    completedWithDueDate: 0,
    onTimeRate: null,
  };

  eligible.forEach((t) => {
    const targetId = t.assignee_id && metricsMap[t.assignee_id] ? t.assignee_id : (t.assignee_id || UNASSIGNED_ID);
    if (!metricsMap[targetId]) {
      metricsMap[targetId] = {
        memberId: targetId,
        name: `Member (${targetId.slice(0, 5)})`,
        email: 'member@teamflow.local',
        totalAssigned: 0,
        completed: 0,
        active: 0,
        overdue: 0,
        weightedPoints: 0,
        onTimeCompleted: 0,
        completedWithDueDate: 0,
        onTimeRate: null,
      };
    }

    const item = metricsMap[targetId];
    item.totalAssigned++;

    if (t.status === 'done') {
      item.completed++;
      if (t.due_date) {
        item.completedWithDueDate++;
        const finishedAt = t.completed_at ? new Date(t.completed_at).getTime() : new Date(t.updated_at).getTime();
        if (finishedAt <= new Date(t.due_date).getTime()) {
          item.onTimeCompleted++;
        }
      }
    } else {
      item.active++;
      item.weightedPoints += PRIORITY_WEIGHTS[t.priority] || 2;
      if (t.due_date && new Date(t.due_date).getTime() < nowUtc) {
        item.overdue++;
      }
    }
  });

  // Calculate on-time rates
  Object.values(metricsMap).forEach((item) => {
    item.onTimeRate = item.completedWithDueDate > 0
      ? (item.onTimeCompleted / item.completedWithDueDate) * 100
      : null;
  });

  return Object.values(metricsMap).filter((m) => m.totalAssigned > 0 || m.memberId !== UNASSIGNED_ID);
}

/**
 * Computes chronological progress trend points (created vs completed over time).
 */
export function computeProgressTrend(tasks: Task[], daysBack = 14): TrendDataPoint[] {
  const eligible = tasks.filter((t) => !t.archived_at && t.status !== 'cancelled');
  const now = new Date();
  
  const points: Record<string, { created: number; completed: number; date: Date }> = {};

  // Build daily slots
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = d.toISOString().substring(0, 10);
    points[key] = { created: 0, completed: 0, date: d };
  }

  // Count items
  eligible.forEach((t) => {
    const createdKey = t.created_at.substring(0, 10);
    if (points[createdKey]) {
      points[createdKey].created++;
    }
    if (t.status === 'done' && t.completed_at) {
      const completedKey = t.completed_at.substring(0, 10);
      if (points[completedKey]) {
        points[completedKey].completed++;
      }
    }
  });

  let cumulativeCreated = 0;
  let cumulativeCompleted = 0;

  return Object.keys(points).sort().map((dateKey) => {
    const slot = points[dateKey];
    cumulativeCreated += slot.created;
    cumulativeCompleted += slot.completed;

    return {
      dateKey,
      displayDate: slot.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      createdDaily: slot.created,
      completedDaily: slot.completed,
      createdCumulative: cumulativeCreated,
      completedCumulative: cumulativeCompleted,
    };
  });
}

/**
 * Exports real analytical dataset as an RFC 4180 standard CSV document.
 */
export function generateAnalyticsCsv(params: {
  orgName: string;
  projectName?: string;
  dateRangeLabel: string;
  summary: AnalyticsSummary;
  workloads: MemberWorkloadMetrics[];
  tasks: Task[];
  membersMap: Record<string, string>;
  projectMap: Record<string, string>;
}): string {
  const {
    orgName,
    projectName,
    dateRangeLabel,
    summary,
    workloads,
    tasks,
    membersMap,
    projectMap,
  } = params;

  let csv = `TEAMFLOW ANALYTICS REPORT\n`;
  csv += `Organization,${escapeCsv(orgName)}\n`;
  csv += `Project Scope,${escapeCsv(projectName || 'All Accessible Projects')}\n`;
  csv += `Date Range,${escapeCsv(dateRangeLabel)}\n`;
  csv += `Generated At (UTC),${new Date().toISOString()}\n\n`;

  // Section 1: KPI Overview
  csv += `EXECUTIVE SUMMARY METRICS (DOCUMENT 1 §9 RULES)\n`;
  csv += `Metric,Value,Calculation Formula\n`;
  csv += `Task Completion Rate,${summary.completionRate !== null ? `${summary.completionRate.toFixed(1)}%` : 'No data'},Done eligible tasks ÷ Total eligible tasks\n`;
  csv += `On-Time Completion Rate,${summary.onTimeRate !== null ? `${summary.onTimeRate.toFixed(1)}%` : 'No data'},Tasks with completed_at <= due_date ÷ Completed tasks with due date\n`;
  csv += `Overdue Tasks Count,${summary.overdueCount},Open eligible tasks with due_date < now (UTC)\n`;
  csv += `Overdue % of Active,${summary.overduePercentOfActive !== null ? `${summary.overduePercentOfActive.toFixed(1)}%` : 'No data'},Overdue count ÷ Active open tasks\n`;
  csv += `Project Progress,${summary.projectProgress !== null ? `${summary.projectProgress.toFixed(1)}%` : 'No data'},Done top-level tasks ÷ All top-level eligible tasks\n`;
  csv += `Assignment Coverage,${summary.assignmentCoverageRate !== null ? `${summary.assignmentCoverageRate.toFixed(1)}%` : 'No data'},Active tasks with assignee ÷ Total active tasks\n`;
  csv += `Total Cognitive Workload Points,${summary.totalWeightedPoints},Priority weighted sum of open tasks (Low:1 Med:2 High:3 Urgent:4)\n\n`;

  // Section 2: Member Workload Breakdown
  csv += `TEAM MEMBER WORKLOAD & PERFORMANCE\n`;
  csv += `Member Name,Email,Total Assigned,Active Open,Completed,Overdue,On-Time Rate,Weighted Points\n`;
  workloads.forEach((w) => {
    const onTimeStr = w.onTimeRate !== null ? `${w.onTimeRate.toFixed(1)}%` : 'No data';
    csv += `${escapeCsv(w.name)},${escapeCsv(w.email)},${w.totalAssigned},${w.active},${w.completed},${w.overdue},${onTimeStr},${w.weightedPoints}\n`;
  });
  csv += `\n`;

  // Section 3: Task Details
  csv += `DETAILED TASK AUDIT LOG\n`;
  csv += `Task ID,Project Name,Title,Status,Priority,Due Date (UTC),Completed At (UTC),On-Time Status,Assignee\n`;
  tasks.forEach((t) => {
    const projTitle = projectMap[t.project_id] || 'Unknown';
    const assignee = t.assignee_id ? (membersMap[t.assignee_id] || 'Assigned Member') : 'Unassigned';
    
    let onTimeStatus = 'N/A';
    if (t.status === 'done') {
      if (t.due_date) {
        const fin = t.completed_at ? new Date(t.completed_at).getTime() : new Date(t.updated_at).getTime();
        onTimeStatus = fin <= new Date(t.due_date).getTime() ? 'On-Time' : 'Late';
      } else {
        onTimeStatus = 'No Deadline';
      }
    } else if (t.due_date && new Date(t.due_date).getTime() < Date.now()) {
      onTimeStatus = 'Overdue';
    }

    csv += `${t.id},${escapeCsv(projTitle)},${escapeCsv(t.title)},${t.status},${t.priority},${t.due_date || 'None'},${t.completed_at || 'None'},${onTimeStatus},${escapeCsv(assignee)}\n`;
  });

  return csv;
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
