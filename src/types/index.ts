import { Database } from './database';

export type User = Database['public']['Tables']['users']['Row'];
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type Membership = Database['public']['Tables']['memberships']['Row'];
export type Workspace = Database['public']['Tables']['workspaces']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type Label = Database['public']['Tables']['labels']['Row'];
export type TaskLabel = Database['public']['Tables']['task_labels']['Row'];
export type Attachment = Database['public']['Tables']['attachments']['Row'];
export type ActivityEvent = Database['public']['Tables']['activity_events']['Row'];

export type OrgRole = Database['public']['Tables']['memberships']['Row']['role'];
export type TaskStatus = Database['public']['Tables']['tasks']['Row']['status'];
export type TaskPriority = Database['public']['Tables']['tasks']['Row']['priority'];
export type ProjectStatus = Database['public']['Tables']['projects']['Row']['status'];

export interface TaskWithAssignee extends Task {
  assignee?: User | null;
  comments_count?: number;
  subtasks_count?: number;
  completed_subtasks_count?: number;
  labels?: Label[];
}

export type OrgJoinRequest = Database['public']['Tables']['org_join_requests']['Row'] & {
  organizations?: { id: string; name: string; slug: string };
  users?: { id: string; name: string; email: string; avatar_url: string | null; job_title?: string | null; department?: string | null };
  user_profile?: { id: string; full_name?: string; email?: string; avatar_url?: string | null; job_title?: string | null; department?: string | null };
};

