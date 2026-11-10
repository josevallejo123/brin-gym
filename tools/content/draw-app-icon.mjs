// Draws app/art/app-icon.svg: one dumbbell in outline, for the Home Screen icon.
//
//   node tools/content/draw-app-icon.mjs
//
// The dumbbell is built from rounded rectangles drawn as outlines of one line weight, like
// the exercise drawings, then turned and fitted inside the middle of the square so that a
// rounded or masked crop never clips it. The app's icon script colours it and adds the background.

import fs from 'node:fs';
import path from 'node:path';
import { CANVAS, ICON_FILE, ROOT, drawingSvg } from './drawings.mjs';
import { boundingBox, parsePath, rotateScaleAbout, serializePath, transform, translate } from './svg-path.mjs';

const BOX_SHARE = 0.58; // just inside the middle 60% the check allows
const LINE_WEIGHT = 13; // in canvas units, once fitted
const TURN_DEGREES = -35;

// The dumbbell lying flat, centred on 0,0. Each part is the centre line of its outline:
// [left, right, half height, corner radius]. Neighbours share an edge, so walls never double.
const PARTS = [
  [-58, 58, 14, 6], // handle
  [-96, -58, 76, 13], // inner plates
  [58, 96, 76, 13],
  [-128, -96, 52, 11], // outer plates
  [96, 128, 52, 11],
];

function roundedRect(left, right, halfHeight, radius) {
  const r = Math.max(0.01, Math.min(radius, (right - left) / 2, halfHeight));
  const top = -halfHeight;
  const bottom = halfHeight;
  return (
    `M${left + r} ${top}H${right - r}A${r} ${r} 0 0 1 ${right} ${top + r}V${bottom - r}A${r} ${r} 0 0 1 ${right - r} ${bottom}` +
    `H${left + r}A${r} ${r} 0 0 1 ${left} ${bottom - r}V${top + r}A${r} ${r} 0 0 1 ${left + r} ${top}Z`
  );
}

// An outline of the given weight around a centre-line rectangle: an outer edge and a hole.
function outline([left, right, halfHeight, radius], weight) {
  const half = weight / 2;
  return (
    roundedRect(left - half, right + half, halfHeight + half, radius + half) +
    roundedRect(left + half, right - half, halfHeight - half, radius - half)
  );
}

function dumbbell(weight, matrix) {
  return PARTS.map((part) => transform(parsePath(outline(part, weight)), matrix));
}

// Turn it, measure it, then scale it to the box. The line weight is set in fitted units,
// so the drawing is measured twice: once to find the scale, once with the weight that scale gives.
const turn = rotateScaleAbout(TURN_DEGREES, 1, 0, 0);
const room = CANVAS * BOX_SHARE;
let scale = 1;
for (let pass = 0; pass < 3; pass += 1) {
  const box = boundingBox(dumbbell(LINE_WEIGHT / scale, turn).flat());
  scale = room / Math.max(box.maxX - box.minX, box.maxY - box.minY);
}
const turned = rotateScaleAbout(TURN_DEGREES, scale, 0, 0);
const placed = dumbbell(LINE_WEIGHT / scale, turned);
const box = boundingBox(placed.flat());
const centre = translate(CANVAS / 2 - (box.minX + box.maxX) / 2, CANVAS / 2 - (box.minY + box.maxY) / 2);

fs.writeFileSync(ICON_FILE, drawingSvg(placed.map((segments) => serializePath(transform(segments, centre)))));
console.log(`draw-app-icon: wrote ${path.relative(ROOT, ICON_FILE)}`);
