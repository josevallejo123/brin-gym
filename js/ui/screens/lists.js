// Home, Day and Variation: the three screens she steps through to pick a
// workout. Each returns the element to show.

import { outline } from "../../logic/sequence.js";
import { COPY, blockName, setsSummary, variationLead } from "../copy.js";
import { button, el, topbar } from "../dom.js";
import { stillDrawing } from "../drawing.js";
import { NAMES } from "../handover.js";
import { ABOUT, dayAddress, variationAddress } from "../routes.js";

// The boxes of Home and Day. Each name is marked with the address it leads
// to, and so is the title of the screen at that address, which lets the name
// travel between the two when she taps (handover.js).
function choices(items) {
  return el(
    "nav",
    { class: "choices" },
    items.map(({ href, lead, name }) =>
      el(
        "a",
        { class: "choice serif", href },
        el(
          "span",
          { class: "choice-words" },
          lead && el("span", { class: "choice-lead" }, lead),
          el("span", { class: "choice-name", [NAMES]: href }, name),
        ),
      ),
    ),
  );
}

export function homeScreen({ data }) {
  return el(
    "main",
    { class: "screen home" },
    el("h1", { class: "screen-title home-title serif" }, COPY.appName),
    choices(data.days.map((day) => ({ href: dayAddress(day.id), name: day.name }))),
    el("div", {}, el("a", { class: "quiet-link", href: ABOUT }, COPY.about)),
  );
}

export function dayScreen({ day, goBack }) {
  return el(
    "main",
    { class: "screen day" },
    topbar(goBack),
    el("h1", { class: "screen-title day-title serif", [NAMES]: dayAddress(day.id) }, day.name),
    choices(
      day.variations.map((variation, index) => ({
        href: variationAddress(day.id, variation.id),
        lead: variationLead(index),
        name: variation.name,
      })),
    ),
  );
}

function exerciseRow(data, entry, slot) {
  const exercise = data.exercises[slot.exercise];
  return el(
    "li",
    { class: "exercise-row" },
    stillDrawing(slot.exercise, exercise),
    el(
      "div",
      {},
      el("p", { class: "exercise-name" }, exercise.name),
      el("p", { class: "exercise-sets" }, setsSummary(entry, slot)),
    ),
  );
}

function group(data, entry) {
  return el(
    "section",
    { class: "group" },
    el("h2", { class: "group-name" }, blockName(entry.block)),
    el("ul", { class: "exercise-rows" }, entry.slots.map((slot) => exerciseRow(data, entry, slot))),
  );
}

export function variationScreen({ data, day, variation, goBack, onStart }) {
  return el(
    "main",
    { class: "screen variation" },
    topbar(goBack),
    el(
      "div",
      { class: "scroll-area" },
      el("h1", { class: "screen-title serif", [NAMES]: variationAddress(day.id, variation.id) }, variation.name),
      el("p", { class: "variation-day" }, day.name),
      outline(data, variation).map((entry) => group(data, entry)),
    ),
    el("footer", { class: "footer-actions" }, button(COPY.start, onStart, "button-main")),
  );
}
