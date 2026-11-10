// The state of a workout in progress, and every way it can change. Pure
// functions over a plain object that can be saved as JSON: no DOM, no storage,
// and no clock of their own. Every function that depends on time is handed
// `now` (milliseconds since the epoch), so times stay right however long the
// app was in the background and tests can move the clock.

import { AWAY_NOTE_MIN_MS, DROP_AFTER_MS, STATE_SCHEMA } from "../config.js";

export function begin({ dayId, variationId }, now) {
  return {
    schema: STATE_SCHEMA,
    dayId,
    variationId,
    stepIndex: 0,
    phase: "set",
    rest: null,
    startedAt: now,
    pausedAt: null,
    pausedMs: 0,
    touchedAt: now,
    note: null,
  };
}

export function isPaused(state) {
  return state.pausedAt !== null;
}

// While paused, time stands still at the moment Pause was tapped.
function effectiveNow(state, now) {
  return state.pausedAt ?? now;
}

export function elapsedMs(state, now) {
  return Math.max(0, effectiveNow(state, now) - state.startedAt - state.pausedMs);
}

export function restLengthMs(state) {
  return state.phase === "rest" ? state.rest.endsAt - state.rest.startedAt : 0;
}

export function restRemainingMs(state, now) {
  if (state.phase !== "rest") return 0;
  const remaining = state.rest.endsAt - effectiveNow(state, now);
  return Math.min(restLengthMs(state), Math.max(0, remaining));
}

function toSet(state, stepIndex, now, note = null) {
  return { ...state, stepIndex, phase: "set", rest: null, touchedAt: now, note };
}

// She tapped Done. Returns the next state, or `finished` with the total time
// when that was the last set.
export function completeSet(state, steps, now) {
  if (state.phase !== "set" || isPaused(state)) return { state };

  const step = steps[state.stepIndex];
  const isLast = state.stepIndex === steps.length - 1;
  if (isLast) return { state: null, finished: { elapsedMs: elapsedMs(state, now) } };
  if (!step.restAfter) return { state: toSet(state, state.stepIndex + 1, now) };

  return {
    state: {
      ...state,
      phase: "rest",
      rest: {
        kind: step.restAfter.kind,
        startedAt: now,
        endsAt: now + step.restAfter.seconds * 1000,
      },
      touchedAt: now,
      note: null,
    },
  };
}

export function skipRest(state, now) {
  if (state.phase !== "rest" || isPaused(state)) return state;
  return toSet(state, state.stepIndex + 1, now);
}

export function addRest(state, seconds, now) {
  if (state.phase !== "rest" || isPaused(state)) return state;
  return {
    ...state,
    rest: { ...state.rest, endsAt: state.rest.endsAt + seconds * 1000 },
    touchedAt: now,
  };
}

export function canStepBack(state) {
  return !isPaused(state) && (state.phase === "rest" || state.stepIndex > 0);
}

// Undo a mis-tap: a rest in progress is cancelled and the set before it is
// not yet done again. The total time is not rewound.
export function stepBack(state, now) {
  if (!canStepBack(state)) return state;
  const stepIndex = state.phase === "rest" ? state.stepIndex : state.stepIndex - 1;
  return toSet(state, stepIndex, now);
}

export function pause(state, now) {
  if (isPaused(state)) return state;
  return { ...state, pausedAt: now, touchedAt: now };
}

// Resuming moves the rest's window forward by the length of the pause, so the
// countdown picks up exactly where it stopped.
export function resume(state, now) {
  if (!isPaused(state)) return state;
  const pausedFor = Math.max(0, now - state.pausedAt);
  const rest = state.rest && {
    ...state.rest,
    startedAt: state.rest.startedAt + pausedFor,
    endsAt: state.rest.endsAt + pausedFor,
  };
  return {
    ...state,
    rest,
    pausedAt: null,
    pausedMs: state.pausedMs + pausedFor,
    touchedAt: now,
  };
}

// Brings the state up to date with the clock. Called on every repaint, on
// launch and whenever the app comes back to the screen. It reports what it
// found so the screen can chime for a rest that ended in front of her and
// stay quiet for one that ended while she was away.
export function sync(state, now) {
  if (now - state.touchedAt >= DROP_AFTER_MS) return { state: null, event: "dropped" };

  const restIsOver = state.phase === "rest" && !isPaused(state) && now >= state.rest.endsAt;
  if (!restIsOver) return { state, event: null };

  const endedAt = state.rest.endsAt;
  const endedWhileAway = now - endedAt >= AWAY_NOTE_MIN_MS;
  return {
    // The rest ending is the clock's doing, not hers, so `touchedAt` stays.
    state: {
      ...toSet(state, state.stepIndex + 1, state.touchedAt),
      note: endedWhileAway ? { restEndedAt: endedAt } : null,
    },
    event: endedWhileAway ? "rest-ended-away" : "rest-ended",
  };
}

// True when a saved state can be used with the steps built from today's data
// file. A save from an older shape, or one that no longer fits the workout
// (the file changed in an update), is not.
export function fits(state, steps) {
  const isObject = state !== null && typeof state === "object";
  if (!isObject || state.schema !== STATE_SCHEMA) return false;

  const timesAreNumbers = [state.startedAt, state.pausedMs, state.touchedAt].every(Number.isFinite);
  const pauseIsValid = state.pausedAt === null || Number.isFinite(state.pausedAt);
  const stepExists = Number.isInteger(state.stepIndex) && state.stepIndex >= 0 && state.stepIndex < steps.length;
  const noteIsValid = state.note === null || Number.isFinite(state.note?.restEndedAt);
  if (!timesAreNumbers || !pauseIsValid || !stepExists || !noteIsValid) return false;

  if (state.phase === "set") return true;
  const restIsWhole = Number.isFinite(state.rest?.startedAt) && Number.isFinite(state.rest?.endsAt);
  const hasNextStep = state.stepIndex < steps.length - 1;
  return state.phase === "rest" && restIsWhole && hasNextStep;
}
