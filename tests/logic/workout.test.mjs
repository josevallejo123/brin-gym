import assert from "node:assert/strict";
import { test } from "node:test";

import { AWAY_NOTE_MIN_MS } from "../../app/js/config.js";
import { buildSteps, findVariation } from "../../app/js/logic/sequence.js";
import * as workout from "../../app/js/logic/workout.js";
import { HOUR, MINUTE, SECOND, T0, fixtureData } from "./helpers.mjs";

const data = fixtureData();
const steps = buildSteps(data, findVariation(data, "glutes", "hip-thrust").variation);

const begin = () => workout.begin({ dayId: "glutes", variationId: "hip-thrust" }, T0);
const done = (state, now) => workout.completeSet(state, steps, now).state;
const { sync } = workout;

test("a new workout starts on the first set with the clock at zero", () => {
  const state = begin();
  assert.equal(state.stepIndex, 0);
  assert.equal(state.phase, "set");
  assert.equal(workout.elapsedMs(state, T0), 0);
});

test("Done starts the rest that follows the set, and the rest counts down from the clock", () => {
  const resting = done(begin(), T0 + 30 * SECOND);
  assert.equal(resting.phase, "rest");
  assert.equal(resting.stepIndex, 0);
  assert.equal(workout.restRemainingMs(resting, T0 + 30 * SECOND), 60 * SECOND);
  assert.equal(workout.restRemainingMs(resting, T0 + 50 * SECOND), 40 * SECOND);
});

test("when the rest is up, the next set is shown", () => {
  const resting = done(begin(), T0);
  const before = sync(resting, T0 + 59 * SECOND);
  assert.equal(before.event, null);
  assert.equal(before.state, resting);

  const after = sync(resting, T0 + 60 * SECOND);
  assert.equal(after.event, "rest-ended");
  assert.equal(after.state.phase, "set");
  assert.equal(after.state.stepIndex, 1);
  assert.equal(after.state.note, null);
});

test("the clock jumping forward in the background keeps every time right", () => {
  const resting = done(begin(), T0 + 20 * SECOND);
  // Nothing ran for 25 minutes: no ticks, no repaints. Then the app looks at the clock.
  const later = T0 + 20 * SECOND + 25 * MINUTE;
  const { state, event } = sync(resting, later);

  assert.equal(event, "rest-ended-away");
  assert.equal(state.stepIndex, 1);
  assert.equal(workout.elapsedMs(state, later), 20 * SECOND + 25 * MINUTE);
  assert.deepEqual(state.note, { restEndedAt: T0 + 80 * SECOND });
});

test("a rest that ended while she was away leaves a note of when it ended", () => {
  const resting = done(begin(), T0);
  const { state, event } = sync(resting, T0 + 60 * SECOND + AWAY_NOTE_MIN_MS);
  assert.equal(event, "rest-ended-away");
  assert.deepEqual(state.note, { restEndedAt: T0 + 60 * SECOND });
});

test("a rest that ended in front of her leaves no note, even if the repaint was a little late", () => {
  const resting = done(begin(), T0);
  const { state, event } = sync(resting, T0 + 60 * SECOND + AWAY_NOTE_MIN_MS - 1);
  assert.equal(event, "rest-ended");
  assert.equal(state.note, null);
});

test("the note is cleared by the next thing she does", () => {
  const resting = done(begin(), T0);
  const away = sync(resting, T0 + 10 * MINUTE).state;
  assert.notEqual(away.note, null);
  assert.equal(done(away, T0 + 11 * MINUTE).note, null);
  assert.equal(workout.stepBack(away, T0 + 11 * MINUTE).note, null);
});

test("an untouched workout is dropped after three hours, and not a moment before", () => {
  const state = done(begin(), T0);
  assert.notEqual(sync(state, T0 + 3 * HOUR - 1).state, null);
  assert.deepEqual(sync(state, T0 + 3 * HOUR), { state: null, event: "dropped" });
});

