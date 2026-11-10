// The change of screen when she picks a day or a variation: the name she
// tapped travels to the next screen's title, and home again on the way back
// (docs/quality-bar.md D23).

import { COPY, expect, heading, openApp, screen, test, workouts } from "./app.mjs";

const { day, variation, title } = workouts[0];
const otherDay = workouts.find((workout) => workout.day !== day).day;

const link = (page, name) => page.getByRole("link", { name, exact: true });
// Picks a box without pressing it. A press shrinks the box a little and the
// name rightly sets out from where the press has it, a fraction of a pixel
// from where it rests; these tests compare with where it rests.
const pick = (page, name) => link(page, name).dispatchEvent("click");
const nameIn = (box) => box.locator(".choice-name");
// A screen's arrival is over when nothing of it is left on the screen. Until
// then a place measured on it is a place in passing.
const arrived = (page) => expect(screen(page)).not.toHaveClass(/fades-in|steps-in/);

const place = (locator) =>
  locator.evaluate((node) => {
    const { left, top } = node.getBoundingClientRect();
    return { left, top };
  });

// Where a name's journey began, worked out from where the name now rests and
// how far it was told the other end is.
async function startOf(locator) {
  const { left, top } = await place(locator);
  const far = await locator.evaluate((node) => ["--travel-x", "--travel-y"].map((name) => Number.parseFloat(node.style.getPropertyValue(name))));
  return { left: left + far[0], top: top + far[1] };
}

function expectSamePlace(actual, expected) {
  expect(actual.left).toBeCloseTo(expected.left, 0);
  expect(actual.top).toBeCloseTo(expected.top, 0);
}

test("the name she taps travels to the next screen's title, and the old screen is gone once it has faded", async ({ page }) => {
  await openApp(page);
  await arrived(page);
  const inItsBox = await place(nameIn(link(page, day.name)));

  await pick(page, day.name);
  await expect(heading(page)).toHaveText(day.name);
  await expect(heading(page)).toHaveClass(/arrives/);
  await arrived(page);
  await expect(page.locator(".screen")).toHaveCount(1);
  expectSamePlace(await startOf(heading(page)), inItsBox);

  const variationInItsBox = await place(nameIn(link(page, title)));
  await pick(page, title);
  await expect(heading(page)).toHaveText(variation.name);
  await arrived(page);
  await expect(page.locator(".screen")).toHaveCount(1);
  expectSamePlace(await startOf(heading(page)), variationInItsBox);
});

test("going back sends the name home to its box", async ({ page }) => {
  await openApp(page);
  await pick(page, day.name);
  await expect(heading(page)).toHaveText(day.name);
  await arrived(page);
  const asTitle = await place(heading(page));

  await page.goBack();
  await expect(heading(page)).toHaveText(COPY.appName);
  await expect(nameIn(link(page, day.name))).toHaveClass(/arrives/);
  await expect(link(page, day.name)).toHaveClass(/receives/);
  await arrived(page);
  expectSamePlace(await startOf(nameIn(link(page, day.name))), asTitle);
});

// A screen that stepped in is a plain screen again once it has arrived, so a
// name leaves it from where it sits.
test("a name sets out from where it sits on a screen she came back to", async ({ page }) => {
  await openApp(page);
  await arrived(page);
  const inItsBox = await place(nameIn(link(page, day.name)));
  await pick(page, otherDay.name);
  await expect(heading(page)).toHaveText(otherDay.name);
  await page.goBack();
  await expect(heading(page)).toHaveText(COPY.appName);
  await arrived(page);

  await pick(page, day.name);
  await expect(heading(page)).toHaveText(day.name);
  await arrived(page);
  expectSamePlace(await startOf(heading(page)), inItsBox);
});

test("a screen shown again over itself moves no name", async ({ page }) => {
  await openApp(page);
  await openApp(page, "nowhere");
  await expect(heading(page)).toHaveText(COPY.appName);
  await expect(page.locator(".arrives")).toHaveCount(0);
  await expect(page.locator(".screen")).toHaveCount(1);
});

test.describe("with reduced motion on", () => {
  test.use({ reducedMotion: "reduce" });

  test("the screen changes at once and no name travels", async ({ page }) => {
    await openApp(page);
    await pick(page, day.name);
    await expect(heading(page)).toHaveText(day.name);
    await expect(page.locator(".arrives")).toHaveCount(0);
    await expect(page.locator(".screen")).toHaveCount(1);
  });
});
