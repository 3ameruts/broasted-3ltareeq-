// Turns the cutouts into die-cut stickers (white border + thin dark outline) with sharp.
// Usage: node social/premium/stickers.mjs  (after prep.mjs) -> social/premium/sticker/<n>.png
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve(here, 'sticker'), { recursive: true });
const WHITE = 26, INK = 5, PAD = WHITE + INK + 6;

// grow an alpha mask by roughly r pixels: blur, then threshold low
const grow = async (alpha, w, h, r) => {
  const blurred = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(r / 2).extractChannel(0).raw().toBuffer();
  return Buffer.from(blurred.map(v => (v > 6 ? 255 : 0)));
};
const solid = async (mask, w, h, [r, g, b]) => sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } })
  .joinChannel(mask, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();

for (let n = 1; n <= 10; n++) {
  const src = sharp(resolve(here, `cut/${n}.png`)).resize(800, 800, { fit: 'inside' });
  const padded = await src.extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const { width: w, height: h } = await sharp(padded).metadata();
  const alpha = Buffer.from((await sharp(padded).extractChannel('alpha').raw().toBuffer()).map(v => (v > 40 ? 255 : 0)));
  const white = await grow(alpha, w, h, WHITE);
  const ink = await grow(white, w, h, INK);
  await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await solid(ink, w, h, [42, 37, 40]) }, { input: await solid(white, w, h, [255, 253, 247]) }, { input: padded }])
    .png({ compressionLevel: 9 }).toFile(resolve(here, `sticker/${n}.png`));
}
console.log('stickers ready');
