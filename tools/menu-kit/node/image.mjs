// Image processing for menu artwork, built on sharp.
// Usage from code: import { fit, cover, optimize, removeWhiteBackground, trim } from './image.mjs'
import sharp from 'sharp';

/** Resize to fit inside w x h, keeping aspect ratio (no crop). */
export const fit = (input, w, h) => sharp(input).resize(w, h, { fit: 'inside', withoutEnlargement: true });

/** Resize and crop to exactly w x h, keeping the most interesting part. */
export const cover = (input, w, h) => sharp(input).resize(w, h, { fit: 'cover', position: sharp.strategy.attention });

/** Crop an explicit region in source pixels. */
export const crop = (input, { left, top, width, height }) => sharp(input).extract({ left, top, width, height });

/** Web/print outputs. */
export const optimize = {
  webp: (img, quality = 82) => img.webp({ quality, effort: 6 }),
  jpeg: (img, quality = 90) => img.jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4' }),
  png: img => img.png({ compressionLevel: 9, adaptiveFiltering: true }),
};

/** Remove surrounding near-uniform background (e.g. white studio space). */
export const trim = (input, threshold = 12) => sharp(input).trim({ threshold });

/**
 * Background removal for product shots on a plain light background (how the sandwich photos are shot).
 * Pixels close to white become transparent, with a soft edge between `hard` and `soft` distance.
 * Returns a PNG buffer with alpha. Busy or dark backgrounds need a matting model instead (see README).
 */
export async function removeWhiteBackground(input, { hard = 10, soft = 40 } = {}) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  // distance from white for every pixel
  const dist = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += channels, p++) dist[p] = 255 - Math.min(data[i], data[i + 1], data[i + 2]);
  // flood fill from the borders so white areas inside the food (cheese, onion, bread) stay opaque
  const bg = new Uint8Array(width * height);
  const stack = [];
  const push = p => { if (!bg[p] && dist[p] < soft) { bg[p] = 1; stack.push(p); } };
  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1); }
  while (stack.length) {
    const p = stack.pop(), x = p % width;
    if (x > 0) push(p - 1);
    if (x < width - 1) push(p + 1);
    if (p >= width) push(p - width);
    if (p < width * (height - 1)) push(p + width);
  }
  for (let p = 0; p < bg.length; p++) {
    if (!bg[p]) continue;
    const a = dist[p] <= hard ? 0 : Math.round(((dist[p] - hard) / (soft - hard)) * 255);
    data[p * channels + 3] = Math.min(data[p * channels + 3], a);
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

/** Basic facts about an image file. */
export async function describe(input) {
  const m = await sharp(input).metadata();
  return { width: m.width, height: m.height, format: m.format, hasAlpha: m.hasAlpha, density: m.density };
}
