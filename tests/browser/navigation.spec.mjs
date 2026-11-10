// Moving between the screens around a workout: the back control, the browser's
// own back (the iOS back swipe), and addresses opened directly.

import { COPY, button, chooseWorkout, expect, heading, openApp, test, workouts } from "./app.mjs";

const { day, variation } = workouts[0];
const back = (page) => button(page, COPY.back);

test("the back control retraces her steps, and agrees with the browser's back", async ({ page }) => {
  await openApp(page);
  await chooseWorkout(page, workouts[0]);
  const entries = await page.evaluate(() => history.length);

  await back(page).click();
  await expect(heading(page)).toHaveText(day.name);
  await page.goForward();
  await expect(heading(page)).toHaveText(variation.name);

  await page.goBack();
  await expect(heading(page)).toHaveText(day.name);
  await back(page).click();
  await expect(heading(page)).toHaveText(COPY.appName);
  expect(await page.evaluate(() => history.length)).toBe(entries);
});

test("a screen opened directly still has a way up, even after a reload", async ({ page }) => {
  await openApp(page, `day/${day.id}/${variation.id}`);
  await expect(heading(page)).toHaveText(variation.name);
  await page.reload();
  await back(page).click();
  await expect(heading(page)).toHaveText(day.name);
  await back(page).click();
  await expect(heading(page)).toHaveText(COPY.appName);
});

test("About is reached from a quiet link on Home, and leads back", async ({ page }) => {
  await openApp(page);
  await page.getByRole("link", { name: COPY.about, exact: true }).click();
  await expect(heading(page)).toHaveText(COPY.about);
  await expect(page.getByText(/^Brin Gym\. Version \S+\.$/)).toBeVisible();
  await expect(page.locator(".credit a").first()).toHaveAttribute("rel", "noopener noreferrer");
  await back(page).click();
  await expect(heading(page)).toHaveText(COPY.appName);
});

test("if the credits cannot be loaded, About says so and the rest of the app carries on", async ({ page }) => {
  await page.route("**/art/credits.json", (route) => route.abort());
  // The browser logs the failed request itself; this test is about what the app then shows.
  page.removeAllListeners("console");

  await openApp(page, "about");
  await expect(heading(page)).toHaveText(COPY.about);
  await expect(page.getByText(COPY.aboutFailed)).toBeVisible();
  await back(page).click();
  await expect(heading(page)).toHaveText(COPY.appName);
});

test("an address that names nothing shows Home", async ({ page }) => {
  await openApp(page, "day/no-such-day");
  await expect(heading(page)).toHaveText(COPY.appName);
  await openApp(page, "workout");
  await expect(heading(page)).toHaveText(COPY.appName);
  await openApp(page, "done");
  await expect(heading(page)).toHaveText(COPY.appName);
});

test("if the workouts cannot be loaded, the screen says so and offers another try", async ({ page }) => {
  let block = true;
  await page.route("**/data/workouts.json", (route) => (block ? route.abort() : route.continue()));
  // The browser logs the failed request itself; this test is about what the app then shows.
  page.removeAllListeners("console");

  await page.goto("./");
  await expect(heading(page)).toHaveText(COPY.loadFailed);
  block = false;
  await button(page, COPY.tryAgain).click();
  await expect(heading(page)).toHaveText(COPY.appName);
});
