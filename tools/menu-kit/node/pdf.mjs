// Print-ready PDF export with Playwright/Chromium: exact page size, optional bleed, embedded fonts.
// Usage: await exportPdf({ url | html, out, spec: { widthMm: 297, heightMm: 210, bleedMm: 3 } })
import { chromium } from 'playwright';

export const A4_LANDSCAPE = { widthMm: 297, heightMm: 210 };

/**
 * Renders a page to PDF. With bleedMm > 0 the PDF page is the trim size plus bleed on every side,
 * so the page content should be laid out at that full size (artwork runs to the edge).
 * Text stays vector and fonts are embedded (subset) by Chromium.
 */
export async function exportPdf({ url, html, out, spec = { ...A4_LANDSCAPE, bleedMm: 0 }, waitFor = 'document.fonts.ready' }) {
  const width = spec.widthMm + 2 * (spec.bleedMm ?? 0);
  const height = spec.heightMm + 2 * (spec.bleedMm ?? 0);
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--font-render-hinting=none'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    if (url) await page.goto(url, { waitUntil: 'networkidle' });
    else await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(waitFor);
    await page.pdf({
      path: out,
      width: `${width}mm`,
      height: `${height}mm`,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: false,
    });
    return { out, widthMm: width, heightMm: height, errors };
  } finally {
    await browser.close();
  }
}

/** CSS for a sheet of the given spec; put the artwork inside .sheet. */
export function sheetCss(spec = { ...A4_LANDSCAPE, bleedMm: 0 }) {
  const b = spec.bleedMm ?? 0;
  return `@page { size: ${spec.widthMm + 2 * b}mm ${spec.heightMm + 2 * b}mm; margin: 0; }
html, body { margin: 0; padding: 0; }
.sheet { width: ${spec.widthMm + 2 * b}mm; height: ${spec.heightMm + 2 * b}mm; position: relative; overflow: hidden; break-after: page; }
.sheet:last-child { break-after: auto; }
.trim { position: absolute; left: ${b}mm; top: ${b}mm; width: ${spec.widthMm}mm; height: ${spec.heightMm}mm; }`;
}
