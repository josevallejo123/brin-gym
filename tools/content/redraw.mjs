// Redraws a frame at one line weight. Plain Node, no packages.
//
// The source set's frames were traced at different times and come out thin, heavy or as
// double lines. This module paints a frame onto a fine grid, measures how far every point is
// from the edge of the ink, closes double lines into one, grows or shrinks the ink to the
// wanted weight, and traces the result back into a path.
//
// Everything here works in canvas units; `perUnit` is how many grid cells one unit gets.

import { flatten } from './svg-path.mjs';

const FAR = 1e20;
const OUTSIDE = -1e6;

/**
 * Paints closed polylines (canvas units) onto a size×size grid.
 * fillRule is "evenodd" or "nonzero", as in SVG.
 */
function rasterize(lines, canvas, perUnit, fillRule = 'evenodd') {
  const size = canvas * perUnit;
  const mask = new Uint8Array(size * size);
  const rows = Array.from({ length: size }, () => []);
  for (const line of lines) {
    for (let k = 1; k < line.length; k += 1) {
      let x0 = line[k - 1][0] * perUnit;
      let y0 = line[k - 1][1] * perUnit;
      let x1 = line[k][0] * perUnit;
      let y1 = line[k][1] * perUnit;
      if (y0 === y1) continue;
      const direction = y0 < y1 ? 1 : -1;
      if (y0 > y1) [x0, y0, x1, y1] = [x1, y1, x0, y0];
      const first = Math.max(0, Math.ceil(y0 - 0.5));
      const last = Math.min(size - 1, Math.ceil(y1 - 0.5) - 1);
      for (let row = first; row <= last; row += 1) {
        rows[row].push([x0 + ((row + 0.5 - y0) / (y1 - y0)) * (x1 - x0), direction]);
      }
    }
  }
  const fillSpan = (row, fromX, toX) => {
    const from = Math.max(0, Math.ceil(fromX - 0.5));
    const to = Math.min(size - 1, Math.ceil(toX - 0.5) - 1);
    if (to >= from) mask.fill(1, row * size + from, row * size + to + 1);
  };
  for (let row = 0; row < size; row += 1) {
    const crossings = rows[row].sort((p, q) => p[0] - q[0]);
    let winding = 0;
    for (let k = 0; k < crossings.length - 1; k += 1) {
      winding += fillRule === 'nonzero' ? crossings[k][1] : 1;
      const inside = fillRule === 'nonzero' ? winding !== 0 : winding % 2 === 1;
      if (inside) fillSpan(row, crossings[k][0], crossings[k + 1][0]);
    }
  }
  return mask;
}

/** Paints several shapes, each a list of path segments, onto one grid. */
function paint(shapes, canvas, perUnit, fillRule) {
  let mask = null;
  for (const segments of shapes) {
    const shape = rasterize(flatten(segments), canvas, perUnit, fillRule);
    if (mask) addInk(mask, shape);
    else mask = shape;
  }
  return mask;
}

// One pass of the Felzenszwalb and Huttenlocher squared distance transform.
function distancePass(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q += 1) {
    let s;
    for (;;) {
      const p = v[k];
      s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
      if (s > z[k]) break;
      k -= 1;
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1] < q) k += 1;
    const p = v[k];
    d[q] = (q - p) * (q - p) + f[p];
  }
}

/** For every cell, the distance in cells to the nearest cell whose mask equals `value`. */
function distanceTo(mask, size, value) {
  const out = new Float32Array(size * size);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) f[y] = mask[y * size + x] === value ? 0 : FAR;
    distancePass(f, size, d, v, z);
    for (let y = 0; y < size; y += 1) out[y * size + x] = Math.min(d[y], FAR);
  }
  for (let y = 0; y < size; y += 1) {
    const row = y * size;
    for (let x = 0; x < size; x += 1) f[x] = out[row + x];
    distancePass(f, size, d, v, z);
    for (let x = 0; x < size; x += 1) out[row + x] = Math.sqrt(d[x]);
  }
  return out;
}

/** Depth inside the ink (positive) or distance outside it (negative), in cells, zero on the edge. */
function signedDistance(mask, size) {
  const inside = distanceTo(mask, size, 0);
  const outside = distanceTo(mask, size, 1);
  const field = new Float32Array(size * size);
  for (let i = 0; i < field.length; i += 1) field[i] = mask[i] ? inside[i] - 0.5 : 0.5 - outside[i];
  return { field, inside };
}

function threshold(field, level) {
  const mask = new Uint8Array(field.length);
  for (let i = 0; i < field.length; i += 1) mask[i] = field[i] >= level ? 1 : 0;
  return mask;
}

/**
 * The typical line width in cells: twice the median depth along the middle of the lines.
 * Solid shapes have little middle line for their area, so they barely move the figure.
 */