test("the three hours run from the last thing she did, not from the start", () => {
  let state = begin();
  state = done(state, T0 + 2 * HOUR);
  const { state: synced } = sync(state, T0 + 4 * HOUR);
  assert.notEqual(synced, null);
  assert.equal(sync(state, T0 + 5 * HOUR).event, "dropped");
});

test("a rest ending on its own does not count as her touching the workout", () => {
  const resting = done(begin(), T0);
  const { state } = sync(resting, T0 + 2 * HOUR);
  assert.equal(state.touchedAt, T0);
  assert.equal(sync(state, T0 + 3 * HOUR).event, "dropped");
});

test("skipping a rest goes straight to the next set with no note", () => {
  const resting = done(begin(), T0);
  const state = workout.skipRest(resting, T0 + 5 * SECOND);
  assert.equal(state.phase, "set");
  assert.equal(state.stepIndex, 1);
  assert.equal(state.note, null);
  assert.equal(state.touchedAt, T0 + 5 * SECOND);
});

test("adding time lengthens the rest in progress, as often as she likes", () => {
  let state = done(begin(), T0);
  state = workout.addRest(state, 15, T0 + 50 * SECOND);
  assert.equal(workout.restRemainingMs(state, T0 + 50 * SECOND), 25 * SECOND);
  state = workout.addRest(state, 15, T0 + 51 * SECOND);
  assert.equal(workout.restLengthMs(state), 90 * SECOND);
  assert.equal(sync(state, T0 + 89 * SECOND).event, null);
  assert.equal(sync(state, T0 + 90 * SECOND).event, "rest-ended");
});

test("skip and add do nothing outside a rest", () => {
  const state = begin();
  assert.equal(workout.skipRest(state, T0), state);
  assert.equal(workout.addRest(state, 15, T0), state);
});

test("step back during a rest cancels it and returns to the set just done", () => {
  const resting = done(begin(), T0 + 40 * SECOND);
  const state = workout.stepBack(resting, T0 + 45 * SECOND);
  assert.equal(state.phase, "set");
  assert.equal(state.stepIndex, 0);
  assert.equal(state.rest, null);
});

test("step back during a set returns to the previous set as not yet done", () => {
  let state = done(begin(), T0);
  state = workout.skipRest(state, T0 + SECOND);
  assert.equal(state.stepIndex, 1);
  state = workout.stepBack(state, T0 + 2 * SECOND);
  assert.equal(state.stepIndex, 0);
  assert.equal(state.phase, "set");
});

test("step back does not rewind the total time", () => {
  const resting = done(begin(), T0 + 40 * SECOND);
  const state = workout.stepBack(resting, T0 + 45 * SECOND);
  assert.equal(workout.elapsedMs(state, T0 + 45 * SECOND), 45 * SECOND);
});

test("there is nothing to step back to on the first set", () => {
  const state = begin();
  assert.equal(workout.canStepBack(state), false);
  assert.equal(workout.stepBack(state, T0 + SECOND), state);
});

test("pause freezes the total time, and resume carries on from where it stopped", () => {
  let state = begin();
  state = workout.pause(state, T0 + 2 * MINUTE);
  assert.equal(workout.elapsedMs(state, T0 + 10 * MINUTE), 2 * MINUTE);
  state = workout.resume(state, T0 + 10 * MINUTE);
  assert.equal(workout.elapsedMs(state, T0 + 11 * MINUTE), 3 * MINUTE);
});

test("pause freezes a rest countdown, and it does not end while paused", () => {
  let state = done(begin(), T0);
  state = workout.pause(state, T0 + 20 * SECOND);
  assert.equal(workout.restRemainingMs(state, T0 + 5 * MINUTE), 40 * SECOND);
  assert.equal(sync(state, T0 + 5 * MINUTE).event, null);

  state = workout.resume(state, T0 + 5 * MINUTE);
  assert.equal(workout.restRemainingMs(state, T0 + 5 * MINUTE), 40 * SECOND);
  assert.equal(workout.restLengthMs(state), 60 * SECOND);
  assert.equal(sync(state, T0 + 5 * MINUTE + 39 * SECOND).event, null);
  assert.equal(sync(state, T0 + 5 * MINUTE + 40 * SECOND).event, "rest-ended");
});

