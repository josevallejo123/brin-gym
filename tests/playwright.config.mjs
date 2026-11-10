// npm run test:browser: the browser tests against the fixture data and
// drawings in tests/fixtures/.

import { defineConfig } from "@playwright/test";

import { browserTests } from "./shared.config.mjs";

export default defineConfig(browserTests({ fixtures: true }));
