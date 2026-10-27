// Optional PhotoRoom background removal (https://www.photoroom.com/api).
// Off unless PHOTOROOM_API_KEY is set; no key is stored in the project and nothing calls it by default.
// Without a key, use removeWhiteBackground() from ./image.mjs instead.
import { readFile } from 'node:fs/promises';
import { removeWhiteBackground } from './image.mjs';

const ENDPOINT = 'https://sdk.photoroom.com/v1/segment';

export const photoroomEnabled = () => Boolean(process.env.PHOTOROOM_API_KEY);

/** Returns a transparent PNG buffer from PhotoRoom. Throws if no key is configured. */
export async function photoroomRemoveBackground(input, { apiKey = process.env.PHOTOROOM_API_KEY } = {}) {
  if (!apiKey) throw new Error('PhotoRoom is not configured: set PHOTOROOM_API_KEY to enable it');
  const bytes = Buffer.isBuffer(input) ? input : await readFile(input);
  const form = new FormData();
  form.append('image_file', new Blob([bytes]), 'image');
  const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'x-api-key': apiKey }, body: form });
  if (!res.ok) throw new Error(`PhotoRoom ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** PhotoRoom when a key is configured, otherwise the local white-background cutout. */
export const removeBackground = (input, opts) => photoroomEnabled() ? photoroomRemoveBackground(input, opts) : removeWhiteBackground(input, opts);
