import { OrgRole } from '../types';

export type Action =
  | 'change_org_settings'
  | 'delete_org'
  | 'manage_members'
  | 'manage_workspaces'
  | 'manage_teams'
  | 'create_project'
  | 'edit_project'
  | 'view_project'
  | 'create_task'
  | 'edit_move_task'
  | 'assign_task'
  | 'delete_archive_task'
  | 'comment'
  | 'delete_comment'
  | 'upload_attachment'
  | 'download_attachment'
  | 'view_reports'
  | 'cross_org_resource';

export interface AuthzContext {
  role: OrgRole;
  isProjectMember?: boolean;
  isResourceCreator?: boolean;
  targetMemberRole?: OrgRole;
  isSameOrg: boolean;
}

/**
 * Evaluates whether an action is permitted under the Document 1 Section 8 Permission Matrix.
 */
export function can(action: Action, context: AuthzContext): boolean {
  // Cross-org invariant: Any resource of another org is strictly denied across all roles (AC-01)
  if (!context.isSameOrg || action === 'cross_org_resource') {
    return false;
  }

  const { role, isProjectMember = false, isResourceCreator = false, targetMemberRole } = context;

  switch (action) {
    case 'change_org_settings':
    case 'delete_org':
      return role === 'owner';

    case 'manage_members':
      if (role === 'owner') return true;
      if (role === 'manager') {
        // Manager cannot touch Owners (Doc 1 §8)
        return targetMemberRole !== 'owner';
      }
      return false;

    case 'manage_workspaces':
    case 'manage_teams':
    case 'create_project':
    case 'edit_project':
      return role === 'owner' || role === 'manager';

    case 'view_project':
      if (role === 'owner' || role === 'manager') return true;
      return isProjectMember;

    case 'create_task':
    case 'edit_move_task':
    case 'comment':
    case 'upload_attachment':
    case 'download_attachment':
      if (role === 'owner' || role === 'manager') return true;
      return isProjectMember;

    case 'assign_task':
      if (role === 'owner' || role === 'manager') return true;
      return isProjectMember;

    case 'delete_archive_task':
      if (role === 'owner' || role === 'manager') return true;
      return isResourceCreator;

    case 'delete_comment':
      if (role === 'owner' || role === 'manager') return true;
      return isResourceCreator;

    case 'view_reports':
      if (role === 'owner' || role === 'manager') return true;
      return isProjectMember;

    default:
      return false;
  }
}
