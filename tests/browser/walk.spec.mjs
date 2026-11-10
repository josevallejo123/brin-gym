// Walks every workout being served from Start to Finish, the way she would:
// tapping Done after each set, and waiting out, skipping or lengthening the
// rests. Any console error or warning fails the walk (see app.mjs).

import { formatCountdown } from "../../app/js/logic/format.js";
import { outline } from "../../app/js/logic/sequence.js";
import {
  COPY,
  addRestLabel,
  button,
  data,
  doneButton,
  exerciseName,
  expect,
  expectNoOverflow,
  heading,
  openApp,
  repsText,
  restName,
  skipButton,
  stepLabel,
  stopClock,
  test,
  workouts,
} from "./app.mjs";

const addSeconds = data.rests.addRestSeconds;

// Three ways through a rest, taken in turn: let it run out, skip it, or add
// time and then let it run out.
const REST_MOVES = [
  async (page, seconds) => page.clock.fastForward(seconds * 1000),
  async (page) => skipButton(page).click(),
  async (page, seconds) => {
    await button(page, addRestLabel(addSeconds)).click();
    await expect(page.locator(".countdown")).toHaveText(formatCountdown((seconds + addSeconds) * 1000));
    await page.clock.fastForward((seconds + addSeconds) * 1000);
  },
];

for (const workout of workouts) {
  test(`walk ${workout.day.name}, ${workout.title}`, async ({ page, baseURL }) => {
    const { day, variation, steps } = workout;
    const elsewhere = [];
    page.on("request", (request) => {
      if (!request.url().startsWith(baseURL)) elsewhere.push(request.url());
    });

    await openApp(page);
    await expect(heading(page)).toHaveText(COPY.appName);
    await expectNoOverflow(page);

    await page.getByRole("link", { name: day.name, exact: true }).click();
    await expect(heading(page)).toHaveText(day.name);
    await expectNoOverflow(page);

    await page.getByRole("link", { name: workout.title, exact: true }).click();
    await expect(heading(page)).toHaveText(variation.name);
    const listed = outline(data, variation).flatMap(({ slots }) => slots);
    await expect(page.locator(".exercise-name")).toHaveText(listed.map(exerciseName));
    await expectNoOverflow(page);

    // Every rest below is read off the screen to the second. With the clock
    // running, a busy machine let a second pass between a tap and the look.
    await stopClock(page);
    await button(page, COPY.start).click();

    for (const [index, step] of steps.entries()) {
      await expect(page.locator(".set-name")).toHaveText(exerciseName(step));
      await expect(page.locator(".set-label")).toHaveText(stepLabel(step));
      await expect(page.locator(".reps")).toHaveText(repsText(step));
      await expectNoOverflow(page);
      await doneButton(page).click();

      const next = steps[index + 1];
      if (!next) break;

      const { kind, seconds } = step.restAfter;
      await expect(page.locator(".rest-kind")).toHaveText(restName(kind));
      await expect(page.locator(".countdown")).toHaveText(formatCountdown(seconds * 1000));
      await expect(page.locator(".next-name")).toHaveText(exerciseName(next));
      await expect(page.locator(".next-detail")).toHaveText([stepLabel(next), repsText(next)]);
      await expectNoOverflow(page);
      await REST_MOVES[index % REST_MOVES.length](page, seconds);
    }

    await expect(heading(page)).toHaveText(/^Done · \d+:\d\d$/);
    await expectNoOverflow(page);
    await button(page, COPY.home).click();
    await expect(heading(page)).toHaveText(COPY.appName);

    expect(elsewhere, "requests outside the app's own folder").toEqual([]);
  });
}
