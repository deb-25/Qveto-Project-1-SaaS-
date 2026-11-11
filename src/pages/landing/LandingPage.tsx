import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart3, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Building2, 
  Users, 
  Lock, 
  Cpu, 
  Play, 
  Check, 
  Zap, 
  ChevronRight, 
  AlertCircle, 
  Terminal, 
  CheckSquare,
  ShieldCheck
} from 'lucide-react';
import { IsoGlowCanvas } from '../../components/isoglow/IsoGlowCanvas';
import { BrandLogo } from '../../components/common/BrandLogo';
import { useAuth } from '../../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { session } = useAuth();
  // Interactive Feature Tabs State
  const [activeTab, setActiveTab] = useState<'board' | 'ai' | 'tenant' | 'telemetry'>('board');

  // Interactive Multi-Tenant Simulation State
  const [activeSimTenant, setActiveSimTenant] = useState<'acme' | 'brightwave'>('acme');

  // Interactive KPI Simulator State
  const [totalDoneTasks, setTotalDoneTasks] = useState(18);
  const totalEligibleTasks = 24;
  const onTimeTasks = 16;

  // AI Interactive Demo Typing State
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedItems, setAiGeneratedItems] = useState<string[]>([
    'Enforce composite foreign keys (org_id, project_id)',
    'Configure PostgreSQL RLS policies with auth.uid() check',
    'Write automated cross-tenant security test assertions',
    'Verify zero-leakage response code in CI pipeline',
  ]);

  const handleTriggerAiBreakdown = () => {
    setAiGenerating(true);
    setAiGeneratedItems([]);
    const items = [
      'Parse request tenant slug and load organization context',
      'Validate user membership and assign role permissions',
      'Enforce atomic status transition table rules',
      'Publish Supabase realtime event to websocket channel',
    ];
    items.forEach((item, index) => {
      setTimeout(() => {
        setAiGeneratedItems((prev) => [...prev, item]);
        if (index === items.length - 1) setAiGenerating(false);
      }, (index + 1) * 350);
    });
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans selection:bg-amber-500 selection:text-black overflow-x-hidden relative">
      
      {/* Dynamic Ambient Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[20%] left-1/4 w-[600px] h-[600px] rounded-full bg-cyan-600/15 blur-[140px] animate-pulse-glow" />
        <div className="absolute top-[10%] -right-[10%] w-[650px] h-[650px] rounded-full bg-amber-500/10 blur-[160px] animate-pulse-glow" style={{ animationDelay: '2.5s' }} />
        <div className="absolute top-[60%] -left-[10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[150px] animate-pulse-glow" style={{ animationDelay: '4s' }} />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* Top Floating Glass Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#07090e]/80 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Universal Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <BrandLogo size="md" showText={true} showVersion={true} glow={true} />
          </Link>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-300">
            <a href="#interactive-board" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
              <span>Interactive Engine</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            </a>
            <a href="#features" className="hover:text-amber-400 transition-colors">Features</a>
            <a href="#security" className="hover:text-amber-400 transition-colors">Security &amp; RLS</a>
            <a href="#analytics" className="hover:text-amber-400 transition-colors">Analytics</a>
          </nav>

          {/* Auth CTA Actions */}
          <div className="flex items-center gap-3 font-mono">
            {session ? (
              <Link
                to="/dashboard"
                className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition active:scale-95"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-lg hover:bg-slate-900/60 transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition active:scale-95"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* =====================================================================
          HERO SECTION: High-Converting Headline + Interactive Iso-Glow Board
          ===================================================================== */}
      <section className="relative z-10 pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          
          {/* Announcement Chip */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-750 text-xs text-slate-300 shadow-xl backdrop-blur-md animate-float">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            <span className="font-semibold text-white">Supabase PostgreSQL 15+ &middot; Multi-Tenant RLS Barrier Active</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </div>

          {/* Main Hero Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08]">
            Where high-velocity engineering teams{' '}
            <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 bg-clip-text text-transparent underline decoration-amber-500/40 decoration-wavy decoration-2">
              ship without friction.
            </span>
          </h1>

          {/* Hero Subtitle */}
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            TeamFlow gives your team an enterprise-ready workspace with verified multi-tenant isolation, 
            smooth drag-and-drop Kanban, AI task breakdowns, and zero-bullshit auditable KPI formulas.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to="/register"
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm transition shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-95 cursor-pointer font-mono"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Launch Workspace Free</span>
            </Link>

            <Link
              to="/board"
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[#0c1018]/90 hover:bg-slate-850 border border-slate-700/80 text-white font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg backdrop-blur-md font-mono"
            >
              <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
              <span>Preview Demo Board</span>
            </Link>
          </div>

          {/* Micro-Features Ticker */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-8 text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Strict RLS Multi-Tenancy</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span>OpenRouter AI Engine</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>WCAG AA Keyboard Kanban</span>
            </div>
          </div>
        </div>

        {/* =====================================================================
            HERO CENTERPIECE: Interactive Isometric Glow Engine (Clean, No Outer Shell, Yellow Only)
            ===================================================================== */}
        <div id="interactive-board" className="mt-12 relative max-w-6xl mx-auto">
          {/* Subtle Amber Glow Backdrop (Yellow Only) */}
          <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-400/15 to-amber-600/20 opacity-60 blur-3xl pointer-events-none" />

          {/* Clean IsoGlow Canvas Container (Zero outer shell box) */}
          <IsoGlowCanvas className="w-full relative" showControls={true} />
        </div>
      </section>

      {/* =====================================================================
          SECTION: Interactive Feature Showcase Tabs (The "Linear-Style" Experience)
          ===================================================================== */}
      <section id="features" className="py-20 border-t border-slate-800/80 bg-[#090c14]/70 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              Interactive Product Tour
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Designed for speed, engineered for scale.
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Explore how TeamFlow handles task breakdowns, multi-tenant boundaries, and real-time sprint execution.
            </p>
          </div>

          {/* Tab Switcher Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800 max-w-2xl mx-auto font-mono text-xs">
            <button
              onClick={() => setActiveTab('board')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${
                activeTab === 'board'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1. Accessible Kanban
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${
                activeTab === 'ai'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2. OpenRouter AI Breakdown
            </button>
            <button
              onClick={() => setActiveTab('tenant')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${
                activeTab === 'tenant'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              3. Multi-Tenant Isolation
            </button>
            <button
              onClick={() => setActiveTab('telemetry')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${
                activeTab === 'telemetry'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              4. Auditable Telemetry
            </button>
          </div>

          {/* Tab Content 1: Accessible Kanban */}
          {activeTab === 'board' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-5">
                <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
                  WCAG AA Compliant &middot; Full Keyboard Navigation
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  Smooth Drag-and-Drop with Instant Rollback Guarantee.
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Powered by <code className="text-amber-400 font-mono">@dnd-kit</code>, TeamFlow provides fluid column transitions with fractional position ordering and optimistic updates. If the server detects a version conflict or permission violation, the board automatically rolls back with descriptive feedback.
                </p>
                <div className="space-y-3 pt-2 font-mono text-xs text-slate-300">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Keyboard shortcuts: Move tasks using Space, Arrow keys, and dedicated "Move to..." modal</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Optimistic locking with automatic version mismatch conflict handling</span>
                  </div>
                </div>
              </div>

              {/* Graphic Mock */}
              <div className="p-6 rounded-3xl bg-[#0c1018] border border-slate-800 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono text-xs">
                  <span className="font-bold text-slate-300">Move Task Dialog (Keyboard AA)</span>
                  <span className="text-[11px] text-amber-400">Esc to close</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-750 space-y-3 font-mono">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Selected Item:</span>
                    <span className="font-bold text-white">ENG-104 &middot; PostgreSQL RLS Policies</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <button className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-left hover:border-amber-400 transition">
                      &larr; Move to Backlog
                    </button>
                    <button className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-left font-bold">
                      &rarr; Advance to In Review
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  All transitions strictly validate against the state transition table in Document 1 &sect;10.
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 2: OpenRouter AI Breakdown */}
          {activeTab === 'ai' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-5">
                <span className="text-xs font-mono font-bold text-purple-400 uppercase tracking-widest">
                  Supabase Edge Function &middot; Multi-Model Fallback
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  Turn High-Level Objectives Into Actionable Subtasks in 1 Second.
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Our deployed Edge Function connects to the OpenRouter API with automated model fallback (Gemini 2.0 Flash, Llama 3.3 70B, Qwen 2.5, DeepSeek R1). Engineers can click "AI Subtask Breakdown" inside any task to produce clear agile acceptance criteria.
                </p>
                <button
                  onClick={handleTriggerAiBreakdown}
                  disabled={aiGenerating}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs font-mono transition shadow-lg shadow-purple-600/30 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{aiGenerating ? 'Generating with Gemini...' : 'Click to Trigger Live AI Generation'}</span>
                </button>
              </div>

              {/* Interactive AI Preview Box */}
              <div className="p-6 rounded-3xl bg-[#0c1018] border border-purple-500/30 shadow-2xl space-y-4 font-mono">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-white">Prompt: "Setup Tenant Authentication"</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                    openrouter.ai/free
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {aiGeneratedItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 animate-fadeIn"
                    >
                      <CheckSquare className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                  {aiGenerating && (
                    <div className="p-3 text-center text-xs text-purple-400 animate-pulse">
                      Synthesizing agile breakdown...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 3: Multi-Tenant Isolation Simulator */}
          {activeTab === 'tenant' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-5">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">
                  Document 1 &sect;2 &sect;12 &middot; AC-01 Verified
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  Zero Data Leakage Across Organization Boundaries.
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Every request carries an explicit <code className="text-cyan-400 font-mono">org_id</code> scope. Even if an attacker passes foreign UUIDs, Supabase PostgreSQL Row Level Security enforces database-level rejection. Switch between the two seeded tenants below to observe real-time isolation.
                </p>

                {/* Tenant Toggle Simulator */}
                <div className="flex items-center gap-3 font-mono text-xs pt-2">
                  <button
                    onClick={() => setActiveSimTenant('acme')}
                    className={`px-4 py-2.5 rounded-xl font-bold transition-all border ${
                      activeSimTenant === 'acme'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/40 shadow-lg'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Tenant A: Acme Labs
                  </button>

                  <button
                    onClick={() => setActiveSimTenant('brightwave')}
                    className={`px-4 py-2.5 rounded-xl font-bold transition-all border ${
                      activeSimTenant === 'brightwave'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/40 shadow-lg'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Tenant B: BrightWave Studio
                  </button>
                </div>
              </div>

              {/* Real-Time Tenant Isolation Terminal */}
              <div className="p-6 rounded-3xl bg-[#0c1018] border border-cyan-500/30 shadow-2xl space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="font-bold text-white">Active Tenant Security Token</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    RLS Active
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase">Tenant Org Scope:</span>
                    <p className="text-cyan-300 font-bold">
                      {activeSimTenant === 'acme' ? 'Acme Labs (a0000000-0000-0000-0000-000000000001)' : 'BrightWave Studio (b0000000-0000-0000-0000-000000000002)'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase">Visible Projects:</span>
                    <p className="text-slate-200">
                      {activeSimTenant === 'acme' ? 'ENG - NextGen Platform 2.0 (Engineering Workspace)' : 'DES - Brand Identity Refresh (Design Studio Workspace)'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-rose-900/40 text-rose-300 space-y-1">
                    <span className="text-[10px] text-rose-400 uppercase">Attempting Foreign Query to other tenant:</span>
                    <p className="text-[11px]">
                      SELECT * FROM tasks WHERE org_id != current_org &rarr; <span className="font-bold text-white">0 rows returned (SQL 403 Forbidden)</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 4: Auditable Telemetry */}
          {activeTab === 'telemetry' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-5">
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
                  Document 1 &sect;9 &middot; Zero-Denominator Handling
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  Mathematical Truth. No Black-Box Percentages.
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  KPIs match exact formulas defined in specification Document 1 &sect;9. Archived and cancelled tasks are strictly excluded from rates. When denominators are zero, TeamFlow renders "No data" badges instead of deceptive 0% or NaN calculations.
                </p>

                {/* Interactive Slider */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 font-mono">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Simulate Completed Tasks:</span>
                    <span className="text-emerald-400 font-bold">{totalDoneTasks} / {totalEligibleTasks} tasks</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={totalEligibleTasks}
                    value={totalDoneTasks}
                    onChange={(e) => setTotalDoneTasks(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>0 tasks</span>
                    <span>12 tasks</span>
                    <span>24 tasks (100%)</span>
                  </div>
                </div>
              </div>

              {/* Dynamic KPI Dashboard Card */}
              <div className="p-6 rounded-3xl bg-[#0c1018] border border-emerald-500/30 shadow-2xl space-y-4 font-mono">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
                  <span className="font-bold text-white">Live Calculated Sprint KPIs</span>
                  <span className="text-[11px] text-slate-400">UTC Now Engine</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-1 uppercase">Completion Rate</span>
                    <p className="text-2xl font-black text-emerald-400">
                      {totalDoneTasks === 0 ? 'No data' : `${Math.round((totalDoneTasks / totalEligibleTasks) * 100)}%`}
                    </p>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      {totalDoneTasks} Done &divide; {totalEligibleTasks} Eligible
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-1 uppercase">On-Time Rate</span>
                    <p className="text-2xl font-black text-cyan-400">
                      {totalDoneTasks === 0 ? 'No data' : `${Math.min(100, Math.round((onTimeTasks / Math.max(1, totalDoneTasks)) * 100))}%`}
                    </p>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Completed &le; Due Date
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
                  Formula: <code>Done eligible tasks &divide; All eligible tasks</code>. Matches RFC 4180 CSV export.
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          SECTION: Interactive Role-Based Permission Matrix (Doc 1 §8)
          ===================================================================== */}
      <section id="security" className="py-20 border-t border-slate-800/80 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="space-y-10">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                Document 1 &sect;8 Matrix
              </span>
              <h2 className="text-3xl font-black text-white tracking-tight mt-2">
                Enterprise Role-Based Access Control
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-md">
              Permissions are not cosmetic client-side toggles. Every database mutation verifies membership role before executing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
            
            {/* Owner Card */}
            <div className="p-6 rounded-3xl bg-[#0c1018] border border-amber-500/30 space-y-4 shadow-xl relative overflow-hidden group hover:border-amber-500/60 transition-all">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold uppercase text-[10px]">
                  Role: Owner
                </span>
                <Lock className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-white">Full Tenant Sovereignty</h3>
              <ul className="space-y-2 text-slate-300 font-sans text-xs">
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Modify Organization settings &amp; slug</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Manage all memberships &amp; role promotions</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>View all workspaces, projects, &amp; reports</span>
                </li>
                <li className="flex items-center gap-2 text-amber-400">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Guarded by Last-Owner Invariant (FR-ORG-06)</span>
                </li>
              </ul>
            </div>

            {/* Manager Card */}
            <div className="p-6 rounded-3xl bg-[#0c1018] border border-blue-500/30 space-y-4 shadow-xl relative overflow-hidden group hover:border-blue-500/60 transition-all">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 font-bold uppercase text-[10px]">
                  Role: Manager
                </span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <h3 className="text-base font-bold text-white">Sprint &amp; Team Leadership</h3>
              <ul className="space-y-2 text-slate-300 font-sans text-xs">
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Create &amp; archive Workspaces &amp; Teams</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Create projects &amp; assign member rosters</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Reopen cancelled tasks (Doc 1 &sect;10)</span>
                </li>
                <li className="flex items-center gap-2 text-slate-400">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Cannot demote or remove Owners</span>
                </li>
              </ul>
            </div>

            {/* Employee Card */}
            <div className="p-6 rounded-3xl bg-[#0c1018] border border-emerald-500/30 space-y-4 shadow-xl relative overflow-hidden group hover:border-emerald-500/60 transition-all">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold uppercase text-[10px]">
                  Role: Employee
                </span>
                <Building2 className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-white">Focused Task Execution</h3>
              <ul className="space-y-2 text-slate-300 font-sans text-xs">
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Access tasks in joined project rosters</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Move tasks, create subtasks, upload files</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Personal My Work stream &amp; notifications</span>
                </li>
                <li className="flex items-center gap-2 text-slate-400">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Non-joined projects strictly 404 (Hidden)</span>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION: Conversion Launchpad (CTA)
          ===================================================================== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto relative z-10 text-center font-mono">
        <div className="relative p-10 sm:p-14 rounded-3xl bg-gradient-to-b from-[#0f1422] to-[#080b13] border border-amber-500/40 shadow-2xl overflow-hidden">
          
          {/* Ambient center blur */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              Instant Workspace Onboarding
            </span>

            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Ready to elevate your sprint velocity?
            </h2>

            <p className="text-sm text-slate-300 font-sans leading-relaxed">
              Experience the complete multi-tenant system with live PostgreSQL RLS, 
              AI task breakdown, and interactive Kanban boards.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-sm shadow-xl shadow-amber-500/25 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Create Free Organization</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/login"
                className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm transition"
              >
                Sign In to Existing Tenant
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Unified Modern Footer */}
      <footer className="border-t border-slate-800/80 py-10 bg-[#06080d] text-center text-xs font-mono text-slate-500 relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLogo size="sm" showText={true} showVersion={true} glow={false} />

          <div className="flex items-center gap-6 text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              All Systems Operational
            </span>
            <span>PostgreSQL 15+ RLS</span>
            <span>OpenRouter Multi-Model</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
