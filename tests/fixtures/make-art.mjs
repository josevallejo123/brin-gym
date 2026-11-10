// Writes the stand-in drawings in tests/fixtures/art/: a plain jointed figure
// for every exercise in the fixture workouts, and a stand-in dumbbell for the
// icon. They follow the same file rules as the real drawings (512 × 512,
// transparent, every shape fill="currentColor") so the app is built and
// tested against the real contract while the real art lives in app/art/.
//
//   node tests/fixtures/make-art.mjs

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES = fileURLToPath(new URL("./", import.meta.url));
const SIZE = 512;
const LINE = 12;
const GROUND_Y = 452;

const capsule = ([x1, y1], [x2, y2], width = LINE) => {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const half = width / 2;
  return `<rect x="${x1 - half}" y="${y1 - half}" width="${(length + width).toFixed(1)}" height="${width}" rx="${half}" transform="rotate(${angle.toFixed(1)} ${x1} ${y1})" fill="currentColor"/>`;
};

const ring = ([cx, cy], radius) => {
  const inner = radius - LINE;
  const circle = (r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
  return `<path fill-rule="evenodd" d="${circle(radius)}${circle(inner)}" fill="currentColor"/>`;
};

const mix = (from, to, amount) => from.map((value, index) => value + (to[index] - value) * amount);

// Three plain movements, each given as its start and finish pose.
const MOVES = [
  {
    // A squat: hips drop, hands come forward.
    start: { head: [256, 96], shoulder: [256, 150], hip: [256, 280], knee: [262, 366], foot: [256, 446], elbow: [280, 210], hand: [300, 262] },
    finish: { head: [236, 176], shoulder: [240, 228], hip: [214, 336], knee: [300, 356], foot: [256, 446], elbow: [296, 262], hand: [344, 248] },
  },
  {
    // A press: hands go from the shoulders to overhead.
    start: { head: [256, 96], shoulder: [256, 150], hip: [256, 280], knee: [258, 366], foot: [256, 446], elbow: [306, 196], hand: [300, 136] },
    finish: { head: [256, 96], shoulder: [256, 150], hip: [256, 280], knee: [258, 366], foot: [256, 446], elbow: [296, 96], hand: [290, 34] },
  },
  {
    // A hinge: the body folds forward at the hips.
    start: { head: [256, 96], shoulder: [256, 150], hip: [256, 280], knee: [260, 366], foot: [256, 446], elbow: [262, 214], hand: [266, 274] },
    finish: { head: [372, 214], shoulder: [326, 232], hip: [222, 286], knee: [244, 368], foot: [256, 446], elbow: [330, 300], hand: [334, 362] },
  },
];

function figure(move, amount) {
  const at = (joint) => mix(move.start[joint], move.finish[joint], amount);
  const parts = [
    ring(at("head"), 30),
    capsule(at("shoulder"), at("hip")),
    capsule(at("shoulder"), at("elbow")),
    capsule(at("elbow"), at("hand")),
    capsule(at("hip"), at("knee")),
    capsule(at("knee"), at("foot")),
    capsule(at("foot"), [at("foot")[0] + 34, at("foot")[1]]),
    capsule([120, GROUND_Y], [392, GROUND_Y], LINE / 2),
  ];
  return svg(parts);
}

const svg = (parts) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">\n  ${parts.join("\n  ")}\n</svg>\n`;

// A dumbbell inside the middle 60% of the square, as the icon rules ask.
function dumbbell() {
  const plate = (x, height, width) =>
    `<rect x="${x}" y="${SIZE / 2 - height / 2}" width="${width}" height="${height}" rx="${width / 2}" fill="currentColor"/>`;
  return svg([
    capsule([150, SIZE / 2], [362, SIZE / 2]),
    plate(150, 150, 22),
    plate(340, 150, 22),
    plate(116, 104, 22),
    plate(374, 104, 22),
  ]);
}

async function write(relativePath, content) {
  const file = path.join(FIXTURES, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

const data = JSON.parse(await readFile(path.join(FIXTURES, "data/workouts.json"), "utf8"));
const ids = Object.keys(data.exercises);

for (const [index, id] of ids.entries()) {
  const { frames } = data.exercises[id];
  const move = MOVES[index % MOVES.length];
  for (let frame = 1; frame <= frames; frame += 1) {
    await write(`art/${id}/${frame}.svg`, figure(move, (frame - 1) / (frames - 1)));
  }
}

await write("art/app-icon.svg", dumbbell());
await write(
  "art/credits.json",
  `${JSON.stringify(
    [
      {
        work: "Workout Guide",
        author: "Bryl Lim",
        url: "https://github.com/bryllim/workout-guide",
        licence: "CC BY-SA 4.0",
        licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        changes: "Recoloured and adapted.",
      },
      {
        work: "Everkinetic",
        author: "Everkinetic",
        url: "https://github.com/everkinetic/data",
        licence: "CC BY-SA 4.0",
        licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        changes: "Recoloured and adapted.",
      },
    ],
    null,
    2,
  )}\n`,
);

console.log(`Wrote stand-in drawings for ${ids.length} exercises.`);
