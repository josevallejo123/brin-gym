// The only two things the app remembers: the mute setting and a workout in
// progress. `storage` is anything shaped like localStorage, so tests pass a
// plain in-memory one.

import { STORAGE_KEYS } from "../config.js";

export function createStore(storage) {
  // Storage can refuse to read or write (private browsing, a full disk). The
  // app then carries on with what it holds in memory for this launch: losing
  // the save is better than losing the workout on screen.
  function read(key) {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  function write(key, value) {
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch {
      // Refused: the workout carries on in memory, as said above.
    }
  }

  return {
    // Returns whatever was saved, or null. Whether it still fits today's
    // workouts is the session's call (workout.fits).
    loadWorkout() {
      const saved = read(STORAGE_KEYS.workout);
      if (saved === null) return null;
      try {
        return JSON.parse(saved);
      } catch {
        // A save that is not JSON cannot be a workout: treat it as absent.
        return null;
      }
    },

    saveWorkout(state) {
      write(STORAGE_KEYS.workout, state === null ? null : JSON.stringify(state));
    },

    loadMuted() {
      return read(STORAGE_KEYS.muted) === "1";
    },

    saveMuted(muted) {
      write(STORAGE_KEYS.muted, muted ? "1" : null);
    },
  };
}
