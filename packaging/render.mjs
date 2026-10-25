// Renders the box design: flat panel sheet (PNG + PDF) and two 3D mockups.
// Usage: node render.mjs [page]   (box = design 1, box2 = design 2)
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = process.argv[2] || 'box';
const prefix = page === 'box' ? '' : page + '-';
const url = v => 'file://' + resolve(here, page + '.html') + '?view=' + v;
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const errors = [];

for (const v of ['mock-front', 'mock-back']) {
  const p = await b.newPage({ viewport: { width: 1600, height: 1600 } });
  p.on('pageerror', e => errors.push(v + ': ' + e.message));
  await p.goto(url(v));
  await p.evaluate(() => window.ready);
  await p.waitForTimeout(600);
  await p.locator('#mock').screenshot({ path: resolve(here, `out/${prefix}${v}.png`) });
  await p.close();
}

const p = await b.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
p.on('pageerror', e => errors.push('flat: ' + e.message));
await p.goto(url('flat'));
await p.evaluate(() => window.ready);
await p.waitForTimeout(600);
const flat = p.locator('#flat');
await flat.screenshot({ path: resolve(here, `out/${prefix}panels.png`) });
const box = await flat.boundingBox();
await p.pdf({ path: resolve(here, `out/${prefix}panels.pdf`), width: Math.ceil(box.width) + 'px', height: Math.ceil(box.height) + 'px', printBackground: true, pageRanges: '1' });
await b.close();
console.log(errors.length ? errors : 'rendered without errors');
