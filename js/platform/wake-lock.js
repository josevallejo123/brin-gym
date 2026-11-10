// Keeps the display from locking while a workout is on screen, using the
// Screen Wake Lock API. The system drops the lock whenever the app leaves the
// screen, so it is asked for again each time the app comes back.
//
// Where the API is missing or the request is refused (Low Power Mode, or a
// Home Screen web app before iOS 18.4), the screen simply locks as usual.
// There is no video or audio trick to hold it awake: those can stop her music.

export function createWakeLock() {
  let wanted = false;
  let lock = null;
  // True while a request is in flight, so two are never held at once.
  let asking = false;

  async function request() {
    const possible = "wakeLock" in navigator && document.visibilityState === "visible";
    if (!wanted || lock !== null || asking || !possible) return;
    asking = true;
    try {
      const granted = await navigator.wakeLock.request("screen");
      // The workout may have ended while the request was in flight.
      if (!wanted) {
        granted.release();
        return;
      }
      lock = granted;
      // The system drops the lock when the app leaves the screen. A lock that
      // has since been replaced must not clear its replacement.
      granted.addEventListener("release", () => {
        if (lock === granted) lock = null;
      });
    } catch {
      // Refused. As the brief asks: do nothing, and let the screen lock.
    } finally {
      asking = false;
    }
  }

  document.addEventListener("visibilitychange", request);

  return {
    hold() {
      wanted = true;
      request();
    },
    release() {
      wanted = false;
      lock?.release();
      lock = null;
    },
  };
}
