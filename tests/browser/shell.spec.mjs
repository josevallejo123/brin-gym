// The Home Screen web app shell in a real browser: installable under
// /brin-gym/ and whole offline after one load. The service worker test runs
// in Chromium, the engine whose automation can switch the network off.

import {
  COPY,
  data,
  doneButton,
  expect,
  heading,
  openApp,
  skipButton,
  startWorkout,
  test,
  workouts,
} from "./app.mjs";

const workout = workouts[0];

const workerInControl = (page) => page.waitForFunction(() => navigator.serviceWorker.controller !== null);

const drawingUrls = Object.entries(data.exercises).flatMap(([id, exercise]) =>
  Array.from({ length: exercise.frames }, (_, index) => `art/${id}/${index + 1}.svg`),
);

test("the manifest and its icons load from under the sub-path", async ({ page, baseURL }) => {
  await openApp(page);
  expect(new URL(baseURL).pathname).toBe("/brin-gym/");

  const manifestUrl = await page.locator('link[rel="manifest"]').evaluate((link) => link.href);
  expect(manifestUrl).toBe(`${baseURL}manifest.webmanifest`);
  const manifest = await (await page.request.get(manifestUrl)).json();
  expect(new URL(manifest.start_url, manifestUrl).href).toBe(baseURL);
  expect(new URL(manifest.scope, manifestUrl).href).toBe(baseURL);

  const touchIcon = await page.locator('link[rel="apple-touch-icon"]').evaluate((link) => link.href);
  for (const url of [touchIcon, ...manifest.icons.map((icon) => new URL(icon.src, manifestUrl).href)]) {
    const response = await page.request.get(url);
    expect(response.ok(), url).toBe(true);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});

test("the site root sends a browser to the sub-path, as GitHub Pages serves it", async ({ page, baseURL }) => {
  await page.goto(new URL("/brin-gym", baseURL).href);
  expect(page.url()).toBe(baseURL);
  await expect(heading(page)).toHaveText(COPY.appName);
});

test.describe("service worker", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "The offline switch needs Chromium.");

  test("after one load the whole app works with the network off, including every drawing", async ({ page, context }) => {
    await openApp(page);
    await workerInControl(page);
    await context.setOffline(true);

    await page.reload();
    await expect(heading(page)).toHaveText(COPY.appName);

    const missing = await page.evaluate(async (urls) => {
      const results = await Promise.all(urls.map(async (url) => [url, (await fetch(url)).ok]));
      return results.filter(([, ok]) => !ok).map(([url]) => url);
    }, drawingUrls);
    expect(missing, "drawings not kept for offline use").toEqual([]);
    expect(await page.evaluate(() => document.fonts.check('1rem "Bodoni Moda"') && document.fonts.check('1rem "Jost"'))).toBe(true);

    await openApp(page, "about");
    await expect(page.getByText(/^Brin Gym\. Version /)).toBeVisible();

    await startWorkout(page, workout);
    await doneButton(page).click();
    await skipButton(page).click();
    await page.reload();
    await expect(page.locator(".set-name")).toBeVisible();
  });
});
