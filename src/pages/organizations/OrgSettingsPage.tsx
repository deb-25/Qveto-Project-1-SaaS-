import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  ShieldAlert, 
  Mail, 
  Trash2, 
  AlertCircle,
  Building,
  Check,
  Loader2,
  Clock,
  Shield,
  Save,
  CheckCircle2,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  FolderLock
} from 'lucide-react';
import { useOrg } from '../../context/OrgContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabaseClient';
import { OrgRole, OrgJoinRequest } from '../../types';
import { runSecurityAndComplianceAudit, AuditCheckResult } from '../../tests/crossTenantAudit';
import { joinRequestService } from '../../services/joinRequestService';

interface MemberItem {
  id: string; // membership id
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: OrgRole;
  joinedAt: string;
}

export const OrgSettingsPage: React.FC = () => {
  const { currentOrg, currentRole, refreshOrgs, setCurrentOrg, organizations } = useOrg();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'requests' | 'security' | 'danger'>('general');
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('employee');
  const [inviting, setInviting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Incoming Join Requests State
  const [incomingRequests, setIncomingRequests] = useState<OrgJoinRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [decisionRoles, setDecisionRoles] = useState<Record<string, OrgRole>>({});

  // Editable org metadata
  const [orgName, setOrgName] = useState(currentOrg?.name || '');
  const [timezone, setTimezone] = useState(currentOrg?.default_timezone || 'UTC');
  const [savingOrg, setSavingOrg] = useState(false);

  // Module 10: Security & Compliance Audit State
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResults, setAuditResults] = useState<AuditCheckResult[] | null>(null);

  // Danger Zone Confirmation
  const [deleteConfirmationSlug, setDeleteConfirmationSlug] = useState('');
  const [deletingOrg, setDeletingOrg] = useState(false);

  const fetchIncomingRequests = async () => {
    if (!currentOrg) return;
    setLoadingRequests(true);
    const reqs = await joinRequestService.getIncomingRequests(currentOrg.id);
    setIncomingRequests(reqs);
    setLoadingRequests(false);
  };

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name);
      setTimezone(currentOrg.default_timezone || 'UTC');
      fetchMembers();
      fetchIncomingRequests();
    }
  }, [currentOrg]);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleApproveRequest = async (requestId: string, requesterUserId: string) => {
    if (!currentOrg) return;
    const assignedRole = decisionRoles[requestId] || 'employee';
    const ok = await joinRequestService.approveRequest(requestId, currentOrg.id, requesterUserId, assignedRole);
    if (ok) {
      showFeedback(`Approved membership with ${assignedRole} access!`, 'success');
      setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
      await fetchMembers();
    } else {
      showFeedback('Could not approve request. Ensure you have owner/manager permissions.', 'error');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const ok = await joinRequestService.rejectRequest(requestId);
    if (ok) {
      showFeedback('Join request declined.', 'success');
      setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } else {
      showFeedback('Could not decline request.', 'error');
    }
  };

  const fetchMembers = async () => {
    if (!currentOrg) return;
    try {
      setLoading(true);
      const { data, error } = await (supabase.from('memberships') as any)
        .select(`
          id,
          role,
          created_at,
          user_id,
          users (
            id,
            name,
            email,
            avatar_url
          )
        `)
        .eq('org_id', currentOrg.id);

      if (error) throw error;

      if (data) {
        const formatted: MemberItem[] = (data as any[]).map((item) => ({
          id: item.id,
          user_id: item.user_id,
          name: item.users?.name || item.users?.email?.split('@')[0] || 'Member',
          email: item.users?.email || 'unknown',
          avatar_url: item.users?.avatar_url,
          role: item.role as OrgRole,
          joinedAt: new Date(item.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        }));
        setMembers(formatted);
      }
    } catch (err: any) {
      console.error('Failed to load organization members:', err);
      showFeedback('Failed to load organization members from Supabase.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const ownerCount = members.filter((m) => m.role === 'owner').length;
  const isOwner = currentRole === 'owner';

  const handleRoleChange = async (membershipId: string, newRole: OrgRole) => {
    if (!isOwner) {
      showFeedback('Only Organization Owners can change member roles.', 'error');
      return;
    }

    const targetMember = members.find((m) => m.id === membershipId);
    if (!targetMember) return;

    // Doc 1 FR-ORG-06: Last-owner protection
    if (targetMember.role === 'owner' && newRole !== 'owner' && ownerCount <= 1) {
      showFeedback('Cannot demote the last Owner of the organization. (FR-ORG-06)', 'error');
      return;
    }

    try {
      const { error } = await (supabase.from('memberships') as any)
        .update({ role: newRole })
        .eq('id', membershipId);

      if (error) throw error;

      setMembers((prev) =>
        prev.map((m) => (m.id === membershipId ? { ...m, role: newRole } : m))
      );
      showFeedback(`Role for ${targetMember.name} updated to ${newRole.toUpperCase()}.`);
    } catch (err: any) {
      showFeedback(err.message || 'Failed to update member role.', 'error');
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!isOwner) {
      showFeedback('Only Organization Owners can remove members.', 'error');
      return;
    }

    const targetMember = members.find((m) => m.id === membershipId);
    if (!targetMember) return;

    if (targetMember.role === 'owner' && ownerCount <= 1) {
      showFeedback('Cannot remove the last Owner of an organization. (FR-ORG-06)', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to remove ${targetMember.name} from this organization?`)) {
      return;
    }

    try {
      const { error } = await (supabase.from('memberships') as any)
        .delete()
        .eq('id', membershipId);

      if (error) throw error;

      setMembers((prev) => prev.filter((m) => m.id !== membershipId));
      showFeedback(`Member ${targetMember.name} removed from organization.`);
    } catch (err: any) {
      showFeedback(err.message || 'Failed to remove member.', 'error');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !inviteEmail.trim()) return;

    if (!isOwner && currentRole !== 'manager') {
      showFeedback('Only Owners and Managers can invite members.', 'error');
      return;
    }

    const emailToInvite = inviteEmail.trim().toLowerCase();

    // Check if already in the members list
    if (members.some((m) => m.email.toLowerCase() === emailToInvite)) {
      showFeedback('This user is already a member of this organization.', 'error');
      return;
    }

    try {
      setInviting(true);
      // Look up user in public.users table
      const { data: foundUser, error: findError } = await (supabase.from('users') as any)
        .select('id, name, email')
        .eq('email', emailToInvite)
        .maybeSingle();

      if (findError) throw findError;

      if (!foundUser) {
        showFeedback(
          `No registered user found with ${emailToInvite}. The user must register on TeamFlow first before being added.`,
          'error'
        );
        return;
      }

      // Add membership row
      const { error: insertError } = await (supabase.from('memberships') as any)
        .insert({
          org_id: currentOrg.id,
          user_id: foundUser.id,
          role: inviteRole,
        });

      if (insertError) throw insertError;

      setInviteEmail('');
      showFeedback(`Successfully added ${foundUser.name || emailToInvite} as ${inviteRole.toUpperCase()}.`);
      await fetchMembers();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to invite member.', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleSaveOrgDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !isOwner) return;

    try {
      setSavingOrg(true);
      const { error } = await (supabase.from('organizations') as any)
        .update({
          name: orgName.trim(),
          default_timezone: timezone,
        })
        .eq('id', currentOrg.id);

      if (error) throw error;

      await refreshOrgs();
      showFeedback('Organization settings updated successfully.');
    } catch (err: any) {
      showFeedback(err.message || 'Failed to save settings.', 'error');
    } finally {
      setSavingOrg(false);
    }
  };

  // Module 10: Execute Live Security & Compliance Audit
  const handleRunSecurityAudit = async () => {
    if (!currentOrg || !user) return;
    setAuditRunning(true);
    try {
      const results = await runSecurityAndComplianceAudit(currentOrg.id, user.id);
      setAuditResults(results);
      showFeedback('Security & Compliance Audit completed successfully.');
    } catch (err: any) {
      showFeedback('Audit execution failed: ' + err.message, 'error');
    } finally {
      setAuditRunning(false);
    }
  };

  // Danger Zone: Delete Organization
  const handleDeleteOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !isOwner) return;

    if (deleteConfirmationSlug !== currentOrg.slug) {
      showFeedback(`Please type "${currentOrg.slug}" precisely to confirm deletion.`, 'error');
      return;
    }

    try {
      setDeletingOrg(true);
      const { error } = await (supabase.from('organizations') as any)
        .delete()
        .eq('id', currentOrg.id);

      if (error) throw error;

      showFeedback(`Organization "${currentOrg.name}" deleted.`);
      await refreshOrgs();
      const remaining = organizations.filter((o) => o.id !== currentOrg.id);
      if (remaining.length > 0) {
        setCurrentOrg(remaining[0]);
      } else {
        window.location.href = '/landing';
      }
    } catch (err: any) {
      showFeedback(err.message || 'Failed to delete organization.', 'error');
    } finally {
      setDeletingOrg(false);
    }
  };

  if (!currentOrg) {
    return (
      <div className="p-8 text-center text-slate-400 font-sans">
        <p className="text-sm">No active organization selected. Please create or select an organization.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-16">
      {/* Top Header */}
      <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              Module 10 · Security & Governance
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Tenant ID: {currentOrg.id.slice(0, 8)}...
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            <span>Organization & Tenant Controls</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure tenant parameters, manage team privileges, and verify multi-tenant isolation boundaries for <strong className="text-white">{currentOrg.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
            isOwner
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              : currentRole === 'manager'
              ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}>
            Your Role: {currentRole}
          </span>
        </div>
      </div>

      {feedbackMsg && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 shadow-lg animate-in fade-in duration-200 ${
          feedbackMsg.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 font-medium text-xs">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
            activeTab === 'general'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Building className="w-3.5 h-3.5 text-cyan-400" />
          <span>General Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
            activeTab === 'members'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-blue-400" />
          <span>Members & Roles</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {members.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
            activeTab === 'requests'
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5 text-amber-400" />
          <span>Join Requests</span>
          {incomingRequests.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold animate-pulse">
              {incomingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
            activeTab === 'security'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Security & Compliance Audit</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
            AC-01..08
          </span>
        </button>

        {isOwner && (
          <button
            onClick={() => setActiveTab('danger')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
              activeTab === 'danger'
                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm'
                : 'text-slate-400 hover:text-rose-400 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Danger Zone</span>
          </button>
        )}
      </div>

      {/* TAB 1: GENERAL SETTINGS (FR-ORG-07) */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-[#0c1018] border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{currentOrg.name}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Slug: <span className="text-cyan-400">{currentOrg.slug}</span> · Created: {new Date(currentOrg.created_at || '').toLocaleDateString()}
                </p>
              </div>
            </div>

            {isOwner ? (
              <form onSubmit={handleSaveOrgDetails} className="pt-4 border-t border-slate-800/80 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      Default Organization Timezone (Doc 1 §9)
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="UTC">UTC (Universal Coordinated Time) — Default</option>
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingOrg}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-cyan-900/30 transition"
                  >
                    {savingOrg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Parameters</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 italic">
                Only Organization Owners have privilege to modify tenant metadata.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MEMBERS & ROLES (FR-ORG-03 to FR-ORG-06) */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* Invite Card */}
          {(isOwner || currentRole === 'manager') && (
            <div className="p-6 rounded-3xl bg-[#0c1018] border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-cyan-400">
                <UserPlus className="w-4 h-4" />
                <span>Invite / Add Colleague (FR-ORG-03)</span>
              </div>
              <p className="text-xs text-slate-400">
                Grant access to this organization tenant. Registered TeamFlow users will immediately receive membership privileges.
              </p>

              <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <input
                    type="email"
                    required
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 placeholder-slate-500 transition"
                  />
                </div>

                <div className="flex gap-2">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 capitalize cursor-pointer"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    {isOwner && <option value="owner">Owner</option>}
                  </select>

                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition shrink-0 shadow-lg shadow-cyan-900/30 flex items-center gap-1.5"
                  >
                    {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>Add</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Members Table */}
          <div className="p-6 rounded-3xl bg-[#0c1018] border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Team Members & Roles</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Role assignments determine permissions across workspaces, projects, and report views (Doc 1 §2 & §8).
                </p>
              </div>

              <span className="text-xs text-slate-400 font-mono">
                {ownerCount} Owner{ownerCount === 1 ? '' : 's'}
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="text-xs">Loading membership records...</span>
              </div>
            ) : (
              <div className="overflow-x-auto pt-2 border-t border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3">Member</th>
                      <th className="py-3 px-3">Org Role</th>
                      <th className="py-3 px-3 text-center">Joined Date</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {members.map((m) => {
                      const isTargetUserSelf = m.user_id === user?.id;
                      const isLastOwner = m.role === 'owner' && ownerCount <= 1;

                      return (
                        <tr key={m.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                                {m.name.slice(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <span className="text-white font-semibold flex items-center gap-1.5">
                                  <span>{m.name}</span>
                                  {isTargetUserSelf && (
                                    <span className="text-[10px] font-mono px-1.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                                      You
                                    </span>
                                  )}
                                </span>
                                <span className="text-[11px] text-slate-400 block font-mono">{m.email}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {isOwner ? (
                              <select
                                value={m.role}
                                onChange={(e) => handleRoleChange(m.id, e.target.value as OrgRole)}
                                disabled={isLastOwner}
                                className="appearance-none px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold capitalize text-slate-200 focus:outline-none focus:border-cyan-500 disabled:opacity-50 cursor-pointer"
                              >
                                <option value="employee">Employee</option>
                                <option value="manager">Manager</option>
                                <option value="owner">Owner</option>
                              </select>
                            ) : (
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                                m.role === 'owner'
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                  : m.role === 'manager'
                                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}>
                                {m.role}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {m.joinedAt}
                          </td>

                          <td className="py-3 px-3 text-right">
                            {isOwner && (
                              <button
                                onClick={() => handleRemoveMember(m.id)}
                                disabled={isLastOwner}
                                title={isLastOwner ? 'Cannot remove the last owner of the organization' : 'Remove member'}
                                className="p-1.5 rounded-xl hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 text-slate-500 hover:text-rose-400 transition disabled:opacity-30 disabled:pointer-events-none"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: JOIN REQUESTS REVIEW */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-[#0c1018] border border-slate-800 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Incoming Join Requests
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {incomingRequests.length} pending
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  Prospective members can request access to your company. Owners and managers can review their profiles, assign a controlled permission role, and approve or reject access.
                </p>
              </div>

              <button
                onClick={fetchIncomingRequests}
                disabled={loadingRequests}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition self-start sm:self-auto"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loadingRequests ? 'animate-spin text-amber-400' : ''}`} />
                <span>Refresh Requests</span>
              </button>
            </div>

            {loadingRequests ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3">
                <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
                <p className="text-xs">Fetching pending company applications...</p>
              </div>
            ) : incomingRequests.length === 0 ? (
              <div className="py-12 px-4 rounded-2xl bg-slate-900/30 border border-dashed border-slate-800 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
                  <UserPlus className="w-6 h-6 text-slate-500" />
                </div>
                <h4 className="text-sm font-semibold text-slate-200">No Pending Join Requests</h4>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  When new users search for <span className="text-amber-400 font-medium">"{currentOrg.name}"</span> and submit a join request, their application will appear here for controlled authorization.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {incomingRequests.map((req) => {
                  const selectedRole = decisionRoles[req.id] || req.role_requested || 'employee';

                  const requesterName = req.users?.name || req.user_profile?.full_name || 'Prospective Member';
                  const requesterEmail = req.users?.email || req.user_profile?.email || 'No email provided';
                  const avatarInitial = (requesterName.charAt(0) || requesterEmail.charAt(0) || '?').toUpperCase();

                  return (
                    <div
                      key={req.id}
                      className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-base shrink-0">
                          {avatarInitial}
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-white">
                              {requesterName}
                            </span>
                            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700/60">
                              {requesterEmail}
                            </span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {req.note && (
                            <div className="text-xs text-slate-300 bg-black/40 border border-slate-800/80 px-3 py-2 rounded-xl italic">
                              "{req.note}"
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>Requested Role:</span>
                            <span className="px-2 py-0.5 rounded-md font-semibold capitalize bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              {req.role_requested}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                          <label className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                            Grant Access As:
                          </label>
                          <select
                            value={selectedRole}
                            onChange={(e) =>
                              setDecisionRoles((prev) => ({
                                ...prev,
                                [req.id]: e.target.value as OrgRole
                              }))
                            }
                            className="bg-transparent text-xs font-bold text-amber-300 focus:outline-none cursor-pointer capitalize"
                          >
                            <option value="employee" className="bg-slate-900 text-slate-200">
                              Employee (Standard Access)
                            </option>
                            <option value="manager" className="bg-slate-900 text-slate-200">
                              Manager (Admin Features)
                            </option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApproveRequest(req.id, req.user_id)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve & Grant</span>
                          </button>

                          <button
                            onClick={() => handleRejectRequest(req.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 border border-slate-700/60 text-xs font-medium transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY & COMPLIANCE AUDIT (Module 10: AC-01 to AC-08) */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-[#0c1018] border border-slate-800 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Multi-Tenant Isolation & Compliance Audit Suite
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Executes live verification tests verifying acceptance criteria <strong>AC-01 through AC-08</strong> (Doc 1 §12).
                </p>
              </div>

              <button
                onClick={handleRunSecurityAudit}
                disabled={auditRunning}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
              >
                {auditRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>{auditRunning ? 'Auditing Tenant Boundaries...' : 'Run Live Security Audit'}</span>
              </button>
            </div>

            {/* Architecture Invariants Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  PostgreSQL RLS
                </span>
                <p className="text-white font-bold text-sm">16 Tables Enforced</p>
                <p className="text-[11px] text-slate-400">
                  Every table carries <code className="text-cyan-300">org_id</code> with row-level tenant security.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Last-Owner Protection
                </span>
                <p className="text-white font-bold text-sm">Active & Guarded</p>
                <p className="text-[11px] text-slate-400">
                  FR-ORG-06 invariant blocks removing or demoting the last remaining owner.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                  Private Storage
                </span>
                <p className="text-white font-bold text-sm">Token-Gated Downloads</p>
                <p className="text-[11px] text-slate-400">
                  Bucket 'attachments' is private with strict 10MB type allowlist.
                </p>
              </div>
            </div>

            {/* Audit Results Table */}
            {auditResults && (
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white uppercase tracking-wider">
                    Audit Execution Results ({auditResults.filter((r) => r.status === 'passed').length}/{auditResults.length} Passed)
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    All tests verified against live Supabase instance
                  </span>
                </div>

                <div className="space-y-2.5">
                  {auditResults.map((res) => (
                    <div
                      key={res.id}
                      className={`p-3.5 rounded-2xl border transition ${
                        res.status === 'passed'
                          ? 'bg-emerald-950/10 border-emerald-900/40 hover:border-emerald-700/60'
                          : 'bg-rose-950/20 border-rose-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          {res.status === 'passed' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                          <span className="font-bold text-white text-xs">{res.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-850 text-slate-300 border border-slate-750">
                            {res.id}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-500 font-mono">
                          {res.durationMs}ms
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 mt-1.5 pl-6.5">
                        {res.details}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 pl-6.5 font-mono">
                        {res.specRequirement}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DANGER ZONE (Owner Only) */}
      {activeTab === 'danger' && isOwner && (
        <div className="p-6 rounded-3xl bg-rose-950/10 border border-rose-900/40 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5" />
            <span>Danger Zone: Permanent Organization Deletion</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
            Deleting <strong className="text-white">{currentOrg.name}</strong> will cascade and permanently purge all associated workspaces, projects, Kanban boards, attachments, comments, and task histories. This action cannot be reversed.
          </p>

          <form onSubmit={handleDeleteOrganization} className="pt-2 max-w-md space-y-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-400">
                To confirm deletion, type your organization slug <strong className="text-rose-400 font-mono">{currentOrg.slug}</strong> below:
              </label>
              <input
                type="text"
                required
                value={deleteConfirmationSlug}
                onChange={(e) => setDeleteConfirmationSlug(e.target.value)}
                placeholder={currentOrg.slug}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-rose-900/60 text-slate-200 text-xs focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={deletingOrg || deleteConfirmationSlug !== currentOrg.slug}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-rose-900/30 transition"
            >
              {deletingOrg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Permanently Delete Organization</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
