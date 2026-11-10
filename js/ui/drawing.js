// An exercise drawing. The files in art/ are colour-neutral, so each frame is
// used as a CSS mask over a block of the drawing colour (css: .drawing).

import { ART_DIR } from "../config.js";
import { el } from "./dom.js";

function frame(exerciseId, number, isStill) {
  const node = el("span", { class: "drawing-frame", "data-frame": number, "data-still": isStill });
  const image = `url("${ART_DIR}/${exerciseId}/${number}.svg")`;
  node.style.webkitMaskImage = image;
  node.style.maskImage = image;
  return node;
}

// One frame, for lists and the "next" preview.
export function stillDrawing(exerciseId, exercise) {
  return el("div", { class: "drawing", "aria-hidden": "true" }, frame(exerciseId, exercise.still, true));
}

// Every frame, stacked, played as a calm loop by CSS. With reduced motion on,
// CSS shows only the frame marked as the still.
export function loopingDrawing(exerciseId, exercise, className) {
  const frames = Array.from({ length: exercise.frames }, (_, index) =>
    frame(exerciseId, index + 1, index + 1 === exercise.still),
  );
  return el(
    "div",
    { class: `drawing ${className}`, "data-loop": exercise.frames, "aria-hidden": "true" },
    frames,
  );
}
