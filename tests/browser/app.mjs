// Shared by the browser tests: a page that fails the test on any console
// error or warning, the workouts being served, and the moves a test makes.

import { readFileSync } from "node:fs";

import { test as base, expect } from "@playwright/test";

import { buildSteps } from "../../app/js/logic/sequence.js";
import { COPY, addRestLabel, repsText, restName, stepLabel, variationLead } from "../../app/js/ui/copy.js";

export { COPY, addRestLabel, expect, repsText, restName, stepLabel };

const DATA_FILES = {
  fixtures: "../fixtures/data/workouts.json",
  real: "../../app/data/workouts.json",
};

// The same file the server is serving (tests/shared.config.mjs sets which).
export const data = JSON.parse(
  readFileSync(new URL(DATA_FILES[process.env.BRIN_CONTENT ?? "fixtures"], import.meta.url), "utf8"),
);

export const workouts = data.days.flatMap((day) =>
  day.variations.map((variation, index) => ({
    day,
    variation,
    title: `${variationLead(index)}${variation.name}`,
    steps: buildSteps(data, variation),
  })),
);

export const exerciseName = (step) => data.exercises[step.exercise].name;

// A fixed moment for the page's clock, so times on screen are predictable.
export const START_TIME = new Date("2026-01-05T18:00:00");

// Stops the page's clock, well after any test has got this far. From then on
// time moves only when the test moves it (page.clock.fastForward and runFor),
// so a time read off the screen does not depend on how fast the machine is.
const CLOCK_STOPS_AT = new Date(START_TIME.getTime() + 10 * 60_000);
export const stopClock = (page) => page.clock.pauseAt(CLOCK_STOPS_AT);

export const test = base.extend({
  page: async ({ page }, use) => {
    const problems = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`));
    await page.clock.install({ time: START_TIME });
    await use(page);
    expect(problems, "console errors and warnings").toEqual([]);
  },
});

// The screen on show. For a moment after a change, the one before it is
// still in the page, fading out.
export const screen = (page) => page.locator(".screen:not(.leaving)");

export async function openApp(page, route = "") {
  await page.goto(`./#/${route}`);
  await screen(page).waitFor();
}

export const heading = (page) => page.getByRole("heading", { level: 1 });
export const button = (page, name) => page.getByRole("button", { name, exact: true });
export const doneButton = (page) => button(page, COPY.done);
export const skipButton = (page) => button(page, COPY.skipRest);

// From Home to a variation's list, by the two taps she makes.
export async function chooseWorkout(page, { day, variation, title }) {
  await page.getByRole("link", { name: day.name, exact: true }).click();
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(heading(page)).toHaveText(variation.name);
}

export async function startWorkout(page, workout) {
  await openApp(page);
  await chooseWorkout(page, workout);
  await button(page, COPY.start).click();
  await expect(page.locator(".player")).toBeVisible();
}

// Nothing may be wider than the phone: no clipped names, no sideways scroll.
export async function expectNoOverflow(page) {
  const overflowing = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll(".screen *")]
      .filter((node) => node.getClientRects().length > 0)
      .filter((node) => {
        const { left, right } = node.getBoundingClientRect();
        const offScreen = left < -0.5 || right > width + 0.5;
        // Text that does not fit its own box: only asked of the boxes that
        // hold the text itself, since rows deliberately bleed past their list.
        const clipped = node.childElementCount === 0 && node.scrollWidth > node.clientWidth + 1;
        return offScreen || clipped;
      })
      .map((node) => `${node.className || node.tagName}: ${node.textContent.slice(0, 40)}`);
  });
  expect(overflowing, "elements wider than the screen").toEqual([]);
}
