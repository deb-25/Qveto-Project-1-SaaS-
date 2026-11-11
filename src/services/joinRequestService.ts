import { supabase } from '../api/supabaseClient';
import { OrgJoinRequest, OrgRole } from '../types';

export interface CompanySearchResult {
  id: string;
  name: string;
  slug: string;
  member_count?: number;
  created_at?: string;
}

export const joinRequestService = {
  /**
   * Search organizations by name or slug for joining
   */
  async searchCompanies(query: string): Promise<CompanySearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      // 1. Try RPC function if present in DB
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('search_organizations', {
        search_query: trimmed,
      });

      if (!rpcError && rpcData) {
        return rpcData as CompanySearchResult[];
      }

      // 2. Fallback to direct select on organizations
      const { data, error } = await (supabase.from('organizations') as any)
        .select('id, name, slug, created_at')
        .or(`name.ilike.%${trimmed}%,slug.ilike.%${trimmed}%`)
        .limit(15);

      if (error) {
        console.warn('Fallback search query note:', error);
        return [];
      }

      return (data || []).map((org: any) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        created_at: org.created_at,
      }));
    } catch (err) {
      console.error('Failed to search companies:', err);
      return [];
    }
  },

  /**
   * Lookup a company by exact slug
   */
  async getCompanyBySlug(slug: string): Promise<CompanySearchResult | null> {
    try {
      const { data, error } = await (supabase.from('organizations') as any)
        .select('id, name, slug, created_at')
        .eq('slug', slug.trim().toLowerCase())
        .maybeSingle();

      if (error || !data) return null;
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Send a request to join a company
   */
  async sendJoinRequest(
    orgId: string,
    roleRequested: 'employee' | 'manager' = 'employee',
    note?: string
  ): Promise<{ success: boolean; error?: string; request?: OrgJoinRequest }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to request to join a company.');

      // Check if user is already a member
      const { data: existingMembership } = await (supabase.from('memberships') as any)
        .select('id, role')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMembership) {
        return { success: false, error: 'You are already an active member of this organization.' };
      }

      // Check if request already pending
      const { data: existingReq } = await (supabase.from('org_join_requests') as any)
        .select('id, status')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingReq) {
        return { success: false, error: 'You already have a pending request for this organization.' };
      }

      const { data, error } = await (supabase.from('org_join_requests') as any)
        .insert({
          org_id: orgId,
          user_id: user.id,
          role_requested: roleRequested,
          note: note ? note.trim() : null,
          status: 'pending',
        })
        .select('*, organizations (id, name, slug)')
        .single();

      if (error) throw error;
      return { success: true, request: data };
    } catch (err: any) {
      console.error('Failed to send join request:', err);
      return { success: false, error: err.message || 'Failed to submit join request.' };
    }
  },

  /**
   * Fetch all join requests sent by the current user
   */
  async getMyJoinRequests(): Promise<OrgJoinRequest[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await (supabase.from('org_join_requests') as any)
        .select('*, organizations (id, name, slug)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Failed to fetch my join requests:', err);
      return [];
    }
  },

  /**
   * Cancel a pending join request sent by the user
   */
  async cancelJoinRequest(requestId: string): Promise<boolean> {
    try {
      const { error } = await (supabase.from('org_join_requests') as any)
        .delete()
        .eq('id', requestId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to cancel join request:', err);
      return false;
    }
  },

  /**
   * Fetch pending requests for an organization (for Owners and Managers)
   */
  async getIncomingRequests(orgId: string): Promise<OrgJoinRequest[]> {
    try {
      const { data, error } = await (supabase.from('org_join_requests') as any)
        .select('*, users (id, name, email, avatar_url, job_title, department)')
        .eq('org_id', orgId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Failed to fetch incoming requests:', err);
      return [];
    }
  },

  /**
   * Approve a join request and assign a controlled role
   */
  async approveRequest(requestId: string, orgId: string, requesterUserId: string, assignedRole: OrgRole = 'employee'): Promise<boolean> {
    try {
      // 1. Try atomic RPC if available
      const { error: rpcErr } = await (supabase.rpc as any)('approve_join_request', {
        request_id: requestId,
        assigned_role: assignedRole,
      });

      if (!rpcErr) return true;

      // 2. Fallback: update request and insert membership
      const { error: memErr } = await (supabase.from('memberships') as any).upsert({
        org_id: orgId,
        user_id: requesterUserId,
        role: assignedRole,
      }, { onConflict: 'org_id,user_id' });

      if (memErr) throw memErr;

      const { data: { user } } = await supabase.auth.getUser();
      await (supabase.from('org_join_requests') as any)
        .update({
          status: 'approved',
          decided_by: user?.id,
          decided_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      // Notification
      await (supabase.from('notifications') as any).insert({
        org_id: orgId,
        recipient_id: requesterUserId,
        type: 'join_approved',
        payload_json: {
          title: 'Join Request Approved',
          message: `Your request to join the organization has been approved with ${assignedRole} role.`,
          role: assignedRole,
        },
      });

      return true;
    } catch (err) {
      console.error('Failed to approve request:', err);
      return false;
    }
  },

  /**
   * Reject a join request
   */
  async rejectRequest(requestId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase.from('org_join_requests') as any)
        .update({
          status: 'rejected',
          decided_by: user?.id,
          decided_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to reject request:', err);
      return false;
    }
  },
};
