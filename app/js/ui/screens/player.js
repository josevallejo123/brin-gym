// The player: one set at a time, and the rest between sets. The bar at the
// top and the row of buttons at the bottom stay put; the stage in between is
// redrawn when the step changes, and only the clocks are touched in between.

import { COUNTDOWN_TICKS, PROGRESS_STEP, REPAINT_MS } from "../../config.js";
import { countdownCue } from "../../logic/cues.js";
import { countdownSeconds, formatCountdown, formatElapsed } from "../../logic/format.js";
import {
  COPY,
  addRestLabel,
  repsParts,
  restEndedText,
  restName,
  stepLabel,
  targetText,
} from "../copy.js";
import { button, el, icon, iconButton } from "../dom.js";
import { loopingDrawing, stillDrawing } from "../drawing.js";

// A thin line that fills from the left. It is redrawn only when it has moved
// far enough to see, so the long total-time line is not animating all workout.
function progressLine(extraClass) {
  const fill = el("div", { class: "progress-fill" });
  const line = el("div", { class: `progress ${extraClass}`, "aria-hidden": "true" }, fill);
  let shown = null;
  const set = (fraction) => {
    const steps = Math.round(Math.min(1, Math.max(0, fraction)) / PROGRESS_STEP);
    if (steps === shown) return;
    shown = steps;
    fill.style.transform = `scaleX(${steps * PROGRESS_STEP})`;
  };
  return { line, set };
}

// Shows a time that changes, touching the page only when the text does. Each
// digit goes in its own fixed-width cell (css: .digit), so the time never
// shifts as it counts.
function liveTime(node) {
  let shown = null;
  return (text) => {
    if (text === shown) return;
    shown = text;
    const cells = [...text].map((character) =>
      /\d/.test(character) ? el("span", { class: "digit" }, character) : character,
    );
    node.replaceChildren(...cells);
  };
}

function endSheet(onEnd) {
  const sheet = el(
    "dialog",
    { class: "sheet", "aria-labelledby": "end-question" },
    el("h2", { class: "sheet-title serif", id: "end-question", tabindex: "-1", autofocus: true }, COPY.endQuestion),
    el("p", { class: "sheet-detail" }, COPY.endDetail),
    el(
      "div",
      { class: "sheet-actions" },
      // Carrying on is the main action, where her thumb already rests, so a
      // slip onto the close control followed by a habitual tap ends nothing.
      button(COPY.endWorkout, onEnd),
      button(COPY.continueWorkout, () => sheet.close(), "button-main"),
    ),
  );
  // A tap on the dimmed screen behind the sheet closes it, like Continue.
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) sheet.close();
  });
  return sheet;
}

// "10", or "10 each side" with the count set larger than the words.
function repsLine(slot, className) {
  const reps = repsParts(slot);
  return el(
    "p",
    { class: className },
    el("span", { class: "reps-count numerals" }, reps.count),
    " ",
    reps.each && el("span", { class: "reps-each" }, reps.each),
  );
}

function setStage(data, view) {
  const { step } = view;
  const exercise = data.exercises[step.exercise];
  return el(
    "div",
    { class: "stage-content" },
    loopingDrawing(step.exercise, exercise, "set-drawing"),
    el("h1", { class: "set-name serif" }, exercise.name),
    el("p", { class: "set-label" }, stepLabel(step)),
    view.restEndedAgoMs !== null && el("p", { class: "set-note" }, restEndedText(view.restEndedAgoMs)),
    repsLine(step, "reps"),
  );
}

function restStage(data, view) {
  const next = view.nextStep;
  const exercise = data.exercises[next.exercise];
  const countdown = el("p", { class: "countdown timer", role: "timer" });
  const progress = progressLine("rest-progress");
  const content = el(
    "div",
    { class: "stage-content" },
    el("h1", { class: "rest-kind" }, restName(view.rest.kind)),
    countdown,
    progress.line,
    // What comes next is laid out like the set it is about to become: the
    // drawing, the name, the set and the reps, in the same order and place.
    el(
      "div",
      { class: "next" },
      el("p", { class: "next-word" }, COPY.next),
      stillDrawing(next.exercise, exercise),
      el("p", { class: "next-name serif" }, exercise.name),
      el("p", { class: "next-detail next-label" }, stepLabel(next)),
      repsLine(next, "next-detail next-reps"),
    ),
  );
  return { content, setCountdown: liveTime(countdown), setProgress: progress.set };
}

