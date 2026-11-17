import assert from "node:assert/strict";
import { test } from "node:test";

import { planOf } from "../../app/js/logic/plan.js";
import { buildSteps, findVariation } from "../../app/js/logic/sequence.js";
import * as workout from "../../app/js/logic/workout.js";
import { T0, fixtureData } from "./helpers.mjs";

const data = fixtureData();
const { variation } = findVariation(data, "glutes", "hip-thrust");
const steps = buildSteps(data, variation);

// The plan read back in the order she does the sets: a block's steps take its
// exercises in turn, once per time through.
function inStepOrder(plan) {
  return plan.flatMap(({ rows }) => {
    const sets = rows.reduce((total, row) => total + row.marks.length, 0);
    return Array.from({ length: sets }, (_, turn) => {
      const row = rows[turn % rows.length];
      return { exercise: row.slot.exercise, mark: row.marks[Math.floor(turn / rows.length)] };
    });
  });
}

const marks = (position) => inStepOrder(planOf(data, variation, position)).map(({ mark }) => mark);
const rows = (position) =>
  planOf(data, variation, position).flatMap((block) => block.rows.map((row) => `${row.state}: ${row.marks.join(" ")}`));

test("the plan holds every set of the workout, exercise by exercise, in the order of the list", () => {
  for (const day of data.days) {
    for (const each of day.variations) {
      const plan = planOf(data, each, { stepIndex: 0, phase: "set" });
      assert.deepEqual(
        inStepOrder(plan).map(({ exercise }) => exercise),
        buildSteps(data, each).map((step) => step.exercise),
        `${day.id} ${each.id}`,
      );
    }
  }
});

test("at the start the first set is the current one and everything else is left", () => {
  assert.deepEqual(marks({ stepIndex: 0, phase: "set" }), ["now", ...Array(steps.length - 1).fill("left")]);
  assert.deepEqual(rows({ stepIndex: 0, phase: "set" }), [
    "now: now left left left",
    "left: left left left",
    "left: left left left",
    "left: left left left",
    "left: left left left",
    "left: left left left",
  ]);
});

test("during a rest the set just done is done and the set the rest leads to is next", () => {
  assert.deepEqual(marks({ stepIndex: 0, phase: "rest" }).slice(0, 3), ["done", "next", "left"]);
  assert.equal(rows({ stepIndex: 0, phase: "rest" })[0], "next: done next left left");
});

test("after several sets: the main lift is done, and a superset's two exercises are each part way", () => {
  // Main lift (4 sets), then superset A rounds 1 and 2 of the first exercise
  // and round 1 of the second: on the second exercise, round 2.
  const position = { stepIndex: 7, phase: "set" };
  assert.deepEqual(rows(position).slice(0, 3), [
    "done: done done done done",
    "left: done done left",
    "now: done now left",
  ]);
  assert.equal(marks(position).filter((mark) => mark === "done").length, 7);
});

test("Back one set marks the set she returns to as not yet done", () => {
  let state = workout.begin({ dayId: "glutes", variationId: "hip-thrust" }, T0);
  for (let set = 0; set < 3; set += 1) {
    state = workout.completeSet(state, steps, T0).state;
    state = workout.skipRest(state, T0);
  }
  assert.deepEqual(marks(state).slice(0, 4), ["done", "done", "done", "now"]);

  // Back from a set to the one before it.
  state = workout.stepBack(state, T0);
  assert.deepEqual(marks(state).slice(0, 4), ["done", "done", "now", "left"]);

  // Back from a rest, which cancels it: the set before is current again.
  state = workout.completeSet(state, steps, T0).state;
  assert.deepEqual(marks(state).slice(0, 4), ["done", "done", "done", "next"]);
  state = workout.stepBack(state, T0);
  assert.deepEqual(marks(state).slice(0, 4), ["done", "done", "now", "left"]);
});

test("on the last set everything else is done", () => {
  const last = marks({ stepIndex: steps.length - 1, phase: "set" });
  assert.deepEqual(last, [...Array(steps.length - 1).fill("done"), "now"]);
  assert.deepEqual(rows({ stepIndex: steps.length - 1, phase: "set" }).at(-1), "now: done done now");
});

test("an exercise that appears twice in one workout is marked by its place, not its name", () => {
  // The test content's Legs 1 opens and ends with the same exercise.
  const twice = findVariation(data, "legs", "landmine-squat").variation;
  assert.equal(twice.main.exercise, twice.finisher.exercise);
  const finisherStarts = buildSteps(data, twice).length - data.sets.finisherSets;
  const plan = planOf(data, twice, { stepIndex: finisherStarts, phase: "set" });
  const [main, finisher] = [plan[0].rows[0], plan.at(-1).rows[0]];
  assert.deepEqual(main.marks, Array(data.sets.warmupSets + data.sets.mainSets).fill("done"));
  assert.deepEqual(finisher.marks, ["now", ...Array(data.sets.finisherSets - 1).fill("left")]);
});