test("two pauses add up", () => {
  let state = begin();
  state = workout.resume(workout.pause(state, T0 + MINUTE), T0 + 3 * MINUTE);
  state = workout.resume(workout.pause(state, T0 + 4 * MINUTE), T0 + 9 * MINUTE);
  assert.equal(workout.elapsedMs(state, T0 + 10 * MINUTE), 3 * MINUTE);
});

test("while paused, Done, skip, add and step back do nothing", () => {
  const pausedSet = workout.pause(begin(), T0);
  assert.equal(done(pausedSet, T0 + SECOND), pausedSet);

  const pausedRest = workout.pause(done(begin(), T0), T0 + SECOND);
  assert.equal(workout.skipRest(pausedRest, T0 + 2 * SECOND), pausedRest);
  assert.equal(workout.addRest(pausedRest, 15, T0 + 2 * SECOND), pausedRest);
  assert.equal(workout.stepBack(pausedRest, T0 + 2 * SECOND), pausedRest);
});

test("a paused workout nobody touches is still dropped after three hours", () => {
  const paused = workout.pause(begin(), T0);
  assert.equal(sync(paused, T0 + 3 * HOUR).event, "dropped");
});

test("the last Done finishes the workout and reports the total time", () => {
  let state = begin();
  let now = T0;
  for (let index = 0; index < steps.length - 1; index += 1) {
    now += 30 * SECOND;
    state = done(state, now);
    now += 10 * SECOND;
    state = workout.skipRest(state, now);
  }
  assert.equal(state.stepIndex, steps.length - 1);

  now += 30 * SECOND;
  const result = workout.completeSet(state, steps, now);
  assert.equal(result.state, null);
  assert.deepEqual(result.finished, { elapsedMs: now - T0 });
});

test("the total time never cuts her off: it keeps counting past the target", () => {
  const state = begin();
  assert.equal(workout.elapsedMs(state, T0 + 45 * MINUTE), 45 * MINUTE);
  assert.equal(sync(state, T0 + 45 * MINUTE).event, null);
});

test("a clock set backwards never shows a negative time or an over-long rest", () => {
  const resting = done(begin(), T0 + MINUTE);
  assert.equal(workout.elapsedMs(resting, T0 - HOUR), 0);
  assert.equal(workout.restRemainingMs(resting, T0 - HOUR), 60 * SECOND);
});

test("a save fits only if it has the current shape and points at a real step", () => {
  const state = begin();
  assert.equal(workout.fits(state, steps), true);
  assert.equal(workout.fits(done(state, T0), steps), true);

  assert.equal(workout.fits(null, steps), false);
  assert.equal(workout.fits("workout", steps), false);
  assert.equal(workout.fits({ ...state, schema: 0 }, steps), false);
  assert.equal(workout.fits({ ...state, stepIndex: steps.length }, steps), false);
  assert.equal(workout.fits({ ...state, stepIndex: -1 }, steps), false);
  assert.equal(workout.fits({ ...state, note: { restEndedAt: T0 } }, steps), true);
  assert.equal(workout.fits({ ...state, note: {} }, steps), false);
  assert.equal(workout.fits({ ...state, note: "a minute ago" }, steps), false);
  assert.equal(workout.fits({ ...state, startedAt: "yesterday" }, steps), false);
  assert.equal(workout.fits({ ...state, pausedAt: undefined }, steps), false);
  assert.equal(workout.fits({ ...state, phase: "rest", rest: null }, steps), false);
  assert.equal(workout.fits({ ...state, phase: "nap" }, steps), false);
});
