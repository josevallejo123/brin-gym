// Finish, About, and the screen shown when the workouts fail to load.

import { FINISH_CLIP_URL, FINISH_STILL_URL } from "../../config.js";
import { COPY, finishText, versionText } from "../copy.js";
import { confetti } from "../confetti.js";
import { button, el, topbar } from "../dom.js";

// The clip loops as an animated image, never as a video: a media element
// would take over the phone's sound and pause her music. With reduced motion
// on, the browser shows the still in its place.
const finishClip = () =>
  el(
    "picture",
    { class: "finish-clip" },
    el("source", { srcset: FINISH_STILL_URL, media: "(prefers-reduced-motion: reduce)" }),
    el("img", { src: FINISH_CLIP_URL, alt: "" }),
  );

// Confetti behind everything, the clip, the words and one way on. Returns the
// screen and what to do on leaving it.
export function finishScreen({ elapsedMs, goHome }) {
  const falling = confetti();
  const element = el(
    "main",
    { class: "screen finish" },
    falling.element,
    el(
      "div",
      { class: "finish-words" },
      finishClip(),
      el("h1", { class: "screen-title finish-title serif" }, COPY.goodJob),
      el("p", { class: "finish-time numerals" }, finishText(elapsedMs)),
    ),
    el("footer", { class: "footer-actions" }, button(COPY.leaveFinish, goHome, "button-main")),
  );
  return { element, leave: falling.stop };
}

// Links on About leave the app, so they open outside it and pass nothing on.
const outsideLink = (href, text) =>
  el("a", { class: "text-link", href, target: "_blank", rel: "noopener noreferrer" }, text);

function credit(entry) {
  return el(
    "li",
    { class: "credit" },
    el("p", {}, outsideLink(entry.url, entry.work), ` by ${entry.author}`),
    el("p", { class: "credit-detail" }, outsideLink(entry.licenceUrl, entry.licence), `. ${entry.changes}`),
  );
}

function aboutDetails({ credits, version }) {
  return [
    el("p", { class: "about-version" }, `${COPY.appName}. ${versionText(version)}.`),
    el(
      "section",
      { class: "about-section" },
      el("h2", { class: "group-name" }, COPY.drawings),
      el("ul", {}, credits.map(credit)),
    ),
    el(
      "section",
      { class: "about-section" },
      el("h2", { class: "group-name" }, COPY.type),
      el("p", { class: "credit" }, COPY.typeCredit),
    ),
  ];
}

// The screen is there at once; the credits and the version fill in when
// their two small files have loaded. `load` resolves to both.
export function aboutScreen({ load, goBack }) {
  const details = el("div", {});
  load().then(
    (loaded) => details.replaceChildren(...aboutDetails(loaded)),
    () => details.replaceChildren(el("p", { class: "about-version" }, `${COPY.aboutFailed} ${COPY.loadFailedDetail}`)),
  );
  return el(
    "main",
    { class: "screen" },
    topbar(goBack),
    el("div", { class: "scroll-area" }, el("h1", { class: "screen-title serif" }, COPY.about), details),
  );
}

export function failedScreen({ retry }) {
  return el(
    "main",
    { class: "screen" },
    el(
      "div",
      { class: "middle" },
      el("h1", { class: "sheet-title serif" }, COPY.loadFailed),
      el("p", { class: "failed-detail" }, COPY.loadFailedDetail),
    ),
    el("footer", { class: "footer-actions" }, button(COPY.tryAgain, retry, "button-main")),
  );
}
