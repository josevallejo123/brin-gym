// The Finish screen: confetti behind everything, the clip, "Good job!", the
// total time and one way on. Each walk to it takes all of a workout's sets,
// so the checks of one screen share one walk.

import { FINISH_CLIP_URL, FINISH_STILL_URL } from "../../app/js/config.js";
import { COPY, button, expect, expectNoOverflow, finishWorkout, heading, screen, test, workouts } from "./app.mjs";

const workout = workouts[0];
const clip = (page) => page.locator(".finish-clip img");
const pieces = (page) => page.locator(".confetti-piece");

// The clip has really decoded, from the file named, and is silent to
// assistive technology.
async function expectClipFrom(page, file) {
  await expect(clip(page)).toHaveAttribute("alt", "");
  await expect.poll(() => clip(page).evaluate((img) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  expect(await clip(page).evaluate((img) => new URL(img.currentSrc).pathname)).toMatch(new RegExp(`/${file}$`));
}

const setVisibility = (page, state) =>
  page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", { value, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);

test("it celebrates behind and around the time, and Continue goes Home and clears it away", async ({ page }) => {
  await finishWorkout(page, workout);
  await expect(page.locator(".finish-time")).toHaveText(/^Done · \d+:\d\d$/);
  await expectClipFrom(page, FINISH_CLIP_URL);
  // An image, never a media element: a video or audio element pauses her music.
  await expect(page.locator("video, audio")).toHaveCount(0);
  await expect(screen(page).getByRole("button")).toHaveCount(1);
  await expectNoOverflow(page);

  // The confetti: behind everything, never taking a tap, never making the
  // screen scroll.
  expect(await pieces(page).count()).toBeGreaterThan(10);
  const layer = await page.locator(".confetti").evaluate((node) => {
    const style = getComputedStyle(node);
    return { pointerEvents: style.pointerEvents, overflow: style.overflow, behind: Number(style.zIndex) < 0 };
  });
  expect(layer).toEqual({ pointerEvents: "none", overflow: "hidden", behind: true });
  expect(await screen(page).evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);

  // It stops while the app is out of sight.
  const playState = () => pieces(page).first().evaluate((node) => getComputedStyle(node).animationPlayState);
  expect(await pieces(page).first().evaluate((node) => getComputedStyle(node).animationName)).toBe("confetti-fall");
  expect(await playState()).toBe("running");
  await setVisibility(page, "hidden");
  expect(await playState()).toBe("paused");
  await setVisibility(page, "visible");
  expect(await playState()).toBe("running");

  await button(page, COPY.leaveFinish).click();
  await expect(heading(page)).toHaveText(COPY.appName);
  await expect(page.locator(".confetti")).toHaveCount(0);
});

test("reloading on the Finish screen shows Home", async ({ page }) => {
  await finishWorkout(page, workout);
  await page.reload();
  await expect(heading(page)).toHaveText(COPY.appName);
});

test.describe("with reduced motion on", () => {
  test.use({ reducedMotion: "reduce" });

  test("the clip is a still and the confetti lies still", async ({ page }) => {
    await finishWorkout(page, workout);
    await expectClipFrom(page, FINISH_STILL_URL);
    const moving = await pieces(page).evaluateAll((nodes) =>
      nodes.filter((node) => getComputedStyle(node).animationName !== "none" || getComputedStyle(node, "::before").animationName !== "none").length,
    );
    expect(moving).toBe(0);
    await expectNoOverflow(page);
  });
});
