// Self-hosted Arabic fonts (bundled from @fontsource, no Google Fonts request),
// so they embed in PDFs and render the same offline.
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/tajawal/800.css';
import '@fontsource/cairo/700.css';
import '@fontsource/cairo/900.css';
import { FONTS } from './config';

/**
 * Canvas text only uses a font once it has been loaded, so call this before drawing.
 * Loads every family/weight with an Arabic sample so the Arabic subset is fetched too.
 */
export async function loadMenuFonts() {
  const sample = 'بروستد عالطريق 123';
  const jobs = Object.values(FONTS).flatMap(f => f.weights.map(w => document.fonts.load(`${w} 32px '${f.family}'`, sample)));
  await Promise.all(jobs);
  await document.fonts.ready;
  return Object.values(FONTS).flatMap(f => f.weights.map(w => ({ family: f.family, weight: w, ok: document.fonts.check(`${w} 32px '${f.family}'`, sample) })));
}
