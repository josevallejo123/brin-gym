// Builds a contact sheet of every frame of every exercise, in the app's colours and at the
// sizes the app uses, and renders it to PNGs so each drawing can be looked at.
//
//   node tools/content/contact-sheet.mjs
//   node tools/content/contact-sheet.mjs --large 264 --small 104
//   node tools/content/contact-sheet.mjs --only goblet-squat,superman --out some/folder
//
// The colours and the small size come from app/css/tokens.css unless --fg, --bg or --small
// say otherwise. The large size is the player's drawing on a 390-point-wide iPhone.
// Writes sheet.html (everything on one page) and sheet-01.png, sheet-02.png, ... into --out.
// With --only the names start with "only" instead, and the full sheet is left alone.
// Rendering uses Playwright's own command line through npx: the project's copy when it is
// installed, otherwise the version named by --playwright. --no-render skips the PNGs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { DATA_FILE, ICON_FILE, MAP_FILE, ROOT, VIEW_BOX, frameFile, pathDataOf, readArgs, readJson } from './drawings.mjs';
import { measureInk, parsePath } from './svg-path.mjs';
import { readTokens } from '../app/tokens.mjs';

const tokens = readTokens();
const REM_PX = 16;

const DEFAULTS = {
  out: path.join(ROOT, 'test-results', 'contact-sheet'),
  fg: tokens.get('--color-drawing'),
  bg: tokens.get('--color-bg'),
  large: 342,
  small: Number.parseFloat(tokens.get('--still-size')) * REM_PX,
  'per-image': 3,
  playwright: '1.64',
};
const GAP = 16;
const PAGE_PADDING = 24;
const RENDER_JOBS = 4;

const args = {
  ...DEFAULTS,
  ...readArgs(process.argv.slice(2), {
    out: 'value',
    fg: 'value',
    bg: 'value',
    large: 'value',
    small: 'value',
    'per-image': 'value',
    playwright: 'value',
    only: 'value',
    'no-render': 'flag',
  }),
};
const large = Number(args.large);
const small = Number(args.small);
const perImage = Number(args['per-image']);
const outDir = path.resolve(args.out);
const contentWidth = 4 * large + 3 * GAP;

const data = readJson(DATA_FILE);
const map = readJson(MAP_FILE);
const only = args.only ? new Set(args.only.split(',')) : null;
const prefix = only ? 'only' : 'sheet';
const ids = Object.keys(data.exercises).filter((id) => !only || only.has(id));

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inlineSvg(shapes, size) {
  const paths = shapes.map((d) => `<path fill="currentColor" fill-rule="evenodd" d="${d}"/>`).join('');
  return `<svg viewBox="${VIEW_BOX}" width="${size}" height="${size}" aria-hidden="true">${paths}</svg>`;
}

// "3" for a plain source frame, "3*" for one with clean-up options, "reverse-lunge/3*" for a borrowed one.
function describeFrame(frame) {
  if (typeof frame !== 'object') return String(frame);
  return `${frame.slug ? `${frame.slug}/` : ''}${frame.from}*`;
}

function exerciseBlock(id) {
  const exercise = data.exercises[id];
  const entry = map.exercises[id];
  const frames = [];
  for (let n = 1; n <= exercise.frames; n += 1) {
    const file = frameFile(id, n);
    const shapes = fs.existsSync(file) ? pathDataOf(fs.readFileSync(file, 'utf8')) : [];
    const weight = shapes.length ? measureInk(shapes.flatMap((d) => parsePath(d))).weight : 0;
    frames.push({ n, shapes, weight });
  }
  const role = (n) => (n === 1 ? 'start' : n === exercise.frames ? 'finish' : 'middle');
  const largeCells = frames
    .map(
      (f) => `<figure>${inlineSvg(f.shapes, large)}<figcaption>${f.n} · ${role(f.n)}${
        f.n === exercise.still ? ' · still' : ''
      } · weight ${f.weight.toFixed(1)}</figcaption></figure>`,
    )
    .join('');
  const overlay = `<figure><div class="overlay">${frames
    .map((f) => inlineSvg(f.shapes, large))
    .join('')}</div><figcaption>all frames overlaid</figcaption></figure>`;
  const smallCells = frames
    .map((f) => `<span class="${f.n === exercise.still ? 'small is-still' : 'small'}">${inlineSvg(f.shapes, small)}</span>`)
    .join('');
  const still = frames.find((f) => f.n === exercise.still);
  const from = entry
    ? `${entry.source} ${entry.slug}, frames ${entry.frames.map(describeFrame).join(' ')}`
    : 'not in art-map.json';
  return `<section>
  <header>
    <div><h2>${escapeHtml(exercise.name)}</h2><p>${id} · from ${escapeHtml(from)}</p></div>
    <div class="smalls">${smallCells}</div>
    <div class="list-row">${still ? inlineSvg(still.shapes, small) : ''}<span>${escapeHtml(exercise.name)}</span></div>
  </header>
  <div class="row">${largeCells}${overlay}</div>
</section>`;
}

