// Renders <name>.html frame by frame (deterministic, no dropped frames) and encodes MP4 + WebM + poster.
// Each page sets window.SIZE = { w, h, outW, outH, posterAt } and window.DURATION.
// Usage: node render.mjs <name> [fps] [--preview t1,t2,...]
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2] || 'hero';
const fps = Number(process.argv[3]) || 30;
const previewArg = process.argv.indexOf('--preview');
const frames = resolve(here, 'frames-' + name);
const out = resolve(here, '../site/public/video');

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const probe = await browser.newPage();
await probe.goto('file://' + resolve(here, name + '.html'));
const size = await probe.evaluate(() => window.SIZE);
await probe.close();

const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
await page.goto('file://' + resolve(here, name + '.html'));
await page.evaluate(() => window.ready);
const stage = page.locator('#stage');

if (previewArg > -1) {
  const times = process.argv[previewArg + 1].split(',').map(Number);
  mkdirSync(resolve(here, 'preview'), { recursive: true });
  for (const t of times) {
    await page.evaluate(t => window.seek(t), t);
    await stage.screenshot({ path: resolve(here, `preview/${name}-t${t}.png`) });
  }
  await browser.close();
  process.exit(0);
}

rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
mkdirSync(out, { recursive: true });
const duration = await page.evaluate(() => window.DURATION);
const total = Math.round(duration * fps);
for (let i = 0; i < total; i++) {
  await page.evaluate(t => window.seek(t), i / fps);
  await stage.screenshot({ path: `${frames}/f${String(i).padStart(4, '0')}.png` });
}
await browser.close();

const scale = `scale=${size.outW}:${size.outH}`;
const input = ['-y', '-framerate', String(fps), '-i', `${frames}/f%04d.png`];
execFileSync('ffmpeg', [...input, '-vf', scale, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', '-an', `${out}/${name}.mp4`], { stdio: 'inherit' });
execFileSync('ffmpeg', [...input, '-vf', scale, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-an', `${out}/${name}.webm`], { stdio: 'inherit' });
const posterFrame = String(Math.round(size.posterAt * fps)).padStart(4, '0');
execFileSync('ffmpeg', ['-y', '-i', `${frames}/f${posterFrame}.png`, '-vf', scale, `${out}/${name}-poster.webp`], { stdio: 'inherit' });
rmSync(frames, { recursive: true, force: true });
console.log(`rendered ${name}: ${total} frames`);
