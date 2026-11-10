// The Home Screen web app shell, checked from the files: the manifest, the
// head of index.html, the icons and launch images, and the rules the code
// keeps (docs/quality-bar.md sections 3 and 4).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { APP_DIR, scan } from "../../tools/app/offline-list.mjs";
import { readPngHeader } from "../../tools/app/png.mjs";
import { readTokens } from "../../tools/app/tokens.mjs";
import { readJson, readText } from "./helpers.mjs";

const html = readText("app/index.html");
const manifest = readJson("app/manifest.webmanifest");
const background = readTokens().get("--color-bg");
const appFiles = (await scan(APP_DIR)).map(({ url }) => url);

const png = (relativePath) => readPngHeader(readFileSync(path.join(APP_DIR, relativePath)));
const filesUnder = (folder, extension) => appFiles.filter((url) => url.startsWith(folder) && url.endsWith(extension));

// A file's code without its comments, which may name the very things the
// code must not contain.
const code = (file) => readText(`app/${file}`).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$|<!--[\s\S]*?-->/gm, "");

// The app's own code, styles and shell. The data, the
// drawings and the font licences are content, with their own checks.
const ownFiles = ["index.html", "manifest.webmanifest", "sw.js", ...filesUnder("css/", ".css"), ...filesUnder("js/", ".js")];
const scripts = ownFiles.filter((file) => file.endsWith(".js"));

test("the page, the theme colour and the manifest all use the token background", () => {
  assert.match(html, new RegExp(`<html lang="en" style="background-color: ${background}">`));
  assert.match(html, new RegExp(`<meta name="theme-color" content="${background}">`));
  assert.equal(manifest.background_color, background);
  assert.equal(manifest.theme_color, background);
});

test("the manifest installs as a standalone app that works under a sub-path", () => {
  assert.equal(manifest.name, "Brin Gym");
  assert.equal(manifest.short_name, "Brin Gym");
  assert.equal(manifest.display, "standalone");
  assert.deepEqual([manifest.id, manifest.start_url, manifest.scope], ["./", "./", "./"]);
});

test("the manifest's icons exist at the sizes it states, each with one purpose", () => {
  assert.deepEqual(manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`).sort(), [
    "192x192 any",
    "512x512 any",
    "512x512 maskable",
  ]);
  for (const icon of manifest.icons) {
    const { width, height } = png(icon.src);
    assert.equal(`${width}x${height}`, icon.sizes, icon.src);
  }
});

test("the Apple touch icon is 180 × 180 with no transparency", () => {
  assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="icons\/apple-touch-icon\.png">/);
  assert.deepEqual(png("icons/apple-touch-icon.png"), { width: 180, height: 180, hasAlpha: false });
});

test("the head carries what an iPhone Home Screen web app needs", () => {
  for (const tag of [
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-title" content="Brin Gym">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<link rel="manifest" href="manifest.webmanifest">',
  ]) {
    assert.ok(html.includes(tag), tag);
  }
});

test("pinch zoom is left on", () => {
  assert.doesNotMatch(html, /user-scalable|maximum-scale/);
});

test("every launch image link points at a file of exactly the size it names, and none is left over", () => {
  const links = [...html.matchAll(/<link rel="apple-touch-startup-image" media="([^"]+)" href="([^"]+)">/g)];
  assert.ok(links.length >= 10, `${links.length} launch images`);
  for (const [, media, href] of links) {
    const [width, height, ratio] = ["device-width: (\\d+)px", "device-height: (\\d+)px", "pixel-ratio: (\\d)"].map(
      (pattern) => Number(media.match(new RegExp(pattern))[1]),
    );
    assert.deepEqual(png(href), { width: width * ratio, height: height * ratio, hasAlpha: false }, href);
  }
  assert.deepEqual(
    filesUnder("icons/startup/", ".png").sort(),
    links.map(([, , href]) => href).sort(),
  );
});

test("everything index.html links to exists", () => {
  const linked = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map(([, url]) => url);
  assert.ok(linked.length > 10);
  for (const url of linked) assert.ok(appFiles.includes(url), url);
});

test("every URL is relative, and nothing loads from another site", () => {
  // The one absolute address in the code is the SVG namespace, which names a
  // format and is never fetched.
  const allowed = ["http://www.w3.org/2000/svg"];
  for (const file of ownFiles) {
    const text = readText(`app/${file}`);
    const absolute = (text.match(/https?:\/\/[^\s"'`)]+/g) ?? []).filter((url) => !allowed.includes(url));
    assert.deepEqual(absolute, [], file);
    assert.doesNotMatch(text, /(?:href|src)=["']\/|url\(["']?\/|fetch\(["'`]\/|from ["']\//, file);
  }
});

test("sounds are made in code: no audio or video element, no sound file", () => {
  for (const file of ownFiles) {
    assert.doesNotMatch(code(file), /<audio|<video|new Audio\(|createElement\(["'](?:audio|video)|\.mp3|\.wav|\.m4a/, file);
  }
});

test("the logic modules have no page in them", () => {
  for (const file of scripts.filter((script) => script.startsWith("js/logic/"))) {
    assert.doesNotMatch(code(file), /\b(document|window|localStorage|navigator)\b/, file);
  }
});

test("no leftovers: no console logging, no to-do notes, and no HTML written from strings", () => {
  for (const file of scripts) {
    assert.doesNotMatch(code(file), /console\.|innerHTML|insertAdjacentHTML|document\.write/, file);
    assert.doesNotMatch(readText(`app/${file}`), /TODO|FIXME/, file);
  }
});

test("no module is a giant file", () => {
  const LONGEST_ALLOWED = 300;
  for (const file of scripts) {
    const lines = readText(`app/${file}`).split("\n").length;
    assert.ok(lines <= LONGEST_ALLOWED, `${file} has ${lines} lines`);
  }
});

test("the only dependency is the browser test runner", () => {
  const pkg = readJson("package.json");
  assert.equal(pkg.dependencies, undefined);
  assert.deepEqual(Object.keys(pkg.devDependencies), ["@playwright/test"]);
});

test("the bundled fonts come with their licences", () => {
  for (const file of ["bodoni-moda.woff2", "bodoni-moda-LICENSE.txt", "jost.woff2", "jost-LICENSE.txt"]) {
    assert.ok(appFiles.includes(`fonts/${file}`), file);
  }
  assert.match(readText("app/fonts/bodoni-moda-LICENSE.txt"), /SIL Open Font License, Version 1\.1/);
  assert.match(readText("app/fonts/jost-LICENSE.txt"), /SIL Open Font License, Version 1\.1/);
});
