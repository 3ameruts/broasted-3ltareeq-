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
  sauce_category: string; cheese_item_id: string | null; cheese_category: string; require_otp?: boolean;
};
export type OrderBranch = { id: string; code: string; name: string; accepting: boolean; paused_until: string | null };
export type Unavailable = { branch_id: string; item_id: string; until: string | null };

export type Zone = { id: number; branch_id: string; name: string; aliases: string[]; fee: number };
export type Store = { content: Content; settings: Settings; branches: OrderBranch[]; unavailable: Unavailable[]; zones: Zone[] };

export async function loadStore(): Promise<Store> {
  const [c, s, b, a, z] = await Promise.all([
    db.from('site_content').select('content').eq('id', 1).single(),
    db.from('order_settings').select('*').eq('id', 1).single(),
    db.from('order_branches').select('*').order('id'),
    db.from('item_availability').select('branch_id,item_id,until'),
    db.from('delivery_zones').select('id,branch_id,name,aliases,fee').order('name'),
  ]);
  const err = c.error || s.error || b.error || a.error;
  if (err) throw err;
  // no zones (or the zones table not set up yet): delivery fee by phone, as before
  const zones = ((z.error ? [] : z.data) as Zone[]).map(x => ({ ...x, fee: Number(x.fee) }));
  return { content: c.data.content as Content, settings: s.data as Settings, branches: b.data as OrderBranch[], unavailable: a.data as Unavailable[], zones };
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

// Arabic search that ignores hamza forms, ta marbuta, diacritics and a leading «ال»
const norm = (t: string) => t.replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim().toLowerCase();
const keys = (z: Zone) => [z.name, ...z.aliases].flatMap(k => { const n = norm(k); return [n, n.replace(/^ال/, '')]; });
export const searchZones = (zones: Zone[], q: string) => {
  const n = norm(q).replace(/^ال/, '');
  return n ? zones.filter(z => keys(z).some(k => k.includes(n))) : zones;
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
  location?: { lat: number; lng: number } | null; note?: string; pay_method: 'cash' | 'cliq'; change_for?: number | null; device?: string; zone_id?: number;
  items: { item_id: string; qty: number; note?: string; options: { id: string; qty: number }[] }[];
};
export type CreateResult = { ok: true; token: string; number: number; subtotal: number; repeat?: boolean; delivery_fee?: number } | { ok: false; error: string; items?: string[] };

export async function createOrder(p: OrderPayload): Promise<CreateResult> {
  const { data, error } = await db.rpc('create_order', { p });
  if (error) throw error;
  return data as CreateResult;
}

export type Tracked = {
  number: number; code: string; branch: string; status: 'new' | 'accepted' | 'ready' | 'delivered' | 'rejected' | 'no_show';
  type: 'pickup' | 'delivery'; name: string; phone: string; pay_method: 'cash' | 'cliq'; subtotal: number; reject_reason: string | null;
  created_at: string; printed_at: string | null; contact_phone: string; delivery_fee?: number | null; delivery_zone?: string | null; cliq_alias: string | null; cliq_name: string | null;
  items: { name: string; qty: number; options: { name: string; qty: number; price?: number }[]; note: string | null; line_total: number }[];
};
export async function getOrder(token: string): Promise<Tracked | null> {
  const { data, error } = await db.rpc('get_order', { p_token: token });
  if (error) throw error;
  return data as Tracked | null;
}

// WhatsApp phone check: a 6-digit code once per phone on each device; the device then keeps a token for that phone
export const normPhone = (p: string) => {
  const d = p.replace(/\D/g, '').replace(/^00962/, '0').replace(/^962/, '0').replace(/^7(\d{8})$/, '07$1');
  return /^07[789]\d{7}$/.test(d) ? d : null;
};
const DEVICES = 'broasted-order-devices-v1';
const devices = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(DEVICES) || '{}'); } catch { return {}; } };
export const deviceFor = (phone: string) => devices()[normPhone(phone) ?? ''];
export const rememberDevice = (phone: string, token: string | null) => {
  const all = devices(), k = normPhone(phone); if (!k) return;
  if (token) all[k] = token; else delete all[k];
  try { localStorage.setItem(DEVICES, JSON.stringify(all)); } catch { /* storage is optional */ }
};
// orders placed on this device, so a customer can get back to a recent one (tracking links stay on the device only)
export type RecentOrder = { token: string; number: number; phone: string; at: number;
  lines?: { item_id: string; qty: number; note: string; options: { id: string; qty: number }[] }[] };
export const orderFor = (token: string) => recent().find(x => x.token === token) ?? null;
// the last order on this device, any age (for «اطلب نفس الطلب»)
export const lastOrder = () => recent()[0] ?? null;
const RECENT = 'broasted-order-recent-v1';
const recent = (): RecentOrder[] => { try { return JSON.parse(localStorage.getItem(RECENT) || '[]'); } catch { return []; } };
export const rememberOrder = (o: RecentOrder) => {
  try { localStorage.setItem(RECENT, JSON.stringify([o, ...recent().filter(x => x.token !== o.token)].slice(0, 10))); } catch { /* storage is optional */ }
};
// the latest order from the last 3 hours (optionally for one phone)
export const latestOrder = (phone?: string) => {
  const p = phone ? normPhone(phone) : null;
  return recent().find(x => Date.now() - x.at < 3 * 3600000 && (!p || x.phone === p)) ?? null;
};

export type OtpResult = { ok: boolean; error?: string; seconds?: number; left?: number; device?: string };
export async function sendOtp(phone: string): Promise<OtpResult> {
  const { data, error } = await db.rpc('otp_send', { p_phone: phone });
  if (error) throw error;
  return data as OtpResult;
}
export async function verifyOtp(phone: string, code: string): Promise<OtpResult> {
  const { data, error } = await db.rpc('otp_verify', { p_phone: phone, p_code: code });
  if (error) throw error;
  return data as OtpResult;
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
  open_order: 'عندك طلب لسا قيد المراجعة. استنى لحد ما يتأكّد، أو تواصل معنا على الرقم.',
  unavailable: 'في أصناف خلصت هسّا بهالفرع:',
  note_too_long: 'الملاحظة طويلة، اختصرها شوي.',
};
