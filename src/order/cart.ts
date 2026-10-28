import { useCallback, useEffect, useState } from 'react';

export type CartOption = { id: string; name: string; price: number; qty: number };
export type CartLine = { key: string; item_id: string; name: string; price: number; image?: string; qty: number; options: CartOption[]; note: string };

const KEY = 'broasted-order-cart-v1';
const read = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage is optional */ } };

export const unitPrice = (l: Pick<CartLine, 'price' | 'options'>) => l.price + l.options.reduce((s, o) => s + o.price * o.qty, 0);
export const lineTotal = (l: CartLine) => Math.round(unitPrice(l) * l.qty * 100) / 100;
// Same item with the same add-ons and note merges into one line
const sig = (l: Omit<CartLine, 'key' | 'qty'>) => [l.item_id, ...l.options.map(o => `${o.id}x${o.qty}`).sort(), l.note.trim()].join('|');

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>(() => read(KEY, []));
  useEffect(() => write(KEY, lines), [lines]);
  const add = useCallback((l: Omit<CartLine, 'key'>) => setLines(cur => {
    const s = sig(l); const i = cur.findIndex(x => sig(x) === s);
    if (i >= 0) return cur.map((x, j) => (j === i ? { ...x, qty: Math.min(20, x.qty + l.qty) } : x));
    return [...cur, { ...l, key: crypto.randomUUID() }];
  }), []);
  const setQty = useCallback((key: string, qty: number) => setLines(cur => cur.map(x => (x.key === key ? { ...x, qty } : x))), []);
  const remove = useCallback((key: string) => setLines(cur => cur.filter(x => x.key !== key)), []);
  const clear = useCallback(() => setLines([]), []);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = Math.round(lines.reduce((s, l) => s + lineTotal(l), 0) * 100) / 100;
  return { lines, add, setQty, remove, clear, count, total };
}
export type Cart = ReturnType<typeof useCart>;

// Small persisted prefs: branch, pickup/delivery, customer details, last orders
export function usePersisted<T>(k: string, initial: T) {
  const [v, setV] = useState<T>(() => read(k, initial));
  useEffect(() => write(k, v), [k, v]);
  return [v, setV] as const;
}
