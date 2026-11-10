// Checks app/data/workouts.json and the drawings in app/art/, then prints each workout's
// on-paper length. Plain Node, no packages. Exits 1 and lists every problem if anything is off.
//
//   node tools/content/check-workouts.mjs      (npm run check)

import fs from 'node:fs';
import path from 'node:path';
import { ART_DIR, CANVAS, DATA_FILE, ICON_FILE, MAP_FILE, ROOT, VIEW_BOX, frameFile } from './drawings.mjs';
import { boundingBox, measureInk, parsePath } from './svg-path.mjs';
import { buildSteps, paperSeconds } from '../../app/js/logic/sequence.js';

const DAYS = [
  ['glutes', 'Glutes'],
  ['legs', 'Legs'],
  ['shoulders-and-triceps', 'Shoulders and triceps'],
  ['back', 'Back'],
];
const VARIATIONS_PER_DAY = 3;
const REST_KEYS = ['betweenSetsSeconds', 'afterSupersetRoundSeconds', 'supersetSwitchSeconds', 'beforeBlockSeconds', 'addRestSeconds'];
const SET_KEYS = ['warmupSets', 'mainSets', 'supersetRounds', 'finisherSets'];
const TOP_KEYS = ['rests', 'sets', 'targetSeconds', 'estimateSecondsPerRep', 'exercises', 'days'];
const VARIATION_KEYS = ['id', 'name', 'main', 'supersetA', 'supersetB', 'finisher'];
const EACH_VALUES = ['side', 'way'];
const CREDIT_KEYS = ['work', 'author', 'url', 'licence', 'licenceUrl', 'changes'];
const ART_FILES = ['app-icon.svg', 'credits.json', 'LICENSE.md'];
const SVG_ATTRIBUTES = ['xmlns', 'viewBox'];
const PATH_ATTRIBUTES = ['fill', 'fill-rule', 'd'];
const ICON_SHARE = 0.6; // the icon stays inside the middle 60% of the square
const MOST_INK = 0.4; // more of the canvas than this filled means a background was painted in
const EDGE_SLACK = 0.5;

const problems = [];
const relative = (file) => path.relative(ROOT, file).replaceAll('\\', '/');
// An ID names a folder of drawings and a part of the app's address, so it is the name
// with everything but letters and digits turned into hyphens: "Step-up onto bench" is
// "step-up-onto-bench". The name itself may hold anything.
const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const isCount = (value) => Number.isInteger(value) && value > 0;
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function sameKeys(value, keys, where, optional = []) {
  if (!isObject(value)) {
    problems.push(`${where} must be an object with ${keys.join(', ')}`);
    return false;
  }
  const missing = keys.filter((key) => !(key in value));
  const extra = Object.keys(value).filter((key) => !keys.includes(key) && !optional.includes(key));
  if (missing.length) problems.push(`${where} is missing ${missing.join(', ')}`);
  if (extra.length) problems.push(`${where} has ${extra.join(', ')}, which the data file's shape doesn't include`);
  return missing.length === 0;
}

