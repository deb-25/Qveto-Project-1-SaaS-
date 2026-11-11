import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Users, 
  ArrowRight,
  Loader2,
  X,
  FolderKanban,
  Archive,
  Edit2,
  Calendar,
  Layers,
  FolderPlus,
  UserCheck,
  Check,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOrg } from '../../context/OrgContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabaseClient';
import { Project, Workspace } from '../../types';

interface TeamItem {
  id: string;
  name: string;
  workspace_id: string;
}

export const WorkspacesPage: React.FC = () => {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Active view tab per workspace (projects | teams)
  const [activeTabByWs, setActiveTabByWs] = useState<Record<string, 'projects' | 'teams'>>({});

  // Workspace Modal
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  const [savingWs, setSavingWs] = useState(false);

  // Project Modal
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [targetWsId, setTargetWsId] = useState<string>('');
  const [prjName, setPrjName] = useState('');
  const [prjKey, setPrjKey] = useState('');
  const [prjDesc, setPrjDesc] = useState('');
  const [prjStatus, setPrjStatus] = useState<string>('active');
  const [prjTargetDate, setPrjTargetDate] = useState('');
  const [creatingPrj, setCreatingPrj] = useState(false);

  // Team Modal
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamWsId, setTeamWsId] = useState<string>('');
  const [teamName, setTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);

  const isManagerOrOwner = currentRole === 'owner' || currentRole === 'manager';

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchData = async () => {
    if (!currentOrg) {
      setWorkspaces([]);
      setProjects([]);
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [wsRes, prjRes, teamsRes] = await Promise.all([
        (supabase.from('workspaces') as any)
          .select('*')
          .eq('org_id', currentOrg.id)
          .is('archived_at', null)
          .order('created_at', { ascending: true }),
        (supabase.from('projects') as any)
          .select('*')
          .eq('org_id', currentOrg.id)
          .is('archived_at', null)
          .order('created_at', { ascending: true }),
        (supabase.from('teams') as any)
          .select('*')
          .eq('org_id', currentOrg.id)
          .order('created_at', { ascending: true }),
      ]);

      setWorkspaces(wsRes.data || []);
      setProjects(prjRes.data || []);
      setTeams(teamsRes.data || []);
    } catch (err) {
      console.error('Failed to load workspaces, projects and teams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentOrg]);

  // Open Workspace Modal for Create or Edit
  const handleOpenWsModal = (ws?: Workspace) => {
    if (ws) {
      setEditingWs(ws);
      setWsName(ws.name);
      setWsDesc(ws.description || '');
    } else {
      setEditingWs(null);
      setWsName('');
      setWsDesc('');
    }
    setIsWorkspaceModalOpen(true);
  };

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName.trim() || !currentOrg) return;

    setSavingWs(true);
    try {
      if (editingWs) {
        // Update
        const { error } = await (supabase.from('workspaces') as any)
          .update({
            name: wsName.trim(),
            description: wsDesc.trim() || null,
          })
          .eq('id', editingWs.id);

        if (error) throw error;
        notify(`Workspace "${wsName}" updated.`);
      } else {
        // Create
        const { error } = await (supabase.from('workspaces') as any)
          .insert({
            org_id: currentOrg.id,
            name: wsName.trim(),
            description: wsDesc.trim() || null,
          });

        if (error) throw error;
        notify(`Workspace "${wsName}" created.`);
      }

      await fetchData();
      setIsWorkspaceModalOpen(false);
    } catch (err: any) {
      notify(err.message || 'Failed to save workspace.');
    } finally {
      setSavingWs(false);
    }
  };

  const handleArchiveWorkspace = async (wsId: string, wsName: string) => {
    if (!confirm(`Are you sure you want to archive workspace "${wsName}"? All contained projects will be archived.`)) {
      return;
    }

    try {
      const { error } = await (supabase.from('workspaces') as any)
        .update({ archived_at: new Date().toISOString() })
        .eq('id', wsId);

      if (error) throw error;
      notify(`Workspace "${wsName}" archived.`);
      await fetchData();
    } catch (err: any) {
      notify(err.message || 'Failed to archive workspace.');
    }
  };

  // Open Project Modal
  const handleOpenProjectModal = (wsId: string) => {
    setTargetWsId(wsId);
    setPrjName('');
    setPrjKey('');
    setPrjDesc('');
    setPrjStatus('active');
    setPrjTargetDate('');
    setIsProjectModalOpen(true);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prjName.trim() || !prjKey.trim() || !targetWsId || !currentOrg) return;

    setCreatingPrj(true);
    try {
      const cleanKey = prjKey.trim().toUpperCase();
      const { data: newProj, error } = await (supabase.from('projects') as any)
        .insert({
          org_id: currentOrg.id,
          workspace_id: targetWsId,
          key: cleanKey,
          name: prjName.trim(),
          description: prjDesc.trim() || null,
          status: prjStatus,
          target_date: prjTargetDate || null,
          lead_id: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator to project_members
      if (user && newProj) {
        await (supabase.from('project_members') as any).insert({
          project_id: newProj.id,
          user_id: user.id,
          org_id: currentOrg.id,
        });
      }

      notify(`Project [${cleanKey}] created successfully.`);
      await fetchData();
      setIsProjectModalOpen(false);
    } catch (err: any) {
      notify(err.message || 'Failed to create project.');
    } finally {
      setCreatingPrj(false);
    }
  };

  // Archive Project
  const handleArchiveProject = async (prjId: string, name: string) => {
    if (!confirm(`Archive project "${name}"? It will become read-only.`)) return;

    try {
      const { error } = await (supabase.from('projects') as any)
        .update({ archived_at: new Date().toISOString(), status: 'archived' })
        .eq('id', prjId);

      if (error) throw error;
      notify(`Project "${name}" archived.`);
      await fetchData();
    } catch (err: any) {
      notify(err.message || 'Failed to archive project.');
    }
  };

  // Open Team Modal
  const handleOpenTeamModal = (wsId: string) => {
    setTeamWsId(wsId);
    setTeamName('');
    setIsTeamModalOpen(true);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !teamWsId || !currentOrg) return;

    setCreatingTeam(true);
    try {
      const { data: newTeam, error } = await (supabase.from('teams') as any)
        .insert({
          org_id: currentOrg.id,
          workspace_id: teamWsId,
          name: teamName.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Add user to team_members
      if (user && newTeam) {
        await (supabase.from('team_members') as any).insert({
          team_id: newTeam.id,
          user_id: user.id,
        });
      }

      notify(`Team "${teamName}" created.`);
      await fetchData();
      setIsTeamModalOpen(false);
    } catch (err: any) {
      notify(err.message || 'Failed to create team.');
    } finally {
      setCreatingTeam(false);
    }
  };

  const statusBadges: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    planned: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    on_hold: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    archived: 'bg-slate-700/30 text-slate-400 border-slate-700',
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] font-mono text-xs text-slate-400 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
        <span>Loading workspace containers and projects...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
            MODULES 02 &amp; 03 &middot; WORKSPACES, TEAMS &amp; PROJECTS
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1 font-mono">
            Workspaces &amp; Projects
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Manage departmental workspaces, teams, and active projects in <span className="text-amber-400 font-mono">{currentOrg?.name}</span>.
          </p>
        </div>

        {isManagerOrOwner && (
          <div className="flex items-center gap-3 font-mono">
            <button 
              onClick={() => handleOpenWsModal()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-xs font-bold text-slate-200 transition shadow-sm"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>New Workspace</span>
            </button>
            <Link 
              to="/board"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition active:scale-95"
            >
              <FolderKanban className="w-4 h-4" />
              <span>Sprint Board</span>
            </Link>
          </div>
        )}
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Workspaces List */}
      {workspaces.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0c1018] border border-slate-800 space-y-4 font-mono">
          <Building2 className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No Workspaces Initialized</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto font-sans">
            Workspaces organize your teams and projects into logical areas like Engineering, Marketing, or Product.
          </p>
          {isManagerOrOwner && (
            <button
              onClick={() => handleOpenWsModal()}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition"
            >
              Create First Workspace
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {workspaces.map((ws) => {
            const wsProjects = projects.filter((p) => p.workspace_id === ws.id);
            const wsTeams = teams.filter((t) => t.workspace_id === ws.id);
            const activeTab = activeTabByWs[ws.id] || 'projects';

            return (
              <div key={ws.id} className="p-6 rounded-2xl bg-[#0c1018]/80 border border-slate-800 space-y-5 shadow-xl">
                {/* Workspace Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-white font-mono">{ws.name}</h2>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-850 text-slate-400 font-mono">
                          {wsProjects.length} projects &middot; {wsTeams.length} teams
                        </span>
                      </div>
                      {ws.description && (
                        <p className="text-xs text-slate-400 font-sans mt-0.5">{ws.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Tab Switcher */}
                  <div className="flex items-center gap-2 font-mono self-end sm:self-center">
                    <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-0.5 text-xs">
                      <button
                        onClick={() => setActiveTabByWs((prev) => ({ ...prev, [ws.id]: 'projects' }))}
                        className={`px-3 py-1 rounded-lg transition ${
                          activeTab === 'projects'
                            ? 'bg-amber-500/20 text-amber-300 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Projects ({wsProjects.length})
                      </button>
                      <button
                        onClick={() => setActiveTabByWs((prev) => ({ ...prev, [ws.id]: 'teams' }))}
                        className={`px-3 py-1 rounded-lg transition ${
                          activeTab === 'teams'
                            ? 'bg-amber-500/20 text-amber-300 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Teams ({wsTeams.length})
                      </button>
                    </div>

                    {isManagerOrOwner && (
                      <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
                        <button
                          onClick={() => handleOpenWsModal(ws)}
                          title="Edit Workspace"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleArchiveWorkspace(ws.id, ws.name)}
                          title="Archive Workspace"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tab: Projects Grid */}
                {activeTab === 'projects' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                        Workspace Projects
                      </span>
                      {isManagerOrOwner && (
                        <button
                          onClick={() => handleOpenProjectModal(ws.id)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs font-mono transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Project</span>
                        </button>
                      )}
                    </div>

                    {wsProjects.length === 0 ? (
                      <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center font-mono">
                        <FolderKanban className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">No active projects in this workspace.</p>
                        {isManagerOrOwner && (
                          <button
                            onClick={() => handleOpenProjectModal(ws.id)}
                            className="mt-3 text-xs text-amber-400 hover:underline font-bold"
                          >
                            + Create a Project
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {wsProjects.map((prj) => (
                          <div
                            key={prj.id}
                            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between group shadow-sm"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2 font-mono">
                                <span className="text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                  {prj.key}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                                      statusBadges[prj.status] || statusBadges.active
                                    }`}
                                  >
                                    {prj.status}
                                  </span>
                                  {isManagerOrOwner && (
                                    <button
                                      onClick={() => handleArchiveProject(prj.id, prj.name)}
                                      title="Archive Project"
                                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                                    >
                                      <Archive className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <Link 
                                to={`/projects/${prj.id}`}
                                className="block text-sm font-bold text-white hover:text-amber-300 transition-colors font-mono"
                              >
                                {prj.name}
                              </Link>
                              {prj.description && (
                                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed font-sans">
                                  {prj.description}
                                </p>
                              )}
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
                              <Link
                                to={`/projects/${prj.id}`}
                                className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-[11px] transition"
                              >
                                <span>Overview</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>

                              <Link
                                to="/board"
                                className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium transition"
                              >
                                <span>Sprint Board</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Teams List */}
                {activeTab === 'teams' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                        Workspace Teams
                      </span>
                      {isManagerOrOwner && (
                        <button
                          onClick={() => handleOpenTeamModal(ws.id)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-xs font-mono transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Team</span>
                        </button>
                      )}
                    </div>

                    {wsTeams.length === 0 ? (
                      <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center font-mono">
                        <Users className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">No teams created in this workspace yet.</p>
                        {isManagerOrOwner && (
                          <button
                            onClick={() => handleOpenTeamModal(ws.id)}
                            className="mt-3 text-xs text-blue-400 hover:underline font-bold"
                          >
                            + Create a Team
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {wsTeams.map((team) => (
                          <div
                            key={team.id}
                            className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                <Users className="w-4 h-4" />
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-bold text-slate-200 truncate font-mono">{team.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono">Team Unit</p>
                              </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                              Active
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Workspace Modal */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono">
          <div className="bg-[#0c1018] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {editingWs ? 'Edit Workspace' : 'Create New Workspace'}
              </h3>
              <button
                onClick={() => setIsWorkspaceModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkspace} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                  Workspace Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering & Platform"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Scope, objectives, and teams..."
                  value={wsDesc}
                  onChange={(e) => setWsDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsWorkspaceModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingWs}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  {savingWs && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingWs ? 'Update Workspace' : 'Create Workspace'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono">
          <div className="bg-[#0c1018] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Create Project in Workspace
              </h3>
              <button
                onClick={() => setIsProjectModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                    Key *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="ENG"
                    value={prjKey}
                    onChange={(e) => setPrjKey(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-amber-400 font-bold text-xs uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Core API Infrastructure"
                    value={prjName}
                    onChange={(e) => setPrjName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Sprint goals and scope..."
                  value={prjDesc}
                  onChange={(e) => setPrjDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={prjStatus}
                    onChange={(e) => setPrjStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                  >
                    <option value="active">Active</option>
                    <option value="planned">Planned</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={prjTargetDate}
                    onChange={(e) => setPrjTargetDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPrj}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  {creatingPrj && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono">
          <div className="bg-[#0c1018] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Create Team in Workspace
              </h3>
              <button
                onClick={() => setIsTeamModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Backend Squad, Frontend UX"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTeamModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTeam}
                  className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  {creatingTeam && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Team</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
