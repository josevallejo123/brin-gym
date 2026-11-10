// Behaviour settings that are not workout content. Everything about the
// workouts themselves (exercises, reps, sets, rest lengths) lives in
// data/workouts.json and nowhere else.

export const DATA_URL = "data/workouts.json";
export const CREDITS_URL = "art/credits.json";
export const VERSION_URL = "version.json";
export const ART_DIR = "art";
export const SERVICE_WORKER_URL = "sw.js";

export const STORAGE_KEYS = {
  workout: "brin-gym.workout",
  muted: "brin-gym.muted",
};

// Bumped when the saved workout's shape changes, so an old save is dropped
// instead of being misread.
export const STATE_SCHEMA = 1;

// An unfinished workout nobody has touched for this long is dropped.
export const DROP_AFTER_MS = 3 * 60 * 60 * 1000;

// A rest that ended at least this long before the app next looked at the
// clock ended while she was away: she gets a note instead of a chime.
export const AWAY_NOTE_MIN_MS = 3000;

// How often the screen re-reads the clock during a workout. This is not a
// unit of time: every time shown is computed from timestamps.
export const REPAINT_MS = 200;

// A progress line is redrawn only when it has moved by this fraction of its
// length, which is less than a pixel on any phone.
export const PROGRESS_STEP = 0.001;

// The seconds of a rest countdown that get a quiet tick.
export const COUNTDOWN_TICKS = [3, 2, 1];
