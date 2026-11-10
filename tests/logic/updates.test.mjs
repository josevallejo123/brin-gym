// When a new version of the app may take over: never during a workout.
// navigator.serviceWorker is replaced by a stand-in that the test drives.

import assert from "node:assert/strict";
import { test } from "node:test";

import { createUpdater } from "../../app/js/platform/updates.js";

function fakeWorker() {
  const worker = {
    state: "installing",
    messages: [],
    postMessage: (message) => worker.messages.push(message),
    addEventListener: (_type, listener) => {
      worker.onStateChange = listener;
    },
    become(state) {
      worker.state = state;
      worker.onStateChange?.();
    },
  };
  return worker;
}

// One browser tab: is it controlled by a worker already, and is a workout in
// progress?
function tab({ controlled, busy = false, waiting = null }) {
  const listeners = {};
  const registration = {
    waiting,
    installing: null,
    update: () => Promise.resolve(),
    addEventListener: (type, listener) => {
      listeners[type] = listener;
    },
  };
  const workers = {
    controller: controlled ? {} : null,
    register: async () => registration,
    addEventListener: (type, listener) => {
      listeners[type] = listener;
    },
  };
  const page = {
    busy,
    reloads: 0,
    registration,
    updater: null,
    controllerChanged: () => listeners.controllerchange(),
    // A new version arrives: it downloads, installs and then waits.
    newVersion() {
      const worker = fakeWorker();
      registration.installing = worker;
      listeners.updatefound();
      registration.installing = null;
      registration.waiting = worker;
      worker.become("installed");
      return worker;
    },
  };
  page.updater = createUpdater({
    workers,
    workerUrl: "sw.js",
    canInterrupt: () => !page.busy,
    reload: () => {
      page.reloads += 1;
    },
  });
  return page;
}

const ACTIVATE = [{ type: "activate" }];

test("the first install on a fresh page reloads nothing", async () => {
  const page = tab({ controlled: false });
  await page.updater.start();
  page.controllerChanged();
  assert.equal(page.reloads, 0);
});

test("a version already waiting at launch is let in at once when no workout is on", async () => {
  const waiting = fakeWorker();
  const page = tab({ controlled: true, waiting });
  await page.updater.start();
  assert.deepEqual(waiting.messages, ACTIVATE);
});

test("a version that arrives while idle is let in, and the page reloads once onto it", async () => {
  const page = tab({ controlled: true });
  await page.updater.start();
  const worker = page.newVersion();
  assert.deepEqual(worker.messages, ACTIVATE);

  page.controllerChanged();
  assert.equal(page.reloads, 1);
});

test("a version that arrives during a workout waits, and is let in when the workout ends", async () => {
  const page = tab({ controlled: true, busy: true });
  await page.updater.start();
  const worker = page.newVersion();
  assert.deepEqual(worker.messages, []);

  page.updater.settle();
  assert.deepEqual(worker.messages, [], "still in the workout");

  page.busy = false;
  page.updater.settle();
  assert.deepEqual(worker.messages, ACTIVATE);
});

test("a version already waiting at launch is held back if a workout is in progress", async () => {
  const waiting = fakeWorker();
  const page = tab({ controlled: true, busy: true, waiting });
  await page.updater.start();
  assert.deepEqual(waiting.messages, []);
});

test("if a new version takes over mid-workout anyway, the reload waits for the workout to end", async () => {
  const page = tab({ controlled: true, busy: true });
  await page.updater.start();
  page.controllerChanged();
  assert.equal(page.reloads, 0);

  page.busy = false;
  page.updater.settle();
  assert.equal(page.reloads, 1);

  page.updater.settle();
  assert.equal(page.reloads, 1, "one reload, not one per settle");
});

test("a page that got its first worker by install still reloads for a later update", async () => {
  const page = tab({ controlled: false });
  await page.updater.start();
  page.controllerChanged();
  page.newVersion();
  page.controllerChanged();
  assert.equal(page.reloads, 1);
});

test("checking for a new version with no signal fails quietly", async () => {
  const page = tab({ controlled: true });
  await page.updater.start();
  page.registration.update = () => Promise.reject(new TypeError("offline"));
  page.updater.check();
  // An unhandled rejection would fail this test run.
  await new Promise((resolve) => setImmediate(resolve));
});

test("no check for a new version is made during a workout", async () => {
  const page = tab({ controlled: true, busy: true });
  await page.updater.start();
  let asked = 0;
  page.registration.update = async () => {
    asked += 1;
  };
  page.updater.check();
  assert.equal(asked, 0);

  page.busy = false;
  page.updater.check();
  assert.equal(asked, 1);
});

test("checking before the worker has registered does nothing", () => {
  const page = tab({ controlled: true });
  assert.doesNotThrow(() => page.updater.check());
  assert.doesNotThrow(() => page.updater.settle());
});
