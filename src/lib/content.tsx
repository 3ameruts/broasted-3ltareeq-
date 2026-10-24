import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import defaults from '../data/default-content.json';

export type Item = { id: string; name: string; price: number; contents?: string; image?: string };
export type Category = { id: string; name: string; blurb: string; note?: string; image?: string; items: Item[] };
export type Branch = { id: string; name: string; maps: string; lat: number; lng: number };
// value null = counted automatically from the menu, branches and hours.
export type Stat = { key: 'branches' | 'hours' | 'sandwiches' | 'sauces'; label: string; value: number | null; show: boolean };
export type Content = {
  brand: {
    name: string; slogan: string; phone: string; hours: string; openHour: number; closeHour: number;
    instagram: string; facebook: string; logo: string;
    showStatus: boolean; statusOpen: string; statusClosed: string;
    footerNote: string;
  };
  hero: { eyebrow: string; title: string; subtitle: string; video: string };
  about: { title: string; lead: string; paragraphs: string[]; video: string; stats: Stat[] };
  marquee: string[];
  categories: Category[];
  branches: Branch[];
  gallery: string[];
};

export const DEFAULT_CONTENT = defaults as Content;
const CACHE_KEY = 'broasted-cache-v1';
const LEGACY_KEY = 'broasted-content-v1';

// Merge section by section so fields added in later versions get their defaults.
export function mergeContent(saved: Partial<Content> | null | undefined): Content {
  if (!saved) return DEFAULT_CONTENT;
  return {
    ...DEFAULT_CONTENT,
    ...saved,
    brand: { ...DEFAULT_CONTENT.brand, ...saved.brand },
    hero: { ...DEFAULT_CONTENT.hero, ...saved.hero },
    about: { ...DEFAULT_CONTENT.about, ...saved.about },
  };
}

function readJSON(key: string): Partial<Content> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(c: Content) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* cache is optional */ }
}

// Edits saved by the old browser-only admin, offered once for publishing.
export const readLegacyEdits = () => readJSON(LEGACY_KEY);
export const clearLegacyEdits = () => { try { localStorage.removeItem(LEGACY_KEY); } catch { /* none */ } };

export async function fetchContent(): Promise<Content | null> {
  const { data, error } = await supabase.from('site_content').select('content').eq('id', 1).maybeSingle();
  if (error || !data) return null;
  return mergeContent(data.content as Partial<Content>);
}

export type SaveResult = { ok: true } | { ok: false; reason: 'not-setup' | 'not-admin' | 'network'; detail: string };

export async function publishContent(c: Content): Promise<SaveResult> {
  const { error } = await supabase.from('site_content').upsert({ id: 1, content: c, updated_at: new Date().toISOString() });
  if (!error) {
    writeCache(c);
    return { ok: true };
  }
  // 42501 covers both a missing table grant and a row-level-security refusal; only the latter means "not an admin".
  if (/row-level security/i.test(error.message)) return { ok: false, reason: 'not-admin', detail: error.message };
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42501') return { ok: false, reason: 'not-setup', detail: error.message };
  return { ok: false, reason: 'network', detail: error.message };
}

type Ctx = { content: Content; setContent: (c: Content) => void; loaded: boolean };
const Ctx = createContext<Ctx | null>(null);

// Renders the last copy this browser saw (or the built-in defaults) at once, then swaps in the live content.
export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<Content>(() => mergeContent(readJSON(CACHE_KEY)));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    fetchContent()
      .then(c => {
        if (!live) return;
        if (c) {
          setContent(c);
          writeCache(c);
        }
      })
      .finally(() => live && setLoaded(true));
    return () => { live = false; };
  }, []);
  return <Ctx.Provider value={{ content, setContent, loaded }}>{children}</Ctx.Provider>;
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
