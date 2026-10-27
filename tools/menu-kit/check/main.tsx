// Tooling self-test (not menu design): mounts the editor, draws Arabic text in both families,
// places a photo, exercises undo/redo and layers, and exports PNG + SVG for verify.mjs to inspect.
import { createRoot } from 'react-dom/client';
import { FabricImage, Rect, Textbox, version, type Canvas } from 'fabric';
import MenuCanvas from '../MenuCanvas';
import { loadMenuFonts } from '../fonts';
import { BRAND, printBoxes, DEFAULT_PRINT, fontStack } from '../config';
import { CanvasHistory } from '../history';
import { toFront, alignTo } from '../layers';
import { toPng, toTrimPng, toSvg } from '../exporters';
import photo from '../../../public/img/item-1.webp?url';

type Result = Record<string, unknown>;
declare global { interface Window { __result?: Result; __error?: string } }

async function run(canvas: Canvas, history: CanvasHistory) {
  const r: Result = { fabricVersion: version };
  r.fonts = await loadMenuFonts();
  const { trim, safe } = printBoxes(DEFAULT_PRINT);

  const bg = new Rect({ left: 0, top: 0, width: canvas.width, height: canvas.height, fill: BRAND.colors.cream, name: 'bg' });
  canvas.add(bg);
  const title = new Textbox('بروستد عالطريق', { width: safe.width, fontFamily: fontStack('Cairo'), fontWeight: 900, fontSize: 260, fill: BRAND.colors.red, direction: 'rtl', textAlign: 'right', name: 'title' });
  const body = new Textbox('اختبار الخط: معلش.. جاجنا فريش ١٢٣ - 3.25 د.أ', { width: safe.width, fontFamily: fontStack('Tajawal'), fontWeight: 500, fontSize: 120, fill: BRAND.colors.ink, direction: 'rtl', textAlign: 'right', name: 'body' });
  canvas.add(title, body);
  alignTo(title, safe, 'right'); alignTo(title, safe, 'top');
  body.set({ left: title.left, top: (title.top ?? 0) + (title.height ?? 0) + 40 }); body.setCoords();

  const img = await FabricImage.fromURL(photo);
  img.scaleToWidth(1200);
  img.set({ left: safe.left, top: safe.top + safe.height - img.getScaledHeight(), name: 'photo' });
  canvas.add(img);
  toFront(canvas, title);
  canvas.renderAll();

  // undo/redo: move the photo, undo, check it came back, redo, check it moved again
  const before = img.left;
  img.set({ left: (img.left ?? 0) + 500 }); img.setCoords(); canvas.fire('object:modified', { target: img });
  await history.undo();
  const afterUndo = canvas.getObjects().find(o => (o as { name?: string }).name === 'photo')?.left;
  await history.redo();
  const afterRedo = canvas.getObjects().find(o => (o as { name?: string }).name === 'photo')?.left;
  r.undoRedo = { ok: afterUndo === before && afterRedo === (before ?? 0) + 500, before, afterUndo, afterRedo };

  r.objects = canvas.getObjects().map(o => (o as { name?: string }).name ?? o.type);
  const objs = canvas.getObjects();
  r.topLayer = (objs[objs.length - 1] as { name?: string }).name;
  r.png = toPng(canvas, 0.25);         // quarter size preview
  r.pngFullBytes = toPng(canvas, 1).length; // full 300 DPI export
  r.trimPngBytes = toTrimPng(canvas).length;
  const svg = toSvg(canvas);
  r.svg = svg;
  r.svgHasArabic = svg.includes('بروستد');
  r.sheetPx = { width: canvas.width, height: canvas.height, trim };
  return r;
}

createRoot(document.getElementById('root')!).render(
  <MenuCanvas displayWidth={1100} onReady={(c, h) => { run(c, h).then(r => { window.__result = r; }).catch(e => { window.__error = String(e?.stack || e); }); }} />
);
