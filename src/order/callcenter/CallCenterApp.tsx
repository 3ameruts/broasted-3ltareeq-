import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { AlertTriangle, Bike, Check, ClipboardCopy, Headset, LogOut, MapPin, MessageCircle, Phone, Play, Store as StoreIcon, Unlock, UserX, Wifi, WifiOff, X } from 'lucide-react';
import type { Order } from '../branch/api';
import { keepAwake, ring, unlockAudio } from '../branch/alarm';
import { Button } from '../ui/button';
import { Input } from '../ui/field';
import { Sheet } from '../ui/drawer';
import { cn } from '../ui/cn';
import { splitLine } from '../split';

// Call center: every agent sees new online orders from all branches with a sound and a notification,
// takes one (it locks to them), checks with the customer if needed, enters it on the branch POS and confirms here.
const url = import.meta.env.VITE_ORDERS_SUPABASE_URL || 'https://qzglmmkrnasgocuvtkut.supabase.co';
const key = import.meta.env.VITE_ORDERS_SUPABASE_KEY || 'sb_publishable_crkSQ5p2ntixzGDK5WRx6Q_2LAfmZee';
const sb = createClient(url, key, { auth: { persistSession: true, storageKey: 'broasted-cc-auth' } });

type CcOrder = Order & { fee_set_by?: string | null; claimed_by: string | null; claimed_name: string | null; claimed_at: string | null; confirmed_name: string | null; confirmed_at: string | null; pos_ref: string | null };
type Branch = { id: string; code: string; name: string };
type Res = { ok: boolean; error?: string; name?: string; repeat?: boolean };

const money = (n: number) => Number(n).toFixed(2);
const clock = (iso: string) => new Intl.DateTimeFormat('ar-JO-u-nu-latn', { timeZone: 'Asia/Amman', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const minsAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
// a taken order stays with that agent until they confirm or cancel it (only an admin can unlock it)
const heldBy = (o: CcOrder) => o.claimed_by;
// one colour per branch so agents never enter an order on the wrong POS
const TONES = ['bg-sky-100 text-sky-900 ring-sky-300', 'bg-amber-100 text-amber-900 ring-amber-300', 'bg-emerald-100 text-emerald-900 ring-emerald-300', 'bg-fuchsia-100 text-fuchsia-900 ring-fuchsia-300'];
const waLink = (phone: string) => 'https://wa.me/' + phone.replace(/\D/g, '').replace(/^0/, '962');

const rpc = async (fn: string, args: Record<string, unknown>) => {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw error;
  return data as Res;
};
const failed = (e: unknown) => toast.error(e instanceof Error && /not_allowed/.test(e.message) ? 'ما عندك صلاحية.' : 'ما زبطت، تأكد من الإنترنت وجرّب مرة ثانية.');

export default function CallCenterApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <Center>…</Center>;
  if (!session) return <Login />;
  return <Shift userId={session.user.id} />;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError('الإيميل أو كلمة السر غلط.');
    setBusy(false);
  };
  return (
    <Center>
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-white p-6 shadow-[0_0_0_2px_var(--color-line)]">
        <Headset size={44} className="mx-auto text-brand-deep" />
        <h1 className="text-center font-display text-3xl">الكول سنتر</h1>
        <label className="flex flex-col gap-1.5 text-sm font-bold">الإيميل
          <Input type="email" autoComplete="username" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">كلمة السر
          <Input type="password" autoComplete="current-password" dir="ltr" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        {error && <p className="text-sm font-bold text-brand-deep" role="alert">{error}</p>}
        <Button type="submit" size="lg" disabled={busy}>{busy ? 'لحظة…' : 'دخول'}</Button>
      </form>
    </Center>
  );
}

