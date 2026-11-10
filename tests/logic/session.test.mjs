import assert from "node:assert/strict";
import { test } from "node:test";

import { STORAGE_KEYS } from "../../app/js/config.js";
import { createSession } from "../../app/js/logic/session.js";
import { createStore } from "../../app/js/logic/store.js";
import { HOUR, MINUTE, SECOND, fakeClock, fixtureData, memoryStorage } from "./helpers.mjs";

const data = fixtureData();

// One phone: a storage that outlives the app, and a clock that keeps running
// while the app is closed. `open()` is the app being launched.
function phone() {
  const storage = memoryStorage();
  const clock = fakeClock();
  return {
    storage,
    clock,
    open() {
      const session = createSession({ data, store: createStore(storage), clock });
      const events = [];
      session.subscribe((event) => events.push(event.type));
      session.restore();
      return { session, events };
    },
  };
}

test("every change is saved as it happens", () => {
  const { storage, clock, open } = phone();
  const { session } = open();
  const saved = () => JSON.parse(storage.getItem(STORAGE_KEYS.workout));

  session.start("glutes", "hip-thrust");
  assert.equal(saved().phase, "set");

  clock.advance(30 * SECOND);
  session.done();
  assert.equal(saved().phase, "rest");

  session.addRest();
  assert.equal(saved().rest.endsAt - saved().rest.startedAt, 75 * SECOND);

  session.pause();
  assert.equal(saved().pausedAt, clock.now());

  session.resume();
  session.skipRest();
  assert.equal(saved().stepIndex, 1);

  session.stepBack();
  assert.equal(saved().stepIndex, 0);

  session.end();
  assert.equal(storage.getItem(STORAGE_KEYS.workout), null);
});

test("closed and reopened mid-set: the same set, with the right total time", () => {
  const { clock, open } = phone();
  const first = open();
  first.session.start("glutes", "hip-thrust");
  clock.advance(30 * SECOND);
  first.session.done();
  first.session.skipRest();
  clock.advance(20 * SECOND);

  // iOS closes the app. Twelve minutes later she opens it again.
  clock.advance(12 * MINUTE);
  const { session } = open();
  const view = session.view();

  assert.equal(session.active, true);
  assert.equal(view.phase, "set");
  assert.equal(view.stepIndex, 1);
  assert.equal(view.step.exercise, "barbell-hip-thrust");
  assert.equal(view.elapsedMs, 50 * SECOND + 12 * MINUTE);
  assert.equal(view.restEndedAgoMs, null);
});

test("closed and reopened mid-rest: the same rest, still counting down", () => {
  const { clock, open } = phone();
  const first = open();
  first.session.start("glutes", "hip-thrust");
  clock.advance(30 * SECOND);
  first.session.done();

  clock.advance(25 * SECOND);
  const { session, events } = open();
  const view = session.view();

  assert.equal(view.phase, "rest");
  assert.equal(view.stepIndex, 0);
  assert.equal(view.rest.remainingMs, 35 * SECOND);
  assert.equal(view.rest.lengthMs, 60 * SECOND);
  assert.equal(view.nextStep.exercise, "barbell-hip-thrust");
  assert.deepEqual(events, []);
});

test("a rest that ended while the app was closed: the next set, with how long ago it ended", () => {
  const { clock, open } = phone();
  const first = open();
  first.session.start("glutes", "hip-thrust");
  clock.advance(30 * SECOND);
  first.session.done();

  clock.advance(60 * SECOND + 4 * MINUTE);
  const { session } = open();
  const view = session.view();

  assert.equal(view.phase, "set");
  assert.equal(view.stepIndex, 1);
  assert.equal(view.restEndedAgoMs, 4 * MINUTE);
  assert.equal(view.elapsedMs, 5 * MINUTE + 30 * SECOND);
});

test("a rest that ended while the app sat in the background tells the screen so", () => {
  const { clock, open } = phone();
  const { session, events } = open();
  session.start("glutes", "hip-thrust");
  session.done();

  clock.advance(10 * MINUTE);
  session.sync();
  assert.deepEqual(events, ["started", "set-done", "rest-ended-away"]);
});

test("a rest that ends on screen is reported as it happens", () => {
  const { clock, open } = phone();
  const { session, events } = open();
  session.start("glutes", "hip-thrust");
  session.done();

  clock.advance(59 * SECOND);
  session.sync();
  clock.advance(SECOND);
  session.sync();
  assert.deepEqual(events, ["started", "set-done", "rest-ended"]);
  assert.equal(session.view().restEndedAgoMs, null);
});

