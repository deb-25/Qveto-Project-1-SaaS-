import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Briefcase, 
  Building2, 
  Globe, 
  FileText, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ShieldCheck, 
  Copy, 
  Check, 
  Sparkles,
  Camera
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrg } from '../../context/OrgContext';
import { supabase } from '../../api/supabaseClient';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
];

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export const ProfilePage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const { organizations, currentRole, currentOrg } = useOrg();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [jobTitle, setJobTitle] = useState(user?.job_title || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');

  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setJobTitle(user.job_title || '');
      setDepartment(user.department || '');
      setBio(user.bio || '');
      setTimezone(user.timezone || 'UTC');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCopyId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    try {
      const updates = {
        name: name.trim(),
        phone: phone.trim() || null,
        job_title: jobTitle.trim() || null,
        department: department.trim() || null,
        bio: bio.trim() || null,
        timezone,
        avatar_url: avatarUrl.trim() || null,
      };

      // 1. Update Supabase Auth user metadata (stores data directly in Supabase Authentication tab!)
      try {
        await supabase.auth.updateUser({
          data: {
            name: updates.name,
            full_name: updates.name,
            phone: updates.phone,
            job_title: updates.job_title,
            department: updates.department,
            bio: updates.bio,
            timezone: updates.timezone,
            avatar_url: updates.avatar_url,
          },
        });
      } catch (authErr) {
        console.warn('Could not sync user_metadata to auth.users:', authErr);
      }

      // 2. Upsert to public.users (creates row if not existing, or updates existing row)
      const { error } = await (supabase.from('users') as any)
        .upsert({
          id: user.id,
          email: user.email,
          ...updates,
        }, { onConflict: 'id' });

      if (error) {
        console.warn('public.users upsert warning:', error.message);
      }

      // 3. Cache to localStorage for instant local retrieval
      try {
        localStorage.setItem(`teamflow_profile_${user.id}`, JSON.stringify({
          ...user,
          ...updates,
        }));
      } catch {}

      await refreshProfile();
      showFeedback('Profile updated successfully!', 'success');
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      showFeedback(err.message || 'Failed to update profile data.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans pb-16">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">
              Personal Identity &amp; Account
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            User Profile Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your personal credentials, contact info, and team presence across all joined companies.
          </p>
        </div>

        {/* Quick Save CTA */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition active:scale-95 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
        </button>
      </div>

      {/* Alert Feedback Banner */}
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

      {/* Profile Overview Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0c1018] border border-slate-800 shadow-xl relative overflow-hidden space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar Preview */}
          <div className="relative group shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-extrabold text-2xl font-mono shadow-xl overflow-hidden border-2 border-slate-700">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name || 'Avatar'} className="w-full h-full object-cover" />
              ) : (
                <span>{name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}</span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-400">
              <Camera className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* User Summary Info */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-white truncate">{name || 'Unnamed Team Member'}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase">
                {currentRole} Role
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>{user?.email}</span>
            </p>
            {jobTitle && (
              <p className="text-xs text-slate-300 flex items-center gap-1.5 font-sans">
                <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                <span>{jobTitle} {department ? `&middot; ${department}` : ''}</span>
              </p>
            )}
          </div>
        </div>

        {/* Preset Avatar Picker */}
        <div className="pt-2 border-t border-slate-800/80">
          <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2.5">
            Choose a preset avatar or enter custom image URL:
          </label>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            {PRESET_AVATARS.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setAvatarUrl(url)}
                className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                  avatarUrl === url ? 'border-amber-400 ring-2 ring-amber-400/30 scale-105' : 'border-slate-800 hover:border-slate-600 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={url} alt={`Avatar option ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          <input
            type="url"
            placeholder="https://example.com/my-avatar.png"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400 font-mono"
          />
        </div>
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleSubmit} className="p-6 sm:p-8 rounded-3xl bg-[#0c1018] border border-slate-800 shadow-xl space-y-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-3 flex items-center gap-2">
          <User className="w-4 h-4 text-amber-400" />
          <span>Personal Information &amp; Professional Details</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Full Name */}
          <div>
            <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase mb-1.5">
              Full Legal / Display Name *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400 transition"
              />
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Email Address (Auth Read-Only) */}
          <div>
            <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase mb-1.5 flex items-center justify-between">
              <span>Account Email</span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3 h-3" /> Verified Auth
              </span>
            </label>
            <div className="relative">
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs cursor-not-allowed font-mono"
              />
              <Mail className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Job Title */}
          <div>
            <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase mb-1.5">
              Job Title / Engineering Role
            </label>
            <div className="relative">
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400 transition"
              />
              <Briefcase className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase mb-1.5">
              Team / Department
            </label>
            <div className="relative">
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Core Infrastructure"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400 transition"
              />
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400 transition font-mono"
              />
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Default Timezone */}
          <div>
            <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase mb-1.5">
              Primary Timezone
            </label>
            <div className="relative">
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400 transition font-mono"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        {/* Bio / About Me */}
        <div>
          <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase mb-1.5">
            About Me / Technical Bio
          </label>
          <div className="relative">
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your team about what you specialize in, current sprint focus, or working hours..."
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400 transition resize-none"
            />
            <FileText className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Submit Action */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer font-mono"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>

      {/* Account Telemetry & Tenant Information */}
      <div className="p-6 rounded-3xl bg-[#0c1018] border border-slate-800 space-y-4 font-mono text-xs text-slate-400 shadow-xl">
        <h4 className="text-white font-bold uppercase tracking-wider text-[11px]">
          Account &amp; Workspace Enrollment Telemetry
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase text-slate-500">Unique User ID</span>
            <div className="flex items-center justify-between text-slate-300 font-mono text-[11px]">
              <span className="truncate">{user?.id?.slice(0, 18)}…</span>
              <button
                type="button"
                onClick={handleCopyId}
                className="p-1 hover:text-amber-400 transition"
                title="Copy Full UUID"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase text-slate-500">Joined Organizations</span>
            <div className="text-amber-400 font-bold text-sm">
              {organizations.length} {organizations.length === 1 ? 'Company' : 'Companies'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase text-slate-500">Active Tenant</span>
            <div className="text-slate-200 font-bold text-sm truncate">
              {currentOrg?.name || 'None Selected'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
