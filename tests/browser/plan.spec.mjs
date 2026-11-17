// The plan she can open during a workout: the whole workout with every set
// marked, opened over the player without stopping anything behind it.

import { planOf } from "../../app/js/logic/plan.js";
import { MINUTE } from "../logic/helpers.mjs";
import {
  COPY,
  button,
  closePlan,
  data,
  doSets,
  doneButton,
  expect,
  expectNoOverflow,
  openPlan,
  startWorkout,
  stepLabel,
  test,
  workouts,
} from "./app.mjs";

const workout = workouts[0];
const { variation, steps } = workout;
const firstRest = steps[0].restAfter.seconds * 1000;

const sheet = (page) => page.locator(".plan-sheet");
const countdown = (page) => page.locator(".countdown");

// The marks on screen, one string per exercise: "done done now left".
const shownMarks = (page) =>
  sheet(page)
    .locator(".exercise-row")
    .evaluateAll((rows) => rows.map((row) => [...row.querySelectorAll(".plan-dot")].map((dot) => dot.dataset.mark).join(" ")));

const expectedMarks = (position) =>
  planOf(data, variation, position).flatMap((block) => block.rows.map((row) => row.marks.join(" ")));

test("on a set, the plan opens over the player and closes back to exactly where she was", async ({ page }) => {
  await startWorkout(page, workout);
  await openPlan(page);
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByRole("heading", { name: variation.name, exact: true })).toBeVisible();
  await expect(sheet(page).getByText(workout.day.name, { exact: true })).toBeVisible();
  expect(await shownMarks(page)).toEqual(expectedMarks({ stepIndex: 0, phase: "set" }));
  await expect(sheet(page).locator(".plan-word")).toHaveText([COPY.now]);
  await expectNoOverflow(page);

  await closePlan(page);
  await expect(sheet(page)).toBeHidden();
  await expect(page.locator(".set-label")).toHaveText(stepLabel(steps[0]));

  // A tap on the dimmed player above the sheet closes it too.
  await openPlan(page);
  await expect(sheet(page)).toBeVisible();
  await page.mouse.click(page.viewportSize().width / 2, 8);
  await expect(sheet(page)).toBeHidden();
  await expect(doneButton(page)).toBeVisible();
});

test("it only shows: Close is the one thing in it that can be tapped", async ({ page }) => {
  await startWorkout(page, workout);
  await openPlan(page);
  await expect(sheet(page).locator("button, a, [tabindex='0']")).toHaveCount(1);
  // A tap on an exercise changes nothing.
  await sheet(page).locator(".exercise-row").last().click();
  await expect(sheet(page)).toBeVisible();
  await closePlan(page);
  await expect(page.locator(".set-label")).toHaveText(stepLabel(steps[0]));
});

test("on a rest, the countdown keeps going behind the plan, and the marks follow when the rest runs out", async ({ page }) => {
  await startWorkout(page, workout);
  await doneButton(page).click();
  await openPlan(page);
  expect(await shownMarks(page)).toEqual(expectedMarks({ stepIndex: 0, phase: "rest" }));
  await expect(sheet(page).locator(".plan-word")).toHaveText([COPY.next]);

  const before = await countdown(page).textContent();
  await page.clock.runFor(5_000);
  await expect(countdown(page)).not.toHaveText(before);
  await expect(sheet(page)).toBeVisible();

  // The rest ends while the plan is open: the next set is now current.
  await page.clock.runFor(firstRest);
  await expect(sheet(page).locator(".plan-word")).toHaveText([COPY.now]);
  expect(await shownMarks(page)).toEqual(expectedMarks({ stepIndex: 1, phase: "set" }));

  await closePlan(page);
  await expect(page.locator(".set-label")).toHaveText(stepLabel(steps[1]));
  await expect(page.locator(".set-note")).toHaveCount(0);
});

test("after several sets, and after Back one set, the marks say what is done, where she is and what is left", async ({ page }) => {
  const sets = data.sets.warmupSets + data.sets.mainSets + 3;
  await startWorkout(page, workout);
  await doSets(page, sets);
  await openPlan(page);
  expect(await shownMarks(page)).toEqual(expectedMarks({ stepIndex: sets, phase: "set" }));
  await expect(sheet(page).locator(".exercise-row[data-state='done']")).toHaveCount(1);
  await closePlan(page);

  await button(page, COPY.stepBack).click();
  await expect(page.locator(".set-label")).toHaveText(stepLabel(steps[sets - 1]));
  await openPlan(page);
  expect(await shownMarks(page)).toEqual(expectedMarks({ stepIndex: sets - 1, phase: "set" }));
});

test("it opens with the exercise she is at in view, even near the end of the workout", async ({ page }) => {
  await startWorkout(page, workout);
  await doSets(page, steps.length - 1);
  await openPlan(page);
  await expect(sheet(page).locator(".exercise-row[data-state='now']")).toHaveCount(1);
  // Both boxes measured at one moment, since the sheet may still be sliding in.
  const placement = await sheet(page).evaluate((node) => {
    const list = node.querySelector(".plan-list").getBoundingClientRect();
    const row = node.querySelector(".exercise-row[data-state='now']").getBoundingClientRect();
    return { above: list.top - row.top, below: row.bottom - list.bottom, scrolled: node.querySelector(".plan-list").scrollTop };
  });
  expect(placement.scrolled, "the list scrolled to it").toBeGreaterThan(0);
  expect(placement.above, "not cut off at the top").toBeLessThanOrEqual(0);
  expect(placement.below, "not cut off at the bottom").toBeLessThanOrEqual(0);
});

test("whether the plan is open is not saved: reopening the app shows the player", async ({ page }) => {
  await startWorkout(page, workout);
  await doneButton(page).click();
  await openPlan(page);
  await page.reload();
  await expect(countdown(page)).toBeVisible();
  await expect(sheet(page)).toBeHidden();
});

test("paused, the plan opens and closes and the workout is still paused", async ({ page }) => {
  await startWorkout(page, workout);
  await button(page, COPY.pause).click();
  await openPlan(page);
  await page.clock.runFor(MINUTE);
  await closePlan(page);
  await expect(button(page, COPY.resume)).toBeVisible();
});
