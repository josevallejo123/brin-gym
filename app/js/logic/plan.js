// Where she is in a workout, for the plan she can open from the player: the
// variation's exercises in the order of the list she saw before Start, each
// with one mark per set saying done, current or left. No DOM, no clock.

import { buildSteps, outline } from "./sequence.js";

// Each set is "done", "left", or the one she is at: "now" on a set, and
// "next" during a rest, for the set the rest leads to.
function markOf(index, { stepIndex, phase }) {
  const current = phase === "rest" ? stepIndex + 1 : stepIndex;
  if (index < current) return "done";
  if (index > current) return "left";
  return phase === "rest" ? "next" : "now";
}

// An exercise as a whole: done once every set is, current while one of its
// sets is, and otherwise left (a superset's other exercise may be part done).
function stateOf(marks) {
  if (marks.every((mark) => mark === "done")) return "done";
  return marks.find((mark) => mark === "now" || mark === "next") ?? "left";
}

// The outline's blocks (sequence.js), each exercise given its marks in the
// order she does its sets. Sets are matched to exercises by position, never
// by name: a block's steps take its exercises in turn, once per time through,
// and one exercise can appear in a workout twice.
export function planOf(data, variation, position) {
  const steps = buildSteps(data, variation);
  let index = 0;
  return outline(data, variation).map((entry) => {
    const marks = entry.slots.map(() => []);
    for (let turn = 0; steps[index]?.block === entry.block; turn += 1, index += 1) {
      marks[turn % marks.length].push(markOf(index, position));
    }
    return { ...entry, rows: entry.slots.map((slot, n) => ({ slot, marks: marks[n], state: stateOf(marks[n]) })) };
  });
}
