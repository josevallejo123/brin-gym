// Which sound goes with what happens in a workout. The names are the sounds
// in platform/sounds.js; nothing here plays anything.

const EVENT_SOUNDS = {
  "set-done": "setDone",
  finished: "setDone",
  // Only a rest that ends in front of her chimes. One that ended while she
  // was away is a different event, and is silent.
  "rest-ended": "chime",
};

export const eventCue = (eventType) => EVENT_SOUNDS[eventType] ?? null;

// The rest countdown gets a quiet tick at the moment a watched second first
// shows on screen, so a countdown she comes back to at "0:02" ticks for 2 and
// 1 and never replays the 3 she missed.
export function countdownCue(previousSeconds, seconds, tickSeconds) {
  const changed = seconds !== previousSeconds;
  return changed && tickSeconds.includes(seconds) ? "tick" : null;
}