function Shift({ userId }: { userId: string }) {
  const [name, setName] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [roleError, setRoleError] = useState(false);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    (async () => {
      const [agent, admin] = await Promise.all([sb.rpc('is_agent'), sb.rpc('is_admin')]);
      if (!agent.data && !admin.data) return setRoleError(true);
      setAdmin(!!admin.data);
      const me = await sb.from('call_center_agents').select('name').eq('user_id', userId).maybeSingle();
      setName((me.data?.name as string) ?? 'المدير');
    })().catch(() => setRoleError(true));
  }, [userId]);

  if (roleError) return <Center><div className="flex flex-col items-center gap-4 text-center"><p className="font-bold">هالحساب مش مضاف عالكول سنتر.</p><Button variant="outline" onClick={() => sb.auth.signOut()}>خروج</Button></div></Center>;
  if (!name) return <Center>…</Center>;
  if (!started) return (
    <Center>
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <Headset size={56} className="text-brand-deep" />
        <h1 className="font-display text-3xl">أهلين {name} 👋</h1>
        <p className="text-soft">اكبس الزر عشان يشتغل صوت التنبيه والإشعارات، وخلّي هالشاشة مفتوحة طول الدوام.</p>
        <Button size="lg" className="w-full" onClick={async () => {
          await unlockAudio(); ring('new'); keepAwake();
          try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch { /* optional */ }
          setStarted(true);
        }}>
          <Play size={20} /> ابدأ الدوام
        </Button>
      </div>
    </Center>
  );
  return <Board userId={userId} name={name} admin={admin} />;
}

