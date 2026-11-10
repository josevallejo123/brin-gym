// Reads the design tokens out of app/css/tokens.css, for the tools and tests
// that need the palette or the sizes. The stylesheet stays the one place a
// value is written down.

import { readFileSync } from "node:fs";
import path from "node:path";

import { APP_DIR } from "./offline-list.mjs";

export const TOKENS_FILE = "css/tokens.css";

// Every "--name: value;" in the file. A token set again for short phones
// reads as its short-phone value, the smaller of the two.
export function readTokens() {
  const css = readFileSync(path.join(APP_DIR, TOKENS_FILE), "utf8");
  return new Map([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value]));
}

// "#1d141a" -> [29, 20, 26]
export const hexToRgb = (hex) => [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
