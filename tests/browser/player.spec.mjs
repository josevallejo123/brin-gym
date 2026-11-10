// How the player behaves around the things that interrupt a workout: closing
// and reopening the app, leaving mid-rest, pausing, stepping back, ending.

import { STORAGE_KEYS } from "../../app/js/config.js";
import { SOUNDS } from "../../app/js/platform/sounds.js";
import { MINUTE } from "../logic/helpers.mjs";
import {
  COPY,
  button,
  data,
  doneButton,
  exerciseName,
  expect,
  heading,
  openApp,
  skipButton,
  startWorkout,
  stepLabel,
  test,
  workouts,
} from "./app.mjs";

const workout = workouts[0];
const [firstStep, secondStep] = workout.steps;
const firstRest = firstStep.restAfter.seconds * 1000;

const saved = (page, key) => page.evaluate((name) => localStorage.getItem(name), key);
const elapsed = (page) => page.locator(".total .timer");
const countdown = (page) => page.locator(".countdown");

test("closed and reopened mid-set: the same set, with the time that has really passed", async ({ page }) => {
  await startWorkout(page, workout);
  await doneButton(page).click();
  await skipButton(page).click();
  await expect(page.locator(".set-label")).toHaveText(stepLabel(secondStep));

  await page.clock.fastForward(7 * MINUTE);
  await page.reload();

  await expect(page.locator(".set-name")).toHaveText(exerciseName(secondStep));
  await expect(page.locator(".set-label")).toHaveText(stepLabel(secondStep));
  await expect(elapsed(page)).toHaveText(/^7:0\d$/);
});

test("closed and reopened mid-rest: the same rest, still counting down", async ({ page }) => {
  await startWorkout(page, workout);
  await doneButton(page).click();
  await page.clock.runFor(20_000);
  await page.reload();

  await expect(page.locator(".rest-kind")).toBeVisible();
  await expect(page.locator(".next-name")).toHaveText(exerciseName(secondStep));
  const secondsLeft = Number((await countdown(page).textContent()).split(":")[1]);
  expect(secondsLeft).toBeLessThanOrEqual(firstRest / 1000 - 20);
  expect(secondsLeft).toBeGreaterThan(firstRest / 1000 - 30);
});

test("a rest that ended while she was away: the next set, with a note of how long ago", async ({ page }) => {
  await startWorkout(page, workout);
  await doneButton(page).click();
  await page.clock.fastForward(firstRest + 4 * MINUTE);

  await expect(page.locator(".set-label")).toHaveText(stepLabel(secondStep));
  await expect(page.locator(".set-note")).toHaveText("Rest ended 4 minutes ago");

  // The note is part of what is saved, so it survives the app being closed.
  await page.reload();
  await expect(page.locator(".set-note")).toHaveText(/^Rest ended \d minutes ago$/);

  await doneButton(page).click();
  await skipButton(page).click();
  await expect(page.locator(".set-note")).toHaveCount(0);
});

test("a rest that ends on screen moves to the next set with no note", async ({ page }) => {
  await startWorkout(page, workout);
  await doneButton(page).click();
  await page.clock.runFor(firstRest + 500);
  await expect(page.locator(".set-label")).toHaveText(stepLabel(secondStep));
  await expect(page.locator(".set-note")).toHaveCount(0);
});

test("pause freezes the total time and the rest; resume carries on", async ({ page }) => {
  await startWorkout(page, workout);
  await doneButton(page).click();
  await page.clock.runFor(5_000);
  await button(page, COPY.pause).click();
  await expect(page.getByText(COPY.paused, { exact: true })).toBeVisible();

  const [frozenTotal, frozenRest] = [await elapsed(page).textContent(), await countdown(page).textContent()];
  await page.clock.runFor(30_000);
  await expect(elapsed(page)).toHaveText(frozenTotal);
  await expect(countdown(page)).toHaveText(frozenRest);

  // Paused survives a close and reopen too.
  await page.reload();
  await expect(page.getByText(COPY.paused, { exact: true })).toBeVisible();
  await expect(countdown(page)).toHaveText(frozenRest);

  await button(page, COPY.resume).click();
  await page.clock.runFor(3_000);
  await expect(countdown(page)).not.toHaveText(frozenRest);
  await expect(page.locator(".rest-kind")).toBeVisible();
});

