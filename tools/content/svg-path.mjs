// Reads, measures and writes SVG path data. Plain Node, no packages.
// Used by the check (where a drawing sits on its canvas), the contact sheet
// (line weight) and the scripts that draw the two files the source set lacks.

const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const COMMANDS = 'MLHVCSQTAZ';
const CURVE_STEPS = 8;

/**
 * Parses path data into absolute segments: M, L, C, Q and Z only.
 * H and V become L, S becomes C, T becomes Q and arcs become C.
 */
export function parsePath(d) {
  const out = [];
  let i = 0;
  let cur = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let lastCtrl = null;

  const skip = () => {
    while (i < d.length && (d.charCodeAt(i) <= 32 || d[i] === ',')) i += 1;
  };
  const num = () => {
    skip();
    NUMBER.lastIndex = i;
    const m = NUMBER.exec(d);
    if (!m) throw new Error(`path data: expected a number at character ${i}`);
    i = NUMBER.lastIndex;
    return Number(m[0]);
  };
  const flag = () => {
    skip();
    const c = d[i];
    if (c !== '0' && c !== '1') throw new Error(`path data: expected an arc flag at character ${i}`);
    i += 1;
    return c === '1';
  };
  const more = () => {
    skip();
    return i < d.length && !/[a-zA-Z]/.test(d[i]);
  };

  skip();
  while (i < d.length) {
    const letter = d[i];
    const upper = letter.toUpperCase();
    if (!COMMANDS.includes(upper)) throw new Error(`path data: unknown command "${letter}" at character ${i}`);
    i += 1;
    const rel = letter !== upper;

    if (upper === 'Z') {
      out.push({ cmd: 'Z' });
      cur = { ...start };
      lastCtrl = null;
      skip();
      continue;
    }

    let first = true;
    do {
      const type = upper === 'M' && !first ? 'L' : upper;
      const ox = rel ? cur.x : 0;
      const oy = rel ? cur.y : 0;
      let ctrl = null;
      if (type === 'M') {
        cur = { x: num() + ox, y: num() + oy };
        start = { ...cur };
        out.push({ cmd: 'M', ...cur });
      } else if (type === 'L') {
        cur = { x: num() + ox, y: num() + oy };
        out.push({ cmd: 'L', ...cur });
      } else if (type === 'H') {
        cur = { x: num() + ox, y: cur.y };
        out.push({ cmd: 'L', ...cur });
      } else if (type === 'V') {
        cur = { x: cur.x, y: num() + oy };
        out.push({ cmd: 'L', ...cur });
      } else if (type === 'C' || type === 'S') {
        let x1;
        let y1;
        if (type === 'C') {
          x1 = num() + ox;
          y1 = num() + oy;
        } else {
          x1 = lastCtrl?.kind === 'C' ? 2 * cur.x - lastCtrl.x : cur.x;
          y1 = lastCtrl?.kind === 'C' ? 2 * cur.y - lastCtrl.y : cur.y;
        }
        const x2 = num() + ox;
        const y2 = num() + oy;
        cur = { x: num() + ox, y: num() + oy };
        out.push({ cmd: 'C', x1, y1, x2, y2, ...cur });
        ctrl = { kind: 'C', x: x2, y: y2 };
      } else if (type === 'Q' || type === 'T') {
        let x1;
        let y1;
        if (type === 'Q') {
          x1 = num() + ox;
          y1 = num() + oy;
        } else {
          x1 = lastCtrl?.kind === 'Q' ? 2 * cur.x - lastCtrl.x : cur.x;
          y1 = lastCtrl?.kind === 'Q' ? 2 * cur.y - lastCtrl.y : cur.y;
        }
        cur = { x: num() + ox, y: num() + oy };
        out.push({ cmd: 'Q', x1, y1, ...cur });
        ctrl = { kind: 'Q', x: x1, y: y1 };
      } else {
        const rx = num();
        const ry = num();
        const rotation = num();
        const large = flag();
        const sweep = flag();
        const end = { x: num() + ox, y: num() + oy };
        out.push(...arcToCubics(cur, rx, ry, rotation, large, sweep, end));
        cur = end;
      }
      lastCtrl = ctrl;
      first = false;
    } while (more());
    skip();
  }
  return out;
}