function readJsonFile(file) {
  if (!fs.existsSync(file)) {
    problems.push(`${relative(file)} is missing`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    problems.push(`${relative(file)} is not valid JSON: ${error.message}`);
    return null;
  }
}

// ---- the data file ----

function checkSlot(slot, where, exercises, used) {
  if (!sameKeys(slot, ['exercise', 'reps'], where, ['each'])) return;
  if (!(slot.exercise in exercises)) problems.push(`${where} uses "${slot.exercise}", which "exercises" doesn't define`);
  used.add(slot.exercise);
  if (!isCount(slot.reps)) problems.push(`${where}: "reps" must be a whole number above zero`);
  if ('each' in slot && !EACH_VALUES.includes(slot.each)) problems.push(`${where}: "each" must be "side" or "way"`);
}

function checkData(data) {
  if (!sameKeys(data, TOP_KEYS, 'workouts.json')) return false;
  let sound = true;

  if (sameKeys(data.rests, REST_KEYS, '"rests"')) {
    for (const key of REST_KEYS) {
      if (!isCount(data.rests[key])) problems.push(`"rests.${key}" must be a whole number of seconds above zero`);
    }
  } else sound = false;
  if (sameKeys(data.sets, SET_KEYS, '"sets"')) {
    for (const key of SET_KEYS) {
      if (!isCount(data.sets[key])) problems.push(`"sets.${key}" must be a whole number above zero`);
    }
  } else sound = false;
  if (!isCount(data.targetSeconds)) problems.push('"targetSeconds" must be a whole number of seconds above zero');
  if (!(typeof data.estimateSecondsPerRep === 'number' && data.estimateSecondsPerRep > 0)) {
    problems.push('"estimateSecondsPerRep" must be a number above zero');
    sound = false;
  }

  if (!isObject(data.exercises)) {
    problems.push('"exercises" must be an object keyed by exercise ID');
    return false;
  }
  for (const [id, exercise] of Object.entries(data.exercises)) {
    const where = `exercise "${id}"`;
    if (!sameKeys(exercise, ['name', 'frames', 'still'], where)) continue;
    if (typeof exercise.name !== 'string' || exercise.name.trim() === '') {
      problems.push(`${where}: "name" must be the name shown in the app`);
    } else if (slug(exercise.name) !== id) {
      problems.push(`${where}: the ID must be the name in lower case with hyphens ("${slug(exercise.name)}")`);
    }
    if (exercise.frames !== 2 && exercise.frames !== 3) problems.push(`${where}: "frames" must be 2 or 3`);
    if (!Number.isInteger(exercise.still) || exercise.still < 1 || exercise.still > exercise.frames) {
      problems.push(`${where}: "still" must be a frame number from 1 to ${exercise.frames}`);
    }
  }

  if (!Array.isArray(data.days) || data.days.length !== DAYS.length) {
    problems.push(`"days" must list exactly ${DAYS.length} days: ${DAYS.map(([, name]) => name).join(', ')}`);
    return false;
  }
  const used = new Set();
  data.days.forEach((day, dayIndex) => {
    const [id, name] = DAYS[dayIndex];
    if (!sameKeys(day, ['id', 'name', 'variations'], `day ${dayIndex + 1}`)) {
      sound = false;
      return;
    }
    if (day.id !== id || day.name !== name) problems.push(`day ${dayIndex + 1} must be "${id}" named "${name}"`);
    if (!Array.isArray(day.variations) || day.variations.length !== VARIATIONS_PER_DAY) {
      problems.push(`${name} must have exactly ${VARIATIONS_PER_DAY} variations`);
      sound = false;
      return;
    }
    day.variations.forEach((variation, index) => {
      const where = `${name}, variation ${index + 1}`;
      if (!sameKeys(variation, VARIATION_KEYS, where)) {
        sound = false;
        return;
      }
      if (typeof variation.name !== 'string' || slug(variation.name) === '') {
        problems.push(`${where}: "name" must be the name shown in the app`);
      } else if (slug(variation.name) !== variation.id) {
        problems.push(`${where}: the ID must be the name in lower case with hyphens ("${slug(variation.name)}")`);
      }
      checkSlot(variation.main, `${where}, main lift`, data.exercises, used);
      checkSlot(variation.finisher, `${where}, finisher`, data.exercises, used);
      for (const key of ['supersetA', 'supersetB']) {
        const label = key === 'supersetA' ? 'superset A' : 'superset B';
        if (!Array.isArray(variation[key]) || variation[key].length !== 2) {
          problems.push(`${where}, ${label} must be exactly two exercises`);
          sound = false;
          continue;
        }
        variation[key].forEach((slot, slotIndex) => checkSlot(slot, `${where}, ${label}, exercise ${slotIndex + 1}`, data.exercises, used));
      }
    });
    const ids = day.variations.map((variation) => variation.id);
    if (new Set(ids).size !== ids.length) problems.push(`${name}: two variations share an ID`);
  });
  for (const id of Object.keys(data.exercises)) {
    if (!used.has(id)) problems.push(`exercise "${id}" is defined but no workout uses it`);
  }
  return sound;
}

// ---- the drawings ----

function checkDrawing(file, insideShare) {
  const name = relative(file);
  const text = fs.readFileSync(file, 'utf8');
  const tag = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g;
  if (text.replace(tag, '').trim() !== '') {
    problems.push(`${name} holds more than plain shapes (text, a comment, a style or a script)`);
  }
  const shapes = [];
  let roots = 0;
  for (const [, closing, element, attributeText] of text.matchAll(tag)) {
    if (closing) continue;
    const attributes = Object.fromEntries([...attributeText.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    const names = Object.keys(attributes);
    if (element === 'svg') {
      roots += 1;
      if (attributes.viewBox !== VIEW_BOX) problems.push(`${name}: viewBox must be "${VIEW_BOX}"`);
      if (attributes.xmlns !== 'http://www.w3.org/2000/svg') problems.push(`${name}: the svg element needs its xmlns`);
      const extra = names.filter((key) => !SVG_ATTRIBUTES.includes(key));
      if (extra.length) problems.push(`${name}: the svg element has ${extra.join(', ')}; only xmlns and viewBox are allowed`);
    } else if (element === 'path') {
      if (attributes.fill !== 'currentColor') problems.push(`${name}: a shape is not fill="currentColor"`);
      const extra = names.filter((key) => !PATH_ATTRIBUTES.includes(key));
      if (extra.length) problems.push(`${name}: a shape has ${extra.join(', ')}; only fill, fill-rule and d are allowed`);
      if (attributes.d) shapes.push(attributes.d);
      else problems.push(`${name}: a shape has no path data`);
    } else {
      problems.push(`${name} uses <${element}>; a drawing holds only <path> shapes`);
    }
  }
  if (roots !== 1 || !text.startsWith('<svg')) problems.push(`${name} must be a single svg element`);
  if (shapes.length === 0) {
    problems.push(`${name} has no shape in it`);
    return;
  }
  let segments;
  try {
    segments = shapes.flatMap((d) => parsePath(d));
  } catch (error) {
    problems.push(`${name}: ${error.message}`);
    return;
  }
  const box = boundingBox(segments);
  const edge = (CANVAS * (1 - insideShare)) / 2 - EDGE_SLACK;
  if (box.minX < edge || box.minY < edge || box.maxX > CANVAS - edge || box.maxY > CANVAS - edge) {
    problems.push(
      insideShare === 1
        ? `${name} is drawn outside its ${CANVAS} by ${CANVAS} canvas`
        : `${name} must stay inside the middle ${insideShare * 100}% of the square`,
    );
  }
  if (measureInk(segments, CANVAS).area > MOST_INK * CANVAS * CANVAS) {
    problems.push(`${name} is mostly filled in; the background must stay transparent`);
  }
}

function checkArt(exercises) {
  if (!fs.existsSync(ART_DIR)) {
    problems.push(`${relative(ART_DIR)} is missing`);
    return 0;
  }
  let drawings = 0;
  for (const [id, exercise] of Object.entries(exercises)) {
    const folder = path.join(ART_DIR, id);
    if (!fs.existsSync(folder)) {
      problems.push(`${relative(folder)} is missing: "${id}" has no drawing`);
      continue;
    }
    if (exercise.frames !== 2 && exercise.frames !== 3) continue;
    const wanted = Array.from({ length: exercise.frames }, (_, index) => `${index + 1}.svg`);
    const found = fs.readdirSync(folder).sort();
    if (found.join(' ') !== wanted.join(' ')) {
      problems.push(`${relative(folder)} must hold exactly ${wanted.join(', ')}; it holds ${found.join(', ') || 'nothing'}`);
    }
    for (const file of wanted.filter((item) => found.includes(item))) {
      checkDrawing(frameFile(id, Number.parseInt(file, 10)), 1);
      drawings += 1;
    }
  }
  for (const item of fs.readdirSync(ART_DIR, { withFileTypes: true })) {
    if (item.isDirectory() && !(item.name in exercises)) problems.push(`${relative(path.join(ART_DIR, item.name))} belongs to no exercise`);
    if (item.isFile() && !ART_FILES.includes(item.name)) problems.push(`${relative(path.join(ART_DIR, item.name))} is not a file this folder should hold`);
  }
  for (const file of ART_FILES) {
    if (!fs.existsSync(path.join(ART_DIR, file))) problems.push(`${relative(path.join(ART_DIR, file))} is missing`);
  }
  if (fs.existsSync(ICON_FILE)) checkDrawing(ICON_FILE, ICON_SHARE);

  const creditsFile = path.join(ART_DIR, 'credits.json');
  if (fs.existsSync(creditsFile)) {
    const credits = readJsonFile(creditsFile);
    if (credits && (!Array.isArray(credits) || credits.length === 0)) {
      problems.push(`${relative(creditsFile)} must be a list with at least one credit`);
    } else if (credits) {
      credits.forEach((credit, index) => {
        const where = `${relative(creditsFile)}, credit ${index + 1}`;
        if (!sameKeys(credit, CREDIT_KEYS, where)) return;
        for (const key of CREDIT_KEYS) {
          if (typeof credit[key] !== 'string' || credit[key].trim() === '') problems.push(`${where}: "${key}" must be text`);
        }
        for (const key of ['url', 'licenceUrl']) {
          if (typeof credit[key] === 'string' && !credit[key].startsWith('https://')) problems.push(`${where}: "${key}" must be an https link`);
        }
      });
    }
  }
  return drawings;
}

// The mapping the drawings were prepared from must tell the same story as the data file.
function checkMap(exercises) {
  const map = readJsonFile(MAP_FILE);
  if (!map || !isObject(map.exercises)) return;
  for (const [id, exercise] of Object.entries(exercises)) {
    const entry = map.exercises[id];
    if (!entry) {
      problems.push(`${relative(MAP_FILE)} has no entry for "${id}"`);
    } else if (!Array.isArray(entry.frames) || entry.frames.length !== exercise.frames || entry.still !== exercise.still) {
      problems.push(`"${id}": workouts.json (frames ${exercise.frames}, still ${exercise.still}) and ${relative(MAP_FILE)} disagree`);
    }
  }
  for (const id of Object.keys(map.exercises)) {
    if (!(id in exercises)) problems.push(`${relative(MAP_FILE)} maps "${id}", which workouts.json doesn't define`);
  }
}

// ---- on-paper lengths ----

// Worked out from the same list of sets and rests the app walks through, so
// the lengths printed here are the lengths of the workouts as the app runs them.
const onPaperSeconds = (variation, data) => paperSeconds(buildSteps(data, variation), data.estimateSecondsPerRep);

function clock(seconds) {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function printLengths(data) {
  const lengths = [];
  console.log(`On-paper lengths (${data.estimateSecondsPerRep} seconds a rep, doubled for "each", plus the rests; target ${clock(data.targetSeconds)}):`);
  for (const day of data.days) {
    const cells = day.variations.map((variation, index) => {
      const seconds = onPaperSeconds(variation, data);
      lengths.push(seconds);
      return `${index + 1} · ${variation.name} ${clock(seconds)}`.padEnd(28);
    });
    console.log(`  ${day.name.padEnd(24)}${cells.join('').trimEnd()}`);
  }
  console.log(`  Shortest ${clock(Math.min(...lengths))}, longest ${clock(Math.max(...lengths))}.`);
}

// ---- run ----

const data = readJsonFile(DATA_FILE);
const dataSound = data ? checkData(data) : false;
let drawings = 0;
if (data && isObject(data.exercises)) {
  drawings = checkArt(data.exercises);
  checkMap(data.exercises);
}
if (dataSound) printLengths(data);

if (problems.length) {
  console.error(`\ncheck-workouts: ${problems.length} ${problems.length === 1 ? 'problem' : 'problems'}`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
const workouts = data.days.reduce((count, day) => count + day.variations.length, 0);
console.log(`check-workouts: ok. ${workouts} workouts, ${Object.keys(data.exercises).length} exercises, ${drawings} drawings.`);
