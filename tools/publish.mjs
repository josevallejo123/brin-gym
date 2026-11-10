// Publishes the app to GitHub Pages: checks it, stamps a new version, and
// pushes. Nothing is pushed unless every check passes.
//
//   npm run publish
//   npm run publish -- --note "Swapped the finisher on the second Back workout"
//
// In this order:
//   1. Stops unless the content check, the logic tests and the browser tests
//      (on the test content and on the real content) all pass.
//   2. Stamps the one version value, app/version.json, then regenerates the
//      offline file list. The order matters: the list's build value is a hash
//      that includes version.json, and a worker whose stamp does not match
//      its list cannot install.
//   3. Tests the stamped app exactly as it will be served.
//   4. Commits, then pushes main (the whole project) and the gh-pages branch
//      (the app folder alone, which is what GitHub Pages serves) together.
//
// Afterwards `npm run test:live` checks the published site itself.

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { liveUrl } from "./app/site.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const APP_FOLDER = "app";
const VERSION_FILE = `${APP_FOLDER}/version.json`;
const MAIN_BRANCH = "main";
const PAGES_BRANCH = "gh-pages";
const REMOTE = "origin";

// What the public repository may hold. Everything else in the project folder
// stays on this computer (.gitignore keeps it out; this is the second lock).
const PUBLIC_FOLDERS = ["app/", "tools/", "tests/", "docs/"];
const PUBLIC_FILES = ["package.json", "package-lock.json", "README.md", "CLAUDE.md", ".gitignore", ".gitattributes"];
// The app has no photos or video, so a file of that kind is personal.
const PERSONAL_FILE = /\.(jpe?g|hei[cf]|webp|gif|tiff?|dng|mov|mp4|m4v|avi)$/i;

// Commits carry GitHub's no-reply address, because an email address in a
// public history cannot be taken back.
const NO_REPLY = /@users\.noreply\.github\.com$/;

const GATES = ["npm run check", "npm test", "npm run test:browser:real"];
const AFTER_STAMPING = ["npm run offline-list", "npm run test:browser:published"];

// "2026.11.09" for the first publish of a day, then "2026.11.09.2", ".3", ...
export function nextVersion(current, today) {
  if (current === today) return `${today}.2`;
  if (!current.startsWith(`${today}.`)) return today;
  return `${today}.${Number(current.slice(today.length + 1)) + 1}`;
}

export function dayStamp(date) {
  const two = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}.${two(date.getMonth() + 1)}.${two(date.getDate())}`;
}

// The files that must not be in a public repository.
export function notPublic(paths) {
  const isPublic = (file) => PUBLIC_FILES.includes(file) || PUBLIC_FOLDERS.some((folder) => file.startsWith(folder));
  return paths.filter((file) => !isPublic(file) || PERSONAL_FILE.test(file));
}

const runGit = (args) => spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });

function git(...args) {
  const result = runGit(args);
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed:\n${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

// For a question git answers with its exit code: null means "no".
function gitOrNull(...args) {
  const result = runGit(args);
  return result.status === 0 ? result.stdout.trim() : null;
}

function run(command) {
  console.log(`\n> ${command}`);
  const result = spawnSync(command, { cwd: ROOT, shell: true, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`"${command}" failed, so nothing was published.`);
}

function refuseStrays(paths) {
  const strays = notPublic(paths.filter(Boolean));
  if (strays.length === 0) return;
  throw new Error(
    `The public repository must not hold these files:\n  ${strays.join("\n  ")}\n` +
      "Nothing was committed or pushed. Add them to .gitignore, and if git already tracks one, run git rm --cached <file>.",
  );
}

// Everything that can stop a publish without running a test is checked here,
// before the minutes of tests. Returns the address the site will have.
function checkSetUp() {
  if (gitOrNull("rev-parse", "--is-inside-work-tree") !== "true") throw new Error("This folder is not a git repository yet.");
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (branch !== MAIN_BRANCH) throw new Error(`Publishing happens from ${MAIN_BRANCH}; this is ${branch}.`);
  const email = gitOrNull("config", "user.email") ?? "";
  if (!NO_REPLY.test(email)) {
    throw new Error(
      "Commits here must use a GitHub no-reply address, and this repository has none set. Set it for this repository only:\n" +
        '  git config user.name "<GitHub login>"\n' +
        '  git config user.email "<id>+<GitHub login>@users.noreply.github.com"',
    );
  }
  // Tracked files, and new ones that the commit would pick up.
  refuseStrays(git("ls-files", "--cached", "--others", "--exclude-standard").split("\n"));
  return liveUrl(REMOTE);
}

// True when the site already serves exactly this app folder and nothing is
// waiting to be committed or pushed. Publishing again would only make her
// phone download the whole app once more.
function alreadyPublished() {
  const clean = git("status", "--porcelain") === "";
  const head = gitOrNull("rev-parse", "HEAD");
  const pushed = head !== null && head === gitOrNull("rev-parse", `${REMOTE}/${MAIN_BRANCH}`);
  const served = gitOrNull("rev-parse", `${REMOTE}/${PAGES_BRANCH}^{tree}`);
  return clean && pushed && served !== null && served === gitOrNull("rev-parse", `HEAD:${APP_FOLDER}`);
}

function stampVersion() {
  // Counted from the last committed version, so a publish that stopped
  // half-way does not use up a number.
  const committed = gitOrNull("show", `HEAD:${VERSION_FILE}`);
  const current = committed === null ? "" : JSON.parse(committed).version;
  const version = nextVersion(current, dayStamp(new Date()));
  writeFileSync(path.join(ROOT, VERSION_FILE), `${JSON.stringify({ version })}\n`);
  console.log(`\nVersion ${version}`);
  return version;
}

function commitAndPush(version, note) {
  git("add", "--all");
  // The last lock: what is about to be committed, read back from git itself.
  refuseStrays(git("ls-files").split("\n"));

  const message = ["-m", `Publish ${version}`, ...(note ? ["-m", note] : [])];
  git("commit", ...message);

  // The site is the app folder and nothing else: a commit on gh-pages whose
  // whole tree is app/ as it was just committed on main.
  const parent = gitOrNull("rev-parse", "--verify", "--quiet", `${REMOTE}/${PAGES_BRANCH}`);
  const tree = git("rev-parse", `HEAD:${APP_FOLDER}`);
  const site = git("commit-tree", tree, ...(parent ? ["-p", parent] : []), ...message);

  // Both branches or neither, so the source and the site never disagree.
  run(`git push --atomic --set-upstream ${REMOTE} ${MAIN_BRANCH} ${site}:refs/heads/${PAGES_BRANCH}`);
}

function publish({ note }) {
  const address = checkSetUp();
  // Learn what is already published; a new, empty repository has nothing yet.
  gitOrNull("fetch", "--quiet", REMOTE);
  if (alreadyPublished()) {
    console.log("Nothing has changed since the last publish.");
    return;
  }

  GATES.forEach(run);
  const version = stampVersion();
  AFTER_STAMPING.forEach(run);
  commitAndPush(version, note);

  console.log(`\nPublished version ${version} to ${address}`);
  console.log("GitHub Pages takes a minute or two to serve it. To check the live site: npm run test:live");
}

// Only when run as a command; the tests import this file for its helpers.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: { note: { type: "string" } } });
  try {
    publish(values);
  } catch (error) {
    console.error(`\n${error.message}`);
    process.exit(1);
  }
}
