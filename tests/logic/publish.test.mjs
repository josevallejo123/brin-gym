// The parts of publishing that can be checked without pushing anything: the
// version stamp, the list of what may be public, and the site's address.

import assert from "node:assert/strict";
import { test } from "node:test";

import { pagesUrl } from "../../tools/app/site.mjs";
import { dayStamp, nextVersion, notPublic } from "../../tools/publish.mjs";
import { readText } from "./helpers.mjs";

test("the version is the day, with a count from the second publish of a day", () => {
  assert.equal(dayStamp(new Date(2026, 10, 9)), "2026.11.09");
  assert.equal(nextVersion("", "2026.11.09"), "2026.11.09");
  assert.equal(nextVersion("0.1.0", "2026.11.09"), "2026.11.09");
  assert.equal(nextVersion("2026.11.08.4", "2026.11.09"), "2026.11.09");
  assert.equal(nextVersion("2026.11.09", "2026.11.09"), "2026.11.09.2");
  assert.equal(nextVersion("2026.11.09.2", "2026.11.09"), "2026.11.09.3");
});

test("only the app, its tools, tests and documents may be tracked", () => {
  const fine = ["app/index.html", "tools/publish.mjs", "tests/logic/publish.test.mjs", "docs/quality-bar.md", "README.md", ".gitignore"];
  assert.deepEqual(notPublic(fine), []);

  const strays = ["notes.md", "private/list.txt", "app/photo.JPG", "tests/clip.mov", "README.md.bak"];
  assert.deepEqual(notPublic([...fine, ...strays]), strays);
});

test("every kind of photo or video .gitignore keeps out is refused by publishing too", () => {
  const kinds = [...readText(".gitignore").matchAll(/^\*\.(\w+)$/gm)].map(([, kind]) => kind).filter((kind) => kind !== "log");
  assert.ok(kinds.length > 0);
  const insideTheApp = kinds.map((kind) => `app/art/something.${kind}`);
  assert.deepEqual(notPublic(insideTheApp), insideTheApp);
});

test("the site's address comes from the repository's address", () => {
  assert.equal(pagesUrl("https://github.com/Someone/brin-gym.git"), "https://someone.github.io/brin-gym/");
  assert.equal(pagesUrl("git@github.com:someone/brin-gym.git"), "https://someone.github.io/brin-gym/");
  assert.equal(pagesUrl("https://github.com/someone/brin-gym"), "https://someone.github.io/brin-gym/");
  assert.throws(() => pagesUrl("https://example.com/someone/brin-gym.git"), /not a GitHub repository/);
});
