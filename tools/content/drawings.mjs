// What the content tools share: where things live and the one file format every drawing uses.
// check-workouts.mjs enforces the format's rules.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_FILE = path.join(ROOT, 'app', 'data', 'workouts.json');
export const ART_DIR = path.join(ROOT, 'app', 'art');
export const MAP_FILE = path.join(ROOT, 'tools', 'content', 'art-map.json');
export const ICON_FILE = path.join(ART_DIR, 'app-icon.svg');

export const CANVAS = 512;
export const VIEW_BOX = `0 0 ${CANVAS} ${CANVAS}`;

export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** A drawing file: one or more shapes, each filled with the colour the app gives it. */
export function drawingSvg(pathData) {
  const shapes = [].concat(pathData).map((d) => `<path fill="currentColor" fill-rule="evenodd" d="${d}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}">${shapes.join('')}</svg>\n`;
}

/** The path data of every <path> in a drawing file. */
export function pathDataOf(svgText) {
  return [...svgText.matchAll(/<path\b[^>]*?\sd="([^"]*)"/g)].map((m) => m[1]);
}

export const frameFile = (exerciseId, frame) => path.join(ART_DIR, exerciseId, `${frame}.svg`);

/** Reads `--name value` and `--flag` arguments into an object. */
export function readArgs(argv, known) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const name = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !(name in known)) {
      throw new Error(`Unknown argument "${argv[i]}". Known: ${Object.keys(known).map((k) => `--${k}`).join(', ')}`);
    }
    if (known[name] === 'flag') {
      args[name] = true;
    } else {
      i += 1;
      if (argv[i] === undefined) throw new Error(`--${name} needs a value`);
      args[name] = argv[i];
    }
  }
  return args;
}
