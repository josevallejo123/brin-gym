// Where the published site lives. GitHub Pages serves a repository at
// https://<account>.github.io/<repository>/, so the address is worked out
// from the repository's own address and written down nowhere.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

// "https://github.com/someone/brin-gym.git" -> "https://someone.github.io/brin-gym/"
export function pagesUrl(remoteUrl) {
  const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!match) throw new Error(`"${remoteUrl}" is not a GitHub repository address.`);
  const [, owner, repository] = match;
  return `https://${owner.toLowerCase()}.github.io/${repository}/`;
}

export function liveUrl(remote = "origin") {
  const result = spawnSync("git", ["remote", "get-url", remote], { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`There is no "${remote}" remote, so the site has no address yet.`);
  return pagesUrl(result.stdout.trim());
}
