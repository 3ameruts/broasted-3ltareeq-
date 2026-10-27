// Cuts the product photos out of their white studio background for the premium social menu.
// Usage: node social/premium/prep.mjs  -> social/premium/cut/<n>.png (n = site image item-n)
import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeWhiteBackground } from '../../tools/menu-kit/node/image.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const photos = resolve(here, '../../brand/photos');
// wraps: the tortilla end is nearly white, so only clear the purest white around them
const cutout = async (f, opts) => sharp(await removeWhiteBackground(resolve(photos, f + '.jpg'), opts)).trim({ threshold: 1 }).png().toBuffer();
const save = (buf, n) => sharp(buf).resize(1100, 1100, { fit: 'inside' }).png({ compressionLevel: 9 }).toFile(resolve(here, `cut/${n}.png`));

const wrapOpts = { hard: 4, soft: 16 };
for (const n of [1, 2, 4, 5, 6, 7, 8, 9, 10]) await save(await cutout(String(n), n === 4 ? wrapOpts : {}), n);

// دبل تيستي تويستر: two copies of the single wrap, staggered like the site photo (3-double.jpg)
const wrap = await cutout('3', wrapOpts);
const { width: w, height: h } = await sharp(wrap).metadata();
const dx = Math.round(w * 0.42), dy = Math.round(h * 0.34);
await save(await sharp({ create: { width: w + dx, height: h + dy, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: wrap, left: dx, top: 0 }, { input: wrap, left: 0, top: dy }]).png().toBuffer(), 3);
console.log('cutouts ready');
