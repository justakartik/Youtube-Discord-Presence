// Generates original icons and the pinned extension key. Idempotent: never overwrites an existing key.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ext = path.join(root, "apps/extension");

// ---- extension key (stable ID for native messaging allowed_origins) ----
const keyFile = path.join(ext, "key.json");
if (!fs.existsSync(keyFile)) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const der = publicKey.export({ type: "spki", format: "der" });
  const id = [...crypto.createHash("sha256").update(der).digest().subarray(0, 16)]
    .map((b) => String.fromCharCode(97 + (b >> 4)) + String.fromCharCode(97 + (b & 15)))
    .join("");
  fs.mkdirSync(path.join(root, ".secrets"), { recursive: true });
  fs.writeFileSync(path.join(root, ".secrets/extension-key.pem"), privateKey.export({ type: "pkcs8", format: "pem" }));
  fs.writeFileSync(keyFile, JSON.stringify({ key: der.toString("base64"), id }, null, 2));
  console.log("generated extension key, id =", id);
}

// ---- icon: rounded blue square, white play triangle, presence dot ----
function render(size) {
  const S = 4; // supersample
  const px = Buffer.alloc(size * size * 4);
  const inRound = (x, y, r) => {
    const cx = Math.min(Math.max(x, r), 1 - r), cy = Math.min(Math.max(y, r), 1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  const inTri = (x, y) => {
    // play triangle (0.36,0.28) (0.36,0.72) (0.70,0.50)
    const [ax, ay, bx, by, cx, cy] = [0.36, 0.28, 0.36, 0.72, 0.7, 0.5];
    const d = (px_, py_, qx, qy, rx, ry) => (px_ - rx) * (qy - ry) - (qx - rx) * (py_ - ry);
    const d1 = d(x, y, ax, ay, bx, by), d2 = d(x, y, bx, by, cx, cy), d3 = d(x, y, cx, cy, ax, ay);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  const inDot = (x, y) => (x - 0.78) ** 2 + (y - 0.78) ** 2 <= 0.12 ** 2;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      let a = 0, r = 0, g = 0, b = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const x = (i + (sx + 0.5) / S) / size, y = (j + (sy + 0.5) / S) / size;
          if (!inRound(x, y, 0.22)) continue;
          a++;
          let c = [0x4b + Math.round(20 * (1 - y)), 0x8c + Math.round(20 * (1 - y)), 0xff]; // subtle gradient
          if (inDot(x, y)) c = [0x3d, 0xdc, 0x97];
          else if (inTri(x, y)) c = [255, 255, 255];
          r += c[0]; g += c[1]; b += c[2];
        }
      const o = (j * size + i) * 4, n = S * S;
      if (a) { px[o] = r / a; px[o + 1] = g / a; px[o + 2] = b / a; px[o + 3] = Math.round((255 * a) / n); }
    }
  return px;
}
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const px = render(size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const chunk = (t, d) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const dir = path.join(ext, "public/icons");
fs.mkdirSync(dir, { recursive: true });
for (const s of [16, 32, 48, 128]) fs.writeFileSync(path.join(dir, `icon-${s}.png`), png(s));
console.log("icons written");
