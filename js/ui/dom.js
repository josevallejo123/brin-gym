// Small helpers for building the screens. Text always goes in as text nodes,
// never as HTML, so nothing from a data file can be read as markup.

import { COPY } from "./copy.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// el("p", { class: "muted" }, "Rest")
// A null, undefined or false attribute or child is left out.
export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (name.startsWith("on")) node.addEventListener(name.slice(2), value);
    else node.setAttribute(name, value === true ? "" : value);
  }
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

// A drawing made of paths, hidden from assistive technology: every one in the
// app sits beside words that say the same thing.
function svg(className, viewBox, paths) {
  const root = document.createElementNS(SVG_NAMESPACE, "svg");
  root.setAttribute("class", className);
  root.setAttribute("viewBox", viewBox);
  root.setAttribute("aria-hidden", "true");
  for (const attributes of paths) {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    for (const [name, value] of Object.entries(attributes)) path.setAttribute(name, value);
    root.append(path);
  }
  return root;
}

// Line icons, all drawn on a 24-unit grid in one stroke weight (css: .icon).
const ICON_PATHS = {
  back: ["M15 5l-7 7 7 7"],
  close: ["M6 6l12 12", "M18 6L6 18"],
  pause: ["M9 5v14", "M15 5v14"],
  plan: ["M10 6.5h10", "M10 12h10", "M10 17.5h10", "M4.5 6.5h.01", "M4.5 12h.01", "M4.5 17.5h.01"],
  undo: ["M8 5L4 9l4 4", "M4 9h10a5 5 0 0 1 0 10H9"],
  sound: ["M4 9.5h3.5L12 6v12l-4.5-3.5H4z", "M15.5 9a4.5 4.5 0 0 1 0 6", "M18 6.5a8 8 0 0 1 0 11"],
  silent: ["M4 9.5h3.5L12 6v12l-4.5-3.5H4z", "M16 9.5l5 5", "M21 9.5l-5 5"],
};

export const icon = (name) =>
  svg(
    "icon",
    "0 0 24 24",
    ICON_PATHS[name].map((d) => ({ d })),
  );

// A button with words on it. "button-main" makes it the screen's one filled
// rose-gold action.
export function button(text, onclick, extraClass = "") {
  return el("button", { class: `button ${extraClass}`.trim(), type: "button", onclick }, text);
}

// A button that shows only an icon still has a name for assistive technology.
export function iconButton(iconName, label, onclick) {
  return el("button", { class: "icon-button", type: "button", "aria-label": label, onclick }, icon(iconName));
}

// A sheet (a <dialog> opened over a screen) closes on a tap of the dimmed
// screen behind it: a tap that reaches the dialog element itself.
export function closeOnBackdrop(sheet) {
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) sheet.close();
  });
  return sheet;
}

// The top of an inner screen: one back control, top left.
export function topbar(goBack) {
  return el("header", { class: "topbar" }, iconButton("back", COPY.back, goBack));
}