test("step back undoes a mis-tap: it cancels the rest, then returns to the set before", async ({ page }) => {
  await startWorkout(page, workout);
  await expect(button(page, COPY.stepBack)).toBeHidden();

  await doneButton(page).click();
  await button(page, COPY.stepBack).click();
  await expect(page.locator(".set-label")).toHaveText(stepLabel(firstStep));

  await doneButton(page).click();
  await skipButton(page).click();
  await expect(page.locator(".set-label")).toHaveText(stepLabel(secondStep));
  await button(page, COPY.stepBack).click();
  await expect(page.locator(".set-label")).toHaveText(stepLabel(firstStep));
});

test("End workout asks first, and ending clears the saved workout", async ({ page }) => {
  await startWorkout(page, workout);
  await button(page, COPY.endWorkout).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: COPY.endQuestion })).toBeVisible();

  await sheet.getByRole("button", { name: COPY.continueWorkout }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator(".player")).toBeVisible();
  expect(await saved(page, STORAGE_KEYS.workout)).not.toBeNull();

  await button(page, COPY.endWorkout).click();
  await sheet.getByRole("button", { name: COPY.endWorkout }).click();
  await expect(heading(page)).toHaveText(COPY.appName);
  expect(await saved(page, STORAGE_KEYS.workout)).toBeNull();

  await page.reload();
  await expect(heading(page)).toHaveText(COPY.appName);
});

test("a workout in progress owns the screen, whatever the address says", async ({ page }) => {
  await startWorkout(page, workout);
  await openApp(page, "about");
  await expect(page.locator(".player")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".player")).toBeVisible();
});

test("an unfinished workout left for three hours is dropped", async ({ page }) => {
  await startWorkout(page, workout);
  await page.clock.fastForward(3 * 60 * MINUTE);
  await expect(heading(page)).toHaveText(COPY.appName);
  expect(await saved(page, STORAGE_KEYS.workout)).toBeNull();
});

test("the mute setting is remembered", async ({ page }) => {
  await startWorkout(page, workout);
  await button(page, COPY.mute).click();
  await expect(button(page, COPY.unmute)).toBeVisible();
  expect(await saved(page, STORAGE_KEYS.muted)).toBe("1");

  await page.reload();
  await expect(button(page, COPY.unmute)).toBeVisible();
  await button(page, COPY.unmute).click();
  expect(await saved(page, STORAGE_KEYS.muted)).toBeNull();
});

// Sounds cannot be heard here, but every note the app starts can be counted.
test.describe("sounds", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Playwright's WebKit for Windows has no Web Audio.");

  const firstNote = (sound) => SOUNDS[sound][0].hz;
  const played = (page) => page.evaluate(() => window.notesStarted);
  const count = (notes, sound) => notes.filter((hz) => hz === firstNote(sound)).length;

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.notesStarted = [];
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function startAndCount(...when) {
        window.notesStarted.push(this.frequency.value);
        return start.apply(this, when);
      };
    });
  });

  test("a tick when a set is done, quiet ticks at 3, 2 and 1, and a chime when the rest ends", async ({ page }) => {
    await startWorkout(page, workout);
    await doneButton(page).click();
    expect(count(await played(page), "setDone")).toBe(1);

    await page.clock.runFor(firstRest - 3_500);
    expect(count(await played(page), "tick")).toBe(0);

    await page.clock.runFor(4_000);
    const notes = await played(page);
    expect(count(notes, "tick")).toBe(data.rests.betweenSetsSeconds >= 3 ? 3 : 0);
    expect(count(notes, "chime")).toBe(1);
  });

  test("no chime and no ticks for a rest that ended while she was away", async ({ page }) => {
    await startWorkout(page, workout);
    await doneButton(page).click();
    await page.clock.fastForward(firstRest + 5 * MINUTE);
    await expect(page.locator(".set-note")).toBeVisible();

    const notes = await played(page);
    expect(count(notes, "tick")).toBe(0);
    expect(count(notes, "chime")).toBe(0);
  });

  test("muted, nothing sounds", async ({ page }) => {
    await startWorkout(page, workout);
    await button(page, COPY.mute).click();
    await doneButton(page).click();
    await page.clock.runFor(firstRest + 500);
    await expect(page.locator(".set-label")).toHaveText(stepLabel(secondStep));
    expect(await played(page)).toEqual([]);
  });
});
