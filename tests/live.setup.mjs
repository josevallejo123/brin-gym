// Waits until the published site serves the version in app/version.json.

import { VERSION_URL } from "../app/js/config.js";
import { readJson } from "./logic/helpers.mjs";

const WAIT_MINUTES = 10;
const RETRY_MS = 10_000;

export default async function waitForPublishedVersion(config) {
  const { version } = readJson(`app/${VERSION_URL}`);
  const url = `${config.projects[0].use.baseURL}${VERSION_URL}`;
  const deadline = Date.now() + WAIT_MINUTES * 60_000;
  let seen = "nothing";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}?at=${Date.now()}`, { cache: "no-store" });
      seen = response.ok ? (await response.json()).version : `status ${response.status}`;
    } catch (error) {
      // No answer yet (the site is still being set up, or there is no signal).
      seen = error.message;
    }
    if (seen === version) return;
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }
  throw new Error(`${url} did not serve version ${version} within ${WAIT_MINUTES} minutes (last seen: ${seen}).`);
}
