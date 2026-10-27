// Verifies the menu design toolchain end to end. Writes test outputs to tools/menu-kit/out/.
// Usage: npm run menu:verify
import { build, preview } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { removeWhiteBackground, cover, optimize, describe } from './node/image.mjs';
import { exportPdf, sheetCss } from './node/pdf.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const out = resolve(here, 'out');
mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
// read package.json from disk: some packages (fabric, sharp) don't export it
const ver = p => { try { return JSON.parse(readFileSync(resolve(root, 'node_modules', p, 'package.json'), 'utf8')).version; } catch { return null; } };

// 1. packages
for (const p of ['fabric', 'lucide-react', 'sharp', 'playwright', '@fontsource/tajawal', '@fontsource/cairo', 'react', 'typescript', 'vite']) {
  const v = ver(p); check(`package ${p}`, !!v, v ?? 'missing');
}

// 2. sharp
try {
  const src = resolve(root, 'brand/photos/3.jpg');
  const meta = await describe(src);
  const cut = await removeWhiteBackground(src);
  writeFileSync(resolve(out, 'sharp-bg-removed.png'), cut);
  const { data: px, info } = await sharp(cut).raw().toBuffer({ resolveWithObject: true });
  let clear = 0, solid = 0;
  for (let i = info.channels - 1; i < px.length; i += info.channels) { if (px[i] === 0) clear++; else if (px[i] === 255) solid++; }
  const total = info.width * info.height;
  await optimize.webp(cover(src, 800, 600)).toFile(resolve(out, 'sharp-cover.webp'));
  const c = await describe(resolve(out, 'sharp-cover.webp'));
  check('sharp: read/resize/crop/optimize', c.width === 800 && c.height === 600, `${meta.width}x${meta.height} ${meta.format} -> 800x600 webp`);
  check('sharp: white background removal', clear > total * 0.5 && solid > total * 0.1, `${Math.round(clear / total * 100)}% transparent, ${Math.round(solid / total * 100)}% opaque`);
} catch (e) { check('sharp', false, e.message); }

// 3. fabric in Node (server-side rendering via node-canvas)
try {
  const { StaticCanvas, Rect, FabricText } = await import('fabric/node');
  const c = new StaticCanvas(null, { width: 400, height: 120, backgroundColor: '#fbf5ea' });
  c.add(new Rect({ left: 10, top: 10, width: 60, height: 60, fill: '#e0263a' }), new FabricText('Fabric node OK', { left: 90, top: 30, fontSize: 28 }));
  c.renderAll();
  const png = Buffer.from(c.toDataURL({ format: 'png' }).split(',')[1], 'base64');
  writeFileSync(resolve(out, 'fabric-node.png'), png);
  check('fabric: Node rendering', png.length > 1000, `${png.length} bytes`);
} catch (e) { check('fabric: Node rendering', false, e.message); }

