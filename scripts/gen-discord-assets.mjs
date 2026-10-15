// Generates 1024x1024 Discord Rich Presence art assets: play.png, pause.png, logo.png -> release/discord-assets
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIZE = 1024, S = 2;

const tri = (x, y, [ax, ay, bx, by, cx, cy]) => {
  const d = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
  const d1 = d(x, y, ax, ay, bx, by), d2 = d(x, y, bx, by, cx, cy), d3 = d(x, y, cx, cy, ax, ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
const rect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const round = (x, y, r) => {
  const cx = Math.min(Math.max(x, r), 1 - r), cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

const glyphs = {
  play: (x, y) => tri(x, y, [0.4, 0.27, 0.4, 0.73, 0.76, 0.5]),
  pause: (x, y) => rect(x, y, 0.32, 0.28, 0.45, 0.72) || rect(x, y, 0.55, 0.28, 0.68, 0.72),
  logo: (x, y) => tri(x, y, [0.36, 0.28, 0.36, 0.72, 0.7, 0.5]),
};

function png(name) {
  const px = Buffer.alloc(SIZE * SIZE * 4);
  for (let j = 0; j < SIZE; j++)
    for (let i = 0; i < SIZE; i++) {
      let a = 0, r = 0, g = 0, b = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const x = (i + (sx + 0.5) / S) / SIZE, y = (j + (sy + 0.5) / S) / SIZE;
          const inside = name === "logo" ? round(x, y, 0.22) : (x - 0.5) ** 2 + (y - 0.5) ** 2 <= 0.5 ** 2;
          if (!inside) continue;
          a++;
          const c = glyphs[name](x, y) ? [255, 255, 255] : [0x4b, 0x8c, 0xff];
          r += c[0]; g += c[1]; b += c[2];
        }
      const o = (j * SIZE + i) * 4;
      if (a) { px[o] = r / a; px[o + 1] = g / a; px[o + 2] = b / a; px[o + 3] = Math.round((255 * a) / (S * S)); }
    }
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) px.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  const chunk = (t, d) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const dir = path.join(root, "release/discord-assets");
fs.mkdirSync(dir, { recursive: true });
for (const n of ["play", "pause", "logo"]) fs.writeFileSync(path.join(dir, `${n}.png`), png(n));
console.log("written to", dir);
