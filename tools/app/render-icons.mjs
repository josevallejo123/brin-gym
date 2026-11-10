// Renders the Home Screen icons and the launch images, on the palette in
// app/css/tokens.css, from the line-drawn dumbbell in app/art/app-icon.svg.
//
//   node tools/app/render-icons.mjs
//   node tools/app/render-icons.mjs --source tests/fixtures/art/app-icon.svg
//
// It writes app/icons/ and rewrites the block of launch-image links in
// app/index.html, so the links and the files cannot drift apart.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "@playwright/test";

import { APP_DIR } from "./offline-list.mjs";
import { encodePng, flatPng } from "./png.mjs";
import { hexToRgb, readTokens } from "./tokens.mjs";

const ICONS_FOLDER = "icons";
const STARTUP_FOLDER = "icons/startup";
const DEFAULT_SOURCE = path.join(APP_DIR, "art/app-icon.svg");

// The drawing sits in the middle 60% of its square, so drawn edge to edge it
// stays inside the safe zone of a maskable icon and of iOS's rounded corners.
const ICON_FILES = [
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512 },
];

// iPhone screens in portrait: width and height in points, and the pixel
// ratio. iOS uses a launch image only if it matches the screen exactly, so a
// new iPhone size needs a new row here.
const IPHONE_SCREENS = [
  [375, 667, 2], // SE (2nd and 3rd generation), 8
  [414, 736, 3], // 8 Plus
  [375, 812, 3], // X, XS, 11 Pro, 12 mini, 13 mini
  [414, 896, 2], // XR, 11
  [414, 896, 3], // XS Max, 11 Pro Max
  [390, 844, 3], // 12, 13, 14, 16e and their Pro models up to 13
  [428, 926, 3], // 12 Pro Max, 13 Pro Max, 14 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [430, 932, 3], // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [402, 874, 3], // 16 Pro, 17, 17 Pro
  [420, 912, 3], // Air
  [440, 956, 3], // 16 Pro Max, 17 Pro Max
];

const LINKS_BLOCK = /(<!-- startup-images:start[^>]*-->)[\s\S]*?(\s*<!-- startup-images:end -->)/;

function palette() {
  const tokens = readTokens();
  const colour = (name) => {
    const hex = tokens.get(name);
    if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`${name} is not a six-digit hex colour in css/tokens.css.`);
    return hex;
  };
  return { background: colour("--color-bg"), line: colour("--color-accent") };
}

// Draws the dumbbell in a browser, at each size, and returns the pixels.
async function drawIcons(svg, { background, line }) {
  // The drawing is colour-neutral: its shapes take the colour set on the root.
  const coloured = svg.replace("<svg ", `<svg color="${line}" `);
  const source = `data:image/svg+xml;base64,${Buffer.from(coloured).toString("base64")}`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const draw = async ({ size, source: imageSource, background: fill }) => {
      const image = new Image();
      image.src = imageSource;
      await image.decode();
      const canvas = new OffscreenCanvas(size, size);
      const context = canvas.getContext("2d");
      context.fillStyle = fill;
      context.fillRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      return Array.from(context.getImageData(0, 0, size, size).data);
    };

    const drawn = [];
    for (const { file, size } of ICON_FILES) {
      const rgba = await page.evaluate(draw, { size, source, background });
      const rgb = Buffer.from(rgba.filter((_, index) => index % 4 !== 3));
      drawn.push({ file, png: encodePng(size, size, rgb) });
    }
    return drawn;
  } finally {
    await browser.close();
  }
}

function startupImages(background) {
  return IPHONE_SCREENS.map(([width, height, ratio]) => {
    const file = `${STARTUP_FOLDER}/${width * ratio}x${height * ratio}.png`;
    const media = `screen and (device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`;
    return {
      file,
      png: flatPng(width * ratio, height * ratio, hexToRgb(background)),
      link: `<link rel="apple-touch-startup-image" media="${media}" href="${file}">`,
    };
  });
}

async function rewriteLinks(links) {
  const indexPath = path.join(APP_DIR, "index.html");
  const html = await readFile(indexPath, "utf8");
  if (!LINKS_BLOCK.test(html)) throw new Error("The startup-images markers are missing from index.html.");
  const block = links.map((link) => `\n    ${link}`).join("");
  await writeFile(indexPath, html.replace(LINKS_BLOCK, `$1${block}$2`));
}

const { values } = parseArgs({ options: { source: { type: "string", default: DEFAULT_SOURCE } } });
const sourcePath = path.resolve(values.source);
const colours = palette();
const icons = await drawIcons(await readFile(sourcePath, "utf8"), colours);
const launch = startupImages(colours.background);

await rm(path.join(APP_DIR, STARTUP_FOLDER), { recursive: true, force: true });
await mkdir(path.join(APP_DIR, STARTUP_FOLDER), { recursive: true });
for (const { file, png } of icons) await writeFile(path.join(APP_DIR, ICONS_FOLDER, file), png);
for (const { file, png } of launch) await writeFile(path.join(APP_DIR, file), png);
await rewriteLinks(launch.map(({ link }) => link));

console.log(
  `Rendered ${icons.length} icons and ${launch.length} launch images from ${path.relative(process.cwd(), sourcePath)}.`,
);
