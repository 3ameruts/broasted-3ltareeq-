import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { AlertTriangle, Bike, Check, LogOut, MapPin, Pause, Phone, Play, Printer, Store as StoreIcon, Wifi, WifiOff, X } from 'lucide-react';
import type { Content } from '../../lib/types';
import { Button } from '../ui/button';
import { Input } from '../ui/field';
import { Sheet } from '../ui/drawer';
import { cn } from '../ui/cn';
import { splitLine } from '../split';
import { acceptOrder, loadOrders, markPaid, pauseBranch, phoneHistory, rejectOrder, reprintOrder, sb, setAvailability, setStatus, type Order } from './api';
import { keepAwake, ring, unlockAudio } from './alarm';
import { printTicket, ticketHtml } from './print';

type Branch = { id: string; code: string; name: string; accepting: boolean; paused_until: string | null };
type Unavail = { branch_id: string; item_id: string; until: string | null };
const money = (n: number) => Number(n).toFixed(2);
const clock = (iso: string) => new Intl.DateTimeFormat('ar-JO-u-nu-latn', { timeZone: 'Asia/Amman', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const minsAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
const failed = (e: unknown) => toast.error(e instanceof Error && /not_allowed/.test(e.message) ? 'ما عندك صلاحية على هالطلب.' : 'ما زبطت، تأكد من الإنترنت وجرّب مرة ثانية.');

export default function BranchApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <Center>…</Center>;
  if (!session) return <Login />;
  return <Shift />;
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
        <img src="/img/logo-sm.png" alt="بروستد عالطريق" className="mx-auto h-16" />
        <h1 className="text-center font-display text-3xl">طلبات الفرع</h1>
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

function Shift() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [roleError, setRoleError] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    (async () => {
      const [mine, isAdmin, br] = await Promise.all([sb.rpc('my_branch'), sb.rpc('is_admin'), sb.from('order_branches').select('*').order('id')]);
      setBranches((br.data ?? []) as Branch[]);
      setAdmin(!!isAdmin.data);
      if (mine.data) setBranchId(mine.data as string);
      else if (isAdmin.data) setBranchId(localStorage.getItem('broasted-branch-pick') || (br.data?.[0] as Branch | undefined)?.id || null);
      else setRoleError(true);
    })().catch(() => setRoleError(true));
  }, []);

  if (roleError) return <Center><div className="flex flex-col items-center gap-4 text-center"><p className="font-bold">هالحساب مش مربوط بأي فرع.</p><Button variant="outline" onClick={() => sb.auth.signOut()}>خروج</Button></div></Center>;
  if (!branchId) return <Center>…</Center>;
  if (!started) return (
    <Center>
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <img src="/img/logo-sm.png" alt="" className="h-20" />
        <h1 className="font-display text-3xl">{branches.find(b => b.id === branchId)?.name}</h1>
        {admin && (
          <select className="h-12 w-full rounded-2xl border-2 border-line bg-white px-3 font-bold" value={branchId}
            onChange={e => { setBranchId(e.target.value); localStorage.setItem('broasted-branch-pick', e.target.value); }} aria-label="الفرع">
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <p className="text-soft">اكبس الزر عشان يشتغل صوت التنبيه، وخلّي هالشاشة مفتوحة طول الدوام.</p>
        <Button size="lg" className="w-full" onClick={async () => { await unlockAudio(); ring('new'); keepAwake(); setStarted(true); }}>
          <Play size={20} /> ابدأ استقبال الطلبات
        </Button>
      </div>
    </Center>
  );
  return <Board branch={branches.find(b => b.id === branchId)!} onBranches={setBranches} />;
}

function Board({ branch, onBranches }: { branch: Branch; onBranches: (b: Branch[]) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [content, setContent] = useState<Content | null>(null);
  const [cliqAlias, setCliqAlias] = useState<string | null>(null);
  const [unavail, setUnavail] = useState<Unavail[]>([]);
  const [tab, setTab] = useState<'orders' | 'menu'>('orders');
  const [online, setOnline] = useState(navigator.onLine);
  const [live, setLive] = useState(false);
  const [, tick] = useState(0);
  const [pauseOpen, setPauseOpen] = useState(false);

  const refresh = useCallback(async () => {
    try { setOrders(await loadOrders(branch.id)); } catch { /* shown by the connection banner */ }
  }, [branch.id]);
  const refreshMeta = useCallback(async () => {
    const [u, b] = await Promise.all([sb.from('item_availability').select('*').eq('branch_id', branch.id), sb.from('order_branches').select('*').order('id')]);
    if (u.data) setUnavail(u.data as Unavail[]);
    if (b.data) onBranches(b.data as Branch[]);
  }, [branch.id, onBranches]);

  useEffect(() => {
    refresh(); refreshMeta();
    Promise.all([sb.from('site_content').select('content').eq('id', 1).single(), sb.from('order_settings').select('cliq_alias').eq('id', 1).single()])
      .then(([c, s]) => { if (c.data) setContent(c.data.content as Content); setCliqAlias((s.data?.cliq_alias as string) ?? null); });
    // live updates; a poll every 20 s and a reload when the connection comes back make sure nothing is missed
    const ch = sb.channel('branch-' + branch.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `branch_id=eq.${branch.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_availability', filter: `branch_id=eq.${branch.id}` }, refreshMeta)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_branches' }, refreshMeta)
      .subscribe(status => { setLive(status === 'SUBSCRIBED'); if (status === 'SUBSCRIBED') refresh(); });
    const poll = setInterval(refresh, 20000);
    const up = () => { setOnline(true); refresh(); refreshMeta(); };
    const down = () => setOnline(false);
    const vis = () => { if (document.visibilityState === 'visible') { refresh(); keepAwake(); } };
    addEventListener('online', up); addEventListener('offline', down); document.addEventListener('visibilitychange', vis);
    return () => { sb.removeChannel(ch); clearInterval(poll); removeEventListener('online', up); removeEventListener('offline', down); document.removeEventListener('visibilitychange', vis); };
  }, [branch.id, refresh, refreshMeta]);

  const fresh = orders.filter(o => o.status === 'new');
  const working = orders.filter(o => o.status === 'accepted' || o.status === 'ready');
  const done = orders.filter(o => ['delivered', 'rejected', 'no_show'].includes(o.status));
  const connected = online && live;

  // the alarm keeps ringing until every new order is accepted or rejected; louder after 2 minutes
  useEffect(() => {
    const i = setInterval(() => {
      tick(x => x + 1);
      if (!online) return ring('offline');
      if (fresh.length) ring(fresh.some(o => minsAgo(o.created_at) >= 2) ? 'urgent' : 'new');
    }, 4000);
    return () => clearInterval(i);
  }, [fresh, online]);

  const paused = !!branch.paused_until && new Date(branch.paused_until) > new Date();

  return (
    <div className="min-h-dvh pb-10">
      {fresh.length > 0 && <div className="pointer-events-none fixed inset-0 z-50 animate-pulse shadow-[inset_0_0_0_8px_var(--color-brand)]" aria-hidden />}
      <header className="sticky top-0 z-30 bg-asphalt px-4 pt-[max(10px,env(safe-area-inset-top))] pb-3 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <img src="/img/logo-sm.png" alt="" className="h-10" />
          <div className="me-auto">
            <p className="font-display text-xl leading-none">{branch.name}</p>
            <p className={cn('mt-1 flex items-center gap-1 text-xs font-bold', connected ? 'text-emerald-300' : 'text-mustard')}>
              {connected ? <><Wifi size={14} /> متصل</> : <><WifiOff size={14} /> مش متصل</>}
            </p>
          </div>
          <Button size="sm" variant={paused ? 'accent' : 'outline'} className={cn(!paused && 'border-white/20 bg-white/10 text-white hover:bg-white/20')} onClick={() => setPauseOpen(true)}>
            {paused ? <><Play size={16} /> موقّف لحد {clock(branch.paused_until!)}</> : <><Pause size={16} /> إيقاف مؤقت</>}
          </Button>
          <button onClick={() => sb.auth.signOut()} className="grid size-10 place-items-center rounded-full bg-white/10" aria-label="خروج"><LogOut size={18} /></button>
        </div>
        <div className="mx-auto mt-3 grid max-w-5xl grid-cols-2 gap-1 rounded-2xl bg-white/10 p-1" role="tablist">
          {([['orders', `الطلبات${fresh.length ? ` (${fresh.length} جديد)` : ''}`], ['menu', 'التوفّر']] as const).map(([v, l]) => (
            <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
              className={cn('h-11 rounded-xl font-bold', tab === v ? 'bg-white text-ink' : 'text-white')}>{l}</button>
          ))}
        </div>
      </header>

      {!connected && (
        <div className="sticky top-[118px] z-20 bg-brand-deep px-4 py-3 text-center font-bold text-white" role="alert">
          ⚠️ لا يوجد اتصال. الطلبات الجديدة رح توصل أول ما يرجع الإنترنت.
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 pt-4">
        {tab === 'orders' ? (
          <div className="flex flex-col gap-6">
            <Group title="طلبات جديدة" empty="ما في طلبات جديدة. أول ما يوصل طلب الجهاز رح يزمّر.">
              {fresh.map(o => <OrderCard key={o.id} o={o} branch={branch} cliqAlias={cliqAlias} onChange={refresh} />)}
            </Group>
            <Group title="قيد التحضير">{working.map(o => <OrderCard key={o.id} o={o} branch={branch} cliqAlias={cliqAlias} onChange={refresh} />)}</Group>
            <Group title="خلصت اليوم">
              {done.length > 0 && <DaySummary orders={done} />}
              {done.map(o => <OrderCard key={o.id} o={o} branch={branch} cliqAlias={cliqAlias} onChange={refresh} />)}
            </Group>
          </div>
        ) : content ? <Availability content={content} branchId={branch.id} unavail={unavail} onChange={refreshMeta} /> : <p className="text-soft">…</p>}
      </main>

      <Sheet open={pauseOpen} onOpenChange={setPauseOpen} title={paused ? 'الطلبات موقّفة' : 'إيقاف الطلبات مؤقتاً'}>
        <div className="flex flex-col gap-3 pb-4">
          {paused && <Button size="lg" onClick={async () => { try { await pauseBranch(null, branch.id); await refreshMeta(); setPauseOpen(false); toast.success('رجعت الطلبات تشتغل'); } catch (e) { failed(e); } }}>
            <Play size={18} /> شغّل الطلبات هسّا</Button>}
          <p className="text-sm text-soft">الزباين ما رح يقدروا يطلبوا من هالفرع خلال هالمدة، وبترجع لحالها.</p>
          {[15, 30, 60].map(m => (
            <Button key={m} variant="outline" size="lg" onClick={async () => { try { await pauseBranch(m, branch.id); await refreshMeta(); setPauseOpen(false); toast(`انوقفت الطلبات ${m} دقيقة`); } catch (e) { failed(e); } }}>
              أوقف <span className="num">{m}</span> دقيقة
            </Button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function Group({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode }) {
  const list = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : [];
  if (!list.length && !empty) return null;
  return (
    <section>
      <h2 className="mb-3 font-display text-2xl">{title}</h2>
      {list.length ? <div className="grid gap-4 md:grid-cols-2">{children}</div> : <p className="rounded-3xl bg-white p-6 text-center text-soft shadow-[0_0_0_2px_var(--color-line)]">{empty}</p>}
    </section>
  );
}

function DaySummary({ orders }: { orders: Order[] }) {
  const d = orders.filter(o => o.status === 'delivered');
  const sum = (f: (o: Order) => boolean) => money(d.filter(f).reduce((s, o) => s + Number(o.subtotal), 0));
  return (
    <div className="grid grid-cols-3 gap-2 rounded-3xl bg-white p-4 text-center shadow-[0_0_0_2px_var(--color-line)] md:col-span-2">
      <div><p className="text-sm text-soft">انسلّم</p><p className="num text-xl font-bold">{d.length}</p></div>
      <div><p className="text-sm text-soft">كاش</p><p className="num text-xl font-bold">{sum(o => o.paid_method === 'cash')}</p></div>
      <div><p className="text-sm text-soft">كليك</p><p className="num text-xl font-bold">{sum(o => o.paid_method === 'cliq')}</p></div>
    </div>
  );
}

const REASONS = ['ما ردّ على الاتصال', 'طلب وهمي', 'صنف خلص', 'خارج منطقة التوصيل', 'الفرع مضغوط'];

function OrderCard({ o, branch, cliqAlias, onChange }: { o: Order; branch: Branch; cliqAlias: string | null; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | 'reject' | 'paid' | 'noshow'>(null);
  const [bad, setBad] = useState(0);
  useEffect(() => { if (o.status === 'new') phoneHistory(o.id).then(r => setBad(r.bad)).catch(() => {}); }, [o.id, o.status]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); onChange(); } catch (e) { failed(e); } finally { setBusy(false); }
  };
  const accept = () => act(async () => {
    const r = await acceptOrder(o.id);
    if (!r.ok) throw new Error(r.error);
    if (r.print) await printTicket(ticketHtml(o, branch.name, { cliqAlias }));
  }, 'انقبل الطلب');
  const reprint = () => act(async () => { const r = await reprintOrder(o.id); if (r.ok) await printTicket(ticketHtml(o, branch.name, { copy: true, cliqAlias })); });

  const a = o.address;
  const finished = ['delivered', 'rejected', 'no_show'].includes(o.status);
  const age = minsAgo(o.created_at);
  return (
    <article className={cn('flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-[0_0_0_2px_var(--color-line)]',
      o.status === 'new' && 'shadow-[0_0_0_3px_var(--color-brand)]', finished && 'opacity-70')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-4xl leading-none"><span className="num">#{o.number}</span></p>
          <p className="mt-1 text-sm text-soft">{clock(o.created_at)} · {age < 1 ? 'هسّا' : `قبل ${age} د`}</p>
        </div>
        <span className={cn('flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold', o.type === 'delivery' ? 'bg-mustard text-ink' : 'bg-asphalt text-white')}>
          {o.type === 'delivery' ? <><Bike size={16} /> توصيل</> : <><StoreIcon size={16} /> استلام</>}
        </span>
      </div>

      {bad > 0 && <p className="flex items-center gap-2 rounded-2xl bg-mustard/30 px-3 py-2 text-sm font-bold"><AlertTriangle size={18} /> هالرقم إله {bad} طلب مرفوض أو ما انستلم قبل. اتصل تأكد.</p>}

      <div className="flex items-center justify-between gap-2">
        <p className="font-bold">{o.customer_name}</p>
        <a href={`tel:${o.customer_phone}`} className="num flex h-11 items-center gap-2 rounded-full bg-paper px-4 font-bold"><Phone size={16} />{o.customer_phone}</a>
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
          {o.type === 'delivery' && (o.delivery_fee != null ? <> · التوصيل <span className="num">{money(o.delivery_fee)}</span></> : ' · + التوصيل بالاتصال')}
        </span>
        <span className="num text-xl font-bold">{money(Number(o.subtotal) + Number(o.delivery_fee ?? 0))} د.أ</span>
      </div>

      {o.status === 'new' && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button size="lg" onClick={accept} disabled={busy}><Check size={20} /> قبول وطباعة</Button>
          <Button size="lg" variant="outline" onClick={() => setSheet('reject')} disabled={busy}><X size={20} /> رفض</Button>
        </div>
      )}
      {o.status === 'accepted' && (
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <Button size="lg" variant="dark" onClick={() => act(() => setStatus(o.id, 'ready'), 'الطلب جاهز')} disabled={busy}>{o.type === 'delivery' ? 'طلع مع المندوب' : 'جاهز للاستلام'}</Button>
          <Button size="lg" variant="outline" onClick={reprint} disabled={busy} aria-label="إعادة طباعة"><Printer size={20} /></Button>
          <Button size="lg" variant="outline" onClick={() => setSheet('reject')} disabled={busy} aria-label="رفض"><X size={20} /></Button>
        </div>
      )}
      {o.status === 'ready' && (
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <Button size="lg" onClick={() => setSheet('paid')} disabled={busy}>تم التسليم والدفع</Button>
          <Button size="lg" variant="outline" onClick={() => setSheet('noshow')} disabled={busy}>ما استلم</Button>
          <Button size="lg" variant="outline" onClick={reprint} disabled={busy} aria-label="إعادة طباعة"><Printer size={20} /></Button>
        </div>
      )}
      {o.status === 'delivered' && (o.paid_method
        ? <p className="text-sm font-bold text-emerald-700">✓ انسلّم وانحاسب {o.paid_method === 'cash' ? 'كاش' : 'كليك'}{o.paid_ref ? ` (${o.paid_ref})` : ''}</p>
        : <Button variant="outline" onClick={() => setSheet('paid')}>سجّل الدفع</Button>)}
      {o.status === 'rejected' && <p className="text-sm font-bold text-brand-deep">انرفض{o.reject_reason ? `: ${o.reject_reason}` : ''}</p>}
      {o.status === 'no_show' && <p className="text-sm font-bold text-brand-deep">ما انستلم</p>}

      <RejectSheet open={sheet === 'reject'} onClose={() => setSheet(null)} onSubmit={(reason, block) => act(() => rejectOrder(o.id, reason, block), block ? 'انرفض وانحظر الرقم' : 'انرفض الطلب').then(() => setSheet(null))} />
      <PaidSheet open={sheet === 'paid'} defaultMethod={o.pay_method} onClose={() => setSheet(null)}
        onSubmit={(m, ref) => act(async () => { if (o.status !== 'delivered') await setStatus(o.id, 'delivered'); await markPaid(o.id, m, ref); }, 'تم').then(() => setSheet(null))} />
      <Sheet open={sheet === 'noshow'} onOpenChange={x => !x && setSheet(null)} title="الزبون ما استلم؟">
        <div className="flex flex-col gap-3 pb-4">
          <Button size="lg" onClick={() => act(() => setStatus(o.id, 'no_show', true), 'انحظر الرقم').then(() => setSheet(null))}>ما استلم، واحظر الرقم</Button>
          <Button size="lg" variant="outline" onClick={() => act(() => setStatus(o.id, 'no_show', false)).then(() => setSheet(null))}>ما استلم، بدون حظر</Button>
        </div>
      </Sheet>
    </article>
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

function PaidSheet({ open, defaultMethod, onClose, onSubmit }: { open: boolean; defaultMethod: 'cash' | 'cliq'; onClose: () => void; onSubmit: (m: 'cash' | 'cliq', ref: string) => void }) {
  const [m, setM] = useState(defaultMethod);
  const [ref, setRef] = useState('');
  useEffect(() => { if (open) { setM(defaultMethod); setRef(''); } }, [open, defaultMethod]);
  return (
    <Sheet open={open} onOpenChange={x => !x && onClose()} title="كيف دفع الزبون؟"
      footer={<Button size="lg" className="w-full" onClick={() => onSubmit(m, ref)}>تأكيد</Button>}>
      <div className="flex flex-col gap-3 pb-2">
        <div className="grid grid-cols-2 gap-2">
          {(['cash', 'cliq'] as const).map(v => (
            <button key={v} onClick={() => setM(v)} aria-pressed={m === v}
              className={cn('h-16 rounded-2xl border-2 bg-white text-lg font-bold', m === v ? 'border-brand-deep text-brand-deep' : 'border-line')}>{v === 'cash' ? 'كاش' : 'كليك'}</button>
          ))}
        </div>
        {m === 'cliq' && <label className="flex flex-col gap-1.5 text-sm font-bold">اسم المحوّل أو رقم الحوالة <span className="font-normal text-soft">(اختياري، للمطابقة مع كشف البنك)</span>
          <Input value={ref} onChange={e => setRef(e.target.value)} maxLength={60} /></label>}
        {m === 'cliq' && <p className="text-sm text-soft">تأكد إنه الحوالة وصلت على حساب المطعم قبل ما تأكد.</p>}
      </div>
    </Sheet>
  );
}

function Availability({ content, branchId, unavail, onChange }: { content: Content; branchId: string; unavail: Unavail[]; onChange: () => void }) {
  const [pick, setPick] = useState<{ id: string; name: string } | null>(null);
  const off = useMemo(() => new Map(unavail.filter(u => !u.until || new Date(u.until) > new Date()).map(u => [u.item_id, u.until])), [unavail]);
  const set = async (id: string, mode: 'on' | 'hour' | 'tomorrow' | 'manual') => {
    try { await setAvailability(id, mode, branchId); onChange(); setPick(null); toast.success(mode === 'on' ? 'رجع متوفر' : 'صار غير متوفر'); } catch (e) { failed(e); }
  };
  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-2xl bg-white p-4 text-sm text-soft shadow-[0_0_0_2px_var(--color-line)]">اللي بتطفيه هون بيصير «غير متوفر» عند الزبون بهالفرع بس، وبيتحدّث عنده فوراً.</p>
      {content.categories.filter(c => c.items.length).map(c => (
        <section key={c.id}>
          <h2 className="mb-2 font-display text-2xl">{c.name}</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {c.items.map(i => {
              const isOff = off.has(i.id); const until = off.get(i.id);
              return (
                <li key={i.id}>
                  <button onClick={() => (isOff ? set(i.id, 'on') : setPick({ id: i.id, name: i.name }))} role="switch" aria-checked={!isOff}
                    className={cn('flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white px-4 text-start shadow-[0_0_0_2px_var(--color-line)]', isOff && 'bg-brand/5 shadow-[0_0_0_2px_var(--color-brand)]')}>
                    <span className="flex-1">
                      <span className="block font-bold">{i.name}</span>
                      {isOff && <span className="block text-sm font-semibold text-brand-deep">غير متوفر{until ? ` لحد ${clock(until)}` : ' لحد ما ترجّعه'}</span>}
                    </span>
                    <span className={cn('relative h-8 w-14 shrink-0 rounded-full transition-colors', isOff ? 'bg-ink/20' : 'bg-emerald-500')}>
                      <span className={cn('absolute top-1 size-6 rounded-full bg-white shadow transition-all', isOff ? 'end-1' : 'start-1')} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <Sheet open={!!pick} onOpenChange={x => !x && setPick(null)} title={pick ? `«${pick.name}» غير متوفر` : ''}>
        <div className="flex flex-col gap-3 pb-4">
          <Button size="lg" variant="outline" onClick={() => pick && set(pick.id, 'hour')}>لمدة ساعة</Button>
          <Button size="lg" variant="outline" onClick={() => pick && set(pick.id, 'tomorrow')}>لبكرة (برجع لحاله مع الفتح)</Button>
          <Button size="lg" onClick={() => pick && set(pick.id, 'manual')}>لحد ما أرجّعه</Button>
        </div>
      </Sheet>
    </div>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => <div className="grid min-h-dvh place-items-center bg-paper p-6">{children}</div>;