function Board({ userId, name, admin }: { userId: string; name: string; admin: boolean }) {
  const [orders, setOrders] = useState<CcOrder[]>([]);
  const [ratings, setRatings] = useState<Map<string, { stars: number; comment: string | null }>>(new Map());
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [online, setOnline] = useState(navigator.onLine);
  const [live, setLive] = useState(false);
  const [, tick] = useState(0);
  const seen = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 3600 * 1000).toISOString();
    const { data, error } = await sb.from('orders').select('*, order_items(*)').gte('created_at', since).order('created_at', { ascending: false });
    if (error || !data) return;
    const list = (data as CcOrder[]).map(o => ({ ...o, order_items: [...o.order_items].sort((a, b) => a.id - b.id) }));
    // a notification for orders that arrived while the agent was on another window
    const fresh = list.filter(o => o.status === 'new');
    if (seen.current) {
      for (const o of fresh) if (!seen.current.has(o.id) && document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
        try { new Notification(`طلب جديد #${o.number}`, { body: `${o.type === 'delivery' ? 'توصيل' : 'استلام'} · ${o.customer_name} · ${money(o.subtotal)} د.أ`, tag: o.id, icon: '/img/logo-sm.png' }); } catch { /* optional */ }
      }
    }
    seen.current = new Set(list.map(o => o.id));
    setOrders(list);
    // customer ratings for the orders on screen (missing table = no ratings yet)
    const done = list.filter(o => o.status !== 'new').map(o => o.id);
    if (done.length) sb.from('order_ratings').select('order_id, stars, comment').in('order_id', done)
      .then(({ data }) => setRatings(new Map((data ?? []).map(r => [r.order_id as string, { stars: r.stars as number, comment: r.comment as string | null }]))));
  }, []);

  useEffect(() => {
    refresh();
    sb.from('order_branches').select('id, code, name').order('id').then(({ data }) => setBranches((data ?? []) as Branch[]));
    // live updates; a poll every 15 s and a reload when the connection comes back make sure nothing is missed
    const ch = sb.channel('call-center')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh)
      .subscribe(status => { setLive(status === 'SUBSCRIBED'); if (status === 'SUBSCRIBED') refresh(); });
    const poll = setInterval(refresh, 15000);
    const up = () => { setOnline(true); refresh(); };
    const down = () => setOnline(false);
    const vis = () => { if (document.visibilityState === 'visible') { refresh(); keepAwake(); } };
    addEventListener('online', up); addEventListener('offline', down); document.addEventListener('visibilitychange', vis);
    return () => { sb.removeChannel(ch); clearInterval(poll); removeEventListener('online', up); removeEventListener('offline', down); document.removeEventListener('visibilitychange', vis); };
  }, [refresh]);

  const tone = useMemo(() => new Map(branches.map((b, i) => [b.id, TONES[i % TONES.length]])), [branches]);
  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? id;
  const shown = orders.filter(o => filter === 'all' || o.branch_id === filter);
  const waiting = shown.filter(o => o.status === 'new').sort((a, b) => a.created_at.localeCompare(b.created_at));
  const mine = waiting.filter(o => heldBy(o) === userId);
  const open = waiting.filter(o => !heldBy(o));
  const others = waiting.filter(o => heldBy(o) && heldBy(o) !== userId);
  const done = shown.filter(o => o.status !== 'new');
  const unclaimed = orders.filter(o => o.status === 'new' && !heldBy(o));
  const connected = online && live;

  // rings while any order waits for someone to take it; louder after 2 minutes
  useEffect(() => {
    const i = setInterval(() => {
      tick(x => x + 1);
      if (!online) return ring('offline');
      if (unclaimed.length) ring(unclaimed.some(o => minsAgo(o.created_at) >= 2) ? 'urgent' : 'new');
    }, 4000);
    return () => clearInterval(i);
  }, [unclaimed, online]);
  useEffect(() => { document.title = (unclaimed.length ? `(${unclaimed.length}) ` : '') + 'الكول سنتر | بروستد عالطريق'; }, [unclaimed.length]);

  // other orders from the same phone within an hour, so nobody keys the same order into the POS twice
  const twins = (o: CcOrder) => orders.filter(x => x.id !== o.id && x.customer_phone === o.customer_phone
    && Math.abs(new Date(x.created_at).getTime() - new Date(o.created_at).getTime()) < 3600000);
  const card = (o: CcOrder) => <OrderCard key={o.id} o={o} rating={ratings.get(o.id)} twins={twins(o)} userId={userId} admin={admin} branchName={branchName(o.branch_id)} tone={tone.get(o.branch_id) ?? TONES[0]} onChange={refresh} />;
  return (
    <div className="min-h-dvh pb-10">
      {unclaimed.length > 0 && <div className="pointer-events-none fixed inset-0 z-50 animate-pulse shadow-[inset_0_0_0_8px_var(--color-brand)]" aria-hidden />}
      <header className="sticky top-0 z-30 bg-asphalt px-4 pt-[max(10px,env(safe-area-inset-top))] pb-3 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <Headset size={30} className="text-mustard" />
          <div className="me-auto">
            <p className="font-display text-xl leading-none">الكول سنتر · {name}</p>
            <p className={cn('mt-1 flex items-center gap-1 text-xs font-bold', connected ? 'text-emerald-300' : 'text-mustard')}>
              {connected ? <><Wifi size={14} /> متصل</> : <><WifiOff size={14} /> مش متصل</>}
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold">بانتظار حدا: <span className="num">{unclaimed.length}</span></span>
          <button onClick={() => sb.auth.signOut()} className="grid size-10 place-items-center rounded-full bg-white/10" aria-label="خروج"><LogOut size={18} /></button>
        </div>
        <div className="mx-auto mt-3 flex max-w-7xl gap-2 overflow-x-auto pb-1" role="tablist" aria-label="الفرع">
          {[{ id: 'all', name: 'كل الفروع' }, ...branches].map(b => {
            const n = orders.filter(o => o.status === 'new' && (b.id === 'all' || o.branch_id === b.id)).length;
            return (
              <button key={b.id} role="tab" aria-selected={filter === b.id} onClick={() => setFilter(b.id)}
                className={cn('h-10 shrink-0 rounded-full px-4 text-sm font-bold', filter === b.id ? 'bg-white text-ink' : 'bg-white/10 text-white')}>
                {b.name}{n ? <span className="num"> ({n})</span> : ''}
              </button>
            );
          })}
        </div>
      </header>

      {!connected && (
        <div className="sticky top-[118px] z-20 bg-brand-deep px-4 py-3 text-center font-bold text-white" role="alert">
          ⚠️ لا يوجد اتصال. الطلبات الجديدة رح توصل أول ما يرجع الإنترنت.
        </div>
      )}

      {/* three columns on a desk screen: waiting for someone, with me, with colleagues and done */}
      <main className="mx-auto grid max-w-7xl items-start gap-6 px-4 pt-4 lg:grid-cols-3">
        <Group title="طلبات جديدة" empty="ما في طلبات جديدة. أول ما يوصل طلب الشاشة رح تزمّر.">{open.map(card)}</Group>
        <Group title="معك هسّا" empty="اكبس «استلمت الطلب» على أي طلب جديد.">{mine.map(card)}</Group>
        <div className="flex flex-col gap-6">
          {others.length > 0 && <Group title="مع زملائك">{others.map(card)}</Group>}
          <Group title="خلصت اليوم" empty="لسا ما خلص ولا طلب اليوم.">{done.map(card)}</Group>
        </div>
      </main>
    </div>
  );
}

