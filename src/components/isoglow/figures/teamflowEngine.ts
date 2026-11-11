import { frame, slits } from '../IsoEngine';
import { FigureApi } from './deskComputer';

/**
 * Bespoke TeamFlow Sprint Dispatcher & Agile Flow Engine
 * Designed specifically for TeamFlow Project Management SaaS.
 * Features:
 * - 3 Isometric Kanban Status Bays: [Backlog], [In Progress], [Done Vault]
 * - Interactive Task Capsules with priority LED indicators
 * - Central Command Console with CRT Sprint Velocity burndown monitor
 * - Multi-lane Fiber-Optic Bus Lines with traveling light pulses
 * - Tactile Dispatch & Sprint Advance buttons
 */
export const TeamFlowEngineFigure = {
  id: 'teamflow-engine',
  name: 'Sprint Dispatcher & Flow Engine',
  hint: 'Click Kanban bays or Console buttons · Space to dispatch task · 1-3 to select lane',
  aria: 'Interactive isometric TeamFlow Sprint Dispatcher with three Kanban bays, task capsules, velocity telemetry screen, and glowing data bus lines.',

  css: `
    [data-fig="teamflow-engine"] .kanban-bay { cursor: pointer; }
    [data-fig="teamflow-engine"] .kanban-bay:hover .bay-deck { stroke: var(--accent-hi); }
    [data-fig="teamflow-engine"] .kanban-bay.active .bay-deck { stroke: var(--accent); fill: var(--glass-on); }
    [data-fig="teamflow-engine"] .kanban-bay.active .bay-halo { opacity: 0.35; }
    [data-fig="teamflow-engine"] .kanban-bay.active .bay-led { fill: var(--accent); }
    
    [data-fig="teamflow-engine"] .task-card { cursor: pointer; transition: transform 0.25s ease-out; }
    [data-fig="teamflow-engine"] .task-card:hover { transform: translateY(-4px); }
    [data-fig="teamflow-engine"] .task-card.active .face { stroke: var(--accent-hi); }
    
    [data-fig="teamflow-engine"] .console-btn { cursor: pointer; transition: transform 60ms ease-out; }
    [data-fig="teamflow-engine"] .console-btn:hover .face.top { stroke: var(--ink-hi); }
    [data-fig="teamflow-engine"] .console-btn.down { transform: translateY(3px); }
    
    [data-fig="teamflow-engine"] .crt-glass { fill: var(--glass-on); stroke: var(--accent); }
    [data-fig="teamflow-engine"] .scope-line { fill: none; stroke: var(--accent-hi); stroke-width: 1.4; filter: url(#soft); }
    [data-fig="teamflow-engine"] .scan-dot { fill: var(--accent-hi); animation: scanBlink 1.2s ease-in-out infinite alternate; }
    @keyframes scanBlink { 0% { opacity: 0.3; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1.3); } }
  `,

  mount(stage: SVGSVGElement, api: FigureApi) {
    // 3D Bounding Envelope for isometric framing
    const K = frame(
      [
        [0, 260, 0],
        [320, 0, 8],
        [320, 260, 0],
        [0, 0, 8],
        [40, 30, 160],
        [280, 30, 160],
        [160, 240, 30],
      ],
      0.08,
      16 / 10
    );

    const { TOP, FRONT, SIDE, box, path } = K;

    // Dimensions
    const BASE_W = 310, BASE_D = 240, BASE_H = 8;
    
    // Command Console (Rear Center)
    const CC_X = 75, CC_Y = 20, CC_Z = BASE_H, CC_W = 160, CC_D = 65, CC_H = 75;
    
    // 3 Kanban Bays (Front Layout)
    const BAY_Y = 110, BAY_D = 115, BAY_H = 10;
    const BAY1_X = 20, BAY1_W = 80;   // Backlog
    const BAY2_X = 115, BAY2_W = 80;  // In Progress
    const BAY3_X = 210, BAY3_W = 80;  // Done Vault

    let svg = `<defs>
      <clipPath id="scope-clip"><rect x="12" y="10" width="136" height="42" rx="6"/></clipPath>
    </defs>`;

    // 1. Heavy Industrial Base Plate
    svg += box(0, 0, 0, BASE_W, BASE_D, BASE_H, 12);
    svg += `<g transform="${TOP(0, 0, BASE_H)}">
      <rect class="detail" x="10" y="10" width="${BASE_W - 20}" height="${BASE_D - 20}" rx="8"/>
      ${[
        [16, 16], [BASE_W - 16, 16], [16, BASE_D - 16], [BASE_W - 16, BASE_D - 16],
        [BASE_W / 2, 16], [BASE_W / 2, BASE_D - 16]
      ].map(([x, y]) => `
        <circle class="face recess" cx="${x}" cy="${y}" r="2.8"/>
        <line class="detail" x1="${x - 1.6}" y1="${y}" x2="${x + 1.6}" y2="${y}"/>
      `).join('')}
      <!-- Ground bus track -->
      <line class="detail" x1="20" y1="98" x2="${BASE_W - 20}" y2="98"/>
    </g>`;

    // 2. Command Console (Rear Unit)
    svg += box(CC_X, CC_Y, CC_Z, CC_W, CC_D, CC_H, 8);
    // Console Top Slits & Exhaust
    svg += `<g transform="${TOP(CC_X, CC_Y, CC_Z + CC_H)}">
      <rect class="face recess" x="15" y="8" width="${CC_W - 30}" height="18" rx="4"/>
      ${slits(22, CC_W - 22, 4.5, 12, 22, false)}
    </g>`;

    // Console Front Interface Plane: CRT Scope & Telemetry
    svg += `<g transform="${FRONT(CC_X, CC_Y + CC_D, CC_Z + CC_H)}">
      <!-- Outer Display Frame -->
      <rect class="face" x="8" y="6" width="${CC_W - 16}" height="50" rx="7"/>
      <rect class="face recess" x="10" y="8" width="${CC_W - 20}" height="46" rx="6"/>
      <rect class="bay-halo" x="12" y="10" width="${CC_W - 24}" height="42" rx="6" filter="url(#bloom)"/>
      <rect class="crt-glass glass" x="12" y="10" width="${CC_W - 24}" height="42" rx="6" filter="url(#soft)"/>
      
      <!-- Telemetry Monitor Graphics inside clip -->
      <g clip-path="url(#scope-clip)">
        <!-- Grid lines inside CRT -->
        ${[18, 28, 38].map(y => `<line class="detail" stroke-opacity="0.3" x1="12" y1="${y}" x2="${CC_W - 12}" y2="${y}"/>`).join('')}
        ${[35, 60, 85, 110, 135].map(x => `<line class="detail" stroke-opacity="0.3" x1="${x}" y1="10" x2="${x}" y2="52"/>`).join('')}
        
        <!-- Sprint Burndown Curve -->
        <path class="scope-line" d="M 18 18 Q 45 20, 65 32 T 105 38 T 138 46"/>
        <!-- Scanner Dot -->
        <circle class="scan-dot" cx="105" cy="38" r="2.2" filter="url(#glow)"/>
        
        <!-- Header text on screen -->
        <text class="scr" x="16" y="20" font-size="5" font-weight="bold">SPRINT 14 BURNDOWN</text>
        <text class="scr-accent" x="16" y="27" font-size="4.2">VELOCITY: 94.2% &middot; 42/48 PTS</text>
        <text class="scr" x="16" y="48" font-size="4">STATUS: ON TRACK</text>
      </g>

      <!-- Lower Controls Deck on Front Plane -->
      <rect class="face recess" x="10" y="58" width="${CC_W - 20}" height="14" rx="3"/>
      <!-- Status Diodes -->
      ${[20, 32, 44, 56, 68].map((x, i) => `
        <circle class="bay-led led ${i < 3 ? 'hot' : ''}" cx="${x}" cy="65" r="2" filter="url(#soft)"/>
      `).join('')}
      <text class="label" x="80" y="66" font-size="4.5" fill="var(--ink)">TEAMFLOW DISPATCHER v2</text>
    </g>`;

    // 3. Tactile Command Buttons on Deck
    const BTN_Y = CC_Y + CC_D + 8;
    const buttons = [
      { id: 'btn-dispatch', x: 85, label: 'DISPATCH', w: 40 },
      { id: 'btn-cycle', x: 135, label: 'ADVANCE', w: 40 },
      { id: 'btn-pulse', x: 185, label: 'PULSE BUS', w: 40 },
    ];

    buttons.forEach(btn => {
      svg += `<g class="console-btn" id="${btn.id}">
        ${box(btn.x, BTN_Y, BASE_H, btn.w, 14, 5, 2)}
        <g transform="${TOP(btn.x, BTN_Y, BASE_H + 5)}">
          <text class="label" x="${btn.w / 2}" y="9.5" text-anchor="middle" font-size="3.8" font-weight="bold" fill="var(--ink-hi)">
            ${btn.label}
          </text>
        </g>
      </g>`;
    });

    // 4. Three Kanban Bays
    const bays = [
      { id: 'bay-backlog', x: BAY1_X, w: BAY1_W, label: '01 BACKLOG', count: '5 TASKS' },
      { id: 'bay-progress', x: BAY2_X, w: BAY2_W, label: '02 IN PROGRESS', count: '3 ACTIVE' },
      { id: 'bay-done', x: BAY3_X, w: BAY3_W, label: '03 COMPLETED', count: '14 DONE' },
    ];

    bays.forEach((b, idx) => {
      svg += `<g class="kanban-bay ${idx === 1 ? 'active' : ''}" id="${b.id}" data-bay="${idx}">`;
      svg += box(b.x, BAY_Y, BASE_H, b.w, BAY_D, BAY_H, 6);
      
      // Top tray recessed bed
      svg += `<g transform="${TOP(b.x, BAY_Y, BASE_H + BAY_H)}">
        <rect class="bay-deck face recess" x="4" y="4" width="${b.w - 8}" height="${BAY_D - 8}" rx="4"/>
        <rect class="bay-halo" x="4" y="4" width="${b.w - 8}" height="${BAY_D - 8}" rx="4" filter="url(#bloom)"/>
        <!-- Header Banner on Tray Bed -->
        <rect class="face" x="6" y="7" width="${b.w - 12}" height="14" rx="2.5"/>
        <circle class="bay-led led ${idx === 1 ? 'hot' : ''}" cx="13" cy="14" r="2" filter="url(#soft)"/>
        <text class="scr-accent" x="20" y="15.5" font-size="4.5" font-weight="bold">${b.label}</text>
        <text class="label" x="${b.w - 12}" y="15.5" text-anchor="end" font-size="4" fill="var(--ink)">${b.count}</text>
      </g>`;

      // Front Face Accent Strip
      svg += `<g transform="${FRONT(b.x, BAY_Y + BAY_D, BASE_H + BAY_H)}">
        <rect class="detail" x="4" y="2" width="${b.w - 8}" height="${BAY_H - 4}" rx="1"/>
      </g>`;
      svg += `</g>`;
    });

    // 5. Task Cards resting inside Bays
    const taskCards = [
      // In Bay 1 (Backlog)
      { id: 'card-1', x: BAY1_X + 8, y: BAY_Y + 28, w: BAY1_W - 16, d: 24, h: 5, title: 'TSK-104 &middot; SSO OAuth', priority: 'HIGH' },
      { id: 'card-2', x: BAY1_X + 8, y: BAY_Y + 58, w: BAY1_W - 16, d: 24, h: 5, title: 'TSK-105 &middot; Webhooks', priority: 'MED' },
      // In Bay 2 (In Progress - Elevated & Glowing)
      { id: 'card-3', x: BAY2_X + 8, y: BAY_Y + 28, w: BAY2_W - 16, d: 24, h: 6, title: 'TSK-101 &middot; Supabase RLS', priority: 'CRIT', active: true },
      { id: 'card-4', x: BAY2_X + 8, y: BAY_Y + 58, w: BAY2_W - 16, d: 24, h: 6, title: 'TSK-102 &middot; Kanban Drag', priority: 'HIGH', active: true },
      // In Bay 3 (Done)
      { id: 'card-5', x: BAY3_X + 8, y: BAY_Y + 28, w: BAY3_W - 16, d: 24, h: 5, title: 'TSK-098 &middot; DB Schema', priority: 'DONE' },
      { id: 'card-6', x: BAY3_X + 8, y: BAY_Y + 58, w: BAY3_W - 16, d: 24, h: 5, title: 'TSK-099 &middot; Vercel Config', priority: 'DONE' },
    ];

    taskCards.forEach(c => {
      const cardZ = BASE_H + BAY_H + 1;
      svg += `<g class="task-card ${c.active ? 'active' : ''}" id="${c.id}">
        ${box(c.x, c.y, cardZ, c.w, c.d, c.h, 3)}
        <g transform="${TOP(c.x, c.y, cardZ + c.h)}">
          <text class="scr-accent" x="8" y="10" font-size="3.8" font-weight="bold">${c.title}</text>
          <text class="label" x="8" y="17" font-size="3.2" fill="var(--ink)">ASSIGN: DEV &middot; PR-41</text>
          <rect class="${c.active ? 'bay-led hot' : 'face'}" x="${c.w - 16}" y="6" width="10" height="4" rx="1.5" filter="url(#soft)"/>
        </g>
      </g>`;
    });

    // 6. Connecting Fiber-Optic Bus Lines (Curves from Console to Bays)
    // Left Line: Console -> Bay 1
    const busLine1: [number, number, number][] = [
      [CC_X + 20, CC_Y + CC_D, BASE_H + 4],
      [CC_X + 10, CC_Y + CC_D + 20, BASE_H + 4],
      [BAY1_X + BAY1_W / 2, BAY_Y - 12, BASE_H + 4],
      [BAY1_X + BAY1_W / 2, BAY_Y, BASE_H + BAY_H],
    ];
    // Center Line: Console -> Bay 2
    const busLine2: [number, number, number][] = [
      [CC_X + CC_W / 2, CC_Y + CC_D, BASE_H + 4],
      [CC_X + CC_W / 2, BAY_Y - 10, BASE_H + 4],
      [BAY2_X + BAY2_W / 2, BAY_Y, BASE_H + BAY_H],
    ];
    // Right Line: Console -> Bay 3
    const busLine3: [number, number, number][] = [
      [CC_X + CC_W - 20, CC_Y + CC_D, BASE_H + 4],
      [CC_X + CC_W - 10, CC_Y + CC_D + 20, BASE_H + 4],
      [BAY3_X + BAY3_W / 2, BAY_Y - 12, BASE_H + 4],
      [BAY3_X + BAY3_W / 2, BAY_Y, BASE_H + BAY_H],
    ];

    const d1 = path(busLine1);
    const d2 = path(busLine2);
    const d3 = path(busLine3);

    svg += `<g id="bus-lines">
      <!-- Under-wires -->
      <path class="wire-under" d="${d1}"/><path class="wire hot" filter="url(#soft)" d="${d1}"/>
      <path class="pulse p1" filter="url(#glow)" pathLength="1000" d="${d1}"/>

      <path class="wire-under" d="${d2}"/><path class="wire hot" filter="url(#soft)" d="${d2}"/>
      <path class="pulse p2" filter="url(#glow)" pathLength="1000" d="${d2}"/>

      <path class="wire-under" d="${d3}"/><path class="wire hot" filter="url(#soft)" d="${d3}"/>
      <path class="pulse p3" filter="url(#glow)" pathLength="1000" d="${d3}"/>
    </g>`;

    stage.setAttribute('viewBox', K.viewBox);
    stage.innerHTML = svg;

    // Interactive State & Event Handlers
    let activeBay = 1; // 0 = backlog, 1 = progress, 2 = done
    let dispatchedCount = 42;

    function render() {
      api.power(true);
      const bayEls = stage.querySelectorAll('.kanban-bay');
      bayEls.forEach((el, i) => {
        el.classList.toggle('active', i === activeBay);
      });

      const names = ['01 Backlog', '02 In Progress', '03 Completed Vault'];
      api.readout(`Bay: ${names[activeBay]} &middot; ${dispatchedCount} tasks dispatched &middot; Bus: Live`);
    }

    const firePulse = (selector = '.pulse') => {
      stage.querySelectorAll(selector).forEach(el => api.replay(el, 'go'));
    };

    const dispatchTask = () => {
      dispatchedCount++;
      activeBay = (activeBay + 1) % 3;
      firePulse('.pulse');
      render();
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      
      // Bay click
      const bay = target.closest('.kanban-bay') as HTMLElement | null;
      if (bay) {
        activeBay = parseInt(bay.dataset.bay || '0', 10);
        firePulse(`.p${activeBay + 1}`);
        render();
        return;
      }

      // Button clicks
      if (target.closest('#btn-dispatch')) {
        api.flash(stage.querySelector('#btn-dispatch')!);
        dispatchTask();
        return;
      }
      if (target.closest('#btn-cycle')) {
        api.flash(stage.querySelector('#btn-cycle')!);
        activeBay = (activeBay + 1) % 3;
        firePulse();
        render();
        return;
      }
      if (target.closest('#btn-pulse')) {
        api.flash(stage.querySelector('#btn-pulse')!);
        firePulse();
        return;
      }

      // Task card click
      const card = target.closest('.task-card');
      if (card) {
        api.flash(card);
        firePulse();
      }
    };

    stage.addEventListener('click', handleClick);
    render();

    // Trigger initial welcoming light pulse
    api.after(300, () => firePulse());

    // Ambient heartbeat pulse so the engine stays lively and reactive
    const pulseInterval = window.setInterval(() => {
      firePulse(`.p${activeBay + 1}`);
    }, 3800);

    return {
      key: (e: KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Enter') {
          dispatchTask();
          return true;
        }
        if (e.key === '1') { activeBay = 0; firePulse('.p1'); render(); return true; }
        if (e.key === '2') { activeBay = 1; firePulse('.p2'); render(); return true; }
        if (e.key === '3') { activeBay = 2; firePulse('.p3'); render(); return true; }
        if (e.key === 'p') { firePulse(); return true; }
        return false;
      },
      unmount: () => {
        window.clearInterval(pulseInterval);
        stage.removeEventListener('click', handleClick);
      },
    };
  },
};
