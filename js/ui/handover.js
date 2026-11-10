// Changes the screen on show.
//
// When the old screen and the new one both show the name of the same place
// (a day's box on Home and the Day screen's title, say), the name travels
// from where it was to where it now is, the old screen fades out behind it,
// and the parts of the new screen step in after it. Any other change is one
// plain fade. The movement itself is in css/base.css.
//
// Both screens' copies of the name make the journey together, the old one
// fading out as the new one fades in, so a name set on one line in its box
// and on two as a title changes shape on the way instead of jumping.
//
// The new screen is in place at once and only its look is animated, so
// nothing waits for an animation to end and a tap during one lands on the
// new screen.

// A piece of text that is the name of a place carries that place's address.
export const NAMES = "data-names";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const namesOn = (screen) => [...screen.querySelectorAll(`[${NAMES}]`)];
const isTitle = (node) => node.matches(".screen-title");

// The name that one screen shows in a box and the other as its title, as the
// old screen's element and the new one's. A screen shown again over itself
// (Home, when the address names nothing) shares every name but moves none.
function sharedName(old, next) {
  const oldNames = new Map(namesOn(old).map((node) => [node.getAttribute(NAMES), node]));
  const arriving = namesOn(next).find((node) => {
    const leaving = oldNames.get(node.getAttribute(NAMES));
    return leaving && isTitle(leaving) !== isTitle(node);
  });
  return arriving ? { leaving: oldNames.get(arriving.getAttribute(NAMES)), arriving } : null;
}

// Where a name sits and how large it is set.
function placeOf(node) {
  const { left, top } = node.getBoundingClientRect();
  return { left, top, size: Number.parseFloat(getComputedStyle(node).fontSize) };
}

// Tells the stylesheet where the other end of a name's journey is, measured
// from the name's own place and size.
function pointAt(node, own, other) {
  node.style.setProperty("--travel-x", `${other.left - own.left}px`);
  node.style.setProperty("--travel-y", `${other.top - own.top}px`);
  node.style.setProperty("--travel-scale", other.size / own.size);
}

// Lets a screen arrive in the way named, then takes the name off it again,
// so that a screen which has arrived is a plain screen. In scripted runs that
// never looked at the page, a finished entrance left in place was measured
// at the next press as if it were still running, and the name set out from
// the wrong spot.
async function arrive(screen, way, parts) {
  screen.classList.add(way);
  await Promise.allSettled(screen.getAnimations(parts).map((animation) => animation.finished));
  screen.classList.remove(way);
}

// Keeps the old screen on show while it fades, but out of the page: it can
// be neither tapped nor read by assistive technology.
function fadeOut(old) {
  old.classList.remove("fades-in", "steps-in");
  old.classList.add("leaving");
  old.inert = true;
  old.setAttribute("aria-hidden", "true");
  old.addEventListener("animationend", (event) => {
    if (event.target === old) old.remove();
  });
}

export function changeScreen(app, next) {
  // Anything before the last screen is an older one still fading out.
  const old = app.lastElementChild;
  const name = old && !reducedMotion.matches ? sharedName(old, next) : null;
  // Measured while the old screen is still laid out.
  const from = name && placeOf(name.leaving);

  for (const screen of [...app.children]) {
    if (!name || screen !== old) screen.remove();
  }
  app.append(next);
  if (!name) {
    arrive(next, "fades-in", { subtree: false });
    return;
  }

  // Measured before the new screen is told how to arrive, so this is where
  // the name will rest, not where an animation has it for now.
  const to = placeOf(name.arriving);

  pointAt(name.leaving, from, to);
  name.leaving.classList.add("departs");
  name.leaving.closest(".choice")?.classList.add("chosen");
  fadeOut(old);

  pointAt(name.arriving, to, from);
  name.arriving.classList.add("arrives");
  name.arriving.closest(".choice")?.classList.add("receives");
  arrive(next, "steps-in", { subtree: true });
}