export function playerScreen({ data, session, sounds, wakeLock }) {
  const elapsed = el("span", { class: "timer" });
  const setElapsed = liveTime(elapsed);
  const totalProgress = progressLine("total-progress");
  const soundButton = iconButton("sound", COPY.mute, toggleSound);
  const sheet = endSheet(() => session.end());
  const stage = el("div", { class: "stage" });
  const actions = el("footer", { class: "player-actions" });

  const root = el(
    "main",
    { class: "screen player" },
    el(
      "header",
      { class: "player-bar" },
      el("p", { class: "total" }, elapsed, " ", el("span", { class: "numerals muted" }, targetText(session.view().targetMs))),
      el(
        "div",
        { class: "player-tools" },
        soundButton,
        el("span", { class: "pause-tool" }, iconButton("pause", COPY.pause, () => session.pause())),
        iconButton("close", COPY.endWorkout, () => sheet.showModal()),
      ),
    ),
    totalProgress.line,
    stage,
    actions,
    sheet,
  );

  // What is on screen now, so only what changed is redrawn.
  let shownStep = null;
  let shownPaused = null;
  let rest = null;
  let lastCountdown = null;

  function toggleSound() {
    sounds.setMuted(!sounds.muted);
    paintSoundButton();
  }

  function paintSoundButton() {
    soundButton.replaceChildren(icon(sounds.muted ? "silent" : "sound"));
    soundButton.setAttribute("aria-label", sounds.muted ? COPY.unmute : COPY.mute);
  }

  function actionButtons(view) {
    if (view.paused) {
      return [el("p", { class: "paused-word" }, COPY.paused), button(COPY.resume, () => session.resume(), "button-main")];
    }
    const back = iconButton("undo", COPY.stepBack, () => session.stepBack());
    back.disabled = !view.canStepBack;
    if (view.phase === "set") return [back, button(COPY.done, () => session.done(), "button-main")];
    return [
      back,
      button(addRestLabel(view.addRestSeconds), () => session.addRest()),
      button(COPY.skipRest, () => session.skipRest()),
    ];
  }

  function paint() {
    const view = session.view();
    if (view === null) return;

    // Pausing leaves the stage as it is, dimmed, and swaps the buttons.
    const step = `${view.stepIndex} ${view.phase}`;
    if (step !== shownStep) {
      rest = view.phase === "rest" ? restStage(data, view) : null;
      lastCountdown = null;
      stage.replaceChildren(rest ? rest.content : setStage(data, view));
    }
    if (step !== shownStep || view.paused !== shownPaused) {
      actions.replaceChildren(...actionButtons(view));
      root.toggleAttribute("data-paused", view.paused);
    }
    shownStep = step;
    shownPaused = view.paused;

    setElapsed(formatElapsed(view.elapsedMs));
    totalProgress.set(view.elapsedMs / view.targetMs);

    if (rest) {
      const seconds = countdownSeconds(view.rest.remainingMs);
      rest.setCountdown(formatCountdown(view.rest.remainingMs));
      rest.setProgress(1 - view.rest.remainingMs / view.rest.lengthMs);
      const cue = countdownCue(lastCountdown, seconds, COUNTDOWN_TICKS);
      if (cue && !view.paused) sounds.play(cue);
      lastCountdown = seconds;
    }
  }

  // The interval decides only when to look at the clock. Every time shown is
  // worked out from timestamps, so a late or skipped repaint loses nothing.
  function look() {
    session.sync();
    paint();
  }

  paintSoundButton();
  paint();
  wakeLock.hold();

  const repaint = setInterval(look, REPAINT_MS);
  const unsubscribe = session.subscribe(paint);
  document.addEventListener("visibilitychange", look);
  window.addEventListener("pageshow", look);

  return {
    element: root,
    leave() {
      clearInterval(repaint);
      unsubscribe();
      document.removeEventListener("visibilitychange", look);
      window.removeEventListener("pageshow", look);
      wakeLock.release();
    },
  };
}
