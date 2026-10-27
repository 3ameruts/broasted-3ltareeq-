// Renders the premium social media menu: four 1080x1350 carousel slides, exported at 2x as JPEG.
// Usage: node social/premium/render.mjs [menu|menu-red|menu-road] [--pdf]   (run prep.mjs once first for the cutouts)
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Lucide from 'lucide-react';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../out');
mkdirSync(out, { recursive: true });
// Site defaults, with the side items replaced by the live list from the admin panel (same as ../render.mjs).
const data = JSON.parse(readFileSync(resolve(here, '../../src/data/default-content.json'), 'utf8'));
const overrides = JSON.parse(readFileSync(resolve(here, '../overrides.json'), 'utf8'));
data.categories.find(c => c.id === 'sides').items = overrides.sides.map((it, i) => ({ id: 'sides-' + (i + 1), ...it }));
// sandwich contents the owner changed for this menu
const contents = JSON.parse(readFileSync(resolve(here, 'overrides.json'), 'utf8')).contents;
for (const c of data.categories) for (const it of c.items) if (contents[it.id]) it.contents = contents[it.id];
const icons = Object.fromEntries(['Phone', 'Clock', 'MapPin', 'Globe', 'ChevronsLeft', 'AtSign'].map(n => [n, renderToStaticMarkup(createElement(Lucide[n], { size: 24, strokeWidth: 2 }))]));
const init = JSON.stringify({ menu: data, icons });

const file = process.argv[2] || 'menu';
const prefix = { menu: 'premium4', 'menu-red': 'red4', 'menu-road': 'road4' }[file] ?? file;
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const report = [];
const open = async (query, opts) => {
  const p = await b.newPage(opts);
  p.on('pageerror', e => report.push(`${query}: ${e.message}`));
  await p.addInitScript(s => { const d = JSON.parse(s); window.MENU = d.menu; window.ICONS = d.icons; }, init);
  await p.goto('file://' + resolve(here, file + '.html') + '?' + query);
  await p.evaluate(() => window.ready);
  return p;
};

const p0 = await open('page=1', { viewport: { width: 1080, height: 1350 } });
const count = await p0.evaluate(() => window.PAGES);
await p0.close();
for (let n = 1; n <= count; n++) {
  const p = await open('page=' + n, { viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  // anything spilling out of its box would be cut off in the post
  const spill = await p.evaluate(() => [...document.querySelectorAll('[data-fit]')].filter(e => e.scrollHeight > e.clientHeight + 1).map(e => e.dataset.fit));
  if (spill.length) report.push(`slide ${n}: overflow in ${spill.join(', ')}`);
  await p.locator('.page').screenshot({ path: resolve(out, `${prefix}-${n}.jpg`), type: 'jpeg', quality: 92 });
  await p.close();
}
if (process.argv.includes('--pdf')) {
  // all slides in one PDF, vector text and embedded fonts
  const p = await open('page=all', { viewport: { width: 1080, height: 1350 } });
  await p.pdf({ path: resolve(out, `${prefix}-menu.pdf`), width: '1080px', height: '1350px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await p.close();
}
await b.close();
console.log(report.length ? report : `rendered ${count} slides without errors`);
