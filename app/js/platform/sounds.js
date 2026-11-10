// The app's three sounds, made with Web Audio so they play over her music.
//
// There is deliberately no <audio> or <video> element and no sound file: a
// media element puts the page's audio session into "playback", which pauses
// Spotify and Apple Music. Web Audio alone leaves the session "ambient", the
// one type defined as mixing with other apps' audio, and where Safari exposes
// navigator.audioSession the type is set to "ambient" outright. The accepted
// side effect: an ambient session is silent when the iPhone's ring switch is
// set to silent.

// Each sound is a list of notes: a pitch that may glide, with a quick fade in
// and a longer fade out. Volumes are fractions of full scale.
export const SOUNDS = {
  // The quiet tick at 3, 2 and 1.
  tick: [{ hz: 880, peak: 0.1, attackS: 0.004, decayS: 0.07 }],
  // The tick when a set is done: a soft, falling tock.
  setDone: [
    { hz: 620, glideToHz: 440, peak: 0.24, attackS: 0.004, decayS: 0.16 },
    { hz: 1240, peak: 0.05, attackS: 0.002, decayS: 0.05 },
  ],
  // The chime when a rest ends: two soft notes, a fifth apart.
  chime: [
    { hz: 784, peak: 0.2, attackS: 0.01, decayS: 1.3 },
    { hz: 1568, peak: 0.04, attackS: 0.01, decayS: 0.7 },
    { hz: 1175, peak: 0.18, attackS: 0.01, decayS: 1.6, startS: 0.16 },
    { hz: 2350, peak: 0.03, attackS: 0.01, decayS: 0.8, startS: 0.16 },
  ],
};

const SILENCE = 0.0001;

export function createSounds({ muted, onMutedChange }) {
  let context = null;
  let isMuted = muted;
  // True from a tap asking for sound until the browser has switched it on.
  // A sound asked for in that same tap is queued and plays a moment later.
  let unlocking = false;

  // Browsers only let sound start from inside a tap, and "click" is the one
  // event every browser counts as a tap. Listening on the way down the page
  // means sound is on before the tapped button's own handler runs.
  function unlock() {
    if (!("AudioContext" in window)) return;
    if (context === null) {
      if ("audioSession" in navigator) navigator.audioSession.type = "ambient";
      context = new AudioContext();
    }
    if (context.state === "running") return;
    unlocking = true;
    context
      .resume()
      // A browser that still refuses leaves sound off until the next tap.
      .catch(() => {})
      .finally(() => {
        unlocking = false;
      });
  }

  // iOS suspends the audio context whenever the app leaves the screen.
  function wake() {
    if (document.visibilityState !== "visible" || context === null || context.state === "running") return;
    // Without a tap this may be refused; the next tap unlocks it instead.
    context.resume().catch(() => {});
  }

  document.addEventListener("click", unlock, { capture: true });
  document.addEventListener("visibilitychange", wake);

  // Only when the app is on screen: a sound for something that happened in
  // the background would be late, and could land on top of whatever she is
  // doing in another app.
  function canPlay() {
    const soundIsOn = context?.state === "running" || unlocking;
    return !isMuted && soundIsOn && document.visibilityState === "visible";
  }

  return {
    get muted() {
      return isMuted;
    },

    setMuted(next) {
      isMuted = next;
      onMutedChange(next);
    },

    // Plays one of SOUNDS by name.
    play(name) {
      if (!canPlay()) return;
      for (const note of SOUNDS[name]) {
        const start = context.currentTime + (note.startS ?? 0);
        const end = start + note.attackS + note.decayS;
        const oscillator = new OscillatorNode(context, { type: "sine", frequency: note.hz });
        const gain = new GainNode(context, { gain: SILENCE });

        if (note.glideToHz) oscillator.frequency.exponentialRampToValueAtTime(note.glideToHz, end);
        gain.gain.setValueAtTime(SILENCE, start);
        gain.gain.exponentialRampToValueAtTime(note.peak, start + note.attackS);
        gain.gain.exponentialRampToValueAtTime(SILENCE, end);

        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(end);
      }
    },
  };
}