test("an unfinished workout left for three hours is gone when she comes back", () => {
  const { storage, clock, open } = phone();
  const first = open();
  first.session.start("glutes", "hip-thrust");
  first.session.done();

  clock.advance(3 * HOUR);
  const { session } = open();
  assert.equal(session.active, false);
  assert.equal(session.view(), null);
  assert.equal(storage.getItem(STORAGE_KEYS.workout), null);
});

test("one minute short of three hours, it is still there", () => {
  const { clock, open } = phone();
  const first = open();
  first.session.start("glutes", "hip-thrust");

  clock.advance(3 * HOUR - MINUTE);
  const { session } = open();
  assert.equal(session.active, true);
  assert.equal(session.view().elapsedMs, 3 * HOUR - MINUTE);
});

test("a workout left open on screen is dropped by the clock too", () => {
  const { clock, open } = phone();
  const { session, events } = open();
  session.start("glutes", "hip-thrust");
  clock.advance(3 * HOUR);
  session.sync();
  assert.equal(session.active, false);
  assert.deepEqual(events, ["started", "dropped"]);
});

test("pausing survives a close and reopen, and the total time stays frozen", () => {
  const { clock, open } = phone();
  const first = open();
  first.session.start("glutes", "hip-thrust");
  clock.advance(MINUTE);
  first.session.pause();

  clock.advance(20 * MINUTE);
  const { session } = open();
  assert.equal(session.view().paused, true);
  assert.equal(session.view().elapsedMs, MINUTE);

  session.resume();
  clock.advance(MINUTE);
  assert.equal(session.view().elapsedMs, 2 * MINUTE);
});

test("walking every set to the end finishes with the total time and clears the save", () => {
  const { storage, clock, open } = phone();
  const { session, events } = open();
  let finished = null;
  session.subscribe((event) => {
    if (event.type === "finished") finished = event;
  });

  session.start("back", "cable-row");
  let sets = 0;
  while (session.active) {
    clock.advance(30 * SECOND);
    session.done();
    sets += 1;
    if (session.active) {
      clock.advance(session.view().rest.remainingMs);
      session.sync();
    }
  }

  assert.equal(sets, 19);
  assert.equal(events.at(-1), "finished");
  // 19 sets of 30 s. Rests: main lift 3 × 60 + 90; each superset 3 × 10 + 2 × 60 + 90; finisher 2 × 60.
  assert.equal(finished.elapsedMs, (19 * 30 + 270 + 2 * 240 + 120) * SECOND);
  assert.equal(storage.getItem(STORAGE_KEYS.workout), null);
});

test("a save that is not JSON, or does not fit today's workouts, is discarded", () => {
  for (const junk of ["{not json", JSON.stringify({ schema: 1, dayId: "glutes", variationId: "gone" }), "null", "7"]) {
    const { storage, open } = phone();
    storage.setItem(STORAGE_KEYS.workout, junk);
    const { session } = open();
    assert.equal(session.active, false, junk);
  }
});

test("a save whose workout changed shape under it is discarded, not misread", () => {
  const { storage, open } = phone();
  const first = open();
  first.session.start("glutes", "hip-thrust");
  const saved = JSON.parse(storage.getItem(STORAGE_KEYS.workout));
  storage.setItem(STORAGE_KEYS.workout, JSON.stringify({ ...saved, stepIndex: 99 }));

  const { session } = open();
  assert.equal(session.active, false);
  assert.equal(storage.getItem(STORAGE_KEYS.workout), null);
});

test("if the phone refuses to save, the workout on screen carries on", () => {
  const clock = fakeClock();
  const refusing = {
    getItem() {
      throw new Error("storage is off");
    },
    setItem() {
      throw new Error("storage is full");
    },
    removeItem() {
      throw new Error("storage is off");
    },
  };
  const session = createSession({ data, store: createStore(refusing), clock });
  session.restore();
  session.start("glutes", "hip-thrust");
  clock.advance(10 * SECOND);
  session.done();
  assert.equal(session.view().phase, "rest");
});

test("starting a workout that is not in the data does nothing", () => {
  const { open } = phone();
  const { session, events } = open();
  session.start("glutes", "nope");
  assert.equal(session.active, false);
  assert.deepEqual(events, []);
});

test("the mute setting is remembered, and is the only other thing kept", () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  assert.equal(store.loadMuted(), false);
  store.saveMuted(true);
  assert.equal(createStore(storage).loadMuted(), true);
  store.saveMuted(false);
  assert.equal(createStore(storage).loadMuted(), false);
  assert.equal(storage.size, 0);
});
