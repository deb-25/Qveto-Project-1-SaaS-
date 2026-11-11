import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Volume2, VolumeX, RotateCcw, ArrowRight, Zap, Play } from 'lucide-react';

export interface KanbanEngineTask {
  id: string;
  code: string;
  title: string;
  column: 'backlog' | 'in_progress' | 'done';
  priority: 'CRIT' | 'HIGH' | 'MED' | 'DONE';
  assignee: string;
  points: number;
}

const INITIAL_TASKS: KanbanEngineTask[] = [
  { id: 'tsk-104', code: 'TSK-104', title: 'OAuth 2.0 PKCE Auth', column: 'backlog', priority: 'HIGH', assignee: 'Sarah K.', points: 5 },
  { id: 'tsk-105', code: 'TSK-105', title: 'Stripe Multi-Tenant Billing', column: 'backlog', priority: 'MED', assignee: 'Alex M.', points: 3 },
  { id: 'tsk-101', code: 'TSK-101', title: 'Supabase RLS Tenant Barrier', column: 'in_progress', priority: 'CRIT', assignee: 'David L.', points: 8 },
  { id: 'tsk-102', code: 'TSK-102', title: 'Realtime Drag Kanban Engine', column: 'in_progress', priority: 'HIGH', assignee: 'Elena R.', points: 5 },
  { id: 'tsk-098', code: 'TSK-098', title: 'PostgreSQL 15+ Schema Migration', column: 'done', priority: 'DONE', assignee: 'Marcus W.', points: 13 },
  { id: 'tsk-099', code: 'TSK-099', title: 'Audit Trail & Telemetry CI', column: 'done', priority: 'DONE', assignee: 'Chloe T.', points: 8 },
];

// Mathematical Isometric Kernel
const C = Math.cos(Math.PI / 6); // ~0.866025
const S = Math.sin(Math.PI / 6); // 0.5
const OX = 590, OY = 82;

const P = (x: number, y: number, z: number): [number, number] => [
  (x - y) * C + OX,
  (x + y) * S - z + OY,
];

const D = (x: number, y: number, z: number): [number, number] => [
  (x - y) * C,
  (x + y) * S - z,
];

const plane = (
  O: [number, number, number],
  U: [number, number, number],
  V: [number, number, number]
) => {
  const o = P(...O), u = D(...U), v = D(...V);
  return `matrix(${u[0].toFixed(4)} ${u[1].toFixed(4)} ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${o[0].toFixed(2)} ${o[1].toFixed(2)})`;
};

// Local plane projection without global board offsets (for transformed groups)
const localPlane = (
  O: [number, number, number],
  U: [number, number, number],
  V: [number, number, number]
) => {
  const o = D(...O), u = D(...U), v = D(...V);
  return `matrix(${u[0].toFixed(4)} ${u[1].toFixed(4)} ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${o[0].toFixed(2)} ${o[1].toFixed(2)})`;
};

const TOP = (x: number, y: number, z: number) => plane([x, y, z], [1, 0, 0], [0, 1, 0]);
const FRONT = (x: number, y: number, z: number) => plane([x, y, z], [1, 0, 0], [0, 0, -1]);
const SIDE = (x: number, y: number, z: number) => plane([x, y, z], [0, -1, 0], [0, 0, -1]);
const TOP_LOCAL = (lx: number, ly: number, lz: number) => localPlane([lx, ly, lz], [1, 0, 0], [0, 1, 0]);

const pathD = (pts: [number, number, number][]) =>
  'M ' + pts.map((p) => P(...p).map((n) => n.toFixed(1)).join(' ')).join(' L ');

// Three Horizontal Bays (Properly nested inside Main Board Deck)
const BAYS = [
  { id: 'backlog' as const, key: 0, label: '01 BACKLOG', x: 95, y: 395, z: 16, w: 150, d: 245, h: 16 },
  { id: 'in_progress' as const, key: 1, label: '02 IN PROGRESS', x: 245, y: 245, z: 16, w: 150, d: 245, h: 16 },
  { id: 'done' as const, key: 2, label: '03 COMPLETED', x: 395, y: 95, z: 16, w: 150, d: 245, h: 16 },
];

