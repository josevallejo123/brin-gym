// How times are written. No DOM and no words: screen copy lives in ui/copy.js.

const pad = (number) => String(number).padStart(2, "0");

function clockFromSeconds(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

// Time that has passed: a second shows once it is complete ("0:59" until a
// full minute is up).
export function formatElapsed(ms) {
  return clockFromSeconds(Math.floor(Math.max(0, ms) / 1000));
}

// Time that is left: a second shows until it is used up, so a 60-second rest
// opens on "1:00" and reaches "0:00" at the moment it ends.
export function countdownSeconds(ms) {
  return Math.ceil(Math.max(0, ms) / 1000);
}

export function formatCountdown(ms) {
  return clockFromSeconds(countdownSeconds(ms));
}