function typicalWidth(inside, mask, size) {
  const ridge = [];
  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const i = y * size + x;
      if (!mask[i]) continue;
      const here = inside[i];
      if (
        here >= inside[i - 1] &&
        here >= inside[i + 1] &&
        here >= inside[i - size] &&
        here >= inside[i + size] &&
        here >= inside[i - size - 1] &&
        here >= inside[i - size + 1] &&
        here >= inside[i + size - 1] &&
        here >= inside[i + size + 1]
      ) {
        ridge.push(here);
      }
    }
  }
  if (ridge.length === 0) return 0;
  ridge.sort((a, b) => a - b);
  return 2 * ridge[ridge.length >> 1] - 0.5;
}

/**
 * Smooths ragged edges: blurs the ink (three box blurs, close to a Gaussian) and keeps
 * what is still more than half covered. Bumps and notches smaller than the radius go.
 */
function smoothEdges(mask, size, radius) {
  let from = Float32Array.from(mask);
  let to = new Float32Array(mask.length);
  const span = 2 * radius + 1;
  const pass = (step, lineStep) => {
    for (let line = 0; line < size; line += 1) {
      const base = line * lineStep;
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += from[base + Math.min(size - 1, Math.max(0, k)) * step];
      for (let k = 0; k < size; k += 1) {
        to[base + k * step] = sum / span;
        sum += from[base + Math.min(size - 1, k + radius + 1) * step] - from[base + Math.max(0, k - radius) * step];
      }
    }
    [from, to] = [to, from];
  };
  for (let round = 0; round < 3; round += 1) {
    pass(1, size);
    pass(size, 1);
  }
  return threshold(from, 0.5);
}

function soften(field, size) {
  const out = new Float32Array(field.length);
  out.set(field);
  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const i = y * size + x;
      out[i] =
        (field[i - size - 1] + field[i - size] + field[i - size + 1] +
          field[i - 1] + field[i] + field[i + 1] +
          field[i + size - 1] + field[i + size] + field[i + size + 1]) / 9;
    }
  }
  return out;
}

/** Traces where the field crosses `level`: closed loops of [x, y] in cells (marching squares). */
function traceLevel(field, size, level) {
  const at = (x, y) => (x <= 0 || y <= 0 || x >= size - 1 || y >= size - 1 ? OUTSIDE : field[y * size + x] - level);
  const links = new Map();
  const link = (a, b) => {
    if (!links.has(a)) links.set(a, []);
    if (!links.has(b)) links.set(b, []);
    links.get(a).push(b);
    links.get(b).push(a);
  };
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const a = at(x, y);
      const b = at(x + 1, y);
      const c = at(x + 1, y + 1);
      const d = at(x, y + 1);
      const kind = (a >= 0 ? 1 : 0) | (b >= 0 ? 2 : 0) | (c >= 0 ? 4 : 0) | (d >= 0 ? 8 : 0);
      if (kind === 0 || kind === 15) continue;
      const top = 2 * (y * size + x);
      const bottom = 2 * ((y + 1) * size + x);
      const left = top + 1;
      const right = 2 * (y * size + x + 1) + 1;
      const centreInside = a + b + c + d >= 0;
      switch (kind) {
        case 1: case 14: link(left, top); break;
        case 2: case 13: link(top, right); break;
        case 3: case 12: link(left, right); break;
        case 4: case 11: link(right, bottom); break;
        case 6: case 9: link(top, bottom); break;
        case 7: case 8: link(left, bottom); break;
        case 5:
          if (centreInside) { link(top, right); link(left, bottom); } else { link(left, top); link(right, bottom); }
          break;
        default:
          if (centreInside) { link(left, top); link(right, bottom); } else { link(top, right); link(left, bottom); }
      }
    }
  }
  const point = (edge) => {
    const cell = edge >> 1;
    const x = cell % size;
    const y = (cell - x) / size;
    const from = at(x, y);
    const to = edge & 1 ? at(x, y + 1) : at(x + 1, y);
    const t = from / (from - to);
    return edge & 1 ? [x + 0.5, y + 0.5 + t] : [x + 0.5 + t, y + 0.5];
  };
  const loops = [];
  const seen = new Set();
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let previous = -1;
    let current = start;
    while (!seen.has(current)) {
      seen.add(current);
      loop.push(point(current));
      const [first, second] = links.get(current);
      const next = first !== previous ? first : second;
      previous = current;
      current = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function loopArea(loop) {
  let sum = 0;
  for (let k = 0; k < loop.length; k += 1) {
    const [x0, y0] = loop[k];
    const [x1, y1] = loop[(k + 1) % loop.length];
    sum += x0 * y1 - x1 * y0;
  }
  return Math.abs(sum) / 2;
}

// Douglas-Peucker on a closed loop: keeps the points needed to stay within `tolerance`.
function simplifyLoop(loop, tolerance) {
  let far = 0;
  let farDistance = -1;
  for (let k = 1; k < loop.length; k += 1) {
    const distance = Math.hypot(loop[k][0] - loop[0][0], loop[k][1] - loop[0][1]);
    if (distance > farDistance) {
      farDistance = distance;
      far = k;
    }
  }
  const keep = new Uint8Array(loop.length + 1);
  keep[0] = 1;
  keep[far] = 1;
  keep[loop.length] = 1;
  const pointAt = (k) => loop[k % loop.length];
  const stack = [[0, far], [far, loop.length]];
  while (stack.length) {
    const [from, to] = stack.pop();
    const [ax, ay] = pointAt(from);
    const [bx, by] = pointAt(to);
    const length = Math.hypot(bx - ax, by - ay);
    let worst = -1;
    let worstDistance = tolerance;
    for (let k = from + 1; k < to; k += 1) {
      const [px, py] = pointAt(k);
      const distance = length === 0
        ? Math.hypot(px - ax, py - ay)
        : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
      if (distance > worstDistance) {
        worstDistance = distance;
        worst = k;
      }
    }
    if (worst !== -1) {
      keep[worst] = 1;
      stack.push([from, worst], [worst, to]);
    }
  }
  return loop.filter((_, k) => keep[k]);
}

function formatNumber(value) {
  const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '').replace(/^(-?)0\./, '$1.');
  return text === '-0' ? '0' : text;
}

