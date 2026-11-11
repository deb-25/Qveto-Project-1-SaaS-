import { frame, slits } from '../IsoEngine';
import { FigureApi } from './deskComputer';

export const OfficeTowerFigure = {
  id: 'tower',
  name: 'Multi-Tenant HQ Tower',
  hint: 'Click floors to toggle active workspace levels · n = cascade shift',
  aria: 'Isometric modernist office tower with 24 floors. Click floors to toggle active workspace levels.',

  css: `
    [data-fig="tower"] .fl { cursor: pointer; }
    [data-fig="tower"] .fl .band { transition: fill .3s; }
    [data-fig="tower"] .fl:hover .band { stroke: var(--ink-hi); }
    [data-fig="tower"] .pn { fill: var(--recess); stroke: var(--detail); stroke-width: .6; vector-effect: non-scaling-stroke; transition: fill .25s, opacity .25s; }
    [data-fig="tower"] .fl.on .pn { fill: var(--accent); stroke: var(--accent-hi); }
    [data-fig="tower"] .fl.on .pn.hi { fill: var(--accent-hi); }
    [data-fig="tower"] .fl.on .pn.dim { opacity: .45; }
    [data-fig="tower"] .fl.on .pn.off { fill: var(--recess); stroke: var(--detail); }
    [data-fig="tower"] .fl.on .win { filter: url(#soft); }
    [data-fig="tower"] .fl.on .halo { opacity: .38; }
    [data-fig="tower"] .cur { fill: none; stroke: var(--accent-hi); stroke-width: 1.6; vector-effect: non-scaling-stroke; opacity: 0; pointer-events: none; }
    [data-fig="tower"] .fl.cursor .cur { opacity: 1; filter: url(#soft); }
    [data-fig="tower"] .beacon { fill: var(--accent-hi); animation: tower-blink 1.4s steps(1) infinite; }
    [data-fig="tower"] .beacon-halo { fill: var(--accent); opacity: .5; animation: tower-blink 1.4s steps(1) infinite; }
    [data-fig="tower"] .mast { fill: none; stroke: var(--line); stroke-width: 1.2; vector-effect: non-scaling-stroke; }
    [data-fig="tower"] .lobby-glass { fill: var(--glass); stroke: var(--line); stroke-width: 1; vector-effect: non-scaling-stroke; transition: fill .4s, stroke .4s; }
    [data-fig="tower"].lit .lobby-glass { fill: var(--accent); stroke: var(--accent-hi); opacity: .85; }
    @keyframes tower-blink { 0% { opacity: 1; } 45% { opacity: .08; } }
  `,

  mount(stage: SVGSVGElement, api: FigureApi) {
    const K = frame(
      [
        [0, 180, 0],
        [210, 0, 7],
        [210, 180, 0],
        [0, 0, 7],
        [104, 72, 340],
        [50, 114, 205],
        [160, 34, 205],
      ],
      0.06
    );

    const { TOP, FRONT, SIDE, box } = K;
    const PZ = 7,
      FH = 9,
      NF = 24;
    const SH = { x: 50, y: 34, w: 110, d: 80, z: 25 };
    const SB = { x: 58, y: 42, w: 94, d: 64, z: 205 };
    const MC = { x: 64, y: 48, w: 82, d: 52, z: 241, h: 14 };

    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const variant = () => {
      const r = rnd();
      return r < 0.1 ? ' off' : r < 0.27 ? ' dim' : r < 0.4 ? ' hi' : '';
    };

    function panes(w: number, n: number) {
      const pitch = w / n,
        pw = pitch - 1.6;
      let s = '';
      for (let i = 0; i < n; i++)
        s += `<rect class="pn${variant()}" x="${(i * pitch + 0.8).toFixed(
          2
        )}" y="1.6" width="${pw.toFixed(2)}" height="${FH - 3.4}"/>`;
      return s;
    }

    function floor(i: number) {
      const B = i <= 20 ? SH : SB;
      const zTop = i <= 20 ? SH.z + i * FH : SB.z + (i - 20) * FH;
      const zBot = zTop - FH;
      const fx = B.x,
        fy = B.y + B.d,
        sx = B.x + B.w,
        sy = B.y + B.d;
      const nwF = i <= 20 ? 11 : 9,
        nwS = i <= 20 ? 8 : 6;

      let s = `<g class="fl fl-${i}" data-floor="${i}">`;
      s += `<g transform="${FRONT(fx, fy, zTop)}">
        <rect class="band" x="0" y="0" width="${B.w}" height="${FH}" fill="var(--deck)" stroke="var(--line)"/>
        <rect class="halo" x="2" y="1" width="${B.w - 4}" height="${FH - 2}" filter="url(#bloom)"/>
        <g class="win">${panes(B.w, nwF)}</g>
        <rect class="cur" x="0" y="0" width="${B.w}" height="${FH}"/>
      </g>`;
      s += `<g transform="${SIDE(sx, sy, zTop)}">
        <rect class="band" x="0" y="0" width="${B.d}" height="${FH}" fill="var(--body)" stroke="var(--line)"/>
        <g class="win">${panes(B.d, nwS)}</g>
      </g>`;
      s += `</g>`;
      return s;
    }

    let svg = box(0, 0, 0, 210, 180, PZ, 12);
    // Plaza details
    svg += `<g transform="${TOP(0, 0, PZ)}">
      <rect class="detail" x="12" y="12" width="186" height="156" rx="8"/>
      <rect class="face recess" x="24" y="24" width="28" height="28" rx="4"/>
    </g>`;

    // Lobby
    svg += box(54, 38, PZ, 102, 72, 18, 4);
    svg += `<g transform="${FRONT(54, 110, 25)}">
      <rect class="lobby-glass" x="10" y="2" width="82" height="14" rx="2"/>
    </g>`;

    // Shaft floors
    for (let i = 1; i <= NF; i++) {
      svg += floor(i);
    }

    // Mechanical crown
    svg += box(MC.x, MC.y, MC.z, MC.w, MC.d, MC.h, 4);
    svg += `<g transform="${FRONT(MC.x, MC.y + MC.d, MC.z + MC.h)}">
      ${slits(4, MC.w - 4, 3.2, 2, MC.h - 2)}
    </g>`;

    // Spire & beacon
    svg += box(100, 68, 255, 8, 8, 10, 2);
    svg += `<line class="mast" x1="104" y1="72" x2="104" y2="335"/>`;
    svg += `<g transform="${FRONT(104, 72, 335)}">
      <circle class="beacon-halo" cx="0" cy="0" r="12" filter="url(#bloom)"/>
      <circle class="beacon" cx="0" cy="0" r="3.2"/>
    </g>`;

    stage.setAttribute('viewBox', K.viewBox);
    stage.innerHTML = svg;

    // Floor state
    const on = new Set([2, 5, 6, 9, 12, 14, 18, 21, 23]);
    let cursor = 12;

    function render() {
      for (let i = 1; i <= NF; i++) {
        const el = stage.querySelector(`.fl-${i}`);
        if (el) {
          el.classList.toggle('on', on.has(i));
          el.classList.toggle('cursor', i === cursor);
        }
      }
      api.power(on.size > 0);
      api.readout(`HQ Tower · ${on.size} of 24 workspace floors active`);
    }

    const handleClick = (e: MouseEvent) => {
      const fl = (e.target as Element).closest('.fl') as HTMLElement | null;
      if (fl) {
        const id = parseInt(fl.dataset.floor || '0', 10);
        if (on.has(id)) on.delete(id);
        else on.add(id);
        cursor = id;
        render();
      }
    };

    stage.addEventListener('click', handleClick);
    render();

    return {
      key: (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
          cursor = Math.min(NF, cursor + 1);
          render();
        } else if (e.key === 'ArrowDown') {
          cursor = Math.max(1, cursor - 1);
          render();
        } else if (e.key === ' ' || e.key === 'Enter') {
          if (on.has(cursor)) on.delete(cursor);
          else on.add(cursor);
          render();
        } else if (e.key === 'n') {
          // Night cascade
          for (let i = 1; i <= NF; i++) {
            api.after(i * 45, () => {
              on.add(i);
              render();
            });
          }
        }
      },
      unmount: () => {
        stage.removeEventListener('click', handleClick);
      },
    };
  },
};