function Group({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode }) {
  const list = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : [];
  if (!list.length && !empty) return null;
  return (
    <section>
      <h2 className="mb-3 font-display text-2xl">{title}</h2>
      {list.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">{children}</div> : <p className="rounded-3xl bg-white p-6 text-center text-soft shadow-[0_0_0_2px_var(--color-line)]">{empty}</p>}
    </section>
  );
}

// the order as plain text, in the order it is keyed into the POS
function posText(o: CcOrder, branchName: string) {
  const a = o.address;
  const lines = [`طلب #${o.number} · ${branchName} · ${o.type === 'delivery' ? 'توصيل' : 'استلام'}`, `${o.customer_name} · ${o.customer_phone}`];
  if (o.type === 'delivery' && a) lines.push([a.area, a.street, a.building && 'بناية ' + a.building, a.floor].filter(Boolean).join('، ') + (a.landmark ? ` (قرب ${a.landmark})` : ''));
  lines.push('');
  for (const i of o.order_items) {
    const { base, extras } = splitLine(i.line_total, i.qty, i.options);
    lines.push(`${i.qty} × ${i.name}  ${money(base)}`);
    for (const x of extras) lines.push(`   + ${x.name}${x.qty > 1 ? ' ×' + x.qty : ''}  ${money(x.total)}`);
    if (i.note) lines.push(`   ملاحظة: ${i.note}`);
  }
  if (o.type === 'delivery') lines.push('', `التوصيل${o.delivery_zone ? ` (${o.delivery_zone})` : ''}: ${o.delivery_fee != null ? money(o.delivery_fee) : o.delivery_range ? `${o.delivery_range} (بيتأكد)` : 'بالاتصال'}`);
  lines.push(`المجموع: ${money(Number(o.subtotal) + Number(o.delivery_fee ?? 0))} د.أ`);
  lines.push(`الدفع: ${o.pay_method === 'cash' ? 'كاش' : 'كليك'}${o.pay_method === 'cash' && o.change_for ? ` (فكّة لـ ${money(o.change_for)})` : ''}`);
  if (o.note) lines.push(`ملاحظة الزبون: ${o.note}`);
  return lines.join('\n');
}

const REASONS = ['ما ردّ على الاتصال', 'طلب وهمي', 'صنف خلص', 'خارج منطقة التوصيل', 'الفرع مضغوط'];

const itemsKey = (o: CcOrder) => o.order_items.map(i => `${i.name}×${i.qty}`).sort().join('|');
const STATUS: Record<CcOrder['status'], string> = { new: 'لسا جديد', accepted: 'انأكّد', ready: 'جاهز', delivered: 'انسلّم', rejected: 'انلغى', no_show: 'ما انستلم' };

function OrderCard({ o, rating, twins, userId, admin, branchName, tone, onChange }: { o: CcOrder; rating?: { stars: number; comment: string | null }; twins: CcOrder[]; userId: string; admin: boolean; branchName: string; tone: string; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | 'reject' | 'cancel'>(null);
  const [pos, setPos] = useState('');
  const [bad, setBad] = useState(0);
  useEffect(() => { if (o.status === 'new') sb.rpc('phone_history', { p_order: o.id }).then(({ data }) => setBad((data as { bad: number } | null)?.bad ?? 0)); }, [o.id, o.status]);

  const holder = heldBy(o);
  const isMine = holder === userId;
  const act = async (fn: () => Promise<Res>, ok?: string) => {
    setBusy(true);
    try {
      const r = await fn();
      if (!r.ok) toast.error(r.error === 'taken' ? `الطلب مع ${r.name ?? 'زميلك'}` : r.error === 'bad_status' ? 'الطلب تغيّرت حالته.' : 'ما زبطت.');
      else if (ok) toast.success(ok);
      onChange();
      return r.ok;
    } catch (e) { failed(e); return false; } finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(posText(o, branchName)); toast.success('انتسخ الطلب'); } catch { toast.error('ما قدرت أنسخ'); }
  };

  const a = o.address;
  const age = minsAgo(o.created_at);
  const late = o.status === 'new' && !holder && age >= 2;
  return (
    <article className={cn('flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-[0_0_0_2px_var(--color-line)]',
      o.status === 'new' && !holder && 'shadow-[0_0_0_3px_var(--color-brand)]', isMine && 'shadow-[0_0_0_3px_var(--color-asphalt)]',
      o.status !== 'new' && 'opacity-75', holder && !isMine && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-4xl leading-none"><span className="num">#{o.number}</span></p>
          <p className={cn('mt-1 text-sm', late ? 'font-bold text-brand-deep' : 'text-soft')}>{clock(o.created_at)} · {age < 1 ? 'هسّا' : `قبل ${age} د`}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={cn('rounded-full px-3 py-1 text-sm font-bold ring-2', tone)}>{branchName}</span>
          <span className={cn('flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold', o.type === 'delivery' ? 'bg-mustard text-ink' : 'bg-asphalt text-white')}>
            {o.type === 'delivery' ? <><Bike size={16} /> توصيل</> : <><StoreIcon size={16} /> استلام</>}
          </span>
        </div>
      </div>

      {bad > 0 && <p className="flex items-center gap-2 rounded-2xl bg-mustard/30 px-3 py-2 text-sm font-bold"><AlertTriangle size={18} /> هالرقم إله {bad} طلب مرفوض أو ما انستلم قبل. اتصل تأكد.</p>}
      {o.status === 'new' && twins.map(t => (
        <p key={t.id} className="flex items-center gap-2 rounded-2xl bg-brand/10 px-3 py-2 text-sm font-bold text-brand-deep">
          <AlertTriangle size={18} className="shrink-0" />
          نفس الرقم إله طلب #{t.number} {minsAgo(t.created_at) < 1 ? 'هسّا' : `قبل ${minsAgo(t.created_at)} د`}{itemsKey(t) === itemsKey(o) ? ' بنفس الأصناف' : ''} ({STATUS[t.status]}). تأكد إنه مش مكرر.
        </p>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{o.customer_name}</p>
        <div className="flex gap-2">
          <a href={`tel:${o.customer_phone}`} className="num flex h-11 items-center gap-2 rounded-full bg-paper px-4 font-bold"><Phone size={16} />{o.customer_phone}</a>
          <a href={waLink(o.customer_phone)} target="_blank" rel="noopener" className="grid size-11 place-items-center rounded-full bg-emerald-100 text-emerald-800" aria-label="واتساب"><MessageCircle size={18} /></a>
        </div>
      </div>
      {o.type === 'delivery' && a && (
        <div className="rounded-2xl bg-paper p-3 text-sm">
          <p className="font-semibold">{[a.area, a.street, a.building && 'بناية ' + a.building, a.floor].filter(Boolean).join('، ')}</p>
          {a.landmark && <p className="text-soft">قرب: {a.landmark}</p>}
          {o.location && <a className="mt-1 inline-flex items-center gap-1 font-bold text-brand-deep underline" target="_blank" rel="noopener"
            href={`https://www.google.com/maps/search/?api=1&query=${o.location.lat},${o.location.lng}`}><MapPin size={14} /> الموقع على الخريطة</a>}
        </div>
      )}

      <ul className="flex flex-col gap-1.5 border-y border-line py-3">
        {o.order_items.map(i => {
          const { base, extras } = splitLine(i.line_total, i.qty, i.options);
          return (
            <li key={i.id}>
              <div className="flex justify-between gap-2 font-bold"><span><span className="num">{i.qty}×</span> {i.name}</span><span className="num">{money(base)}</span></div>
              {extras.map((x, j) => (
                <div key={j} className="flex justify-between gap-2 ps-5 text-sm text-soft">
                  <span>+ {x.name}{x.qty > 1 ? ` ×${x.qty}` : ''}</span><span className="num">{money(x.total)}</span>
                </div>
              ))}
              {i.note && <p className="ps-5 text-sm font-bold text-brand-deep">«{i.note}»</p>}
            </li>
          );
        })}
      </ul>
      {o.note && <p className="rounded-2xl bg-mustard/25 px-3 py-2 text-sm font-semibold">ملاحظة: {o.note}</p>}
      <div className="flex items-baseline justify-between">
        <span className="text-sm">
          الدفع: <b>{o.pay_method === 'cash' ? 'كاش' : 'كليك'}</b>{o.pay_method === 'cash' && o.change_for ? <> · فكّة لـ <span className="num">{money(o.change_for)}</span></> : null}
        </span>
        <span className="num text-xl font-bold">{money(Number(o.subtotal) + Number(o.delivery_fee ?? 0))} د.أ</span>
      </div>
      {o.type === 'delivery' && (o.delivery_fee != null
        ? <p className="-mt-2 text-sm">التوصيل{o.delivery_zone ? ` (${o.delivery_zone})` : ''}: <b className="num">{money(o.delivery_fee)}</b>{o.fee_set_by ? <span className="text-soft"> · عدّله {o.fee_set_by}</span> : null}</p>
        : <p className="-mt-2 rounded-2xl bg-mustard/30 px-3 py-2 text-sm font-bold">⚠️ {o.delivery_range ? `${o.delivery_zone}: التوصيل من ${o.delivery_range.replace(' – ', ' لـ ')}، ثبّت السعر مع الزبون وسجّله تحت.` : 'منطقة مش بالقائمة: اتفق مع الزبون على سعر التوصيل وسجّله تحت.'}</p>)}

      {o.status === 'new' && !holder && (
        <Button size="lg" onClick={() => act(() => rpc('cc_claim', { p_order: o.id }), 'الطلب معك')} disabled={busy}><Headset size={20} /> استلمت الطلب</Button>
      )}
      {o.status === 'new' && holder && !isMine && (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-paper px-3 py-2 text-sm font-bold">
          <span>مع {o.claimed_name} من {minsAgo(o.claimed_at!)} د</span>
          {admin && <Button size="sm" variant="outline" onClick={() => act(() => rpc('cc_release', { p_order: o.id }), 'انفك القفل ورجع للقائمة')} disabled={busy}><Unlock size={16} /> فك القفل</Button>}
        </div>
      )}
      {o.status === 'new' && isMine && (
        <div className="flex flex-col gap-2 rounded-2xl bg-paper p-3">
          <Button variant="outline" onClick={copy}><ClipboardCopy size={18} /> انسخ الطلب للـ POS</Button>
          {o.type === 'delivery' && <FeeEditor o={o} onSave={fee => act(() => rpc('cc_set_fee', { p_order: o.id, p_fee: fee }), 'انحفظ سعر التوصيل')} />}
          <label className="flex flex-col gap-1.5 text-sm font-bold">رقم فاتورة الـ POS <span className="font-normal text-soft">(اختياري)</span>
            <Input value={pos} onChange={e => setPos(e.target.value)} maxLength={40} dir="ltr" inputMode="numeric" />
          </label>
          <Button size="lg" onClick={() => act(() => rpc('cc_confirm', { p_order: o.id, p_pos_ref: pos || null }), 'انأكّد الطلب')} disabled={busy}>
            <Check size={20} /> أكّدته على POS {branchName.replace('فرع ', '').replace('دوار ', '')}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setSheet('cancel')} disabled={busy}><UserX size={18} /> الزبون لغى</Button>
            <Button variant="outline" onClick={() => setSheet('reject')} disabled={busy}><X size={18} /> رفض</Button>
          </div>
        </div>
      )}
      {o.status === 'accepted' && o.confirmed_name && (
        <p className="text-sm font-bold text-emerald-700">✓ أكّده {o.confirmed_name} {o.confirmed_at && `الساعة ${clock(o.confirmed_at)}`}{o.pos_ref ? <> · POS <span className="num">#{o.pos_ref}</span></> : null}</p>
      )}
      {o.status === 'accepted' && !o.confirmed_name && <p className="text-sm font-bold text-emerald-700">✓ انقبل من الفرع</p>}
      {rating && <p className={cn('rounded-2xl px-3 py-2 text-sm font-bold', rating.stars <= 2 ? 'bg-brand/10 text-brand-deep' : 'bg-mustard/25')}>
        تقييم الزبون: {'★'.repeat(rating.stars)}{'☆'.repeat(5 - rating.stars)}{rating.comment ? ` «${rating.comment}»` : ''}</p>}
      {['ready', 'delivered'].includes(o.status) && <p className="text-sm font-bold text-emerald-700">✓ {o.status === 'ready' ? 'جاهز' : 'انسلّم'}</p>}
      {o.status === 'rejected' && <p className="text-sm font-bold text-brand-deep">انلغى{o.reject_reason ? `: ${o.reject_reason}` : ''}{o.confirmed_name ? ` · ${o.confirmed_name}` : ''}</p>}
      {o.status === 'no_show' && <p className="text-sm font-bold text-brand-deep">ما انستلم</p>}

      <RejectSheet open={sheet === 'reject'} onClose={() => setSheet(null)}
        onSubmit={async (reason, block) => { if (await act(() => rpc('cc_cancel', { p_order: o.id, p_reason: reason, p_block: block }), block ? 'انرفض وانحظر الرقم' : 'انرفض الطلب')) setSheet(null); }} />
      <Sheet open={sheet === 'cancel'} onOpenChange={x => !x && setSheet(null)} title="الزبون لغى الطلب؟">
        <div className="flex flex-col gap-3 pb-4">
          <p className="text-soft">الطلب بيطلع من الطابور، والزبون بيشوف إنه انلغى.</p>
          <Button size="lg" onClick={async () => { if (await act(() => rpc('cc_cancel', { p_order: o.id, p_reason: 'الزبون لغى الطلب', p_block: false }), 'انلغى الطلب')) setSheet(null); }} disabled={busy}>آه، الغيه</Button>
          <Button size="lg" variant="outline" onClick={() => setSheet(null)}>لا، رجوع</Button>
        </div>
      </Sheet>
    </article>
  );
}

// delivery fee: fill it in for an area that isn't on the list, or change it after talking to the customer
function FeeEditor({ o, onSave }: { o: CcOrder; onSave: (fee: number) => void }) {
  const [v, setV] = useState(o.delivery_fee != null ? String(o.delivery_fee) : '');
  const n = Number(v);
  const changed = v.trim() !== '' && n >= 0 && n <= 50 && n !== (o.delivery_fee != null ? Number(o.delivery_fee) : NaN);
  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold">سعر التوصيل
        <Input value={v} onChange={e => setV(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" dir="ltr" placeholder="0.75" />
      </label>
      <Button variant="outline" onClick={() => onSave(Math.round(n * 100) / 100)} disabled={!changed}>احفظ</Button>
    </div>
  );
}

function RejectSheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (reason: string, block: boolean) => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [block, setBlock] = useState(false);
  useEffect(() => { if (open) { setReason(REASONS[0]); setBlock(false); } }, [open]);
  return (
    <Sheet open={open} onOpenChange={x => !x && onClose()} title="رفض الطلب"
      footer={<Button size="lg" className="w-full" onClick={() => onSubmit(reason, block)}>ارفض الطلب</Button>}>
      <div className="flex flex-col gap-2 pb-2" role="radiogroup" aria-label="السبب">
        {REASONS.map(r => (
          <button key={r} role="radio" aria-checked={reason === r} onClick={() => { setReason(r); if (r === 'طلب وهمي') setBlock(true); }}
            className={cn('h-13 rounded-2xl border-2 bg-white px-4 text-start font-bold', reason === r ? 'border-brand-deep text-brand-deep' : 'border-line')}>{r}</button>
        ))}
        <label className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl bg-white px-4 font-bold">
          <input type="checkbox" className="size-5 accent-[var(--color-brand-deep)]" checked={block} onChange={e => setBlock(e.target.checked)} />
          احظر هالرقم من الطلب أونلاين
        </label>
      </div>
    </Sheet>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => <div className="grid min-h-dvh place-items-center bg-paper p-6">{children}</div>;
