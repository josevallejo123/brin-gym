// npm run test:browser:published: the offline test against app/ exactly as it
// is on disk, with the offline file list and the worker's build stamp as
// tools/app/offline-list.mjs wrote them. Every other run has the local server
// work those two out in memory, so this is the only test of the pair that is
// really published. tools/publish.mjs runs it after stamping.

import { defineConfig } from "@playwright/test";

import { sharedConfig } from "./shared.config.mjs";

export default defineConfig({
  ...sharedConfig({ engines: ["chromium"], asPublished: true }),
  testDir: "./browser",
  testMatch: "shell.spec.mjs",
  grep: /network off/,
});
