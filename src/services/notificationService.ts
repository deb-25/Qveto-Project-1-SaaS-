import { supabase } from '../api/supabaseClient';
import { Task, User } from '../types';

export interface CreateNotificationParams {
  orgId: string;
  recipientId: string;
  actorId?: string | null;
  type: 'assigned' | 'overdue' | 'comment' | 'mention' | 'due_date' | 'status_change';
  taskId?: string | null;
  dedupeKey?: string | null;
  title: string;
  message: string;
  extraPayload?: Record<string, any>;
}

/**
 * Creates an in-app notification with anti-noise rules, deduplication, and email simulation.
 * Rule FR-NTF-04: No notification to the actor about their own action.
 * Rule FR-NTF-03: Deduplication key prevents duplicate alerts.
 * Rule FR-NTF-05: Clearly labelled simulated email dispatch status.
 */
export async function createNotification(params: CreateNotificationParams): Promise<boolean> {
  const {
    orgId,
    recipientId,
    actorId,
    type,
    taskId,
    dedupeKey,
    title,
    message,
    extraPayload = {},
  } = params;

  // 1. Anti-Noise Rule: Do not notify self
  if (actorId && recipientId === actorId) {
    return false;
  }

  // 2. Dedupe Key Verification
  if (dedupeKey) {
    try {
      const { data: existing } = await (supabase.from('notifications') as any)
        .select('id')
        .eq('recipient_id', recipientId)
        .eq('dedupe_key', dedupeKey)
        .maybeSingle();

      if (existing) {
        // Notification with this dedupe key has already been delivered
        return false;
      }
    } catch (err) {
      console.warn('Dedupe check error:', err);
    }
  }

  // 3. Construct Payload with Simulated Email Dispatch (FR-NTF-05)
  const payload = {
    title,
    message,
    actor_id: actorId || null,
    task_id: taskId || null,
    email_simulated: {
      status: 'simulated_dispatched',
      subject: `[TeamFlow] ${title}`,
      dispatched_at: new Date().toISOString(),
      note: 'Simulated mode: SMTP server not configured in dev environment',
    },
    ...extraPayload,
  };

  try {
    const { error } = await (supabase.from('notifications') as any).insert({
      org_id: orgId,
      recipient_id: recipientId,
      type,
      task_id: taskId || null,
      payload_json: payload,
      dedupe_key: dedupeKey || null,
      read_at: null,
      email_status: 'simulated_sent',
    });

    if (error) {
      console.error('Failed to create notification:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Exception creating notification:', err);
    return false;
  }
}

/**
 * Triggers notification when a task is assigned or reassigned to a user.
 */
export async function notifyTaskAssigned(params: {
  orgId: string;
  task: Task;
  newAssigneeId: string;
  actorUser?: { id: string; name?: string; email?: string } | null;
}) {
  const { orgId, task, newAssigneeId, actorUser } = params;
  if (!newAssigneeId) return;

  const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'A team member';

  await createNotification({
    orgId,
    recipientId: newAssigneeId,
    actorId: actorUser?.id,
    type: 'assigned',
    taskId: task.id,
    dedupeKey: `assign:${task.id}:${newAssigneeId}`,
    title: `Assigned: ${task.title}`,
    message: `${actorName} assigned you to this task (Priority: ${task.priority.toUpperCase()})`,
    extraPayload: {
      task_title: task.title,
      priority: task.priority,
      due_date: task.due_date,
    },
  });
}

/**
 * Triggers notifications when a comment is added to a task.
 * Notifies:
 * 1. Explicitly @mentioned users
 * 2. Task assignee (if not author)
 * 3. Task creator (if not author and not assignee)
 * Collapses burst comments within 5-minute window.
 */
export async function notifyCommentAdded(params: {
  orgId: string;
  task: Task;
  commentBody: string;
  authorUser: { id: string; name?: string; email?: string };
  projectMembers?: { id: string; name: string; email: string }[];
}) {
  const { orgId, task, commentBody, authorUser, projectMembers = [] } = params;
  const authorName = authorUser.name || authorUser.email?.split('@')[0] || 'Someone';

  // 1. Scan for @mentions in comment body
  const mentionMatches = commentBody.match(/@([\w.-]+)/g) || [];
  const mentionedUserIds = new Set<string>();

  for (const rawMention of mentionMatches) {
    const handle = rawMention.substring(1).toLowerCase();
    const matchedMember = projectMembers.find(
      (m) =>
        m.name.toLowerCase().replace(/\s+/g, '') === handle ||
        m.email.toLowerCase().split('@')[0] === handle
    );
    if (matchedMember && matchedMember.id !== authorUser.id) {
      mentionedUserIds.add(matchedMember.id);
    }
  }

  // Send mention notifications
  for (const mentionedId of mentionedUserIds) {
    await createNotification({
      orgId,
      recipientId: mentionedId,
      actorId: authorUser.id,
      type: 'mention',
      taskId: task.id,
      dedupeKey: `mention:${task.id}:${mentionedId}:${Date.now()}`,
      title: `Mentioned in ${task.title}`,
      message: `${authorName} mentioned you: "${commentBody.slice(0, 80)}${commentBody.length > 80 ? '...' : ''}"`,
      extraPayload: {
        task_title: task.title,
        comment_snippet: commentBody.slice(0, 140),
      },
    });
  }

  // 2. Notify Assignee (if not author and not already notified via mention)
  if (task.assignee_id && task.assignee_id !== authorUser.id && !mentionedUserIds.has(task.assignee_id)) {
    // 5-minute burst collapsing window
    const burstWindow = Math.floor(Date.now() / (5 * 60 * 1000));
    await createNotification({
      orgId,
      recipientId: task.assignee_id,
      actorId: authorUser.id,
      type: 'comment',
      taskId: task.id,
      dedupeKey: `comment:${task.id}:${task.assignee_id}:${burstWindow}`,
      title: `New Comment: ${task.title}`,
      message: `${authorName} commented on your assigned task: "${commentBody.slice(0, 80)}${commentBody.length > 80 ? '...' : ''}"`,
      extraPayload: {
        task_title: task.title,
        comment_snippet: commentBody.slice(0, 140),
      },
    });
  }

  // 3. Notify Creator (if not author, not assignee, and not mentioned)
  if (
    task.created_by &&
    task.created_by !== authorUser.id &&
    task.created_by !== task.assignee_id &&
    !mentionedUserIds.has(task.created_by)
  ) {
    const burstWindow = Math.floor(Date.now() / (5 * 60 * 1000));
    await createNotification({
      orgId,
      recipientId: task.created_by,
      actorId: authorUser.id,
      type: 'comment',
      taskId: task.id,
      dedupeKey: `comment:${task.id}:${task.created_by}:${burstWindow}`,
      title: `New Comment: ${task.title}`,
      message: `${authorName} commented on a task you created`,
      extraPayload: {
        task_title: task.title,
        comment_snippet: commentBody.slice(0, 140),
      },
    });
  }
}

/**
 * Triggers notification when a task due date is changed.
 */
export async function notifyDueDateChanged(params: {
  orgId: string;
  task: Task;
  oldDueDate?: string | null;
  newDueDate?: string | null;
  actorUser?: { id: string; name?: string; email?: string } | null;
}) {
  const { orgId, task, oldDueDate, newDueDate, actorUser } = params;
  if (!task.assignee_id || oldDueDate === newDueDate) return;

  const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'A manager';
  const formattedDate = newDueDate ? new Date(newDueDate).toLocaleDateString() : 'Removed deadline';

  await createNotification({
    orgId,
    recipientId: task.assignee_id,
    actorId: actorUser?.id,
    type: 'due_date',
    taskId: task.id,
    dedupeKey: `due_date:${task.id}:${newDueDate || 'none'}`,
    title: `Due Date Changed: ${task.title}`,
    message: `${actorName} updated the target date to ${formattedDate}`,
    extraPayload: {
      task_title: task.title,
      old_due_date: oldDueDate,
      new_due_date: newDueDate,
    },
  });
}

/**
 * Triggers notification when a task transitions to In Review or Done.
 */
export async function notifyTaskCompletedOrStatusChanged(params: {
  orgId: string;
  task: Task;
  oldStatus: string;
  newStatus: string;
  actorUser?: { id: string; name?: string; email?: string } | null;
}) {
  const { orgId, task, oldStatus, newStatus, actorUser } = params;
  if (oldStatus === newStatus) return;

  const actorName = actorUser?.name || actorUser?.email?.split('@')[0] || 'Team member';

  // If moved to in_review or done, notify task creator
  const targetRecipient = task.created_by && task.created_by !== actorUser?.id 
    ? task.created_by 
    : (task.assignee_id && task.assignee_id !== actorUser?.id ? task.assignee_id : null);

  if (!targetRecipient) return;

  const statusLabel = newStatus.replace('_', ' ').toUpperCase();

  await createNotification({
    orgId,
    recipientId: targetRecipient,
    actorId: actorUser?.id,
    type: 'status_change',
    taskId: task.id,
    dedupeKey: `status:${task.id}:${newStatus}`,
    title: `Status: ${task.title} &rarr; ${statusLabel}`,
    message: `${actorName} moved this task to ${statusLabel}`,
    extraPayload: {
      task_title: task.title,
      old_status: oldStatus,
      new_status: newStatus,
    },
  });
}

/**
 * Automated Overdue Detection Engine (FR-NTF-03).
 * Evaluates all open tasks in the organization against current UTC timestamp.
 * Detects tasks where due_date < now and status is not done or cancelled.
 * Guarantees idempotency with dedupe_key = overdue:{taskId}:{dueDate}.
 */
export async function runOverdueDetectionEngine(orgId: string): Promise<{
  scannedCount: number;
  newlyFlaggedOverdueCount: number;
}> {
  if (!orgId) return { scannedCount: 0, newlyFlaggedOverdueCount: 0 };

  const nowIso = new Date().toISOString();

  try {
    // 1. Fetch active eligible tasks that are past their due date
    const { data: overdueTasks, error } = await (supabase.from('tasks') as any)
      .select('id, org_id, title, status, due_date, assignee_id, priority')
      .eq('org_id', orgId)
      .is('archived_at', null)
      .neq('status', 'done')
      .neq('status', 'cancelled')
      .not('due_date', 'is', null)
      .lt('due_date', nowIso);

    if (error || !overdueTasks) {
      console.warn('Overdue detection fetch warning:', error?.message);
      return { scannedCount: 0, newlyFlaggedOverdueCount: 0 };
    }

    let newlyFlagged = 0;

    for (const t of overdueTasks) {
      if (!t.assignee_id || !t.due_date) continue;

      const dateStr = t.due_date.substring(0, 10);
      const dedupeKey = `overdue:${t.id}:${dateStr}`;

      const inserted = await createNotification({
        orgId,
        recipientId: t.assignee_id,
        actorId: null, // System-triggered
        type: 'overdue',
        taskId: t.id,
        dedupeKey,
        title: `Overdue: ${t.title}`,
        message: `Deadline was ${new Date(t.due_date).toLocaleDateString()}. Task is still in ${t.status.replace('_', ' ').toUpperCase()} status.`,
        extraPayload: {
          task_title: t.title,
          due_date: t.due_date,
          priority: t.priority,
          status: t.status,
        },
      });

      if (inserted) {
        newlyFlagged++;
      }
    }

    return {
      scannedCount: overdueTasks.length,
      newlyFlaggedOverdueCount: newlyFlagged,
    };
  } catch (err) {
    console.error('Error running overdue detection engine:', err);
    return { scannedCount: 0, newlyFlaggedOverdueCount: 0 };
  }
}
