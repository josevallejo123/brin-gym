// npm run test:browser:real: the same browser tests against the real
// app/data/ and app/art/, as they will be published.

import { defineConfig } from "@playwright/test";

import { browserTests } from "./shared.config.mjs";

export default defineConfig(browserTests({ fixtures: false }));