interface IsoGlowCanvasProps {
  className?: string;
  showControls?: boolean;
}

export const IsoGlowCanvas: React.FC<IsoGlowCanvasProps> = ({
  className = '',
  showControls = true,
}) => {
  const [tasks, setTasks] = useState<KanbanEngineTask[]>(INITIAL_TASKS);
  const [dispatchedCount, setDispatchedCount] = useState<number>(42);
  const [activePulse, setActivePulse] = useState<'backlog' | 'in_progress' | 'done' | 'all' | null>('in_progress');
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [lastActionHint, setLastActionHint] = useState<string>('Ready · Click any card to advance it');
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play audio chime
  const playChime = (tone: number) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      const freqs = [659, 880, 1174, 1318];
      const freq = freqs[tone % freqs.length];

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + 0.12);
    } catch {}
  };

  // Pulse animation trigger
  const triggerPulse = (target: 'backlog' | 'in_progress' | 'done' | 'all') => {
    setActivePulse(target);
    window.setTimeout(() => {
      setActivePulse(null);
    }, 600);
  };

  // Move task to next section
  const advanceTask = (taskId: string) => {
    let movedTitle = '';
    let nextStageName = '';

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        movedTitle = t.code;
        if (t.column === 'backlog') {
          nextStageName = 'In Progress';
          triggerPulse('in_progress');
          playChime(1);
          return { ...t, column: 'in_progress', priority: 'HIGH' };
        }
        if (t.column === 'in_progress') {
          nextStageName = 'Completed';
          triggerPulse('done');
          playChime(2);
          return { ...t, column: 'done', priority: 'DONE' };
        }
        // If in done, restart to backlog
        nextStageName = 'Backlog (Recycled)';
        triggerPulse('backlog');
        playChime(0);
        return { ...t, column: 'backlog', priority: 'MED' };
      })
    );

    setDispatchedCount((c) => c + 1);
    setLastActionHint(`Moved ${movedTitle} → ${nextStageName}`);
  };

  // Quick Dispatch: moves the first backlog item or creates a new card
  const handleQuickDispatch = () => {
    const nextBacklog = tasks.find((t) => t.column === 'backlog');
    if (nextBacklog) {
      advanceTask(nextBacklog.id);
    } else {
      // Add a fresh task
      const newId = `tsk-${Date.now().toString().slice(-3)}`;
      const newTask: KanbanEngineTask = {
        id: newId,
        code: `TSK-${Math.floor(106 + Math.random() * 20)}`,
        title: 'Realtime SSE Stream Bus',
        column: 'backlog',
        priority: 'HIGH',
        assignee: 'Dev Bot',
        points: 5,
      };
      setTasks((prev) => [newTask, ...prev.slice(0, 5)]);
      setDispatchedCount((c) => c + 1);
      triggerPulse('backlog');
      playChime(3);
      setLastActionHint(`Dispatched ${newTask.code} into Backlog`);
    }
  };

  // Advance whole sprint wave
  const handleAdvanceSprint = () => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.column === 'in_progress') return { ...t, column: 'done', priority: 'DONE' };
        if (t.column === 'backlog') return { ...t, column: 'in_progress', priority: 'HIGH' };
        return { ...t, column: 'backlog', priority: 'MED' };
      })
    );
    setDispatchedCount((c) => c + 2);
    triggerPulse('all');
    playChime(2);
    setLastActionHint('Wave advance: Backlog → Progress → Done');
  };

  // Reset to initial
  const handleResetSprint = () => {
    setTasks(INITIAL_TASKS);
    triggerPulse('all');
    playChime(0);
    setLastActionHint('Sprint reset to baseline state');
  };

  // Ambient heartbeat
  useEffect(() => {
    const timer = window.setInterval(() => {
      triggerPulse('in_progress');
    }, 4500);
    return () => window.clearInterval(timer);
  }, []);

  // Compute tasks per column
  const backlogTasks = tasks.filter((t) => t.column === 'backlog');
  const inProgressTasks = tasks.filter((t) => t.column === 'in_progress');
  const doneTasks = tasks.filter((t) => t.column === 'done');

  // Compute 2D position for each card
  const getCard2DTransform = (task: KanbanEngineTask) => {
    const colKey = task.column === 'backlog' ? 0 : task.column === 'in_progress' ? 1 : 2;
    const colTasks = task.column === 'backlog' ? backlogTasks : task.column === 'in_progress' ? inProgressTasks : doneTasks;
    const slotIndex = Math.max(0, colTasks.findIndex((t) => t.id === task.id));
    const isHovered = hoveredTaskId === task.id;

    const bay = BAYS[colKey];
    const slotSpacing = 70;
    const cardU = 8;
    const cardV = 30 + (slotIndex % 3) * slotSpacing;
    const cardZ = bay.z + bay.h + 2 + (isHovered ? 10 : 0);

    const [px, py] = P(bay.x + cardU, bay.y + cardV, cardZ);
    return { x: px, y: py, isHovered };
  };

  // Fiber-Optic Bus Paths from Console (x=200..440, y=190) to Bays
  const consoleCenter: [number, number, number] = [320, 190, 20];
  const busBacklogPts: [number, number, number][] = [
    [240, 190, 20],
    [215, 225, 20],
    [170, 365, 20],
    [170, 395, 32],
  ];
  const busProgressPts: [number, number, number][] = [
    consoleCenter,
    [320, 220, 20],
    [320, 245, 32],
  ];
  const busDonePts: [number, number, number][] = [
    [400, 190, 20],
    [425, 215, 20],
    [470, 75, 20],
    [470, 95, 32],
  ];

  const busBacklogD = pathD(busBacklogPts);
  const busProgressD = pathD(busProgressPts);
  const busDoneD = pathD(busDonePts);

  // Card Dimensions in local isometric space
  const CARD_W = 134;
  const CARD_D = 64;
  const CARD_H = 10;

  // Local card faces strictly relative to the translated card origin (NO global offsets)
  const f0 = D(0, CARD_D, 0);
  const f1 = D(CARD_W, CARD_D, 0);
  const f2 = D(CARD_W, CARD_D, CARD_H);
  const f3 = D(0, CARD_D, CARD_H);

  const s0 = D(CARD_W, 0, 0);
  const s1 = D(CARD_W, CARD_D, 0);
  const s2 = D(CARD_W, CARD_D, CARD_H);
  const s3 = D(CARD_W, 0, CARD_H);

  return (
    <div className={`w-full relative select-none ${className}`}>
      {/* Controls Bar (No heavy outer shell - clean floating actions) */}
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-2 font-mono">
          {/* Status Chip */}
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Interactive Sprint Engine
            </span>
            <span className="text-slate-600 hidden sm:inline">&middot;</span>
            <span className="text-xs text-slate-400 hidden sm:inline font-sans">
              Click any task card to move it through the sprint
            </span>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleQuickDispatch}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Dispatch Task</span>
            </button>

            <button
              onClick={handleAdvanceSprint}
              title="Advance entire sprint wave"
              className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-bold transition active:scale-95 flex items-center gap-1 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Advance Wave</span>
            </button>

            <button
              onClick={handleResetSprint}
              title="Reset all tasks to original slots"
              className="p-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-800 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Audio Chimes Enabled' : 'Audio Muted'}
              className={`p-1.5 rounded-xl border transition cursor-pointer ${
                soundEnabled
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-slate-900/90 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Pure SVG Isometric Stage (Seamless, no artificial window shell) */}
      <div className="relative w-full aspect-[16/10] overflow-visible rounded-3xl bg-transparent">
        {/* Soft Ambient Radial Glow (Yellow only) */}
        <div
          className="absolute inset-0 pointer-events-none -z-10"
          style={{
            background: 'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(245, 158, 11, 0.14), transparent 75%)',
          }}
        />

        <svg
          viewBox="0 0 1180 720"
          className="w-full h-full block overflow-visible"
          role="img"
          aria-label="TeamFlow Interactive Isometric Kanban Board"
        >
          <defs>
            {/* Luminous Neon Filters */}
            <filter id="iso-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="iso-bloom" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="7" />
            </filter>

            {/* Linear Gradients (Golden Amber Theme Only) */}
            <linearGradient id="amber-deck" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#182030" />
              <stop offset="100%" stopColor="#0c111a" />
            </linearGradient>

            <linearGradient id="bay-highlight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(245, 158, 11, 0.18)" />
              <stop offset="100%" stopColor="rgba(245, 158, 11, 0.02)" />
            </linearGradient>

            <linearGradient id="crt-screen" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#151b27" />
              <stop offset="100%" stopColor="#0a0e16" />
            </linearGradient>

            <clipPath id="crt-clip">
              <rect x="10" y="8" width="220" height="50" rx="6" />
            </clipPath>
          </defs>

          {/* =================================================================
              1. INDUSTRIAL BASE DECK (Isometric Substrate - Fully Encloses All Bays)
              ================================================================= */}
          <g id="base-substrate">
            {/* Base Plate 3D Block (x=55, y=55, z=0, w=530, d=625, h=16) */}
            <polygon
              points={`${P(55, 680, 0)[0]},${P(55, 680, 0)[1]} ${P(585, 680, 0)[0]},${P(585, 680, 0)[1]} ${P(585, 680, 16)[0]},${P(585, 680, 16)[1]} ${P(55, 680, 16)[0]},${P(55, 680, 16)[1]}`}
              fill="#06090e"
              stroke="#f59e0b"
              strokeWidth="1.2"
              strokeOpacity="0.4"
            />
            <polygon
              points={`${P(585, 55, 0)[0]},${P(585, 55, 0)[1]} ${P(585, 680, 0)[0]},${P(585, 680, 0)[1]} ${P(585, 680, 16)[0]},${P(585, 680, 16)[1]} ${P(585, 55, 16)[0]},${P(585, 55, 16)[1]}`}
              fill="#04060a"
              stroke="#d97706"
              strokeWidth="1.2"
              strokeOpacity="0.3"
            />
            {/* Top Deck Surface */}
            <polygon
              points={`${P(55, 55, 16)[0]},${P(55, 55, 16)[1]} ${P(585, 55, 16)[0]},${P(585, 55, 16)[1]} ${P(585, 680, 16)[0]},${P(585, 680, 16)[1]} ${P(55, 680, 16)[0]},${P(55, 680, 16)[1]}`}
              fill="#0c1018"
              stroke="#f59e0b"
              strokeWidth="1.6"
              strokeOpacity="0.55"
            />

            {/* Perimeter Accent Line inside Top Deck */}
            <g transform={TOP(55, 55, 16)}>
              <rect x="12" y="12" width="506" height="601" rx="10" fill="none" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.25" />
              {/* Corner Hex Studs */}
              {[
                [18, 18],
                [512, 18],
                [18, 607],
                [512, 607],
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="4" fill="#1b2434" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.6" />
              ))}
            </g>
          </g>

          {/* =================================================================
              2. FIBER-OPTIC DATA BUS LINES (With Travelling Yellow Pulses)
              ================================================================= */}
          <g id="fiber-optic-bus">
            {/* Under conduits */}
            <path d={busBacklogD} fill="none" stroke="#05080e" strokeWidth="7" strokeLinecap="round" />
            <path d={busProgressD} fill="none" stroke="#05080e" strokeWidth="7" strokeLinecap="round" />
            <path d={busDoneD} fill="none" stroke="#05080e" strokeWidth="7" strokeLinecap="round" />

            {/* Fiber wire core */}
            <path d={busBacklogD} fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeOpacity="0.75" />
            <path d={busProgressD} fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeOpacity="0.9" />
            <path d={busDoneD} fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeOpacity="0.75" />

            {/* Glowing traveling energy pulses */}
            <path
              d={busBacklogD}
              fill="none"
              stroke="#fef08a"
              strokeWidth="3.2"
              strokeLinecap="round"
              filter="url(#iso-glow)"
              strokeDasharray="40 300"
              className={activePulse === 'backlog' || activePulse === 'all' ? 'animate-pulse' : ''}
              strokeOpacity={activePulse === 'backlog' || activePulse === 'all' ? 1 : 0.35}
            />
            <path
              d={busProgressD}
              fill="none"
              stroke="#fde047"
              strokeWidth="4"
              strokeLinecap="round"
              filter="url(#iso-glow)"
              strokeDasharray="50 300"
              className={activePulse === 'in_progress' || activePulse === 'all' ? 'animate-pulse' : ''}
              strokeOpacity={activePulse === 'in_progress' || activePulse === 'all' ? 1 : 0.4}
            />
            <path
              d={busDoneD}
              fill="none"
              stroke="#fef08a"
              strokeWidth="3.2"
              strokeLinecap="round"
              filter="url(#iso-glow)"
              strokeDasharray="40 300"
              className={activePulse === 'done' || activePulse === 'all' ? 'animate-pulse' : ''}
              strokeOpacity={activePulse === 'done' || activePulse === 'all' ? 1 : 0.35}
            />
          </g>

          {/* =================================================================
              3. REAR CENTER TELEMETRY CONSOLE (Sprint Velocity Monitor)
              ================================================================= */}
          <g id="telemetry-console">
            {/* Front Face: transformed by FRONT(200, 190, 91) - clean depth behind Bay 2 */}
            <g transform={FRONT(200, 190, 91)}>
              {/* Outer CRT Bezel */}
              <rect x="6" y="4" width="228" height="58" rx="8" fill="#0e131d" stroke="#f59e0b" strokeWidth="1.6" />
              {/* Recessed Screen Area */}
              <rect x="10" y="8" width="220" height="50" rx="6" fill="url(#crt-screen)" stroke="#d97706" strokeWidth="1" />

              {/* CRT Content within Clip */}
              <g clipPath="url(#crt-clip)">
                {/* Subtle Amber Screen Grid */}
                {[20, 34, 48].map((gy) => (
                  <line key={gy} x1="12" y1={gy} x2="228" y2={gy} stroke="#f59e0b" strokeWidth="0.4" strokeOpacity="0.18" />
                ))}
                {[55, 110, 165].map((gx) => (
                  <line key={gx} x1={gx} y1="8" x2={gx} y2="58" stroke="#f59e0b" strokeWidth="0.4" strokeOpacity="0.18" />
                ))}

                {/* Golden Burndown Sparkline on Right Side */}
                <path
                  d="M 120 35 Q 145 33, 165 22 T 200 15"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="1.8"
                  filter="url(#iso-glow)"
                />
                {/* Glowing Scanning Dot */}
                <circle cx="165" cy="22" r="2.6" fill="#fef08a" filter="url(#iso-glow)" />

                {/* Screen Header */}
                <text x="16" y="21" fontSize="8.5" fontFamily="'JetBrains Mono', monospace" fontWeight="700" fill="#fde68a" letterSpacing="0.08em">
                  SPRINT 14 FLOW TELEMETRY
                </text>

                {/* Hero Velocity Metric */}
                <text x="16" y="36" fontSize="14" fontFamily="'JetBrains Mono', monospace" fontWeight="900" fill="#fbbf24">
                  96.4% <tspan fontSize="9" fontWeight="600" fill="#fde68a">VELOCITY</tspan>
                </text>

                {/* Live Stats Subline */}
                <text x="16" y="48" fontSize="8" fontFamily="'JetBrains Mono', monospace" fill="#94a3b8">
                  {dispatchedCount} Dispatched &middot; {backlogTasks.length} queued &middot; {doneTasks.length} done
                </text>

                {/* Status Indicator Chip */}
                <rect x="166" y="10" width="46" height="11" rx="3" fill="rgba(245,158,11,0.18)" stroke="#f59e0b" strokeWidth="0.8" />
                <text x="189" y="18" textAnchor="middle" fontSize="7" fontFamily="'JetBrains Mono', monospace" fontWeight="800" fill="#fef08a">
                  OPTIMAL
                </text>
              </g>

              {/* Status Diodes Row */}
              {[18, 28, 38, 48].map((lx, idx) => (
                <circle key={idx} cx={lx} cy="55" r="1.6" fill={idx < 3 ? '#fbbf24' : '#78350f'} filter={idx < 3 ? 'url(#iso-glow)' : undefined} />
              ))}
              <text x="224" y="56" textAnchor="end" fontSize="7" fontFamily="'JetBrains Mono', monospace" fontWeight="600" fill="#f59e0b" opacity="0.7">
                FLOW ENGINE v2.4
              </text>
            </g>

            {/* Console Top Surface */}
            <g transform={TOP(200, 115, 91)}>
              <rect x="0" y="0" width="240" height="75" rx="6" fill="#141a27" stroke="#f59e0b" strokeWidth="1.2" strokeOpacity="0.6" />
              {/* Tactical Buttons on Console Deck */}
              <g
                className="cursor-pointer group"
                onClick={handleQuickDispatch}
              >
                <rect x="12" y="14" width="64" height="24" rx="5" fill="#1c2538" stroke="#f59e0b" strokeWidth="1.4" />
                <text x="44" y="30" textAnchor="middle" fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="700" fill="#fbbf24">
                  + DISPATCH
                </text>
              </g>

              <g
                className="cursor-pointer group"
                onClick={handleAdvanceSprint}
              >
                <rect x="84" y="14" width="64" height="24" rx="5" fill="#1c2538" stroke="#f59e0b" strokeWidth="1.4" />
                <text x="116" y="30" textAnchor="middle" fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="700" fill="#fbbf24">
                  ⚡ ADVANCE
                </text>
              </g>

              <g
                className="cursor-pointer group"
                onClick={handleResetSprint}
              >
                <rect x="156" y="14" width="64" height="24" rx="5" fill="#1c2538" stroke="#f59e0b" strokeWidth="1.4" />
                <text x="188" y="30" textAnchor="middle" fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="700" fill="#fbbf24">
                  ↺ RESET
                </text>
              </g>

              {/* Cooling Vents on Deck */}
              {[44, 50, 56, 62].map((vy) => (
                <line key={vy} x1="16" y1={vy} x2="224" y2={vy} stroke="#f59e0b" strokeWidth="1.2" strokeOpacity="0.3" strokeDasharray="6 4" />
              ))}
            </g>
          </g>

          {/* =================================================================
              4. THREE KANBAN BAYS (Backlog, In Progress, Completed)
              ================================================================= */}
          {BAYS.map((b, idx) => {
            const count = idx === 0 ? backlogTasks.length : idx === 1 ? inProgressTasks.length : doneTasks.length;
            const isProgress = idx === 1;

            return (
              <g key={b.id} id={`bay-${b.id}`} className="kanban-bay">
                {/* 3D Tray Walls */}
                {/* Front Wall */}
                <polygon
                  points={`${P(b.x, b.y + b.d, b.z)[0]},${P(b.x, b.y + b.d, b.z)[1]} ${P(b.x + b.w, b.y + b.d, b.z)[0]},${P(b.x + b.w, b.y + b.d, b.z)[1]} ${P(b.x + b.w, b.y + b.d, b.z + b.h)[0]},${P(b.x + b.w, b.y + b.d, b.z + b.h)[1]} ${P(b.x, b.y + b.d, b.z + b.h)[0]},${P(b.x, b.y + b.d, b.z + b.h)[1]}`}
                  fill="#080c14"
                  stroke="#f59e0b"
                  strokeWidth="1.2"
                  strokeOpacity={isProgress ? 0.8 : 0.45}
                />
                {/* Side Wall */}
                <polygon
                  points={`${P(b.x + b.w, b.y, b.z)[0]},${P(b.x + b.w, b.y, b.z)[1]} ${P(b.x + b.w, b.y + b.d, b.z)[0]},${P(b.x + b.w, b.y + b.d, b.z)[1]} ${P(b.x + b.w, b.y + b.d, b.z + b.h)[0]},${P(b.x + b.w, b.y + b.d, b.z + b.h)[1]} ${P(b.x + b.w, b.y, b.z + b.h)[0]},${P(b.x + b.w, b.y, b.z + b.h)[1]}`}
                  fill="#05080f"
                  stroke="#d97706"
                  strokeWidth="1.2"
                  strokeOpacity={isProgress ? 0.7 : 0.4}
                />

                {/* Recessed Bay Deck Surface */}
                <g transform={TOP(b.x, b.y, b.z + b.h)}>
                  {/* Bed Rectangle */}
                  <rect
                    x="2"
                    y="2"
                    width={b.w - 4}
                    height={b.d - 4}
                    rx="8"
                    fill={isProgress ? 'url(#bay-highlight)' : '#0b0f17'}
                    stroke={isProgress ? '#fbbf24' : '#f59e0b'}
                    strokeWidth={isProgress ? '2' : '1.4'}
                    strokeOpacity={isProgress ? 0.95 : 0.55}
                  />

                  {/* Header Title Banner on Tray Bed */}
                  <rect x="6" y="6" width={b.w - 12} height="20" rx="5" fill="#131a28" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.7" />
                  
                  {/* Glowing Status Diode */}
                  <circle
                    cx="15"
                    cy="16"
                    r="3.5"
                    fill={isProgress ? '#fbbf24' : '#f59e0b'}
                    filter={isProgress ? 'url(#iso-glow)' : undefined}
                  />

                  {/* Column Label & Task Count (High-Contrast, Pure Yellow & White) */}
                  <text x="26" y="19" fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="800" fill="#ffffff" letterSpacing="0.04em">
                    {b.label}
                  </text>
                  <text x={b.w - 14} y="19" textAnchor="end" fontSize="10.5" fontFamily="'JetBrains Mono', monospace" fontWeight="700" fill="#fbbf24">
                    {count} {idx === 2 ? 'DONE' : 'TASKS'}
                  </text>

                  {/* Slot Guide Rail Lines */}
                  <line x1="8" y1="30" x2={b.w - 8} y2="30" stroke="#f59e0b" strokeWidth="0.8" strokeOpacity="0.3" />
                  <line x1="8" y1="135" x2={b.w - 8} y2="135" stroke="#f59e0b" strokeWidth="0.8" strokeOpacity="0.25" strokeDasharray="4 4" />
                </g>
              </g>
            );
          })}

          {/* =================================================================
              5. INTERACTIVE TASK CARDS (Real Movement on Click + Hover Lift)
              ================================================================= */}
          <g id="interactive-task-cards">
            {tasks.map((task) => {
              const { x, y, isHovered } = getCard2DTransform(task);
              const isCrit = task.priority === 'CRIT';
              const isDone = task.column === 'done';

              return (
                <g
                  key={task.id}
                  id={`card-${task.id}`}
                  transform={`translate(${x}, ${y})`}
                  style={{
                    transition: 'transform 0.65s cubic-bezier(0.34, 1.4, 0.64, 1), filter 0.25s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setHoveredTaskId(task.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                  onClick={() => advanceTask(task.id)}
                >
                  {/* Subtle 3D Card Hover Shadow */}
                  {isHovered && (
                    <polygon
                      points={`${f0[0]},${f0[1] + 12} ${f1[0]},${f1[1] + 12} ${s1[0]},${s1[1] + 12} ${s0[0]},${s0[1] + 12}`}
                      fill="rgba(0,0,0,0.5)"
                      filter="url(#iso-bloom)"
                    />
                  )}

                  {/* Card 3D Body Faces */}
                  {/* Front Face */}
                  <polygon
                    points={`${f0[0]},${f0[1]} ${f1[0]},${f1[1]} ${f2[0]},${f2[1]} ${f3[0]},${f3[1]}`}
                    fill="#0e131d"
                    stroke="#d97706"
                    strokeWidth="1.2"
                  />
                  {/* Side Face */}
                  <polygon
                    points={`${s0[0]},${s0[1]} ${s1[0]},${s1[1]} ${s2[0]},${s2[1]} ${s3[0]},${s3[1]}`}
                    fill="#090d16"
                    stroke="#b45309"
                    strokeWidth="1.2"
                  />

                  {/* Top Deck of the Task Card (Main Content Surface strictly in local space) */}
                  <g transform={TOP_LOCAL(0, 0, CARD_H)}>
                    {/* Card Surface Deck */}
                    <rect
                      x="0"
                      y="0"
                      width={CARD_W}
                      height={CARD_D}
                      rx="7"
                      fill={isHovered ? '#1c2538' : '#121824'}
                      stroke={isHovered ? '#fef08a' : isCrit ? '#fbbf24' : '#f59e0b'}
                      strokeWidth={isHovered ? '2.2' : '1.3'}
                      filter={isHovered ? 'url(#iso-glow)' : undefined}
                    />

                    {/* Top Header Row: Task Code & Priority Badge */}
                    <text
                      x="8"
                      y="16"
                      fontSize="10.5"
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight="700"
                      fill="#fbbf24"
                    >
                      {task.code}
                    </text>

                    {/* Priority / Status Pill */}
                    <rect
                      x="88"
                      y="6"
                      width="44"
                      height="13"
                      rx="3"
                      fill={isDone ? 'rgba(16,185,129,0.2)' : isCrit ? 'rgba(239,68,68,0.22)' : 'rgba(245,158,11,0.2)'}
                      stroke={isDone ? '#10b981' : isCrit ? '#ef4444' : '#f59e0b'}
                      strokeWidth="0.8"
                    />
                    <text
                      x="110"
                      y="15.5"
                      textAnchor="middle"
                      fontSize="8"
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight="800"
                      fill={isDone ? '#34d399' : isCrit ? '#f87171' : '#fde68a'}
                    >
                      {task.priority}
                    </text>

                    {/* Task Title (White, High-Contrast, Crisp Vector Typography) */}
                    <text
                      x="8"
                      y="30"
                      fontSize="11"
                      fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                      fontWeight="700"
                      fill="#ffffff"
                    >
                      {task.title.length > 20 ? `${task.title.slice(0, 19)}…` : task.title}
                    </text>

                    {/* Assignee & Story Points */}
                    <text
                      x="8"
                      y="43"
                      fontSize="8.5"
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight="500"
                      fill="#fde68a"
                      opacity="0.85"
                    >
                      {task.assignee} &middot; {task.points} pts
                    </text>

                    {/* Interactive Action Prompt Banner (Clear Callout to Click) */}
                    <rect
                      x="6"
                      y="49"
                      width={CARD_W - 12}
                      height="13"
                      rx="3.5"
                      fill={isHovered ? 'rgba(245,158,11,0.28)' : 'rgba(245,158,11,0.1)'}
                      stroke="#f59e0b"
                      strokeWidth="0.6"
                    />
                    <text
                      x={CARD_W / 2}
                      y="58.5"
                      textAnchor="middle"
                      fontSize="7.5"
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight="800"
                      fill={isHovered ? '#fef08a' : '#fbbf24'}
                      letterSpacing="0.04em"
                    >
                      {task.column === 'backlog'
                        ? 'CLICK TO START →'
                        : task.column === 'in_progress'
                        ? 'CLICK TO COMPLETE ✓'
                        : 'CLICK TO RECYCLE ↺'}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Floating Readout Notification (Yellow and crisp) */}
      <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400 px-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-300 font-semibold">{lastActionHint}</span>
        </div>
        <div className="text-[11px] text-slate-500 hidden sm:block">
          Hotkey: Space to dispatch &middot; Click any card to advance
        </div>
      </div>
    </div>
  );
};
