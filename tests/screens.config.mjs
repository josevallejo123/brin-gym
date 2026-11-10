// npm run screens: a screenshot of every screen and player state at both
// iPhone sizes, in WebKit, for holding against docs/quality-bar.md. They land
// in test-results/screens/ unless SCREENS_DIR says otherwise, and show the
// fixture content unless SCREENS_CONTENT is "real".

import { defineConfig } from "@playwright/test";

import { sharedConfig } from "./shared.config.mjs";

export default defineConfig({
  ...sharedConfig({ fixtures: process.env.SCREENS_CONTENT !== "real", engines: ["webkit"] }),
  testDir: "./screens",
  testMatch: "*.shots.mjs",
});