// 4. fabric + React + lucide in the browser, Arabic fonts, undo/redo, PNG/SVG export
const dist = resolve(out, '.check-dist');
let browser, server;
try {
  rmSync(dist, { recursive: true, force: true });
  await build({ root: resolve(here, 'check'), base: './', logLevel: 'error', plugins: [react()], build: { outDir: dist, emptyOutDir: true } });
  check('vite build of editor test page', existsSync(resolve(dist, 'index.html')));
  server = await preview({ root: resolve(here, 'check'), logLevel: 'error', build: { outDir: dist }, preview: { port: 4321, strictPort: false } });
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch();
  check('playwright: Chromium launch', true, `${browser.version()}`);
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__result || window.__error, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error(err);
  const r = await page.evaluate(() => window.__result);
  check('fabric: browser canvas in React', r.objects.length >= 4, `fabric ${r.fabricVersion}; objects: ${r.objects.join(', ')}`);
  check('lucide-react icons render', await page.locator('button svg.lucide').count() >= 5);
  const fontsOk = r.fonts.every(f => f.ok);
  check('fonts: Cairo + Tajawal loaded (Arabic subset)', fontsOk, r.fonts.map(f => `${f.family} ${f.weight}:${f.ok ? 'ok' : 'NO'}`).join(' '));
  check('undo/redo', r.undoRedo.ok, JSON.stringify(r.undoRedo));
  check('layers: bring to front', r.topLayer === 'title', `top = ${r.topLayer}`);
  writeFileSync(resolve(out, 'fabric-browser-preview.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  check('export: high-res PNG (300 DPI A4 landscape + bleed)', r.pngFullBytes > 100000, `${r.sheetPx.width}x${r.sheetPx.height}px, ~${Math.round(r.pngFullBytes * 0.75 / 1024)} KB`);
  writeFileSync(resolve(out, 'fabric-export.svg'), r.svg);
  check('export: SVG', r.svgHasArabic && r.svg.startsWith('<?xml'), `${r.svg.length} chars, Arabic text kept`);
  await page.screenshot({ path: resolve(out, 'editor-screenshot.png') });
  if (errs.length) check('editor page errors', false, errs.join(' | '));
} catch (e) {
  check('browser editor test', false, e.message.split('\n')[0]);
} finally {
  await browser?.close();
  await new Promise(r => server ? server.httpServer.close(r) : r());
}

// 5. PDF: A4 landscape with 3 mm bleed, Arabic text with embedded fonts, photo
try {
  const font = (pkg, file) => pathToFileURL(require.resolve(`${pkg}/files/${file}`)).href;
  const spec = { widthMm: 297, heightMm: 210, bleedMm: 3 };
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face { font-family: Cairo; font-weight: 900; src: url(${font('@fontsource/cairo', 'cairo-arabic-900-normal.woff2')}) format('woff2'); unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200E; }
@font-face { font-family: Cairo; font-weight: 900; src: url(${font('@fontsource/cairo', 'cairo-latin-900-normal.woff2')}) format('woff2'); unicode-range: U+0000-00FF, U+2000-206F; }
@font-face { font-family: Tajawal; font-weight: 500; src: url(${font('@fontsource/tajawal', 'tajawal-arabic-500-normal.woff2')}) format('woff2'); unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200E; }
@font-face { font-family: Tajawal; font-weight: 500; src: url(${font('@fontsource/tajawal', 'tajawal-latin-500-normal.woff2')}) format('woff2'); unicode-range: U+0000-00FF, U+2000-206F; }
${sheetCss(spec)}
.sheet { background: #e0263a; }
.trim { background: #fbf5ea; outline: 0.2mm dashed #2b8a3e; outline-offset: -8mm; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6mm; }
h1 { font: 900 30mm/1 Cairo; color: #b21017; margin: 0; }
p { font: 500 9mm/1.4 Tajawal; color: #2a2528; margin: 0; }
img { height: 60mm; }
</style></head><body><div class="sheet"><div class="trim">
<h1>بروستد عالطريق</h1><p>اختبار PDF: خط عربي مضمّن، اتجاه من اليمين لليسار، A4 أفقي مع هامش قص 3 ملم</p>
<img src="${pathToFileURL(resolve(out, 'sharp-bg-removed.png')).href}">
</div></div></body></html>`;
  const htmlPath = resolve(out, 'pdf-test.html');
  writeFileSync(htmlPath, html);
  const pdfPath = resolve(out, 'test-A4-landscape-bleed.pdf');
  const res = await exportPdf({ url: pathToFileURL(htmlPath).href, out: pdfPath, spec });
  const info = execFileSync('pdfinfo', [pdfPath]).toString();
  const size = info.match(/Page size:\s+([\d.]+) x ([\d.]+) pts/);
  const mm = size ? [Number(size[1]) / 72 * 25.4, Number(size[2]) / 72 * 25.4].map(n => n.toFixed(1)) : [];
  check('PDF: page size A4 landscape + bleed', size && Math.abs(mm[0] - 303) < 0.5 && Math.abs(mm[1] - 216) < 0.5, `${mm.join(' x ')} mm (297x210 + 3 mm bleed)`);
  const fonts = execFileSync('pdffonts', [pdfPath]).toString();
  const fontNames = fonts.split('\n').slice(2).filter(Boolean).map(l => l.split(/\s+/)[0]);
  check('PDF: Arabic fonts embedded, no fallback fonts', /Cairo/i.test(fonts) && /Tajawal/i.test(fonts) && fontNames.every(n => /Cairo|Tajawal/i.test(n)), fontNames.join(', '));
  const text = execFileSync('pdftotext', ['-layout', pdfPath, '-']).toString();
  check('PDF: Arabic text is real text (selectable)', /بروستد/.test(text) || /دتسورب/.test(text), text.trim().split('\n')[0].trim().slice(0, 40));
  execFileSync('pdftoppm', ['-r', '40', '-png', '-singlefile', pdfPath, resolve(out, 'pdf-preview')]);
  if (res.errors.length) check('PDF page errors', false, res.errors.join(' | '));
} catch (e) { check('PDF export', false, e.message.split('\n')[0]); }

const failed = results.filter(r => !r.ok);
writeFileSync(resolve(out, 'report.json'), JSON.stringify({ date: new Date().toISOString(), node: process.version, results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Outputs in ${out}`);
process.exit(failed.length ? 1 : 0);
