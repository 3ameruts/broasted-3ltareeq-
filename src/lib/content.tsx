import { createContext, useContext, useState, type ReactNode } from 'react';
import defaults from '../data/default-content.json';

export type Item = { id: string; name: string; price: number; contents?: string; image?: string };
export type Category = { id: string; name: string; blurb: string; note?: string; image?: string; items: Item[] };
export type Branch = { id: string; name: string; maps: string; lat: number; lng: number };
export type Content = {
  brand: {
    name: string; slogan: string; phone: string; hours: string; openHour: number; closeHour: number;
    instagram: string; facebook: string; logo: string;
  };
  hero: { eyebrow: string; title: string; subtitle: string; video: string };
  about: { title: string; lead: string; paragraphs: string[]; video: string };
  marquee: string[];
  categories: Category[];
  branches: Branch[];
  gallery: string[];
};

export const DEFAULT_CONTENT = defaults as Content;
const KEY = 'broasted-content-v1';

// Demo storage: edits live in this browser only. The production build swaps this for the server.
export function loadContent(): Content {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_CONTENT, ...JSON.parse(raw) };
  } catch {
    /* storage blocked or corrupt: fall back to defaults */
  }
  return DEFAULT_CONTENT;
}

export function saveContent(c: Content): { ok: true } | { ok: false; reason: string } {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
    return { ok: true };
  } catch (e) {
    const full = e instanceof DOMException && /quota/i.test(e.name + e.message);
    return { ok: false, reason: full ? 'full' : 'blocked' };
  }
}

export function resetContent() {
  try { localStorage.removeItem(KEY); } catch { /* nothing stored */ }
}

const Ctx = createContext<{ content: Content; setContent: (c: Content) => void } | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<Content>(loadContent);
  return <Ctx.Provider value={{ content, setContent }}>{children}</Ctx.Provider>;
}

export function useContent() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useContent outside ContentProvider');
  return v;
}

export const formatPrice = (n: number) => n.toFixed(2);

// Local time in Jordan, independent of the visitor's own time zone.
export function isOpenNow(open: number, close: number, now = new Date()) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Amman' }).format(now)) % 24;
  return open < close ? h >= open && h < close : h >= open || h < close;
}

export function telHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return 'tel:+962' + digits.replace(/^0/, '');
}
