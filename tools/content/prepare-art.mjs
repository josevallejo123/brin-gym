// Fills app/art/ from art-map.json: each exercise's frames, numbered in playing order,
// fitted to the canvas, redrawn at one line weight, in the app's colour-neutral file format.
//
//   node tools/content/prepare-art.mjs --sources <folder holding the clones>
//   node tools/content/prepare-art.mjs --sources <folder> --only goblet-squat,frog-pump
//
// <folder> holds one clone per source, in the sub-folder art-map.json names for it ("folder"),
// each checked out at the commit art-map.json records. The clones are read, never run, and
// stay outside this project. The Home Screen icon is drawn by draw-app-icon.mjs, not here.
//
// In art-map.json a frame is the source's name for it (a number, or a word), or an object:
//   { "from": 3 }                   the source frame
//   "slug": "reverse-lunge"         take it from another drawing of the source set
//   "source": "everkinetic"         take it from another source
//   "close": 2, "smooth": 1         join a double-line trace into single lines, then even its edges
//   "grow": -0.5                    set the growth by hand instead of measuring the line weight
//   "erase": [[x, y, x, y, ...]]    areas to remove (source coordinates), each a closed outline
//   "keep": [[x, y, x, y, ...]]     areas to keep; everything else is removed
//   "shift": [dx, dy], "scale": 1.1 move or resize this frame so the figure stays in place
//   "paste": [{ "from": 1, "keep": [...] }]   add part of another frame (same options)

import fs from 'node:fs';
import path from 'node:path';
import {
  ART_DIR,
  CANVAS,
  DATA_FILE,
  MAP_FILE,
  ROOT,
  drawingSvg,
  frameFile,
  pathDataOf,
  readArgs,
  readJson,
} from './drawings.mjs';
import { addInk, inkBox, inkMask, traceMask } from './redraw.mjs';
import { parsePath, rotateScaleAbout, transform } from './svg-path.mjs';

const MAX_FIT_SCALE = 2.5;

// How each source keeps a frame's ink, by the "format" art-map.json gives the source.
const INK_READERS = {
  // One white path on a transparent 512 canvas.
  'white-path': (svg) => {
    const shapes = pathDataOf(svg);
    const expected = svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><path fill="#fff" fill-rule="evenodd" d="');
    return expected && shapes.length === 1 ? shapes : null;
  },
  // Dark line paths in their own group, drawn over white shapes that are left behind.
  'dark-group': (svg) => {
    const group = /<g fill="#333">([\s\S]*?)<\/g>/.exec(svg);
    const shapes = group ? pathDataOf(group[1]) : [];
    return shapes.length ? shapes : null;
  },
};

function fail(message) {
  console.error(`prepare-art: ${message}`);
  process.exit(1);
}

const args = readArgs(process.argv.slice(2), { sources: 'value', only: 'value' });
const map = readJson(MAP_FILE);
const data = readJson(DATA_FILE);
const style = map.style;
const only = args.only ? new Set(args.only.split(',')) : null;

function readSourceShapes(source, slug, frame) {
  if (!args.sources) fail(`${slug} comes from ${source.work}: pass --sources <folder holding the clones>`);
  const file = path.join(args.sources, source.folder, source.file.replace('{slug}', slug).replace('{frame}', frame));
  if (!fs.existsSync(file)) fail(`${source.work} has no frame "${frame}" for ${slug} (${file})`);
  const shapes = INK_READERS[source.format](fs.readFileSync(file, 'utf8'));
  if (!shapes) fail(`${file} is not laid out as this script expects of ${source.work}; look at it before going on`);
  return shapes.map((d) => parsePath(d));
}

// [x, y, x, y, ...] lists from the map, as closed polylines.
function outlines(lists) {
  return (lists ?? []).map((flat) => {
    const line = [];
    for (let i = 0; i < flat.length; i += 2) line.push([flat[i], flat[i + 1]]);
    line.push(line[0]);
    return line;
  });
}

const moveOutlines = (lines, [a, b, c, d, e, f]) =>
  lines.map((line) => line.map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]));

/** One piece of ink: a source frame (or part of one) with its own clean-up options. */
function loadPiece(entry, spec) {
  const options = typeof spec === 'object' ? spec : { from: spec };
  const sourceName = options.source ?? entry.source;
  const source = map.sources[sourceName];
  if (!source) fail(`unknown source "${sourceName}"`);
  const slug = options.slug ?? entry.slug;
  let shapes = readSourceShapes(source, slug, String(options.from));
  let erase = outlines(options.erase);
  let keep = outlines(options.keep);
  if (options.scale || options.shift) {
    const [dx, dy] = options.shift ?? [0, 0];
    const matrix = rotateScaleAbout(0, options.scale ?? 1, CANVAS / 2, CANVAS / 2);
    matrix[4] += dx;
    matrix[5] += dy;
    shapes = shapes.map((segments) => transform(segments, matrix));
    erase = moveOutlines(erase, matrix);
    keep = moveOutlines(keep, matrix);
  }
  return { options, label: `${slug}/${options.from}`, shapes, fillRule: source.fillRule, erase, keep };
}