// The endpoint-to-centre conversion from the SVG specification's implementation notes.
function arcToCubics(p0, rxIn, ryIn, rotationDegrees, large, sweep, p1) {
  if (p0.x === p1.x && p0.y === p1.y) return [];
  if (rxIn === 0 || ryIn === 0) return [{ cmd: 'L', x: p1.x, y: p1.y }];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  const phi = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (p0.x - p1.x) / 2;
  const dy = (p0.y - p1.y) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let factor = Math.sqrt(Math.max(0, numerator / denominator));
  if (large === sweep) factor = -factor;
  const cxp = (factor * rx * y1p) / ry;
  const cyp = (-factor * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (p0.x + p1.x) / 2;
  const cy = sin * cxp + cos * cyp + (p0.y + p1.y) / 2;
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const theta = angle(1, 0, ux, uy);
  let sweepAngle = angle(ux, uy, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI;
  if (sweep && sweepAngle < 0) sweepAngle += 2 * Math.PI;

  const pieces = Math.max(1, Math.ceil(Math.abs(sweepAngle) / (Math.PI / 2) - 1e-9));
  const step = sweepAngle / pieces;
  const handle = (4 / 3) * Math.tan(step / 4);
  const at = (a) => {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    return {
      x: cx + rx * ca * cos - ry * sa * sin,
      y: cy + rx * ca * sin + ry * sa * cos,
      dx: -rx * sa * cos - ry * ca * sin,
      dy: -rx * sa * sin + ry * ca * cos,
    };
  };
  const curves = [];
  for (let k = 0; k < pieces; k += 1) {
    const a = at(theta + k * step);
    const b = k === pieces - 1 ? { ...at(theta + (k + 1) * step), x: p1.x, y: p1.y } : at(theta + (k + 1) * step);
    curves.push({
      cmd: 'C',
      x1: a.x + handle * a.dx,
      y1: a.y + handle * a.dy,
      x2: b.x - handle * b.dx,
      y2: b.y - handle * b.dy,
      x: b.x,
      y: b.y,
    });
  }
  return curves;
}

/**
 * Turns segments into closed polylines: one list of [x, y] points per subpath.
 * Every subpath is closed, as a fill treats it, whether or not it ends with Z.
 */
export function flatten(segments, steps = CURVE_STEPS) {
  const lines = flattenOpen(segments, steps);
  for (const line of lines) {
    const [x0, y0] = line[0];
    const [xn, yn] = line.at(-1);
    if (x0 !== xn || y0 !== yn) line.push([x0, y0]);
  }
  return lines;
}

function flattenOpen(segments, steps) {
  const lines = [];
  let line = null;
  let cur = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  for (const seg of segments) {
    if (seg.cmd === 'M') {
      line = [[seg.x, seg.y]];
      lines.push(line);
      start = { x: seg.x, y: seg.y };
    } else if (seg.cmd === 'Z') {
      line?.push([start.x, start.y]);
      cur = { ...start };
      continue;
    } else if (seg.cmd === 'L') {
      line.push([seg.x, seg.y]);
    } else {
      for (let k = 1; k <= steps; k += 1) {
        const t = k / steps;
        const u = 1 - t;
        if (seg.cmd === 'C') {
          line.push([
            u * u * u * cur.x + 3 * u * u * t * seg.x1 + 3 * u * t * t * seg.x2 + t * t * t * seg.x,
            u * u * u * cur.y + 3 * u * u * t * seg.y1 + 3 * u * t * t * seg.y2 + t * t * t * seg.y,
          ]);
        } else {
          line.push([
            u * u * cur.x + 2 * u * t * seg.x1 + t * t * seg.x,
            u * u * cur.y + 2 * u * t * seg.y1 + t * t * seg.y,
          ]);
        }
      }
    }
    cur = { x: seg.x, y: seg.y };
  }
  return lines;
}

/** The box that holds every point of the drawing. */
export function boundingBox(segments) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const line of flatten(segments)) {
    for (const [x, y] of line) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Inked area (even-odd rule), outline length, and the line weight they imply.
 * A drawn line of width w and length n has area w·n and outline 2n, so w = 2·area ÷ outline.
 * Solid shapes push the figure up, so compare it between frames of one exercise, not across the set.
 */
export function measureInk(segments, canvas = 512) {
  const lines = flatten(segments);
  let outline = 0;
  const edges = [];
  for (const line of lines) {
    for (let k = 1; k < line.length; k += 1) {
      const [x0, y0] = line[k - 1];
      const [x1, y1] = line[k];
      outline += Math.hypot(x1 - x0, y1 - y0);
      if (y0 !== y1) edges.push(y0 < y1 ? [x0, y0, x1, y1] : [x1, y1, x0, y0]);
    }
  }
  let area = 0;
  for (let row = 0; row < canvas; row += 1) {
    const y = row + 0.5;
    const crossings = [];
    for (const [x0, y0, x1, y1] of edges) {
      if (y >= y0 && y < y1) crossings.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
    }
    crossings.sort((a, b) => a - b);
    for (let k = 1; k < crossings.length; k += 2) area += crossings[k] - crossings[k - 1];
  }
  return { area, outline, weight: outline > 0 ? (2 * area) / outline : 0 };
}

/** Applies the matrix [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export function transform(segments, [a, b, c, d, e, f]) {
  const px = (x, y) => a * x + c * y + e;
  const py = (x, y) => b * x + d * y + f;
  return segments.map((seg) => {
    if (seg.cmd === 'Z') return seg;
    const next = { cmd: seg.cmd, x: px(seg.x, seg.y), y: py(seg.x, seg.y) };
    if ('x1' in seg) {
      next.x1 = px(seg.x1, seg.y1);
      next.y1 = py(seg.x1, seg.y1);
    }
    if ('x2' in seg) {
      next.x2 = px(seg.x2, seg.y2);
      next.y2 = py(seg.x2, seg.y2);
    }
    return next;
  });
}

export const translate = (dx, dy) => [1, 0, 0, 1, dx, dy];

/** A turn of `degrees` (clockwise on screen) and a scale of `factor`, both about the point (cx, cy). */
export function rotateScaleAbout(degrees, factor, cx, cy) {
  const r = (degrees * Math.PI) / 180;
  const a = factor * Math.cos(r);
  const b = factor * Math.sin(r);
  return [a, b, -b, a, cx - a * cx + b * cy, cy - b * cx - a * cy];
}

/** Writes segments back as path data with a fixed number of decimals. */
export function serializePath(segments, decimals = 2) {
  const n = (v) => {
    const s = v.toFixed(decimals);
    const trimmed = s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
    return trimmed === '-0' ? '0' : trimmed;
  };
  return segments
    .map((seg) => {
      if (seg.cmd === 'Z') return 'Z';
      if (seg.cmd === 'C') return `C${n(seg.x1)} ${n(seg.y1)} ${n(seg.x2)} ${n(seg.y2)} ${n(seg.x)} ${n(seg.y)}`;
      if (seg.cmd === 'Q') return `Q${n(seg.x1)} ${n(seg.y1)} ${n(seg.x)} ${n(seg.y)}`;
      return `${seg.cmd}${n(seg.x)} ${n(seg.y)}`;
    })
    .join('');
}
