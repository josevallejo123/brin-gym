// The clip on the Finish screen and its still: animated WebP files that carry
// pictures and nothing else. The source video held a location and device tags,
// so every chunk is read and anything but image data fails the test.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { FINISH_CLIP_URL, FINISH_STILL_URL } from "../../app/js/config.js";
import { APP_DIR, scan } from "../../tools/app/offline-list.mjs";
import { APPROVED_PERSONAL_FILES, notPublic } from "../../tools/publish.mjs";
import { SECOND } from "./helpers.mjs";

// The source runs 2.593 seconds; the clip plays it 1.5 times as fast.
const LOOP_MS = (2.593 * SECOND) / 1.5;
const LARGEST_CLIP_BYTES = 1.5 * 1024 * 1024;

// The chunks a WebP file is made of (RIFF), and inside each animation frame
// the chunks that hold its picture.
const IMAGE_CHUNKS = new Set(["VP8 ", "VP8L", "ALPH"]);
const FILE_CHUNKS = new Set(["VP8X", "ANIM", "ANMF", ...IMAGE_CHUNKS]);
// The flags in VP8X that announce an ICC profile, EXIF data or XMP data.
const METADATA_FLAGS = 0x20 | 0x08 | 0x04;

function chunks(bytes, start, end) {
  const found = [];
  for (let offset = start; offset < end; ) {
    const size = bytes.readUInt32LE(offset + 4);
    found.push({ id: bytes.toString("latin1", offset, offset + 4), body: bytes.subarray(offset + 8, offset + 8 + size) });
    offset += 8 + size + (size % 2);
  }
  return found;
}

function readWebp(url) {
  const bytes = readFileSync(path.join(APP_DIR, url));
  assert.equal(bytes.toString("latin1", 0, 4), "RIFF", url);
  assert.equal(bytes.toString("latin1", 8, 12), "WEBP", url);
  const top = chunks(bytes, 12, bytes.length);
  // An animation frame: 16 bytes of placement and timing, then its picture.
  const frames = top
    .filter(({ id }) => id === "ANMF")
    .map(({ body }) => ({ durationMs: body.readUIntLE(12, 3), parts: chunks(body, 16, body.length).map(({ id }) => id) }));
  const anim = top.find(({ id }) => id === "ANIM")?.body;
  return {
    size: bytes.length,
    ids: top.map(({ id }) => id),
    flags: top.find(({ id }) => id === "VP8X")?.body[0] ?? 0,
    loops: anim ? anim.readUInt16LE(4) : null,
    frames,
  };
}

const clip = readWebp(FINISH_CLIP_URL);
const still = readWebp(FINISH_STILL_URL);

test("the clip and its still hold image data and nothing else: no location, EXIF, XMP or colour profile", () => {
  for (const [name, file] of [["clip", clip], ["still", still]]) {
    assert.deepEqual(file.ids.filter((id) => !FILE_CHUNKS.has(id)), [], name);
    assert.equal(file.flags & METADATA_FLAGS, 0, name);
    for (const frame of file.frames) assert.deepEqual(frame.parts.filter((id) => !IMAGE_CHUNKS.has(id)), [], name);
  }
});

test("the clip loops for ever at one and a half times the speed of the source", () => {
  assert.ok(clip.frames.length > 1, "animated");
  assert.equal(clip.loops, 0, "0 means for ever");
  const frameMs = clip.frames[0].durationMs;
  const total = clip.frames.reduce((sum, frame) => sum + frame.durationMs, 0);
  assert.ok(Math.abs(total - LOOP_MS) <= frameMs, `one loop takes ${total} ms`);
});

test("the clip is small enough to keep offline, and the still is a single picture", () => {
  assert.ok(clip.size < LARGEST_CLIP_BYTES, `${clip.size} bytes`);
  assert.ok(still.size < clip.size / 10, `${still.size} bytes`);
  assert.equal(still.frames.length, 0, "a still has no animation frames");
  assert.equal(still.ids.filter((id) => IMAGE_CHUNKS.has(id)).length, 1);
});

// The approved two are the files the app shows, and nothing else in the app
// is a photo or video that publishing would refuse.
test("the app folder holds no photo or video but the approved clip and still", async () => {
  assert.deepEqual([...APPROVED_PERSONAL_FILES].sort(), [`app/${FINISH_CLIP_URL}`, `app/${FINISH_STILL_URL}`].sort());
  assert.deepEqual(notPublic((await scan(APP_DIR)).map(({ url }) => `app/${url}`)), []);
});
