export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrgRole = 'owner' | 'manager' | 'employee';
export type ProjectStatus = 'planned' | 'active' | 'on_hold' | 'completed' | 'archived';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          timezone: string;
          phone?: string | null;
          job_title?: string | null;
          department?: string | null;
          bio?: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          avatar_url?: string | null;
          timezone?: string;
          phone?: string | null;
          job_title?: string | null;
          department?: string | null;
          bio?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string;
          name?: string;
          avatar_url?: string | null;
          timezone?: string;
          phone?: string | null;
          job_title?: string | null;
          department?: string | null;
          bio?: string | null;
        };
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          default_timezone: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          default_timezone?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          default_timezone?: string;
        };
      };
      memberships: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          role: OrgRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          role: OrgRole;
          created_at?: string;
        };
        Update: {
          role?: OrgRole;
        };
      };
      workspaces: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          description: string | null;
          archived_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          description?: string | null;
          archived_at?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          archived_at?: string | null;
        };
      };
      projects: {
        Row: {
          id: string;
          org_id: string;
          workspace_id: string;
          key: string;
          name: string;
          description: string | null;
          status: ProjectStatus;
          lead_id: string | null;
          start_date: string | null;
          target_date: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          workspace_id: string;
          key: string;
          name: string;
          description?: string | null;
          status?: ProjectStatus;
          lead_id?: string | null;
          start_date?: string | null;
          target_date?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          status?: ProjectStatus;
          lead_id?: string | null;
          start_date?: string | null;
          target_date?: string | null;
          archived_at?: string | null;
        };
      };
      tasks: {
        Row: {
          id: string;
          org_id: string;
          project_id: string;
          parent_task_id: string | null;
          title: string;
          description: string | null;
          status: TaskStatus;
          priority: TaskPriority;
          assignee_id: string | null;
          created_by: string | null;
          due_date: string | null;
          completed_at: string | null;
          position: number;
          version: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          project_id: string;
          parent_task_id?: string | null;
          title: string;
          description?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          assignee_id?: string | null;
          created_by?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          position?: number;
          version?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          parent_task_id?: string | null;
          title?: string;
          description?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          assignee_id?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          position?: number;
          version?: number;
          archived_at?: string | null;
        };
      };
      comments: {
        Row: {
          id: string;
          org_id: string;
          task_id: string;
          author_id: string;
          body: string;
          edited_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          task_id: string;
          author_id: string;
          body: string;
          edited_at?: string | null;
          created_at?: string;
        };
        Update: {
          body?: string;
          edited_at?: string | null;
        };
      };
      notifications: {
        Row: {
          id: string;
          org_id: string;
          recipient_id: string;
          type: string;
          task_id: string | null;
          payload_json: Json | null;
          dedupe_key: string | null;
          read_at: string | null;
          email_status: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          recipient_id: string;
          type: string;
          task_id?: string | null;
          payload_json?: Json | null;
          dedupe_key?: string | null;
          read_at?: string | null;
          email_status?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
          email_status?: string | null;
        };
      };
      labels: {
        Row: {
          id: string;
          org_id: string;
          project_id: string | null;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          project_id?: string | null;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          project_id?: string | null;
          name?: string;
          color?: string;
        };
      };
      task_labels: {
        Row: {
          task_id: string;
          label_id: string;
        };
        Insert: {
          task_id: string;
          label_id: string;
        };
        Update: {
          task_id?: string;
          label_id?: string;
        };
      };
      attachments: {
        Row: {
          id: string;
          org_id: string;
          task_id: string;
          uploader_id: string;
          original_name: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          checksum: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          task_id: string;
          uploader_id: string;
          original_name: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          checksum?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          original_name?: string;
          checksum?: string | null;
          deleted_at?: string | null;
        };
      };
      activity_events: {
        Row: {
          id: string;
          org_id: string;
          project_id: string | null;
          task_id: string | null;
          actor_id: string | null;
          type: string;
          before_json: Json | null;
          after_json: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          project_id?: string | null;
          task_id?: string | null;
          actor_id?: string | null;
          type: string;
          before_json?: Json | null;
          after_json?: Json | null;
          created_at?: string;
        };
        Update: {
          type?: string;
          before_json?: Json | null;
          after_json?: Json | null;
        };
      };
      org_join_requests: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          status: 'pending' | 'approved' | 'rejected' | 'cancelled';
          role_requested: 'employee' | 'manager';
          note: string | null;
          decided_by: string | null;
          decided_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
          role_requested?: 'employee' | 'manager';
          note?: string | null;
          decided_by?: string | null;
          decided_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
          role_requested?: 'employee' | 'manager';
          note?: string | null;
          decided_by?: string | null;
          decided_at?: string | null;
        };
      };
    };
  };
}
