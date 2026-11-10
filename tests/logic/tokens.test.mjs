// The design system, checked from the code: contrast, and that every colour,
// size and duration is a named token (docs/quality-bar.md D1, D9, D15, D22).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { APP_DIR, scan } from "../../tools/app/offline-list.mjs";
import { TOKENS_FILE, hexToRgb, readTokens } from "../../tools/app/tokens.mjs";

const stylesheets = (await scan(APP_DIR))
  .filter(({ url }) => url.endsWith(".css"))
  .map(({ url, file }) => ({ file: url, css: readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "") }));
const tokensCss = stylesheets.find(({ file }) => file === TOKENS_FILE).css;
const otherCss = stylesheets.filter(({ file }) => file !== TOKENS_FILE);
const tokens = readTokens();

function luminance(hex) {
  const [red, green, blue] = hexToRgb(hex)
    .map((value) => value / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(tokens.get(foreground)), luminance(tokens.get(background))].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const MAIN_TEXT = 7;
const OTHER_TEXT = 4.5;

for (const [foreground, background, minimum] of [
  ["--color-text", "--color-bg", MAIN_TEXT],
  ["--color-drawing", "--color-bg", MAIN_TEXT],
  ["--color-text", "--color-surface", MAIN_TEXT],
  ["--color-text", "--color-surface-pressed", MAIN_TEXT],
  ["--color-muted", "--color-bg", OTHER_TEXT],
  ["--color-accent", "--color-bg", OTHER_TEXT],
  ["--color-on-accent", "--color-accent", OTHER_TEXT],
  ["--color-on-accent", "--color-accent-pressed", OTHER_TEXT],
]) {
  test(`${foreground} on ${background} has a contrast of at least ${minimum}:1`, () => {
    const ratio = contrast(foreground, background);
    assert.ok(ratio >= minimum, `${ratio.toFixed(2)}:1`);
  });
}

test("no stylesheet but tokens.css holds a raw colour, length or duration", () => {
  const raw = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|(?<![\w-])\d*\.?\d+(?:px|rem|em|ms|s|vh|vw|dvh|svh|pt)\b/gi;
  for (const { file, css } of otherCss) {
    assert.deepEqual(css.match(raw) ?? [], [], file);
  }
});

test("every token a stylesheet uses is defined", () => {
  for (const { file, css } of [...otherCss, { file: TOKENS_FILE, css: tokensCss }]) {
    const missing = [...css.matchAll(/var\((--[\w-]+)/g)].map(([, name]) => name).filter((name) => !tokens.has(name));
    assert.deepEqual(missing, [], file);
  }
});

test("every token is used, apart from spare steps of the type and space scales", () => {
  const all = [tokensCss, ...otherCss.map(({ css }) => css)].join("\n");
  const isScaleStep = (name) => /^--(type|space)-\d+$/.test(name);
  const unused = [...tokens.keys()].filter((name) => !isScaleStep(name) && !all.includes(`var(${name})`));
  assert.deepEqual(unused, []);
});

test("nothing decorative: no gradients, blur, shadows or filters", () => {
  for (const { file, css } of otherCss) {
    assert.deepEqual(css.match(/gradient|blur|shadow|filter/gi) ?? [], [], file);
  }
});

test("only transform and opacity are ever transitioned", () => {
  for (const { file, css } of otherCss) {
    const transitions = [...css.matchAll(/transition:\s*([^;]+);/g)].map(([, value]) => value.trim());
    for (const value of transitions) {
      assert.match(value, /^(none|(transform|opacity) [^,]+)$/, `${file}: ${value}`);
    }
  }
});

test("keyframes move only opacity, transform and the flourish's stroke", () => {
  const allowed = new Set(["opacity", "transform", "stroke-dashoffset"]);
  for (const { file, css } of otherCss) {
    for (const [, body] of css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?\})\s*\}/g)) {
      const properties = [...body.matchAll(/([\w-]+):/g)].map(([, property]) => property);
      assert.deepEqual(properties.filter((property) => !allowed.has(property)), [], file);
    }
  }
});

// A paused stage is drawn at --dim-opacity over the background, which mixes
// each colour that far towards it.
test("paused, the dimmed stage still reads: muted text keeps a contrast of 4.5:1", () => {
  const dim = Number(tokens.get("--dim-opacity"));
  const background = hexToRgb(tokens.get("--color-bg"));
  const dimmedLuminance = (name) => {
    const mixed = hexToRgb(tokens.get(name)).map((value, index) => Math.round(background[index] + (value - background[index]) * dim));
    return luminance(`#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`);
  };
  const ratio = (name) => (dimmedLuminance(name) + 0.05) / (luminance(tokens.get("--color-bg")) + 0.05);

  assert.ok(dim < 1, "the stage does dim");
  assert.ok(ratio("--color-muted") >= OTHER_TEXT, `muted text ${ratio("--color-muted").toFixed(2)}:1`);
  assert.ok(ratio("--color-text") >= MAIN_TEXT, `main text ${ratio("--color-text").toFixed(2)}:1`);
});

test("the app is always dark: nothing follows the phone's light or dark setting", () => {
  const all = [tokensCss, ...otherCss.map(({ css }) => css)].join("\n");
  assert.equal(all.includes("prefers-color-scheme"), false);
  assert.match(all, /color-scheme:\s*dark/);
});

test("the player's type is large enough to read from across the room", () => {
  const pixels = (name) => {
    const [, step] = tokens.get(name).match(/var\(--type-(\d+)\)/);
    return Number(step);
  };
  assert.ok(pixels("--player-reps-size") >= 96);
  assert.ok(pixels("--countdown-size") >= 96);
  assert.ok(pixels("--player-name-size") >= 30);
});
