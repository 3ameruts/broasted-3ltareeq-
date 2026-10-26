// Renders the two-page social media menu (1080x1350, exported at 2x) from the site's menu data.
// Usage: node render.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const menu = readFileSync(resolve(here, '../src/data/default-content.json'), 'utf8');
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const report = [];

for (const n of [1, 2]) {
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => report.push(`page ${n}: ${e.message}`));
  await p.addInitScript(m => { window.MENU = JSON.parse(m); }, menu);
  await p.goto('file://' + resolve(here, 'menu.html') + '?page=' + n);
  await p.evaluate(() => window.ready);
  await p.waitForTimeout(300);
  // anything spilling past the page bottom would be cut off in the post
  const overflow = await p.evaluate(() => {
    const m = document.querySelector('main');
    const clipped = [...document.querySelectorAll('.card')].filter(c => c.scrollHeight > c.clientHeight + 1).length;
    return Math.max(m.scrollHeight - m.clientHeight, clipped ? 1 : 0);
  });
  if (overflow > 0) report.push(`page ${n}: content overflows by ${overflow}px`);
  await p.locator('.page').screenshot({ path: resolve(here, `out/menu-${n}.png`) });
  await p.close();
}
await b.close();
console.log(report.length ? report : 'rendered without errors');
