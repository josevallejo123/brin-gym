// What the browser test configurations share: the two iPhone sizes, the two
// engines, and the local server that mounts the app under /brin-gym/.

import { devices } from "@playwright/test";

import { DEFAULT_PORT, MOUNT } from "../tools/app/serve.mjs";

const BASE_URL = `http://localhost:${DEFAULT_PORT}${MOUNT}`;

// The two sizes the brief names: a current iPhone and the small iPhone SE.
const SIZES = [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
];

// WebKit is the closest thing to iPhone Safari on a PC; Chromium is the
// second opinion, and the one that can test the service worker offline.
const ENGINES = {
  webkit: { ...devices["iPhone 14"], browserName: "webkit" },
  chromium: { ...devices["Pixel 7"], browserName: "chromium" },
};

function projects(engineNames) {
  return engineNames.flatMap((engine) =>
    SIZES.map((viewport) => ({
      name: `${engine} ${viewport.width}x${viewport.height}`,
      use: { ...ENGINES[engine], viewport },
    })),
  );
}

// `fixtures: true` serves tests/fixtures/ in place of app/data/ and app/art/.
// The choice is passed on to the test files through BRIN_CONTENT, so they
// read the same workouts the server is serving. `asPublished: true` serves
// app/ exactly as it is on disk. `liveUrl` tests a site that is already
// running somewhere else, and starts no server.
export function sharedConfig({ fixtures = false, asPublished = false, engines = Object.keys(ENGINES), liveUrl = null }) {
  process.env.BRIN_CONTENT = fixtures ? "fixtures" : "real";
  const server = ["node tools/app/serve.mjs", `--port ${DEFAULT_PORT}`, fixtures && "--fixtures", asPublished && "--as-published"];
  return {
    outputDir: "../test-results",
    reporter: [["list"]],
    forbidOnly: true,
    fullyParallel: true,
    timeout: 90_000,
    use: { baseURL: liveUrl ?? BASE_URL },
    projects: projects(engines),
    webServer: liveUrl
      ? undefined
      : {
          command: server.filter(Boolean).join(" "),
          cwd: "..",
          url: BASE_URL,
          reuseExistingServer: false,
        },
  };
}

// The browser tests proper: every spec in tests/browser, in both engines.
export const browserTests = ({ fixtures }) => ({
  ...sharedConfig({ fixtures }),
  testDir: "./browser",
  testMatch: "*.spec.mjs",
});
