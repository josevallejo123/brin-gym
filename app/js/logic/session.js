// One workout in progress: the state, the steps it runs through, the clock
// and the save. Every change is saved before anyone is told about it, so
// closing the app at any moment loses nothing. No DOM.

import { buildSteps, findVariation } from "./sequence.js";
import * as workout from "./workout.js";

export function createSession({ data, store, clock }) {
  let state = null;
  let steps = null;
  const listeners = new Set();

  function stepsFor(dayId, variationId) {
    const found = findVariation(data, dayId, variationId);
    return found && buildSteps(data, found.variation);
  }

  function commit(nextState, event) {
    if (nextState === state) return;
    state = nextState;
    if (state === null) steps = null;
    store.saveWorkout(state);
    listeners.forEach((listener) => listener(event));
  }

  function act(change, type) {
    if (state === null) return;
    commit(change(state, clock.now()), { type });
  }

  function sync() {
    if (state === null) return;
    const result = workout.sync(state, clock.now());
    if (result.event) commit(result.state, { type: result.event });
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    get active() {
      return state !== null;
    },

    // Picks up a saved workout at launch. A save that no longer fits the data
    // file is discarded; one that does is brought up to date with the clock.
    restore() {
      const saved = store.loadWorkout();
      const savedSteps = saved && stepsFor(saved.dayId, saved.variationId);
      if (!savedSteps || !workout.fits(saved, savedSteps)) {
        if (saved !== null) store.saveWorkout(null);
        return;
      }
      state = saved;
      steps = savedSteps;
      sync();
    },

    start(dayId, variationId) {
      const nextSteps = stepsFor(dayId, variationId);
      if (!nextSteps) return;
      steps = nextSteps;
      commit(workout.begin({ dayId, variationId }, clock.now()), { type: "started" });
    },

    done() {
      if (state === null) return;
      const result = workout.completeSet(state, steps, clock.now());
      const event = result.finished
        ? { type: "finished", elapsedMs: result.finished.elapsedMs }
        : { type: "set-done" };
      commit(result.state, event);
    },

    skipRest: () => act(workout.skipRest, "rest-skipped"),
    addRest: () =>
      act((current, now) => workout.addRest(current, data.rests.addRestSeconds, now), "rest-extended"),
    stepBack: () => act(workout.stepBack, "stepped-back"),
    pause: () => act(workout.pause, "paused"),
    resume: () => act(workout.resume, "resumed"),
    end: () => act(() => null, "ended"),
    sync,

    // Everything the screen needs, worked out from the clock at this moment.
    view() {
      if (state === null) return null;
      const now = clock.now();
      return {
        stepIndex: state.stepIndex,
        step: steps[state.stepIndex],
        nextStep: steps[state.stepIndex + 1] ?? null,
        phase: state.phase,
        paused: workout.isPaused(state),
        canStepBack: workout.canStepBack(state),
        elapsedMs: workout.elapsedMs(state, now),
        targetMs: data.targetSeconds * 1000,
        addRestSeconds: data.rests.addRestSeconds,
        rest:
          state.phase === "rest"
            ? {
                kind: state.rest.kind,
                remainingMs: workout.restRemainingMs(state, now),
                lengthMs: workout.restLengthMs(state),
              }
            : null,
        restEndedAgoMs: state.note ? Math.max(0, now - state.note.restEndedAt) : null,
      };
    },
  };
}
