import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  Kanban, 
  CheckSquare, 
  BarChart3, 
  Settings, 
  Bell, 
  Users, 
  Building2, 
  Menu, 
  X, 
  ChevronDown,
  LogOut,
  Plus,
  LayoutGrid,
  User,
  Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrg } from '../../context/OrgContext';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import { useOverdueEngine } from '../../hooks/useOverdueEngine';

import { BrandLogo } from '../common/BrandLogo';

export const AppLayout: React.FC = () => {
  const { user, signOut } = useAuth();
  const { currentOrg, organizations, setCurrentOrg, currentRole, createOrganization, loading } = useOrg();
  useOverdueEngine(); // Automated Overdue Background Audit Engine (FR-NTF-03)
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [isNewOrgModalOpen, setIsNewOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [createOrgError, setCreateOrgError] = useState<string | null>(null);

  const navItems = [
    { name: 'Companies Hub', path: '/dashboard', icon: LayoutGrid },
    { name: 'My Work', path: '/my-work', icon: CheckSquare },
    { name: 'Kanban Board', path: '/board', icon: Kanban },
    { name: 'Projects & Workspaces', path: '/workspaces', icon: Building2 },
    { name: 'Reports & Analytics', path: '/reports', icon: BarChart3 },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'Organization & Team', path: '/org-settings', icon: Users },
    { name: 'My Profile', path: '/profile', icon: User },
  ];

  const roleColors = {
    owner: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    manager: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    employee: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setCreateOrgError(null);
    setCreatingOrg(true);
    const slug = newOrgSlug.trim() || newOrgName.trim().toLowerCase().replace(/\s+/g, '-');
    const created = await createOrganization(newOrgName.trim(), slug);
    setCreatingOrg(false);

    if (created) {
      setIsNewOrgModalOpen(false);
      setNewOrgName('');
      setNewOrgSlug('');
      setCreateOrgError(null);
    } else {
      setCreateOrgError('Could not initialize organization. Please try again.');
    }
  };

  return (
    <div className="flex h-screen bg-[#07090e] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800/80 bg-[#0c1018]/90 backdrop-blur-xl">
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-slate-800/80">
          <BrandLogo size="md" showText={true} showVersion={false} glow={true} />
        </div>

        {/* Organization Switcher */}
        <div className="p-3 border-b border-slate-800/60 relative">
          <button
            onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 transition text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-300 font-mono">
                {currentOrg?.name?.charAt(0) || 'T'}
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-slate-200 truncate font-mono">
                  {currentOrg?.name || 'No Organization'}
                </p>
                <p className="text-[10px] text-slate-400 capitalize font-mono">{currentRole} role</p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {/* Org Dropdown */}
          {orgDropdownOpen && (
            <div className="absolute top-full left-3 right-3 mt-1.5 py-1.5 rounded-xl bg-[#0c1018] border border-slate-700 shadow-2xl z-50 font-mono">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Switch Tenant Organization
              </div>
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    setCurrentOrg(org);
                    setOrgDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-850 transition-colors ${
                    currentOrg?.id === org.id ? 'text-amber-400 font-semibold bg-amber-500/10' : 'text-slate-300'
                  }`}
                >
                  <span className="truncate">{org.name}</span>
                  {currentOrg?.id === org.id && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20">Active</span>}
                </button>
              ))}

              <div className="pt-1 mt-1 border-t border-slate-800">
                <button
                  onClick={() => {
                    setOrgDropdownOpen(false);
                    setIsNewOrgModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-amber-400 hover:bg-slate-850 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Organization</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono font-medium transition-all ${
                  active
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Footer with Real Profile & Sign Out */}
        <div className="p-3 border-t border-slate-800/80 flex items-center justify-between font-mono">
          <Link
            to="/profile"
            title="Manage your profile & personal info"
            className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition group p-1 rounded-xl hover:bg-slate-900/60"
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 group-hover:border-amber-450 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0 transition">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-slate-200 group-hover:text-amber-300 transition truncate">
                {user?.name || 'Authenticated User'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </Link>
          <button
            onClick={() => signOut()}
            title="Sign out of TeamFlow"
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition ml-1 shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800/80 bg-[#0c1018]/60 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 z-20">
          <div className="flex items-center gap-3 font-mono">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="md:hidden flex items-center">
              <BrandLogo size="xs" showText={false} />
            </div>
            
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-slate-200 font-semibold">{currentOrg?.name || 'Workspace'}</span>
              <span>/</span>
              <span className="text-amber-400 font-medium">{currentRole} access</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-mono font-medium uppercase ${roleColors[currentRole]}`}>
              {currentRole}
            </span>

            {/* Live In-App Notification Center (Module 7) */}
            <NotificationDropdown />
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-800 bg-[#0c1018]/95 backdrop-blur-xl px-4 py-3 space-y-2 z-30 font-mono">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium ${
                    active ? 'bg-amber-500/10 text-amber-400' : 'text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* Routed Workspace Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {!loading &&
          organizations.length === 0 &&
          !['/dashboard', '/companies', '/profile', '/notifications'].includes(location.pathname) ? (
            <div className="max-w-xl mx-auto my-12 p-8 rounded-3xl bg-[#0c1018] border border-amber-500/30 text-center space-y-6 shadow-2xl font-mono">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                <Building2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-white tracking-tight">Welcome to TeamFlow SaaS</h2>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  You are not currently enrolled in any active company workspace. You can search and send a join request to an existing company or initialize a brand new organization.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/companies"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20"
                >
                  <Search className="w-4 h-4" />
                  <span>Join Existing Company</span>
                </Link>
                <button
                  onClick={() => setIsNewOrgModalOpen(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Company</span>
                </button>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* New Organization Modal */}
      {isNewOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono">
          <div className="bg-[#0c1018] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Initialize New Organization</h3>
              <button
                onClick={() => setIsNewOrgModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              {createOrgError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {createOrgError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-300 uppercase mb-1">
                  Organization Name *
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
                  {creatingOrg ? 'Creating...' : 'Create & Become Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
