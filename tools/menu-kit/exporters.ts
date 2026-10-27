// Browser-side exports from a Fabric canvas.
import type { StaticCanvas } from 'fabric';
import { printBoxes, type PrintSpec, DEFAULT_PRINT, PRINT_DPI } from './config';

/** High-resolution PNG. The canvas is designed at print pixels, so multiplier 1 = 300 DPI. */
export function toPng(canvas: StaticCanvas, multiplier = 1) {
  return canvas.toDataURL({ format: 'png', multiplier });
}

/** PNG of the trim area only (bleed cut off), e.g. for social media. */
export function toTrimPng(canvas: StaticCanvas, spec: PrintSpec = DEFAULT_PRINT, multiplier = 1) {
  const { trim } = printBoxes(spec, PRINT_DPI);
  return canvas.toDataURL({ format: 'png', multiplier, ...trim });
}

/** Vector SVG with the fonts referenced by family name. */
export function toSvg(canvas: StaticCanvas) {
  return canvas.toSVG();
}
