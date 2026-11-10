// A new version reaching an app that is already open: it installs in the
// background and waits for the workout to end. The test starts a server of
// its own, on the test content, so that it can publish a "new version" to it.

import { startServer } from "../../tools/app/serve.mjs";
import { COPY, button, chooseWorkout, doneButton, expect, heading, skipButton, test, workouts } from "./app.mjs";

const workout = workouts[0];

const workerInControl = (page) => page.waitForFunction(() => navigator.serviceWorker.controller !== null);

test.skip(({ browserName }) => browserName !== "chromium", "The service worker tests run in Chromium.");

test("a new version installs in the background and takes over only once the workout is over", async ({ page }) => {
  const server = await startServer({ port: 0, fixtures: true });
  try {
    await page.goto(server.url);
    await workerInControl(page);
    const [firstCache] = await page.evaluate(() => caches.keys());

    await chooseWorkout(page, workout);
    await button(page, COPY.start).click();
    await page.evaluate(() => {
      window.neverReloaded = true;
    });

    server.publishNewVersion("-next");
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting));

    // The new version is on the phone, but the workout was not interrupted.
    await doneButton(page).click();
    await skipButton(page).click();
    expect(await page.evaluate(() => window.neverReloaded)).toBe(true);
    expect(await page.evaluate(() => caches.keys())).toContain(firstCache);

    await button(page, COPY.endWorkout).click();
    await page.getByRole("dialog").getByRole("button", { name: COPY.endWorkout }).click();

    // With the workout over, the page reloads onto the new version.
    await page.waitForFunction(() => window.neverReloaded !== true);
    await expect(heading(page)).toHaveText(COPY.appName);
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([`${firstCache}-next`]);
  } finally {
    await server.close();
  }
});
