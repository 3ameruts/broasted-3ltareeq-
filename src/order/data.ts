import { createClient } from '@supabase/supabase-js';
import type { Category, Content } from '../lib/types';

// Orders live in the site's Supabase project; VITE_ORDERS_SUPABASE_URL/KEY can point a build at another project.
// The publishable key is safe in the browser: the database only allows create_order/get_order for visitors.
const url = import.meta.env.VITE_ORDERS_SUPABASE_URL || 'https://qzglmmkrnasgocuvtkut.supabase.co';
const key = import.meta.env.VITE_ORDERS_SUPABASE_KEY || 'sb_publishable_crkSQ5p2ntixzGDK5WRx6Q_2LAfmZee';
export const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

export type Settings = {
  enabled: boolean; open_time: string; last_order_time: string; phone: string;
  cliq_alias: string | null; cliq_name: string | null;
  sauce_category: string; cheese_item_id: string | null; cheese_category: string;
};
export type OrderBranch = { id: string; code: string; name: string; accepting: boolean; paused_until: string | null };
export type Unavailable = { branch_id: string; item_id: string; until: string | null };

export type Store = { content: Content; settings: Settings; branches: OrderBranch[]; unavailable: Unavailable[] };

export async function loadStore(): Promise<Store> {
  const [c, s, b, a] = await Promise.all([
    db.from('site_content').select('content').eq('id', 1).single(),
    db.from('order_settings').select('*').eq('id', 1).single(),
    db.from('order_branches').select('*').order('id'),
    db.from('item_availability').select('branch_id,item_id,until'),
  ]);
  const err = c.error || s.error || b.error || a.error;
  if (err) throw err;
  return { content: c.data.content as Content, settings: s.data as Settings, branches: b.data as OrderBranch[], unavailable: a.data as Unavailable[] };
}

// Live updates when a branch switches an item off/on or pauses orders
export function watchStore(onAvailability: () => void, onBranches: () => void) {
  const ch = db.channel('order-store')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'item_availability' }, onAvailability)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_branches' }, onBranches)
    .subscribe();
  return () => { db.removeChannel(ch); };
}
export const reloadAvailability = async () => ((await db.from('item_availability').select('branch_id,item_id,until')).data ?? []) as Unavailable[];
export const reloadBranches = async () => ((await db.from('order_branches').select('*').order('id')).data ?? []) as OrderBranch[];

export const isUnavailable = (list: Unavailable[], branchId: string | null, itemId: string) =>
  !!branchId && list.some(u => u.branch_id === branchId && u.item_id === itemId && (!u.until || new Date(u.until) > new Date()));

export const branchPaused = (b?: OrderBranch | null) => !!b && (!b.accepting || (!!b.paused_until && new Date(b.paused_until) > new Date()));

// Ordering hours in Amman time (the database checks again on submit)
export function hoursOpen(s: Settings, now = new Date()) {
  const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const [o, l] = [s.open_time.slice(0, 5), s.last_order_time.slice(0, 5)];
  return o <= l ? t >= o && t <= l : t >= o || t < l;
}
export const hourLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const part = h < 5 ? 'الفجر' : h < 12 ? 'الصبح' : h < 15 ? 'الظهر' : h < 18 ? 'العصر' : 'المسا';
  return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${part}`;
};

export const imgUrl = (p?: string) => (!p ? undefined : /^https?:/.test(p) ? p : '/' + p.replace(/^\.?\//, ''));
export const money = (n: number) => n.toFixed(2);
export { splitLine } from './split';

// Which add-ons a menu item can take: sauces on everything except sauces/sides, cheese on sandwiches
export function addonsFor(cat: Category, content: Content, s: Settings) {
  if (cat.id === s.sauce_category || cat.id === 'sides') return { sauces: [], cheese: null };
  const sauces = content.categories.find(c => c.id === s.sauce_category)?.items ?? [];
  const cheese = cat.id === s.cheese_category && s.cheese_item_id
    ? content.categories.flatMap(c => c.items).find(i => i.id === s.cheese_item_id) ?? null : null;
  return { sauces, cheese };
}

export type OrderPayload = {
  idempotency_key: string; branch_id: string; type: 'pickup' | 'delivery'; name: string; phone: string;
  address?: { area: string; street: string; building: string; floor?: string; landmark?: string };
  location?: { lat: number; lng: number } | null; note?: string; pay_method: 'cash' | 'cliq'; change_for?: number | null;
  items: { item_id: string; qty: number; note?: string; options: { id: string; qty: number }[] }[];
};
export type CreateResult = { ok: true; token: string; number: number; subtotal: number; repeat?: boolean } | { ok: false; error: string; items?: string[] };

export async function createOrder(p: OrderPayload): Promise<CreateResult> {
  const { data, error } = await db.rpc('create_order', { p });
  if (error) throw error;
  return data as CreateResult;
}

export type Tracked = {
  number: number; code: string; branch: string; status: 'new' | 'accepted' | 'ready' | 'delivered' | 'rejected' | 'no_show';
  type: 'pickup' | 'delivery'; name: string; phone: string; pay_method: 'cash' | 'cliq'; subtotal: number; reject_reason: string | null;
  created_at: string; printed_at: string | null; contact_phone: string; cliq_alias: string | null; cliq_name: string | null;
  items: { name: string; qty: number; options: { name: string; qty: number; price?: number }[]; note: string | null; line_total: number }[];
};
export async function getOrder(token: string): Promise<Tracked | null> {
  const { data, error } = await db.rpc('get_order', { p_token: token });
  if (error) throw error;
  return data as Tracked | null;
}

export const ERRORS: Record<string, string> = {
  ordering_off: 'الطلب الأونلاين متوقف حالياً.',
  closed: 'الطلب الأونلاين مسكّر هسّا.',
  branch_paused: 'الفرع موقّف الطلبات شوي. جرّب فرع ثاني أو بعد شوي.',
  bad_branch: 'اختار الفرع.',
  bad_phone: 'رقم الجوال لازم يكون أردني، مثل 0791234567.',
  bad_name: 'اكتب اسمك.',
  bad_address: 'عبّي المنطقة والشارع والبناية.',
  blocked: 'للأسف ما بنقدر نستقبل طلبك أونلاين. تواصل معنا على الرقم.',
  too_many: 'بعتت كذا طلب ورا بعض. استنى كم دقيقة وجرّب.',
  unavailable: 'في أصناف خلصت هسّا بهالفرع:',
  note_too_long: 'الملاحظة طويلة، اختصرها شوي.',
};
