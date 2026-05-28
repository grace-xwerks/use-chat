#!/usr/bin/env node
// Generates placeholder PNG icons for the Chrome extension.
// Pure Node — no npm dependencies. Run with `node scripts/generate-icons.js`.
// Produces icons/icon-16.png, icon-48.png, icon-128.png.
//
// Design: solid Grace-blue square with a centered white speech-bubble glyph.
// Replace with brand art whenever it's ready; manifest paths stay the same.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── PNG encoding ──────────────────────────────────────────────────────────
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })());
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, pixels /* Uint8Array RGBA */) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);   // bit depth
  ihdr.writeUInt8(6, 9);   // RGBA
  ihdr.writeUInt8(0, 10);  // compression
  ihdr.writeUInt8(0, 11);  // filter
  ihdr.writeUInt8(0, 12);  // interlace

  // Add per-scanline filter byte (0 = None)
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy ? pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
                : Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ── Glyph: chat-bubble approximated with rectangles + circle ──────────────
// Background: Google blue (#1a73e8). Foreground: white speech bubble.
const BG = [0x1a, 0x73, 0xe8, 0xff];
const FG = [0xff, 0xff, 0xff, 0xff];

function drawIcon(size) {
  const px = new Uint8Array(size * size * 4);
  // Fill background
  for (let i = 0; i < size * size; i++) {
    px[i * 4 + 0] = BG[0];
    px[i * 4 + 1] = BG[1];
    px[i * 4 + 2] = BG[2];
    px[i * 4 + 3] = BG[3];
  }

  // Speech-bubble body: rounded rect centered, ~62% of canvas, slightly above midline
  const bodyW = Math.round(size * 0.62);
  const bodyH = Math.round(size * 0.46);
  const bodyX = Math.round((size - bodyW) / 2);
  const bodyY = Math.round(size * 0.22);
  const radius = Math.max(2, Math.round(size * 0.10));

  const setFg = (x, y) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = FG[0]; px[i + 1] = FG[1]; px[i + 2] = FG[2]; px[i + 3] = FG[3];
  };

  for (let y = bodyY; y < bodyY + bodyH; y++) {
    for (let x = bodyX; x < bodyX + bodyW; x++) {
      // Rounded corners — keep pixel if not in corner mask
      const dxL = bodyX + radius - x;
      const dxR = x - (bodyX + bodyW - radius - 1);
      const dyT = bodyY + radius - y;
      const dyB = y - (bodyY + bodyH - radius - 1);
      if (dxL > 0 && dyT > 0 && dxL * dxL + dyT * dyT > radius * radius) continue;
      if (dxR > 0 && dyT > 0 && dxR * dxR + dyT * dyT > radius * radius) continue;
      if (dxL > 0 && dyB > 0 && dxL * dxL + dyB * dyB > radius * radius) continue;
      if (dxR > 0 && dyB > 0 && dxR * dxR + dyB * dyB > radius * radius) continue;
      setFg(x, y);
    }
  }

  // Tail (triangle) pointing down-left from bubble bottom
  const tailH = Math.round(size * 0.18);
  const tailW = Math.round(size * 0.18);
  const tailX = Math.round(bodyX + bodyW * 0.22);
  const tailY = bodyY + bodyH;
  for (let dy = 0; dy < tailH; dy++) {
    const w = Math.round(tailW * (1 - dy / tailH));
    for (let dx = 0; dx < w; dx++) setFg(tailX + dx, tailY + dy);
  }

  // Three dots inside bubble to suggest "talking"
  const dotR = Math.max(1, Math.round(size * 0.045));
  const dotY = Math.round(bodyY + bodyH * 0.5);
  const dotSpacing = Math.round(bodyW * 0.22);
  const dotCx = Math.round(bodyX + bodyW / 2);
  for (const dx of [-dotSpacing, 0, dotSpacing]) {
    for (let y = -dotR; y <= dotR; y++) {
      for (let x = -dotR; x <= dotR; x++) {
        if (x * x + y * y <= dotR * dotR) {
          const i = ((dotY + y) * size + (dotCx + dx + x)) * 4;
          if (i >= 0 && i < px.length) {
            px[i] = BG[0]; px[i + 1] = BG[1]; px[i + 2] = BG[2]; px[i + 3] = BG[3];
          }
        }
      }
    }
  }

  return px;
}

// ── Emit ──────────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const png = encodePng(size, drawIcon(size));
  const out = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes)`);
}
