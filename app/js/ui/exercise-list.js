// A variation's exercises grouped by block, each with its still drawing, its
// name and its sets: the list on the Variation screen, and the same list in
// the plan she can open during the workout.

import { blockName, setsSummary } from "./copy.js";
import { el } from "./dom.js";
import { stillDrawing } from "./drawing.js";

function exerciseRow(data, block, slot, more) {
  const exercise = data.exercises[slot.exercise];
  return el(
    "li",
    { class: "exercise-row" },
    stillDrawing(slot.exercise, exercise),
    el(
      "div",
      {},
      el("p", { class: "exercise-name" }, exercise.name),
      el("p", { class: "exercise-sets" }, setsSummary(block, slot)),
      more,
    ),
  );
}

// `blocks` come from sequence.js's outline. `more(block, position)` may add
// a line under an exercise's sets.
export function exerciseGroups(data, blocks, more = () => null) {
  return blocks.map((block) =>
    el(
      "section",
      { class: "group" },
      el("h2", { class: "group-name" }, blockName(block.block)),
      el(
        "ul",
        { class: "exercise-rows" },
        block.slots.map((slot, position) => exerciseRow(data, block, slot, more(block, position))),
      ),
    ),
  );
}
