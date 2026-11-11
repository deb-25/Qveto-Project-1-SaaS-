import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Plus, 
  Search, 
  Send, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  ArrowRight, 
  Users, 
  Briefcase, 
  Sparkles, 
  AlertCircle,
  Loader2,
  Trash2,
  Bell
} from 'lucide-react';
import { useOrg } from '../../context/OrgContext';
import { useAuth } from '../../context/AuthContext';
import { joinRequestService, CompanySearchResult } from '../../services/joinRequestService';
import { OrgJoinRequest } from '../../types';

export const CompaniesHubPage: React.FC = () => {
  const { organizations, currentOrg, setCurrentOrg, createOrganization, currentRole } = useOrg();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Search & Join Request state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedOrgToJoin, setSelectedOrgToJoin] = useState<CompanySearchResult | null>(null);
  const [requestedRole, setRequestedRole] = useState<'employee' | 'manager'>('employee');
  const [requestNote, setRequestNote] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);

  // My Sent Join Requests
  const [myRequests, setMyRequests] = useState<OrgJoinRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Create New Org Modal
  const [isNewOrgModalOpen, setIsNewOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  // Feedback Toast
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4500);
  };

  const loadMyRequests = async () => {
    setLoadingRequests(true);
    const reqs = await joinRequestService.getMyJoinRequests();
    setMyRequests(reqs);
    setLoadingRequests(false);
  };

  useEffect(() => {
    loadMyRequests();
  }, [user]);

  // Handle Search Input Debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      const results = await joinRequestService.searchCompanies(searchQuery);
      // Filter out companies already joined
      const joinedIds = new Set(organizations.map((o) => o.id));
      setSearchResults(results.filter((r) => !joinedIds.has(r.id)));
      setSearching(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, organizations]);

  const handleSendJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgToJoin) return;

    setSubmittingReq(true);
    const res = await joinRequestService.sendJoinRequest(
      selectedOrgToJoin.id,
      requestedRole,
      requestNote
    );
    setSubmittingReq(false);

    if (res.success) {
      showFeedback(`Join request sent to ${selectedOrgToJoin.name}! Awaiting owner approval.`, 'success');
      setSelectedOrgToJoin(null);
      setRequestNote('');
      setSearchQuery('');
      setSearchResults([]);
      await loadMyRequests();
    } else {
      showFeedback(res.error || 'Failed to submit join request.', 'error');
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    const ok = await joinRequestService.cancelJoinRequest(requestId);
    if (ok) {
      showFeedback('Join request cancelled.', 'success');
      setMyRequests((prev) => prev.filter((r) => r.id !== requestId));
    } else {
      showFeedback('Could not cancel request.', 'error');
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setCreatingOrg(true);
    const slug = newOrgSlug.trim() || newOrgName.trim().toLowerCase().replace(/\s+/g, '-');
    const org = await createOrganization(newOrgName.trim(), slug);
    setCreatingOrg(false);

    if (org) {
      setIsNewOrgModalOpen(false);
      setNewOrgName('');
      setNewOrgSlug('');
      showFeedback(`Organization "${org.name}" initialized! You are now the Owner.`, 'success');
    } else {
      showFeedback('Failed to create organization. Please verify unique slug.', 'error');
    }
  };

  const roleBadgeStyles: Record<string, string> = {
    owner: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    manager: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    employee: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 font-sans pb-20">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Enterprise Tenant Directory
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Companies &amp; Workspaces Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Switch between joined organizations, send membership requests to join other enterprise teams, or initialize a new company workspace.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsNewOrgModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition active:scale-95 cursor-pointer font-mono"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Company</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-mono border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* =====================================================================
          SECTION 1: SEARCH DIRECTORY & REQUEST ACCESS (TOP SECTION)
          ===================================================================== */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0c1018] border border-cyan-500/30 shadow-xl space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-400">
              Join Existing Organization
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Search Directory &amp; Request Access
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Search for a company by name or slug. Once submitted, the company's Owner or Manager can review and grant you controlled access.
          </p>
        </div>

        {/* Search Input Box */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type company name or slug (e.g. Acme, BrightWave, titan-systems)..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-cyan-400 transition font-mono placeholder:text-slate-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
          {searching && <Loader2 className="w-4 h-4 animate-spin text-cyan-400 absolute right-3.5 top-3.5" />}
        </div>

        {/* Search Results */}
        {searchQuery.trim() && (
          <div className="space-y-3 pt-2">
            <span className="text-[11px] font-mono uppercase text-slate-400">
              Directory Results ({searchResults.length})
            </span>

            {searchResults.length === 0 && !searching ? (
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 font-mono text-center">
                No organizations found matching "{searchQuery}". Double-check spelling or ask your team owner for their exact company slug.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {searchResults.map((org) => {
                  const isSelected = selectedOrgToJoin?.id === org.id;

                  return (
                    <div
                      key={org.id}
                      onClick={() => setSelectedOrgToJoin(org)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/30'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{org.name}</h4>
                        <p className="text-[11px] text-slate-400 font-mono truncate">@{org.slug}</p>
                      </div>
                      <span className="text-xs font-mono font-bold text-cyan-400 shrink-0">
                        {isSelected ? '✓ Selected' : 'Select →'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Selected Org Join Request Form */}
        {selectedOrgToJoin && (
          <form onSubmit={handleSendJoinRequest} className="p-5 rounded-2xl bg-slate-900/80 border border-cyan-500/40 space-y-4 font-mono animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                Submit Request to Join: <span className="text-white">{selectedOrgToJoin.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedOrgToJoin(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕ Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-slate-300 uppercase mb-1">
                  Requested Role
                </label>
                <select
                  value={requestedRole}
                  onChange={(e) => setRequestedRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="employee">Employee / Contributor (Standard Access)</option>
                  <option value="manager">Manager / Team Lead (Manage Sprints &amp; Workspaces)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 uppercase mb-1">
                  Personal Intro Note (Optional)
                </label>
                <input
                  type="text"
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder="e.g. Lead designer on Team Apollo, joining today"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-400 font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={submittingReq}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-900/30 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {submittingReq ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{submittingReq ? 'Sending...' : 'Send Request to Company Owner'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* =====================================================================
          SECTION 2: JOINED COMPANIES LIST
          ===================================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>Joined Companies &amp; Organizations ({organizations.length})</span>
          </h2>
          <span className="text-[11px] text-slate-400 font-mono">
            Click to enter workspace or switch active tenant
          </span>
        </div>

        {organizations.length === 0 ? (
          <div className="p-8 rounded-3xl bg-[#0c1018] border border-amber-500/30 text-center space-y-4 shadow-xl font-mono">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Building2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">No Companies Joined Yet</h3>
              <p className="text-xs text-slate-400 font-sans max-w-md mx-auto">
                You are not currently enrolled in any organization workspace. Use the search section above to request to join an existing company, or initialize your own company.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {organizations.map((org) => {
              const isActive = currentOrg?.id === org.id;

              return (
                <div
                  key={org.id}
                  className={`p-6 rounded-3xl transition-all relative overflow-hidden flex flex-col justify-between space-y-5 border ${
                    isActive
                      ? 'bg-gradient-to-b from-amber-500/10 to-[#0c1018] border-amber-500/50 shadow-xl shadow-amber-500/5'
                      : 'bg-[#0c1018] border-slate-800 hover:border-slate-700 shadow-lg'
                  }`}
                >
                  {/* Top Bar with Status Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black text-xl font-mono shadow-md">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {isActive && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Active Tenant
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border uppercase ${roleBadgeStyles[currentRole] || 'border-slate-700 text-slate-400'}`}>
                          {isActive ? currentRole : 'Member'} Role
                        </span>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-white tracking-tight truncate">{org.name}</h3>
                    <p className="text-xs text-slate-400 font-mono truncate">slug: @{org.slug}</p>
                  </div>

                  {/* Quick Enter Action */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">
                      Timezone: {org.default_timezone || 'UTC'}
                    </span>
                    <button
                      onClick={() => {
                        setCurrentOrg(org);
                        navigate('/my-work');
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/20'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-750'
                      }`}
                    >
                      <span>{isActive ? 'Enter Workspace' : 'Switch & Open'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================================================
          SECTION 3: PENDING JOIN REQUESTS
          ===================================================================== */}
      {myRequests.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Your Sent Join Requests ({myRequests.length})</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              Track requests awaiting company administrator decision
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myRequests.map((req) => (
              <div
                key={req.id}
                className="p-5 rounded-2xl bg-[#0c1018] border border-slate-800 flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white truncate">
                      {req.organizations?.name || 'Unknown Company'}
                    </h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        req.status === 'pending'
                          ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                          : req.status === 'approved'
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono truncate">
                    Requested Role: <strong className="text-slate-200 capitalize">{req.role_requested}</strong> &middot;{' '}
                    {new Date(req.created_at).toLocaleDateString()}
                  </p>
                  {req.note && (
                    <p className="text-[11px] text-slate-500 italic truncate font-sans">
                      "{req.note}"
                    </p>
                  )}
                </div>

                {req.status === 'pending' && (
                  <button
                    onClick={() => handleCancelRequest(req.id)}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition shrink-0 cursor-pointer"
                    title="Cancel request"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CREATE NEW COMPANY
          ===================================================================== */}
      {isNewOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono">
          <div className="bg-[#0c1018] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Initialize New Company</h3>
              <button
                onClick={() => setIsNewOrgModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                  Company / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corporation"
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    if (!newOrgSlug) {
                      setNewOrgSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                  Organization Slug
                </label>
                <input
                  type="text"
                  placeholder="e.g. acme-corp"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewOrgModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingOrg}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition disabled:opacity-50"
                >
                  {creatingOrg ? 'Initializing...' : 'Create & Become Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
