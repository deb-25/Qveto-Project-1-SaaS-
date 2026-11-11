import { TaskStatus, OrgRole } from '../types';

export interface TransitionOptions {
  hasOpenSubtasks?: boolean;
  isArchived?: boolean;
  userRole?: OrgRole;
}

export interface TransitionValidationResult {
  valid: boolean;
  error?: string;
}

export const STATUS_ORDER: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const STATUS_DESCRIPTIONS: Record<TaskStatus, string> = {
  backlog: 'Unscheduled work, idea pool, or triage queue',
  todo: 'Scheduled for current milestone or upcoming sprint',
  in_progress: 'Active development or implementation underway',
  in_review: 'Code review, QA testing, or stakeholder verification',
  done: 'Completed and verified acceptance criteria',
  cancelled: 'Abandoned or rejected work item',
};

/**
 * Validates a task status transition against Document 1 Section 10 business rules.
 */
export function validateStatusTransition(
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  options: TransitionOptions = {}
): TransitionValidationResult {
  const { hasOpenSubtasks = false, isArchived = false, userRole = 'employee' } = options;

  // 1. Archived tasks cannot change status until restored
  if (isArchived) {
    return {
      valid: false,
      error: 'Archived tasks cannot change status until restored (Doc 1 §10).',
    };
  }

  // 2. Same status is a no-op / allowed
  if (fromStatus === toStatus) {
    return { valid: true };
  }

  // 3. Any status may move to Cancelled
  if (toStatus === 'cancelled') {
    return { valid: true };
  }

  // 4. Cancelled status may only be reopened to Backlog or To Do by Manager or Owner
  if (fromStatus === 'cancelled') {
    if (toStatus !== 'backlog' && toStatus !== 'todo') {
      return {
        valid: false,
        error: 'Cancelled tasks can only be reopened to Backlog or To Do (Doc 1 §10).',
      };
    }
    if (userRole === 'employee') {
      return {
        valid: false,
        error: 'Only Managers and Owners can reopen cancelled tasks (Doc 1 §10).',
      };
    }
    return { valid: true };
  }

  // 5. Parent task cannot be set to Done while it has open subtasks
  if (toStatus === 'done' && hasOpenSubtasks) {
    return {
      valid: false,
      error: 'Cannot mark task as Done while it has unresolved subtasks (Doc 1 §10). Complete or cancel all subtasks first.',
    };
  }

  // 6. Reopening from Done: Done may be reopened to In Progress or In Review
  if (fromStatus === 'done') {
    if (toStatus === 'in_progress' || toStatus === 'in_review') {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Done tasks can only be reopened into In Progress or In Review (Doc 1 §10).',
    };
  }

  // 7. Backlog jump exceptions: Backlog may move directly to To Do or In Progress
  if (fromStatus === 'backlog') {
    if (toStatus === 'todo' || toStatus === 'in_progress') {
      return { valid: true };
    }
    return {
      valid: false,
      error: `Invalid transition from Backlog to ${STATUS_LABELS[toStatus]}. Backlog can advance to To Do or In Progress (Doc 1 §10).`,
    };
  }

  // 8. Adjacent active transitions: Forward and backward between adjacent active statuses
  const fromIdx = STATUS_ORDER.indexOf(fromStatus);
  const toIdx = STATUS_ORDER.indexOf(toStatus);

  if (fromIdx !== -1 && toIdx !== -1) {
    const diff = Math.abs(toIdx - fromIdx);
    if (diff === 1) {
      return { valid: true };
    }
    return {
      valid: false,
      error: `Non-adjacent workflow jump from ${STATUS_LABELS[fromStatus]} to ${STATUS_LABELS[toStatus]} is restricted (Doc 1 §10). Move step-by-step through the workflow pipeline.`,
    };
  }

  return {
    valid: false,
    error: `Transition from ${fromStatus} to ${toStatus} is not permitted.`,
  };
}

/**
 * Returns the list of valid next statuses for a given status based on current options.
 */
export function getAllowedTargetStatuses(
  currentStatus: TaskStatus,
  options: TransitionOptions = {}
): TaskStatus[] {
  const allStatuses: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'];
  return allStatuses.filter((s) => {
    if (s === currentStatus) return true;
    const res = validateStatusTransition(currentStatus, s, options);
    return res.valid;
  });
}
