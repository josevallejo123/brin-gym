// The confetti behind the Finish screen. CSS drops and tumbles each piece
// (css/screens.css); here each one only gets its own place, pace, delay and
// spin, as fractions between 0 and 1 that the stylesheet scales into the
// ranges in tokens.css. A piece's colour and shape come from its place in the
// list, so no colour is written here.

import { CONFETTI_PIECES } from "../config.js";
import { el } from "./dom.js";

const FRACTIONS = ["piece-x", "piece-y", "piece-pace", "piece-delay", "piece-spin"];

function piece() {
  const node = el("span", { class: "confetti-piece" });
  for (const name of FRACTIONS) node.style.setProperty(`--${name}`, Math.random().toFixed(3));
  return node;
}

// Returns the layer, and `stop` for when the screen is left. Nothing moves
// while the app is out of sight.
export function confetti() {
  const layer = el("div", { class: "confetti", "aria-hidden": "true" }, Array.from({ length: CONFETTI_PIECES }, piece));
  const followVisibility = () => layer.toggleAttribute("data-paused", document.visibilityState === "hidden");
  document.addEventListener("visibilitychange", followVisibility);
  return {
    element: layer,
    stop: () => document.removeEventListener("visibilitychange", followVisibility),
  };
}