function fitMatrix(boxes) {
  const minX = Math.min(...boxes.map((b) => b.minX));
  const minY = Math.min(...boxes.map((b) => b.minY));
  const maxX = Math.max(...boxes.map((b) => b.maxX));
  const maxY = Math.max(...boxes.map((b) => b.maxY));
  const room = CANVAS - 2 * style.margin;
  const scale = Math.min(room / (maxX - minX), room / (maxY - minY), MAX_FIT_SCALE);
  return [scale, 0, 0, scale, CANVAS / 2 - (scale * (minX + maxX)) / 2, CANVAS / 2 - (scale * (minY + maxY)) / 2];
}

function redrawExercise(id, entry) {
  const frames = entry.frames.map((spec) => {
    const main = loadPiece(entry, spec);
    const pastes = (main.options.paste ?? []).map((pasteSpec) => loadPiece(entry, pasteSpec));
    return [main, ...pastes];
  });
  const boxes = frames.flat().map((piece) =>
    inkBox(piece.shapes, { canvas: CANVAS, fillRule: piece.fillRule, erase: piece.erase, keep: piece.keep }),
  );
  if (boxes.includes(null)) fail(`${id}: a frame has no ink left after "erase" and "keep"`);
  const fit = fitMatrix(boxes);
  const scale = fit[0];
  const grid = { canvas: CANVAS, perUnit: style.gridPerUnit };

  return frames.map((pieces, index) => {
    let ink = null;
    const notes = [];
    for (const piece of pieces) {
      const { mask, measured, growth } = inkMask(piece.shapes.map((segments) => transform(segments, fit)), {
        ...grid,
        fillRule: piece.fillRule,
        lineWeight: style.lineWeight,
        erase: moveOutlines(piece.erase, fit),
        keep: moveOutlines(piece.keep, fit),
        close: (piece.options.close ?? 0) * scale,
        smooth: (piece.options.smooth ?? 0) * scale,
        grow: piece.options.grow,
      });
      if (ink) addInk(ink, mask);
      else ink = mask;
      notes.push(`${piece.label} ${measured.toFixed(1)}${growth >= 0 ? '+' : ''}${growth.toFixed(2)}`);
    }
    const d = traceMask(ink, { ...grid, tolerance: style.tolerance, minArea: style.minSpeck });
    console.log(`  ${id} ${index + 1}: ${notes.join(' + ')}  x${scale.toFixed(2)}  ${(d.length / 1024).toFixed(0)} KB`);
    return [d];
  });
}

const mapped = Object.keys(map.exercises);
const defined = Object.keys(data.exercises);
const unmapped = defined.filter((id) => !(id in map.exercises));
const unknown = mapped.filter((id) => !(id in data.exercises));
if (unmapped.length) fail(`art-map.json has no entry for: ${unmapped.join(', ')}`);
if (unknown.length) fail(`art-map.json maps exercises that workouts.json doesn't define: ${unknown.join(', ')}`);

let written = 0;
for (const [id, entry] of Object.entries(map.exercises)) {
  if (only && !only.has(id)) continue;
  if (!Array.isArray(entry.frames) || (entry.frames.length !== 2 && entry.frames.length !== 3)) {
    fail(`${id}: "frames" must list two or three frames, in playing order`);
  }
  const shapes = redrawExercise(id, entry);

  const folder = path.join(ART_DIR, id);
  fs.mkdirSync(folder, { recursive: true });
  const keep = new Set();
  shapes.forEach((frameShapes, index) => {
    const file = frameFile(id, index + 1);
    fs.writeFileSync(file, drawingSvg(frameShapes));
    keep.add(path.basename(file));
    written += 1;
  });
  for (const name of fs.readdirSync(folder)) {
    if (!keep.has(name)) fs.rmSync(path.join(folder, name));
  }
}

const drift = [];
for (const [id, entry] of Object.entries(map.exercises)) {
  const exercise = data.exercises[id];
  if (exercise.frames !== entry.frames.length) {
    drift.push(`${id}: art-map.json keeps ${entry.frames.length} frames, workouts.json says ${exercise.frames}`);
  }
  if (exercise.still !== entry.still) {
    drift.push(`${id}: art-map.json says still ${entry.still}, workouts.json says ${exercise.still}`);
  }
}

console.log(`prepare-art: wrote ${written} files into ${path.relative(ROOT, ART_DIR)}`);
if (drift.length) {
  console.error('prepare-art: set "frames" and "still" in app/data/workouts.json to match art-map.json:');
  for (const line of drift) console.error(`  ${line}`);
  process.exit(1);
}
