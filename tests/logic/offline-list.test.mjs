// The offline file list: built by scanning, never kept by hand, and stamped
// into the service worker so every change to the app changes sw.js.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { APP_DIR, PAGES_MARKER, describe, scan, stampWorker } from "../../tools/app/offline-list.mjs";
import { readText } from "./helpers.mjs";

let folder;

async function put(relativePath, content) {
  const file = path.join(folder, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

before(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "brin-gym-offline-"));
  await put("index.html", "<!doctype html>");
  await put("sw.js", 'const BUILD = "unbuilt";\n');
  await put("offline-files.json", "{}");
  await put("js/main.js", "export {};");
  await put("art/frog-pump/1.svg", "<svg/>");
  await put("icons/icon-192.png", "icon");
  await put("icons/startup/750x1334.png", "launch image");
  await put(PAGES_MARKER, "");
});

after(() => rm(folder, { recursive: true, force: true }));

const list = async () => describe(await scan(folder));

test("the list is every file in the folder, in a steady order, with relative forward-slash paths", async () => {
  const { files } = await list();
  assert.deepEqual(files, ["art/frog-pump/1.svg", "icons/icon-192.png", "index.html", "js/main.js"]);
});

test("the worker, the list itself, the launch images and the GitHub Pages marker are not kept", async () => {
  const { files } = await list();
  for (const skipped of ["sw.js", "offline-files.json", "icons/startup/750x1334.png", PAGES_MARKER]) {
    assert.equal(files.includes(skipped), false, skipped);
  }
});

test("the build value is steady for the same files and changes with any of them", async () => {
  const first = await list();
  assert.equal((await list()).build, first.build);
  assert.match(first.build, /^[0-9a-f]{12}$/);

  await put("art/frog-pump/1.svg", "<svg><path/></svg>");
  const afterDrawing = await list();
  assert.notEqual(afterDrawing.build, first.build);

  await put("art/frog-pump/2.svg", "<svg/>");
  const afterNewFile = await list();
  assert.notEqual(afterNewFile.build, afterDrawing.build);
  assert.ok(afterNewFile.files.includes("art/frog-pump/2.svg"));
});

test("a change to the worker's own code changes the build, but stamping it does not", async () => {
  const before = await list();
  await put("sw.js", `const BUILD = "${before.build}";\n`);
  assert.equal((await list()).build, before.build);

  await put("sw.js", `const BUILD = "${before.build}";\n// a new rule\n`);
  assert.notEqual((await list()).build, before.build);
});

test("stamping replaces the build line and nothing else", () => {
  const source = '// worker\nconst BUILD = "old";\nconst CACHE = `brin-gym-${BUILD}`;\n';
  assert.equal(stampWorker(source, "abc123"), '// worker\nconst BUILD = "abc123";\nconst CACHE = `brin-gym-${BUILD}`;\n');
});

test("a worker without exactly one build line is refused", () => {
  assert.throws(() => stampWorker("const CACHE = 1;", "abc"), /Expected one BUILD line/);
  assert.throws(() => stampWorker('const BUILD = "a";\nconst BUILD = "b";', "abc"), /Expected one BUILD line/);
});

test("the real worker has its build line and the real app folder scans", async () => {
  assert.doesNotThrow(() => stampWorker(readText("app/sw.js"), "abc"));
  const scanned = await scan(APP_DIR);
  // Without the marker GitHub Pages rewrites art/LICENSE.md and the worker cannot install.
  assert.ok(scanned.some(({ url }) => url === PAGES_MARKER), `${PAGES_MARKER} is in the app folder`);
  const { files } = await describe(scanned);
  for (const needed of ["index.html", "css/tokens.css", "js/main.js", "fonts/jost.woff2", "version.json"]) {
    assert.ok(files.includes(needed), needed);
  }
});
