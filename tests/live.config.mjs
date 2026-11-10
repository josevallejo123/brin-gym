// npm run test:live: the twelve-workout walk and the shell tests (installable
// under the sub-path, whole offline after one load) against the published
// site. It waits first until the site serves the version in app/version.json,
// since GitHub Pages takes a minute or two after a publish.

import { defineConfig } from "@playwright/test";

import { liveUrl } from "../tools/app/site.mjs";
import { sharedConfig } from "./shared.config.mjs";

// Worked out once and handed on to the test workers, which load this file too.
process.env.BRIN_LIVE_URL ??= liveUrl();

export default defineConfig({
  ...sharedConfig({ liveUrl: process.env.BRIN_LIVE_URL }),
  testDir: "./browser",
  testMatch: ["walk.spec.mjs", "shell.spec.mjs"],
  globalSetup: "./live.setup.mjs",
  // A real network is slower and less even than the local server.
  retries: 1,
  workers: 4,
});
