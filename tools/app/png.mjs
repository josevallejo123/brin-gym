// Writes PNG files with no transparency: 8-bit RGB, nothing else. Small on
// purpose: the icon renderer needs exactly this, and an icon with an alpha
// channel is what turns black on an iPhone Home Screen.

import { crc32, deflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BYTES_PER_PIXEL = 3;
const COLOUR_TYPE_RGB = 2;

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, check]);
}

// `rgb` holds width × height pixels, three bytes each, row by row.
export function encodePng(width, height, rgb) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = COLOUR_TYPE_RGB;

  // Each row is stored with one leading byte naming its filter: 0, none.
  const rowLength = width * BYTES_PER_PIXEL;
  const rows = Buffer.alloc((rowLength + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rgb.copy(rows, y * (rowLength + 1) + 1, y * rowLength, (y + 1) * rowLength);
  }

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function flatPng(width, height, [red, green, blue]) {
  const rgb = Buffer.alloc(width * height * BYTES_PER_PIXEL);
  for (let offset = 0; offset < rgb.length; offset += BYTES_PER_PIXEL) {
    rgb[offset] = red;
    rgb[offset + 1] = green;
    rgb[offset + 2] = blue;
  }
  return encodePng(width, height, rgb);
}

// Reads back what encodePng wrote first: the size and the colour type.
export function readPngHeader(file) {
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error("Not a PNG file.");
  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
    hasAlpha: file[25] !== COLOUR_TYPE_RGB,
  };
}
