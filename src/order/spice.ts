// Hot / regular, and splitting the pieces of a big meal. The same rules live in the database (22-otp-every-order-and-spice-split.sql),
// which refuses anything else: broasted from 12 pieces in steps of 4 (8 hot + 4 regular), tender from 8 pieces in any number.
export type Spice = 'regular' | 'hot' | 'mixed';
export type SplitRule = { step: number; min: number };
export type SplitRules = Record<string, SplitRule>;
// the database default (order_settings.spice_split); the page only offers splits once the database sends its rules
export const DEFAULT_SPLIT: SplitRules = { broasted: { step: 4, min: 12 }, tender: { step: 1, min: 8 } };

// «وجبة 12 قطعة بروستد» → 12, «وجبة 8 قطع تندر» → 8, anything else → 0
export const piecesOf = (name: string) => Number(/([0-9]+)\s*(?:قطعة|قطع)/.exec(name)?.[1] ?? 0);

// how this item can be split, or null when it is all-hot or all-regular only (or the database doesn't split yet)
export function splitFor(rules: SplitRules | null | undefined, categoryId: string, name: string) {
  const r = rules?.[categoryId], pieces = piecesOf(name);
  return r && pieces >= r.min && pieces > r.step ? { pieces, step: r.step } : null;
}

// the label shown everywhere: «حار 🌶️», «عادي», «8 حار 🌶️ + 4 عادي»
export function spiceText(spice?: string | null, hot?: number | null, regular?: number | null, emoji = true) {
  const h = emoji ? 'حار 🌶️' : 'حار';
  if (spice === 'mixed' && hot && regular) return `${hot} ${h} + ${regular} عادي`;
  return spice === 'hot' ? h : spice === 'regular' ? 'عادي' : '';
}
