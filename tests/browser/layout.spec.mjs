// The quality-bar rules that can be measured on a real page: steady timer
// digits, tap targets, the main action in thumb reach, reduced motion.

import {
  COPY,
  button,
  data,
  doneButton,
  expect,
  expectNoOverflow,
  heading,
  openApp,
  startWorkout,
  test,
  workouts,
} from "./app.mjs";

const workout = workouts[0];
const TAP_MIN = 44;
const MAIN_ACTION_MIN_HEIGHT = 56;

const width = async (locator) => (await locator.boundingBox()).width;

// Links inside a sentence (the credits on About) are the one exception to the
// tap-target rule; everything else she can tap is checked.
async function expectTapTargets(page) {
  const small = await page.evaluate((minimum) => {
    return [...document.querySelectorAll(".screen a:not(.text-link), .screen button, dialog[open] button")]
      .filter((node) => node.getClientRects().length > 0)
      // The laid-out size, which a press animation in progress does not change.
      .filter((node) => node.offsetWidth < minimum || node.offsetHeight < minimum)
      .map((node) => `${node.getAttribute("aria-label") ?? node.textContent}: ${node.offsetWidth} × ${node.offsetHeight}`);
  }, TAP_MIN);
  expect(small, "tap targets smaller than 44 px").toEqual([]);
}

async function expectInThumbReach(page, name) {
  const box = await page.locator(".screen").getByRole("button", { name, exact: true }).boundingBox();
  const { height } = page.viewportSize();
  expect(box.height, `${name} height`).toBeGreaterThanOrEqual(MAIN_ACTION_MIN_HEIGHT);
  expect(box.y, `${name} sits in the bottom third`).toBeGreaterThan((height * 2) / 3);
}

test("timer digits never shift width as they change", async ({ page }) => {
  await startWorkout(page, workout);
  const total = page.locator(".total .timer");
  const totalAtStart = await width(total);

  await doneButton(page).click();
  const countdown = page.locator(".countdown");
  const widths = new Set([await width(countdown)]);
  // 1:00 down through 0:49 shows every digit at least once.
  for (let second = 0; second < 11; second += 1) {
    await page.clock.runFor(1_000);
    widths.add(await width(countdown));
  }
  expect([...widths], "countdown widths over eleven seconds").toHaveLength(1);
  expect(await width(total)).toBe(totalAtStart);
});

test("every tap target is at least 44 px, and the main action is in thumb reach", async ({ page }) => {
  await openApp(page);
  await expectTapTargets(page);

  await page.getByRole("link", { name: workout.day.name, exact: true }).click();
  await expectTapTargets(page);

  await page.getByRole("link", { name: workout.title, exact: true }).click();
  await expectTapTargets(page);
  await expectInThumbReach(page, COPY.start);

  await button(page, COPY.start).click();
  await expectTapTargets(page);
  await expectInThumbReach(page, COPY.done);

  await doneButton(page).click();
  await expectTapTargets(page);

  await button(page, COPY.pause).click();
  await expect(button(page, COPY.pause)).toBeHidden();
  await expectTapTargets(page);
  await expectInThumbReach(page, COPY.resume);

  await button(page, COPY.endWorkout).click();
  await expectTapTargets(page);
  await page.getByRole("dialog").getByRole("button", { name: COPY.endWorkout }).click();

  await openApp(page, "about");
  await expect(heading(page)).toHaveText(COPY.about);
  await expectTapTargets(page);
});

test("no name is cut off or runs off the screen, on any day or variation", async ({ page }) => {
  for (const day of data.days) {
    await openApp(page, `day/${day.id}`);
    await expect(heading(page)).toHaveText(day.name);
    await expectNoOverflow(page);
    for (const variation of day.variations) {
      await openApp(page, `day/${day.id}/${variation.id}`);
      await expect(heading(page)).toHaveText(variation.name);
      await expectNoOverflow(page);
    }
  }
  await openApp(page, "about");
  await expect(heading(page)).toHaveText(COPY.about);
  await expectNoOverflow(page);
});

test("the drawing loops through its frames", async ({ page }) => {
  await startWorkout(page, workout);
  const frames = page.locator(".set-drawing .drawing-frame");
  await expect(frames).toHaveCount(data.exercises[workout.steps[0].exercise].frames);
  const animations = await frames.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationName));
  expect(animations.every((name) => name.startsWith("loop-of-"))).toBe(true);
  expect(new Set(animations).size).toBe(animations.length);
});

test.describe("with reduced motion on", () => {
  test.use({ reducedMotion: "reduce" });

  test("the drawing is a still: only the frame chosen as the still shows", async ({ page }) => {
    await startWorkout(page, workout);
    const exercise = data.exercises[workout.steps[0].exercise];
    const shown = await page.locator(".set-drawing .drawing-frame").evaluateAll((nodes) =>
      nodes
        .filter((node) => getComputedStyle(node).opacity === "1")
        .map((node) => ({ frame: node.dataset.frame, animation: getComputedStyle(node).animationName })),
    );
    expect(shown).toEqual([{ frame: String(exercise.still), animation: "none" }]);
  });

  test("screens arrive without moving", async ({ page }) => {
    await openApp(page);
    expect(await page.locator(".screen").evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
  });
});

test("it behaves like an app: no text selection, no tap highlight, no double-tap zoom, always dark", async ({ page }) => {
  await openApp(page);
  const styles = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const link = getComputedStyle(document.querySelector(".choice"));
    return {
      userSelect: body.userSelect || body.webkitUserSelect,
      touchAction: link.touchAction,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      bodyOverflow: body.overflow,
    };
  });
  expect(styles).toEqual({ userSelect: "none", touchAction: "manipulation", colorScheme: "dark", bodyOverflow: "hidden" });
});

test.describe("when the phone is set to light mode", () => {
  test.use({ colorScheme: "light" });

  test("the app is still dark", async ({ page }) => {
    await openApp(page);
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [red, green, blue] = background.match(/\d+/g).map(Number);
    expect(Math.max(red, green, blue)).toBeLessThan(64);
  });
});
