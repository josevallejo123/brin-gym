// Shared by the logic tests: the fixture data, a clock the test moves by hand
// and a stand-in for localStorage.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));

export function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8"));
}

export function readText(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

export const fixtureData = () => readJson("tests/fixtures/data/workouts.json");

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

// A fixed, arbitrary moment. Tests add to it; none reads the real clock.
export const T0 = Date.UTC(2026, 0, 5, 18, 0, 0);

export function fakeClock(start = T0) {
  let now = start;
  return {
    now: () => now,
    advance(ms) {
      now += ms;
    },
  };
}

export function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    get size() {
      return values.size;
    },
  };
}
