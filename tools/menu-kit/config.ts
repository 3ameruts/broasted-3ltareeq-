// Print geometry and brand typography for menu artwork.
// All print sizes are in millimetres; px conversions use the chosen DPI.

export const MM_PER_INCH = 25.4;
export const PRINT_DPI = 300;
export const SCREEN_DPI = 96; // CSS px, what Chromium uses when printing PDFs

export const A4_LANDSCAPE = { widthMm: 297, heightMm: 210 } as const;
export const A4_PORTRAIT = { widthMm: 210, heightMm: 297 } as const;

export type PrintSpec = {
  widthMm: number;   // trim size (finished size after cutting)
  heightMm: number;
  bleedMm: number;   // artwork extends this far past the trim on every side
  safeMm: number;    // keep text and logos this far inside the trim
};

export const DEFAULT_PRINT: PrintSpec = { ...A4_LANDSCAPE, bleedMm: 3, safeMm: 8 };

export const mmToPx = (mm: number, dpi = PRINT_DPI) => Math.round((mm / MM_PER_INCH) * dpi);

/** Pixel boxes for a print spec: full sheet with bleed, the trim box and the safe area. */
export function printBoxes(spec: PrintSpec = DEFAULT_PRINT, dpi = PRINT_DPI) {
  const bleed = mmToPx(spec.bleedMm, dpi);
  const safe = mmToPx(spec.safeMm, dpi);
  const trimW = mmToPx(spec.widthMm, dpi);
  const trimH = mmToPx(spec.heightMm, dpi);
  return {
    sheet: { width: trimW + bleed * 2, height: trimH + bleed * 2 },
    trim: { left: bleed, top: bleed, width: trimW, height: trimH },
    safe: { left: bleed + safe, top: bleed + safe, width: trimW - safe * 2, height: trimH - safe * 2 },
    bleed,
  };
}

export const BRAND = {
  name: 'بروستد عالطريق',
  colors: {
    red: '#e0263a',
    redDeep: '#b21017',
    yellow: '#fcb712',
    asphalt: '#363336',
    ink: '#2a2528',
    cream: '#fbf5ea',
  },
} as const;

// Arabic-first families. Each family lists the weights loaded by fonts.ts.
export const FONTS = {
  display: { family: 'Cairo', weights: [700, 900] },
  body: { family: 'Tajawal', weights: [400, 500, 700, 800] },
} as const;

export const fontStack = (family: string) => `'${family}', 'Segoe UI', Tahoma, sans-serif`;
