import assert from "node:assert/strict";
import { test } from "node:test";

import { formatElapsed } from "../../app/js/logic/format.js";
import { buildSteps, findVariation, outline, paperSeconds } from "../../app/js/logic/sequence.js";
import { fixtureData } from "./helpers.mjs";

const data = fixtureData();
const stepsFor = (dayId, variationId) => buildSteps(data, findVariation(data, dayId, variationId).variation);

// One line per step: the exercise, then the rest that follows it.
const asLines = (steps) =>
  steps.map((step) => `${step.exercise} > ${step.restAfter ? `${step.restAfter.kind} ${step.restAfter.seconds}` : "finish"}`);

test("a workout runs in the agreed order with the agreed rests", () => {
  assert.deepEqual(asLines(stepsFor("glutes", "hip-thrust")), [
    "barbell-hip-thrust > rest 60",
    "barbell-hip-thrust > rest 60",
    "barbell-hip-thrust > rest 60",
    "barbell-hip-thrust > setup 90",
    "dumbbell-romanian-deadlift > switch 10",
    "dumbbell-curtsy-lunge > rest 60",
    "dumbbell-romanian-deadlift > switch 10",
    "dumbbell-curtsy-lunge > rest 60",
    "dumbbell-romanian-deadlift > switch 10",
    "dumbbell-curtsy-lunge > setup 90",
    "cable-kickback > switch 10",
    "banded-lateral-walk > rest 60",
    "cable-kickback > switch 10",
    "banded-lateral-walk > rest 60",
    "cable-kickback > switch 10",
    "banded-lateral-walk > setup 90",
    "frog-pump > rest 60",
    "frog-pump > rest 60",
    "frog-pump > finish",
  ]);
});

test("the main lift opens with one warm-up set at the main lift's reps", () => {
  const [warmup, first, , third] = stepsFor("glutes", "hip-thrust");
  assert.deepEqual(
    { warmup: warmup.warmup, reps: warmup.reps, number: warmup.number, of: warmup.of },
    { warmup: true, reps: 10, number: 1, of: 1 },
  );
  assert.deepEqual({ warmup: first.warmup, number: first.number, of: first.of }, { warmup: false, number: 1, of: 3 });
  assert.equal(third.number, 3);
});

test("superset steps carry their round and keep 'each side' and 'each way'", () => {
  const steps = stepsFor("glutes", "hip-thrust");
  const supersetB = steps.filter((step) => step.block === "supersetB");
  assert.deepEqual(
    supersetB.map((step) => `${step.number}/${step.of} ${step.reps} ${step.each}`),
    ["1/3 12 side", "1/3 12 way", "2/3 12 side", "2/3 12 way", "3/3 12 side", "3/3 12 way"],
  );
});

test("the list of a variation and its steps come from one outline", () => {
  const { variation } = findVariation(data, "glutes", "hip-thrust");
  assert.deepEqual(
    outline(data, variation).map(({ block, slots, warmups, times }) => `${block}: ${slots.length} × ${warmups}+${times}`),
    ["main: 1 × 1+3", "supersetA: 2 × 0+3", "supersetB: 2 × 0+3", "finisher: 1 × 0+3"],
  );
});

test("a block that is done no times appears in neither the list nor the steps", () => {
  const { variation } = findVariation(data, "glutes", "hip-thrust");
  const noFinisher = { ...data, sets: { ...data.sets, finisherSets: 0 } };
  assert.equal(outline(noFinisher, variation).some(({ block }) => block === "finisher"), false);
  const steps = buildSteps(noFinisher, variation);
  assert.equal(steps.some((step) => step.block === "finisher"), false);
  assert.equal(steps.at(-1).restAfter, null);
});

test("an unknown day or variation is not found", () => {
  assert.equal(findVariation(data, "glutes", "nope"), null);
  assert.equal(findVariation(data, "nope", "hip-thrust"), null);
});

// The twelve approved workouts, as reps only: [reps, "each" or nothing] for
// the main lift, both exercises of superset A, both of superset B and the
// finisher, with the on-paper length each must come to.
const each = true;
const APPROVED = [
  ["Glutes 1", [10], [10], [10, each], [12, each], [12, each], [15], "30:27"],
  ["Glutes 2", [10], [12], [10, each], [12], [10, each], [15, each], "30:36"],
  ["Glutes 3", [10], [10, each], [12], [12, each], [10, each], [15], "30:09"],
  ["Legs 1", [10], [12], [10], [10, each], [15], [15], "27:18"],
  ["Legs 2", [8, each], [12], [10, each], [12], [10, each], [15], "29:33"],
  ["Legs 3", [10], [12], [10, each], [12], [10], [10, each], "27:36"],
  ["Shoulders and triceps 1", [10], [12], [12], [12], [12], [10, each], "26:42"],
  ["Shoulders and triceps 2", [10], [12], [12], [12], [10, each], [15], "27:09"],
  ["Shoulders and triceps 3", [8, each], [12], [12], [12], [12], [15], "27:09"],
  ["Back 1", [10], [10, each], [12], [12], [12], [15], "27:09"],
  ["Back 2", [10], [12], [10], [10, each], [12], [15], "26:51"],
  ["Back 3", [10], [12], [12], [12], [12], [15], "25:57"],
];

const slot = ([reps, isEach]) => ({ exercise: "any", reps, ...(isEach ? { each: "side" } : {}) });

for (const [name, main, a1, a2, b1, b2, finisher, expected] of APPROVED) {
  test(`on paper, ${name} runs ${expected}`, () => {
    const variation = {
      main: slot(main),
      supersetA: [slot(a1), slot(a2)],
      supersetB: [slot(b1), slot(b2)],
      finisher: slot(finisher),
    };
    const seconds = paperSeconds(buildSteps(data, variation), data.estimateSecondsPerRep);
    assert.equal(formatElapsed(seconds * 1000), expected);
  });
}
