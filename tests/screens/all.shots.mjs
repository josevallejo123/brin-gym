// Takes a screenshot of every screen and every state of the player, for the
// review against docs/quality-bar.md. Not part of npm test: run it with
// npm run screens.

import path from "node:path";

import {
  COPY,
  addRestLabel,
  button,
  data,
  doneButton,
  exerciseName,
  openApp,
  skipButton,
  startWorkout,
  test,
  workouts,
} from "../browser/app.mjs";

const OUT_DIR = path.resolve(process.env.SCREENS_DIR ?? "test-results/screens");

// The workout with the longest exercise name in it: the hardest case for layout.
const nameLength = (step) => exerciseName(step).length;
const longestNameLength = (workout) => Math.max(...workout.steps.map(nameLength));
const longNamed = workouts.reduce((best, workout) => (longestNameLength(workout) > longestNameLength(best) ? workout : best));
const first = workouts[0];

let counter = 0;

// Long enough for a screen's entrance to finish, so the shot is the settled
// screen; the Finish flourish takes longer to draw.
const SETTLE_MS = 450;
const FLOURISH_SETTLE_MS = 1600;

async function shoot(page, name, settleMs = SETTLE_MS) {
  counter += 1;
  const { width, height } = page.viewportSize();
  await page.waitForTimeout(settleMs);
  const file = `${width}x${height}-${String(counter).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: path.join(OUT_DIR, file) });
}

test("every screen and player state", async ({ page }) => {
  test.setTimeout(180_000);

  await openApp(page);
  await shoot(page, "home");

  await page.getByRole("link", { name: longNamed.day.name, exact: true }).click();
  await shoot(page, "day");

  await page.getByRole("link", { name: longNamed.title, exact: true }).click();
  await shoot(page, "variation");
  await page.locator(".scroll-area").evaluate((node) => node.scrollTo(0, node.scrollHeight));
  await shoot(page, "variation-end-of-list");

  await openApp(page, "about");
  await shoot(page, "about");

  // The first workout: warm-up set, a rest, a superset switch, a set-up rest.
  await startWorkout(page, first);
  await shoot(page, "set-warm-up");
  await doneButton(page).click();
  await page.clock.runFor(13_000);
  await shoot(page, "rest");
  await button(page, addRestLabel(data.rests.addRestSeconds)).click();
  await shoot(page, "rest-with-time-added");
  await button(page, COPY.pause).click();
  await shoot(page, "rest-paused");
  await button(page, COPY.resume).click();
  await skipButton(page).click();
  await shoot(page, "set-main");
  await button(page, COPY.pause).click();
  await shoot(page, "set-paused");
  await button(page, COPY.resume).click();
  await button(page, COPY.mute).click();
  await shoot(page, "set-sound-off");
  await button(page, COPY.unmute).click();

  // Walk to the last main set, whose rest is the set-up for superset A.
  for (let done = 1; done < data.sets.mainSets; done += 1) {
    await doneButton(page).click();
    await skipButton(page).click();
  }
  await doneButton(page).click();
  await shoot(page, "rest-set-up");
  await skipButton(page).click();
  await shoot(page, "set-superset");
  await doneButton(page).click();
  await shoot(page, "rest-switch");

  // She leaves mid-rest and comes back four minutes after it ended.
  await page.clock.fastForward(4 * 60_000 + data.rests.supersetSwitchSeconds * 1000);
  await shoot(page, "set-after-rest-ended-away");

  await button(page, COPY.endWorkout).click();
  await shoot(page, "end-workout-sheet");
  await button(page, COPY.endWorkout).last().click();

  // The longest names, on a set and as the "next" of a rest.
  await startWorkout(page, longNamed);
  const longestLength = longestNameLength(longNamed);
  const longNameIndex = longNamed.steps.findIndex((step, index) => index > 0 && nameLength(step) === longestLength);
  for (let index = 0; index < longNameIndex - 1; index += 1) {
    await doneButton(page).click();
    await skipButton(page).click();
  }
  await doneButton(page).click();
  await shoot(page, "rest-before-longest-name");
  await skipButton(page).click();
  await shoot(page, "set-longest-name");

  // Straight through to the end.
  for (let index = longNameIndex; index < longNamed.steps.length - 1; index += 1) {
    await doneButton(page).click();
    await skipButton(page).click();
  }
  await page.clock.fastForward(21 * 60_000);
  await doneButton(page).click();
  await shoot(page, "finish", FLOURISH_SETTLE_MS);
});

test("the screen shown when the workouts do not load", async ({ page }) => {
  await page.route("**/data/workouts.json", (route) => route.abort());
  await page.goto("./");
  await button(page, COPY.tryAgain).waitFor();
  counter = 90;
  // The aborted request is logged by the browser; that is the point here.
  page.removeAllListeners("console");
  await shoot(page, "load-failed");
});
