// Finish, About, and the screen shown when the workouts fail to load.

import { COPY, finishText, versionText } from "../copy.js";
import { button, el, flourish, topbar } from "../dom.js";

export function finishScreen({ elapsedMs, goHome }) {
  return el(
    "main",
    { class: "screen" },
    el("div", { class: "middle" }, el("h1", { class: "finish-time numerals" }, finishText(elapsedMs)), flourish()),
    el("footer", { class: "footer-actions" }, button(COPY.home, goHome, "button-main")),
  );
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
