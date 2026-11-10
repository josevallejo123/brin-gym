// Builds the list of files the service worker keeps on the phone, by scanning
// the app folder, so the list is never kept by hand.
//
//   node tools/app/offline-list.mjs
//
// writes app/offline-files.json and stamps the same build value into
// app/sw.js. The build value is a hash of every file in the list, so any
// change to the app (a workout, a drawing, a line of code) changes the bytes
// of sw.js, which is the one thing every browser checks to find a new version.

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const APP_DIR = fileURLToPath(new URL("../../app/", import.meta.url));
export const LIST_FILE = "offline-files.json";
export const WORKER_FILE = "sw.js";

// Tells GitHub Pages to serve the folder as it is. Without it Pages runs
// Jekyll, which turns art/LICENSE.md into a web page, and a file in the
// offline list that is not there stops the worker from installing.
export const PAGES_MARKER = ".nojekyll";

// Not kept for offline use: the worker and the list are always fetched fresh,
// the startup images are read by iOS once, when the app is added to the Home
// Screen, and the Pages marker is for GitHub alone.
const NOT_KEPT = [WORKER_FILE, LIST_FILE, PAGES_MARKER, "icons/startup/"];

const BUILD_LINE = /const BUILD = "[^"]*";/g;
const BUILD_LENGTH = 12;

// Every file under `dir`, as { url, file }: `url` is the path the app uses
// (forward slashes, relative), `file` is where it is on disk.
export async function scan(dir, urlPrefix = "") {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const file = path.join(entry.parentPath, entry.name);
      return { url: urlPrefix + path.relative(dir, file).split(path.sep).join("/"), file };
    });
}

export function stampWorker(source, build) {
  const found = source.match(BUILD_LINE)?.length ?? 0;
  if (found !== 1) throw new Error(`Expected one BUILD line in ${WORKER_FILE}, found ${found}.`);
  return source.replace(BUILD_LINE, `const BUILD = "${build}";`);
}

// The offline list for a set of files: which are kept, and the build value
// that names this exact set of bytes.
export async function describe(entries) {
  const kept = entries
    .filter(({ url }) => !NOT_KEPT.some((skipped) => url.startsWith(skipped)))
    .sort((a, b) => (a.url < b.url ? -1 : 1));
  const worker = entries.find(({ url }) => url === WORKER_FILE);
  if (!worker) throw new Error(`${WORKER_FILE} is missing.`);

  const hash = createHash("sha256");
  for (const { url, file } of kept) {
    hash.update(url).update("\0").update(await readFile(file)).update("\0");
  }
  // The worker counts too, read with its stamp blanked so stamping it does
  // not change the value it is stamped with.
  hash.update(stampWorker(await readFile(worker.file, "utf8"), ""));

  return { build: hash.digest("hex").slice(0, BUILD_LENGTH), files: kept.map(({ url }) => url) };
}

export const serializeList = (list) => `${JSON.stringify(list, null, 2)}\n`;

async function main() {
  const list = await describe(await scan(APP_DIR));
  const workerPath = path.join(APP_DIR, WORKER_FILE);
  await writeFile(path.join(APP_DIR, LIST_FILE), serializeList(list));
  await writeFile(workerPath, stampWorker(await readFile(workerPath, "utf8"), list.build));
  console.log(`Build ${list.build}: ${list.files.length} files kept for offline use.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
