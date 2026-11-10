import assert from "node:assert/strict";
import { test } from "node:test";

import { COUNTDOWN_TICKS } from "../../app/js/config.js";
import { countdownCue, eventCue } from "../../app/js/logic/cues.js";
import { countdownSeconds, formatCountdown, formatElapsed } from "../../app/js/logic/format.js";
import {
  COPY,
  addRestLabel,
  finishText,
  repsText,
  restEndedText,
  setsSummary,
  stepLabel,
  variationLead,
} from "../../app/js/ui/copy.js";
import { HOUR, MINUTE, SECOND } from "./helpers.mjs";

test("elapsed time shows whole seconds that have passed", () => {
  assert.equal(formatElapsed(0), "0:00");
  assert.equal(formatElapsed(999), "0:00");
  assert.equal(formatElapsed(59_999), "0:59");
  assert.equal(formatElapsed(29 * MINUTE + 41 * SECOND), "29:41");
  assert.equal(formatElapsed(HOUR + 2 * MINUTE + 3 * SECOND), "1:02:03");
  assert.equal(formatElapsed(-5), "0:00");
});

test("a countdown shows each second until it is used up", () => {
  assert.equal(formatCountdown(60 * SECOND), "1:00");
  assert.equal(formatCountdown(59_001), "1:00");
  assert.equal(formatCountdown(59_000), "0:59");
  assert.equal(formatCountdown(1), "0:01");
  assert.equal(formatCountdown(0), "0:00");
  assert.equal(countdownSeconds(2_400), 3);
});

test("the countdown ticks once each at 3, 2 and 1", () => {
  const heard = [];
  let previous = null;
  for (let ms = 5_000; ms >= 0; ms -= 200) {
    const seconds = countdownSeconds(ms);
    if (countdownCue(previous, seconds, COUNTDOWN_TICKS)) heard.push(seconds);
    previous = seconds;
  }
  assert.deepEqual(heard, [3, 2, 1]);
});

test("coming back with two seconds left ticks for what is left, not for what was missed", () => {
  assert.equal(countdownCue(40, 2, COUNTDOWN_TICKS), "tick");
  assert.equal(countdownCue(2, 2, COUNTDOWN_TICKS), null);
  assert.equal(countdownCue(40, 0, COUNTDOWN_TICKS), null);
});

test("reps read as the brief writes them", () => {
  assert.equal(repsText({ reps: 10 }), "10");
  assert.equal(repsText({ reps: 10, each: "side" }), "10 each side");
  assert.equal(repsText({ reps: 12, each: "way" }), "12 each way");
});

test("the player says which set or round she is on", () => {
  assert.equal(stepLabel({ block: "main", warmup: true, number: 1, of: 1 }), "Warm-up set");
  assert.equal(stepLabel({ block: "main", warmup: true, number: 2, of: 2 }), "Warm-up set 2 of 2");
  assert.equal(stepLabel({ block: "main", warmup: false, number: 2, of: 3 }), "Set 2 of 3");
  assert.equal(stepLabel({ block: "supersetA", number: 2, of: 3 }), "Superset A · round 2 of 3");
  assert.equal(stepLabel({ block: "supersetB", number: 3, of: 3 }), "Superset B · round 3 of 3");
  assert.equal(stepLabel({ block: "finisher", number: 1, of: 3 }), "Finisher · set 1 of 3");
});

test("the variation list gives sets and reps from the block's counts", () => {
  const main = { block: "main", warmups: 1, times: 3 };
  assert.equal(setsSummary(main, { reps: 10 }), "Warm-up set, then 3 sets of 10");
  assert.equal(setsSummary(main, { reps: 8, each: "side" }), "Warm-up set, then 3 sets of 8 each side");
  assert.equal(setsSummary({ block: "supersetA", warmups: 0, times: 3 }, { reps: 12, each: "way" }), "3 rounds of 12 each way");
  assert.equal(setsSummary({ block: "finisher", warmups: 0, times: 3 }, { reps: 15 }), "3 sets of 15");
  assert.equal(setsSummary({ ...main, warmups: 0, times: 1 }, { reps: 10 }), "1 set of 10");
  assert.equal(setsSummary({ ...main, warmups: 2 }, { reps: 10 }), "2 warm-up sets, then 3 sets of 10");
});

test("a set done ticks, a rest ending on screen chimes, and a rest that ended while away is silent", () => {
  assert.equal(eventCue("set-done"), "setDone");
  assert.equal(eventCue("finished"), "setDone");
  assert.equal(eventCue("rest-ended"), "chime");
  assert.equal(eventCue("rest-ended-away"), null);
  assert.equal(eventCue("paused"), null);
});

test("titles and buttons follow the brief's wording", () => {
  assert.equal(`${variationLead(0)}Hip thrust`, "1 · Hip thrust");
  assert.equal(finishText(29 * MINUTE + 41 * SECOND), "Done · 29:41");
  assert.equal(addRestLabel(15), "Add 15 seconds");
});

test("the away note says how long ago the rest ended, in plain words", () => {
  assert.equal(restEndedText(3 * SECOND), "Rest ended 3 seconds ago");
  assert.equal(restEndedText(59_999), "Rest ended 59 seconds ago");
  assert.equal(restEndedText(MINUTE), "Rest ended 1 minute ago");
  assert.equal(restEndedText(4 * MINUTE + 30 * SECOND), "Rest ended 4 minutes ago");
  assert.equal(restEndedText(HOUR), "Rest ended 1 hour ago");
  assert.equal(restEndedText(2 * HOUR + 5 * MINUTE), "Rest ended 2 hours 5 minutes ago");
});

test("no copy shouts or cheers", () => {
  const strings = JSON.stringify(COPY);
  assert.equal(strings.includes("!"), false);
  assert.equal(/\p{Extended_Pictographic}/u.test(strings), false);
});