function iconBlock() {
  if (!fs.existsSync(ICON_FILE)) return '';
  const shapes = pathDataOf(fs.readFileSync(ICON_FILE, 'utf8'));
  const tile = (size) => `<span class="icon-tile" style="width:${size}px;height:${size}px">${inlineSvg(shapes, size)}</span>`;
  return `<section>
  <header><div><h2>Home Screen icon</h2><p>app-icon.svg · the dashed square is the middle 60%</p></div></header>
  <div class="row"><figure><span class="icon-guide">${inlineSvg(shapes, large)}</span><figcaption>on the canvas</figcaption></figure>
  <figure>${tile(180)}<figcaption>180 px, rounded like an iPhone icon</figcaption></figure>
  <figure>${tile(60)}<figcaption>60 px</figcaption></figure></div>
</section>`;
}

function page(blocks, title) {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; padding: ${PAGE_PADDING}px; width: ${contentWidth}px; background: ${args.bg}; color: ${args.fg}; font: 14px/1.4 system-ui, sans-serif; }
  section { margin: 0 0 28px; }
  header { display: flex; align-items: center; gap: 24px; margin: 0 0 8px; min-height: ${small + 8}px; }
  h2 { margin: 0; font-size: 20px; font-weight: 600; }
  p, figcaption { margin: 4px 0 0; font-size: 13px; opacity: 0.7; }
  .row { display: flex; gap: ${GAP}px; align-items: flex-start; }
  figure { margin: 0; }
  svg { display: block; }
  figure > svg, .overlay, .icon-guide { outline: 1px solid ${args.fg}22; }
  .overlay { position: relative; width: ${large}px; height: ${large}px; }
  .overlay svg { position: absolute; inset: 0; opacity: 0.45; }
  .smalls { display: flex; gap: 12px; margin-left: auto; }
  .small { padding-bottom: 2px; border-bottom: 2px solid transparent; }
  .small.is-still { border-bottom-color: ${args.fg}; }
  .list-row { display: flex; align-items: center; gap: 12px; width: 300px; font-size: 15px; }
  .icon-guide { position: relative; display: block; }
  .icon-guide::after { content: ""; position: absolute; inset: 20%; border: 1px dashed ${args.fg}88; }
  .icon-tile { display: block; border-radius: 22.5%; background: ${args.bg}; outline: 1px solid ${args.fg}44; overflow: hidden; }
</style>
${blocks.join('\n')}
</html>
`;
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const quoted = [command, ...commandArgs.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a))].join(' ');
    const child = spawn(quoted, { shell: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${quoted}\n${stderr.trim()}`))));
  });
}

async function render(jobs) {
  const local = fs.existsSync(path.join(ROOT, 'node_modules', 'playwright', 'package.json'));
  const runner = local ? ['playwright'] : ['-y', `playwright@${args.playwright}`];
  const queue = [...jobs];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      await run('npx', [
        ...runner,
        'screenshot',
        '--full-page',
        `--viewport-size=${contentWidth + 2 * PAGE_PADDING},600`,
        pathToFileURL(job.html).href,
        job.png,
      ]);
    }
  };
  await Promise.all(Array.from({ length: RENDER_JOBS }, worker));
}

fs.mkdirSync(outDir, { recursive: true });
const blocks = ids.map(exerciseBlock);
const icon = only ? '' : iconBlock();
fs.writeFileSync(path.join(outDir, `${prefix}.html`), page([...blocks, icon], 'Brin Gym drawings'));

const jobs = [];
if (!args['no-render']) {
  for (const name of fs.readdirSync(outDir)) {
    if (name.startsWith(`${prefix}-`) && name.endsWith('.png')) fs.rmSync(path.join(outDir, name));
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contact-sheet-'));
  const groups = [];
  for (let i = 0; i < blocks.length; i += perImage) groups.push(blocks.slice(i, i + perImage));
  if (icon) groups.push([icon]);
  groups.forEach((group, index) => {
    const number = String(index + 1).padStart(2, '0');
    const html = path.join(tempDir, `${prefix}-${number}.html`);
    fs.writeFileSync(html, page(group, `Brin Gym drawings ${number}`));
    jobs.push({ html, png: path.join(outDir, `${prefix}-${number}.png`) });
  });
  await render(jobs);
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log(`contact-sheet: ${ids.length} exercises, ${prefix}.html and ${jobs.length} images in ${path.relative(ROOT, outDir)}`);
