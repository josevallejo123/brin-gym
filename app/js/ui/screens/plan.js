// The plan of the workout in progress, opened from the player's top bar: the
// list she saw before Start, with every set marked done, current or left. It
// only shows. The player carries on behind it, every clock and sound with it,
// and whether it is open is not saved.

import { planOf } from "../../logic/plan.js";
import { findVariation, outline } from "../../logic/sequence.js";
import { COPY, setsDoneText } from "../copy.js";
import { button, closeOnBackdrop, el } from "../dom.js";
import { exerciseGroups } from "../exercise-list.js";

// The exercise she is at says so in words, so colour is never the only signal.
const CURRENT_WORDS = { now: COPY.now, next: COPY.next };

function paintMarks(line, block, row) {
  const done = row.marks.filter((mark) => mark === "done").length;
  const dots = el(
    "span",
    { class: "plan-dots", role: "img", "aria-label": setsDoneText(block.block, done, row.marks.length) },
    row.marks.map((mark) => el("span", { class: "plan-dot", "data-mark": mark })),
  );
  const word = CURRENT_WORDS[row.state];
  line.replaceChildren(dots);
  if (word) line.append(el("span", { class: "plan-word" }, word));
  line.closest(".exercise-row").dataset.state = row.state;
}

// Which exercise a line of marks belongs to: its block and its place there.
const rowKey = (block, position) => `${block.block} ${position}`;

export function planSheet(data, { dayId, variationId }) {
  const { day, variation } = findVariation(data, dayId, variationId);
  // One line of marks under each exercise.
  const lines = new Map();
  const addLine = (block, position) => {
    const line = el("p", { class: "plan-marks" });
    lines.set(rowKey(block, position), line);
    return line;
  };
  // Laid out like the Variation screen, title and all, so it reads as the
  // same list. Opening the sheet puts focus on the list itself, which a
  // keyboard can then scroll. Focus on anything inside it would scroll the
  // list to that thing (WebKit does so a moment after opening), undoing the
  // scroll to where she is.
  const list = el(
    "div",
    { class: "scroll-area plan-list", tabindex: "-1", autofocus: true },
    el("h2", { class: "sheet-title serif", id: "plan-title" }, variation.name),
    el("p", { class: "variation-day" }, day.name),
    exerciseGroups(data, outline(data, variation), addLine),
  );

  // Everything is inside one body, with the padding, so only a tap on the
  // dimmed screen behind it reaches the dialog itself and closes it.
  const sheet = closeOnBackdrop(
    el(
      "dialog",
      { class: "sheet plan-sheet", "aria-labelledby": "plan-title" },
      el(
        "div",
        { class: "plan-body" },
        list,
        el("footer", { class: "footer-actions plan-actions" }, button(COPY.closePlan, () => sheet.close(), "button-main")),
      ),
    ),
  );

  return {
    element: sheet,

    // `position` is the player's view: the step she is on, and whether it is
    // the set or the rest after it.
    update(position) {
      for (const block of planOf(data, variation, position)) {
        block.rows.forEach((row, position) => paintMarks(lines.get(rowKey(block, position)), block, row));
      }
    },

    // Opens with the exercise she is at in the middle of the list, or as near
    // the middle as the list allows.
    show() {
      sheet.showModal();
      const current = list.querySelector('[data-state="now"], [data-state="next"]');
      const [box, row] = [list.getBoundingClientRect(), current.getBoundingClientRect()];
      list.scrollTop += row.top - box.top - (box.height - row.height) / 2;
    },
  };
}
