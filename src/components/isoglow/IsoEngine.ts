// Isometric projection kernel adapted from iso-figure & iso-glow
export const C = Math.cos(Math.PI / 6);
export const S = Math.sin(Math.PI / 6);

export interface IsoFrame {
  C: number;
  S: number;
  P: (x: number, y: number, z: number) => [number, number];
  D: (x: number, y: number, z: number) => [number, number];
  plane: (O: [number, number, number], U: [number, number, number], V: [number, number, number]) => string;
  TOP: (x: number, y: number, z: number) => string;
  FRONT: (x: number, y: number, z: number) => string;
  SIDE: (x: number, y: number, z: number) => string;
  rect: (t: string, w: number, h: number, r?: number, cls?: string) => string;
  box: (x: number, y: number, z: number, w: number, d: number, h: number, r?: number) => string;
  boxc: (x: number, y: number, z: number, w: number, d: number, h: number, r: number, cls: string) => string;
  path: (pts: [number, number, number][]) => string;
  viewBox: string;
  W: number;
  H: number;
}

export function kernel(OX: number, OY: number) {
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
    return `matrix(${u[0]} ${u[1]} ${v[0]} ${v[1]} ${o[0]} ${o[1]})`;
  };
  const TOP = (x: number, y: number, z: number) => plane([x, y, z], [1, 0, 0], [0, 1, 0]);
  const FRONT = (x: number, y: number, z: number) => plane([x, y, z], [1, 0, 0], [0, 0, -1]);
  const SIDE = (x: number, y: number, z: number) => plane([x, y, z], [0, -1, 0], [0, 0, -1]);

  const rect = (t: string, w: number, h: number, r = 0, cls = 'face') =>
    `<g transform="${t}"><rect class="${cls}" width="${w}" height="${h}" rx="${r}"/></g>`;

  const rounded = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    r: number,
    cls: string
  ) => {
    r = Math.min(r, w / 2, d / 2);
    const n = 10, z1 = z + h, q = Math.PI / 4, H = Math.PI / 2, c = cls ? ' ' + cls : '';
    const arc = (cx: number, cy: number, a0: number, a1: number) => {
      const o: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      return o;
    };
    const ring = [
      ...arc(x + w - r, y + r, -H, 0),
      ...arc(x + w - r, y + d - r, 0, H),
      ...arc(x + r, y + d - r, H, 2 * H),
      ...arc(x + r, y + r, 2 * H, 3 * H),
    ];
    const vis = [
      ...arc(x + w - r, y + r, -q, 0),
      ...arc(x + w - r, y + d - r, 0, H),
      ...arc(x + r, y + d - r, H, 3 * q),
    ];
    const d3 = (pts: [number, number, number][]) =>
      'M' + pts.map((p) => P(...p).map((v) => v.toFixed(2)).join(' ')).join('L') + 'Z';
    const wall: [number, number, number][] = [
      ...vis.map(([a, b]) => [a, b, z] as [number, number, number]),
      ...vis.slice().reverse().map(([a, b]) => [a, b, z1] as [number, number, number]),
    ];
    return `<path class="face${c}" d="${d3(wall)}"/><path class="face top${c}" d="${d3(ring.map(([a, b]) => [a, b, z1] as [number, number, number]))}"/>`;
  };

  const box = (x: number, y: number, z: number, w: number, d: number, h: number, r = 0) =>
    r > 0
      ? rounded(x, y, z, w, d, h, r, '')
      : rect(SIDE(x + w, y + d, z + h), d, h) +
        rect(FRONT(x, y + d, z + h), w, h) +
        rect(TOP(x, y, z + h), w, d, 0, 'face top');

  const boxc = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    r: number,
    cls: string
  ) =>
    r > 0
      ? rounded(x, y, z, w, d, h, r, cls)
      : rect(SIDE(x + w, y + d, z + h), d, h, 0, 'face ' + cls) +
        rect(FRONT(x, y + d, z + h), w, h, 0, 'face ' + cls) +
        rect(TOP(x, y, z + h), w, d, 0, 'face top ' + cls);

  const path = (pts: [number, number, number][]) =>
    'M' + pts.map((p) => P(...p).map((n) => n.toFixed(2)).join(' ')).join('L');

  return { C, S, P, D, plane, TOP, FRONT, SIDE, rect, box, boxc, path };
}

export function frame(
  points: [number, number, number][],
  margin = 0.09,
  aspect = 4 / 3
): IsoFrame {
  const d = points.map(([x, y, z]) => [(x - y) * C, (x + y) * S - z]);
  const x0 = Math.min(...d.map((p) => p[0])), x1 = Math.max(...d.map((p) => p[0]));
  const y0 = Math.min(...d.map((p) => p[1])), y1 = Math.max(...d.map((p) => p[1]));
  const m = margin * Math.max(x1 - x0, y1 - y0);
  let w = x1 - x0 + 2 * m, h = y1 - y0 + 2 * m;
  let ox = m - x0, oy = m - y0;
  if (w / h < aspect) {
    const nw = h * aspect;
    ox += (nw - w) / 2;
    w = nw;
  } else {
    const nh = w / aspect;
    oy += (nh - h) / 2;
    h = nh;
  }
  return {
    ...kernel(ox, oy),
    viewBox: `0 0 ${w.toFixed(1)} ${h.toFixed(1)}`,
    W: w,
    H: h,
  };
}

export const slits = (
  a0: number,
  a1: number,
  step: number,
  b0: number,
  b1: number,
  vertical = true,
  cls = 'detail'
) => {
  let s = '';
  for (let a = a0; a <= a1 + 1e-6; a += step) {
    s += vertical
      ? `<line class="${cls}" x1="${a}" y1="${b0}" x2="${a}" y2="${b1}"/>`
      : `<line class="${cls}" x1="${b0}" y1="${a}" x2="${b1}" y2="${a}"/>`;
  }
  return s;
};