function loopsToPath(loops) {
  const parts = [];
  for (const loop of loops) {
    const rounded = [];
    for (const [x, y] of loop) {
      const rx = Math.round(x * 10);
      const ry = Math.round(y * 10);
      const last = rounded.at(-1);
      if (!last || last[0] !== rx || last[1] !== ry) rounded.push([rx, ry]);
    }
    if (rounded.length < 3) continue;
    let text = `M${formatNumber(rounded[0][0] / 10)} ${formatNumber(rounded[0][1] / 10)}l`;
    for (let k = 1; k < rounded.length; k += 1) {
      const dx = formatNumber((rounded[k][0] - rounded[k - 1][0]) / 10);
      const dy = formatNumber((rounded[k][1] - rounded[k - 1][1]) / 10);
      text += `${k > 1 && !dx.startsWith('-') ? ' ' : ''}${dx}${dy.startsWith('-') ? '' : ' '}${dy}`;
    }
    parts.push(`${text}z`);
  }
  return parts.join('');
}

function clearOutside(mask, region, keepInside) {
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] && (region[i] === 1) !== keepInside) mask[i] = 0;
  }
}

/**
 * Paints a frame and brings it to the wanted line weight. Returns the ink as a grid.
 *   shapes      the frame's shapes, each a list of path segments, at their final size and place
 *   fillRule    "evenodd" or "nonzero", as the source drew them
 *   lineWeight  the wanted line width, in canvas units
 *   erase       closed polylines; ink inside them is removed (equipment the app doesn't show)
 *   keep        closed polylines; ink outside them is removed
 *   close       joins lines closer than about twice this many units (for double-line traces)
 *   smooth      evens out edge bumps and notches smaller than about this many units
 *   grow        units to add to every edge; leave undefined to have it worked out from lineWeight
 */
export function inkMask(shapes, { canvas, perUnit, fillRule, lineWeight, erase, keep, close = 0, smooth = 0, grow }) {
  const size = canvas * perUnit;
  let mask = paint(shapes, canvas, perUnit, fillRule);
  if (erase?.length) clearOutside(mask, rasterize(erase, canvas, perUnit), false);
  if (keep?.length) clearOutside(mask, rasterize(keep, canvas, perUnit), true);
  if (close > 0) {
    const widened = threshold(signedDistance(mask, size).field, -close * perUnit);
    mask = threshold(signedDistance(widened, size).field, close * perUnit);
  }
  if (smooth > 0) mask = smoothEdges(mask, size, Math.max(1, Math.round(smooth * perUnit)));
  const { field, inside } = signedDistance(mask, size);
  const measured = typicalWidth(inside, mask, size) / perUnit;
  const growth = grow ?? (lineWeight - measured) / 2;
  return { mask: threshold(field, -growth * perUnit), measured, growth };
}

/** Adds the ink of `other` to `mask`. */
export function addInk(mask, other) {
  for (let i = 0; i < mask.length; i += 1) mask[i] |= other[i];
}

/** Traces a grid of ink back into path data: straight pieces no further than `tolerance` units from the edge. */
export function traceMask(mask, { canvas, perUnit, tolerance, minArea }) {
  const size = canvas * perUnit;
  const loops = traceLevel(soften(signedDistance(mask, size).field, size), size, 0)
    .filter((loop) => loopArea(loop) >= minArea * perUnit * perUnit)
    .map((loop) => simplifyLoop(loop, tolerance * perUnit).map(([x, y]) => [x / perUnit, y / perUnit]));
  return loopsToPath(loops);
}

/** The box around the ink left after `erase` and `keep`, in canvas units (measured on a coarse grid). */
export function inkBox(shapes, { canvas, fillRule, erase, keep }) {
  const perUnit = 2;
  const size = canvas * perUnit;
  const mask = paint(shapes, canvas, perUnit, fillRule);
  if (erase?.length) clearOutside(mask, rasterize(erase, canvas, perUnit), false);
  if (keep?.length) clearOutside(mask, rasterize(keep, canvas, perUnit), true);
  let minX = size;
  let minY = size;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!mask[y * size + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX: minX / perUnit, minY: minY / perUnit, maxX: (maxX + 1) / perUnit, maxY: (maxY + 1) / perUnit };
}
