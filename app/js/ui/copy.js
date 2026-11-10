// Every word the app shows that is not workout content. Plain sentence case:
// no exclamation marks, no cheer. Exercise names, reps and rest lengths come
// from data/workouts.json; nothing here names an exercise or a number of reps.

import { formatElapsed } from "../logic/format.js";

export const COPY = {
  appName: "Brin Gym",
  about: "About",
  back: "Back",
  home: "Home",
  start: "Start",
  done: "Done",
  resume: "Resume",
  pause: "Pause",
  paused: "Paused",
  mute: "Turn sounds off",
  unmute: "Turn sounds on",
  stepBack: "Back one set",
  skipRest: "Skip",
  next: "Next",
  endWorkout: "End workout",
  endQuestion: "End this workout?",
  endDetail: "Your place in it will not be kept.",
  continueWorkout: "Continue",
  drawings: "Drawings",
  type: "Type",
  typeCredit: "Bodoni Moda and Jost, under the SIL Open Font License.",
  loadFailed: "The workouts did not load.",
  aboutFailed: "The credits did not load.",
  loadFailedDetail: "Check the connection, then try again.",
  tryAgain: "Try again",
};

const BLOCK_NAMES = {
  main: "Main lift",
  supersetA: "Superset A",
  supersetB: "Superset B",
  finisher: "Finisher",
};

const REST_NAMES = {
  rest: "Rest",
  switch: "Switch",
  setup: "Set up",
};

const EACH = {
  side: "each side",
  way: "each way",
};

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export const blockName = (block) => BLOCK_NAMES[block];
export const restName = (kind) => REST_NAMES[kind];

// "10", "10 each side", "12 each way". The count and the words are returned
// apart because the player sets the count much larger.
export function repsParts(slot) {
  return { count: String(slot.reps), each: EACH[slot.each] ?? "" };
}

export function repsText(slot) {
  const { count, each } = repsParts(slot);
  return each ? `${count} ${each}` : count;
}

// Where she is in the workout, as shown on the player.
export function stepLabel(step) {
  if (step.block === "main") {
    if (!step.warmup) return `Set ${step.number} of ${step.of}`;
    return step.of === 1 ? "Warm-up set" : `Warm-up set ${step.number} of ${step.of}`;
  }
  const unit = step.block === "finisher" ? "set" : "round";
  return `${BLOCK_NAMES[step.block]} · ${unit} ${step.number} of ${step.of}`;
}

// Sets and reps for one row of the variation list. `entry` is the row's block
// from sequence.js: how many warm-ups, then how many times through.
export function setsSummary({ block, warmups, times }, slot) {
  const isSuperset = block !== "main" && block !== "finisher";
  const work = `${plural(times, isSuperset ? "round" : "set")} of ${repsText(slot)}`;
  if (warmups === 0) return work;
  const warmup = warmups === 1 ? "Warm-up set" : plural(warmups, "warm-up set");
  return `${warmup}, then ${work}`;
}

// What comes before a variation's name in its box: "1 · " of "1 · Hip thrust".
export const variationLead = (index) => `${index + 1} · `;
export const addRestLabel = (seconds) => `Add ${plural(seconds, "second")}`;
export const targetText = (targetMs) => `/ ${formatElapsed(targetMs)}`;
export const finishText = (elapsedMs) => `${COPY.done} · ${formatElapsed(elapsedMs)}`;
export const versionText = (version) => `Version ${version}`;

// The note she sees when a rest ran out while the app was in the background.
export function restEndedText(agoMs) {
  const totalSeconds = Math.floor(agoMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let ago = plural(totalSeconds, "second");
  if (hours > 0) ago = minutes > 0 ? `${plural(hours, "hour")} ${plural(minutes, "minute")}` : plural(hours, "hour");
  else if (totalMinutes > 0) ago = plural(totalMinutes, "minute");
  return `Rest ended ${ago} ago`;
}
