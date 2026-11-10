// Registers the service worker and decides when a new version may take over.
//
// A new version downloads in the background and then waits. It is let in only
// when `canInterrupt()` says nothing would be lost, which is never during a
// workout. Letting it in reloads the page once, onto the new files.
//
// `workers` is navigator.serviceWorker; it is passed in so the rules can be
// tested with a stand-in (tests/logic/updates.test.mjs).

export function createUpdater({ workers, workerUrl, canInterrupt, reload }) {
  let registration = null;
  let reloadDue = false;
  // A page that starts with no worker gets its first one by install, not by
  // update, and has nothing to reload for.
  let controlled = Boolean(workers.controller);

  function letWaitingVersionIn() {
    if (registration?.waiting && canInterrupt()) registration.waiting.postMessage({ type: "activate" });
  }

  function reloadIfDue() {
    if (!reloadDue || !canInterrupt()) return;
    reloadDue = false;
    reload();
  }

  workers.addEventListener("controllerchange", () => {
    if (controlled) reloadDue = true;
    controlled = true;
    reloadIfDue();
  });

  function watch(worker) {
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") letWaitingVersionIn();
    });
  }

  return {
    async start() {
      registration = await workers.register(workerUrl, { updateViaCache: "none" });
      registration.addEventListener("updatefound", () => watch(registration.installing));
      letWaitingVersionIn();
    },

    // Asks the server whether there is a new version. Called when the app
    // comes back to the screen, and left for later during a workout, when a
    // new version could only download and wait anyway.
    check() {
      if (!canInterrupt()) return;
      // With no signal the check fails, which is the normal state of an
      // offline app: the version on the phone carries on.
      registration?.update().catch(() => {});
    },

    // Called whenever a workout ends or the screen changes: a version that
    // was held back may now be let in.
    settle() {
      letWaitingVersionIn();
      reloadIfDue();
    },
  };
}
