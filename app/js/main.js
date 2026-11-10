// Starts the app: loads the workouts, picks up a workout in progress, and
// shows the screen the address asks for (ui/routes.js lists the addresses).

import { CREDITS_URL, DATA_URL, SERVICE_WORKER_URL, VERSION_URL } from "./config.js";
import { eventCue } from "./logic/cues.js";
import { findVariation } from "./logic/sequence.js";
import { createSession } from "./logic/session.js";
import { createStore } from "./logic/store.js";
import { createSounds } from "./platform/sounds.js";
import { createUpdater } from "./platform/updates.js";
import { createWakeLock } from "./platform/wake-lock.js";
import { changeScreen } from "./ui/handover.js";
import { ABOUT, DONE, HOME, WORKOUT, dayAddress, workoutInAddress } from "./ui/routes.js";
import { dayScreen, homeScreen, variationScreen } from "./ui/screens/lists.js";
import { aboutScreen, failedScreen, finishScreen } from "./ui/screens/plain.js";
import { playerScreen } from "./ui/screens/player.js";

const app = document.getElementById("app");

// Reaching for localStorage can itself throw when storage is blocked, so it
// is only touched inside calls the store already guards.
const phoneStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} did not load (${response.status}).`);
  return response.json();
}

async function loadAbout() {
  const [credits, { version }] = await Promise.all([loadJson(CREDITS_URL), loadJson(VERSION_URL)]);
  return { credits, version };
}

// The screen on show, and what it needs done when it is replaced.
let showing = null;
let leaveScreen = null;

function show(name, element, leave = null) {
  leaveScreen?.();
  leaveScreen = leave;
  showing = name;
  changeScreen(app, element);
}

function start(data) {
  const store = createStore(phoneStorage);
  const session = createSession({ data, store, clock: { now: () => Date.now() } });
  const sounds = createSounds({ muted: store.loadMuted(), onMutedChange: store.saveMuted });
  const wakeLock = createWakeLock();
  // The time of the workout just finished, while the Finish screen shows it.
  let finishedMs = null;

  const updater =
    "serviceWorker" in navigator
      ? createUpdater({
          workers: navigator.serviceWorker,
          workerUrl: SERVICE_WORKER_URL,
          canInterrupt: () => !session.active && finishedMs === null,
          reload: () => location.reload(),
        })
      : null;

  // How many screens deep she is, kept on each history entry: a screen reached
  // by tapping a link is one deeper than the screen the link was on.
  let depth = -1;

  function noteDepth() {
    if (history.state?.depth === undefined) history.replaceState({ depth: depth + 1 }, "");
    depth = history.state.depth;
  }

  // Moves to an address without leaving the old one behind, so a back swipe
  // never returns to a workout that is over.
  function replace(address) {
    history.replaceState({ depth }, "", address);
    route();
  }

  // The back control steps back through history when the screen before is
  // part of the app, so it and the iOS back swipe always agree. Opened
  // directly (after a reload, say) there is nothing behind, and it goes to
  // the screen above instead.
  const backTo = (address) => () => (depth > 0 ? history.back() : replace(address));

  function showPlayer() {
    if (location.hash !== WORKOUT) history.replaceState({ depth }, "", WORKOUT);
    if (showing === "player") return;
    const player = playerScreen({ data, session, sounds, wakeLock });
    show("player", player.element, player.leave);
  }

  function showFinish() {
    if (showing === "finish") return;
    const forget = () => {
      finishedMs = null;
    };
    show("finish", finishScreen({ elapsedMs: finishedMs, goHome: () => replace(HOME) }), forget);
  }

  function route() {
    noteDepth();
    // A workout in progress owns the screen, whatever the address says.
    if (session.active) {
      showPlayer();
      return;
    }
    if (location.hash === DONE && finishedMs !== null) {
      showFinish();
      return;
    }

    const { dayId, variationId } = workoutInAddress(location.hash);
    const day = data.days.find((candidate) => candidate.id === dayId);
    const found = day && findVariation(data, dayId, variationId);
    if (found) {
      const onStart = () => session.start(dayId, variationId);
      show("variation", variationScreen({ data, ...found, goBack: backTo(dayAddress(dayId)), onStart }));
    } else if (day) {
      show("day", dayScreen({ day, goBack: backTo(HOME) }));
    } else if (location.hash === ABOUT) {
      show("about", aboutScreen({ load: loadAbout, goBack: backTo(HOME) }));
    } else {
      show("home", homeScreen({ data }));
    }
    // With no workout on screen, a new version that was held back may come in.
    updater?.settle();
  }

  // A workout saved by an earlier launch is picked up before anything listens,
  // so the first screen shown is simply the right one.
  session.restore();

  session.subscribe((event) => {
    const cue = eventCue(event.type);
    if (cue) sounds.play(cue);

    if (event.type === "started") route();
    if (event.type === "ended" || event.type === "dropped") replace(HOME);
    if (event.type === "finished") {
      finishedMs = event.elapsedMs;
      replace(DONE);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updater?.check();
  });
  window.addEventListener("hashchange", route);
  // iOS applies :active styles only when something listens for touches.
  document.addEventListener("touchstart", () => {}, { passive: true });

  route();

  // Without a service worker the app still runs; it just needs a connection.
  updater?.start().catch(() => {});
  // Asks the browser not to clear the app's storage under pressure. Where it
  // says no, or cannot be asked, storage behaves as it always did.
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}

async function boot() {
  let data;
  try {
    data = await loadJson(DATA_URL);
  } catch {
    show("failed", failedScreen({ retry: boot }));
    return;
  }
  start(data);
}

boot();
