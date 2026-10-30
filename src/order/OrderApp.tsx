import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ShoppingBag } from 'lucide-react';
import type { Category, Item } from '../lib/types';
import { useCart, usePersisted } from './cart';
import { addonsFor, branchPaused, hourLabel, hoursOpen, isUnavailable, lastOrder, latestOrder, loadStore, orderFor, money, reloadAvailability, reloadBranches, watchStore, type Store } from './data';
import { BranchPicker, type Mode } from './screens/BranchPicker';
import { BranchChip, Menu } from './screens/Menu';
import { ItemSheet } from './screens/ItemSheet';
import { CartPanel, CartSheet } from './screens/CartSheet';
import { Checkout } from './screens/Checkout';
import { Tracking } from './screens/Tracking';
import { InstallPrompt } from './screens/InstallPrompt';
import { Sheet } from './ui/drawer';
import { Button } from './ui/button';
import { cn } from './ui/cn';

type View = { name: 'menu' } | { name: 'checkout' } | { name: 'track'; token: string };
const readView = (): View => {
  const q = new URLSearchParams(location.search);
  const t = q.get('t');
  if (t && /^[0-9a-f]{32}$/.test(t)) return { name: 'track', token: t };
  return q.get('step') === 'checkout' ? { name: 'checkout' } : { name: 'menu' };
};
const go = (v: View, replace = false) => {
  const url = v.name === 'track' ? `?t=${v.token}` : v.name === 'checkout' ? '?step=checkout' : location.pathname;
  history[replace ? 'replaceState' : 'pushState'](null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export default function OrderApp() {
  const [store, setStore] = useState<Store | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<View>(readView);
  const [branchId, setBranchId] = usePersisted<string | null>('broasted-order-branch-v1', null);
  const [mode, setMode] = usePersisted<Mode>('broasted-order-mode-v1', 'pickup');
  // the branch is asked every time the order page opens (last choice preselected); a refresh at checkout keeps it
  const [picked, setPicked] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [sheet, setSheet] = useState<{ item: Item; cat: Category } | null>(null);
  const [, tick] = useState(0);
  const [reorder, setReorder] = useState<string | null>(null);
  const cart = useCart();

  const load = useCallback(() => { setLoadError(false); loadStore().then(setStore).catch(() => setLoadError(true)); }, []);
  useEffect(load, [load]);
  useEffect(() => watchStore(
    () => reloadAvailability().then(u => setStore(s => s && { ...s, unavailable: u })),
    () => reloadBranches().then(b => setStore(s => s && { ...s, branches: b })),
  ), []);
  useEffect(() => { const on = () => setView(readView()); addEventListener('popstate', on); return () => removeEventListener('popstate', on); }, []);
  // re-check opening hours and timed availability every minute
  useEffect(() => { const i = setInterval(() => tick(x => x + 1), 60000); return () => clearInterval(i); }, []);

  const branch = store?.branches.find(b => b.id === branchId) ?? null;
  const unavailable = useCallback((id: string) => !!store && isUnavailable(store.unavailable, branchId, id), [store, branchId]);
  const categories = useMemo(() => store?.content.categories.filter(c => c.items.length) ?? [], [store]);

  // «اطلب نفس الطلب»: rebuild the cart from an earlier order with today's menu and prices
  useEffect(() => {
    if (!store || !reorder) return;
    const saved = orderFor(reorder);
    setReorder(null);
    if (!saved?.lines?.length) return;
    const find = (id: string) => { for (const c of categories) { const i = c.items.find(x => x.id === id); if (i) return { item: i, cat: c }; } return null; };
    const missing: string[] = [];
    cart.clear();
    for (const l of saved.lines) {
      const f = find(l.item_id);
      if (!f) { missing.push('صنف ما عاد موجود'); continue; }
      if (unavailable(f.item.id)) { missing.push(f.item.name); continue; }
      const options = l.options.flatMap(o => {
        const x = find(o.id);
        return x && !unavailable(x.item.id) ? [{ id: x.item.id, name: x.item.name, price: x.item.price, qty: o.qty }] : [];
      });
      cart.add({ item_id: f.item.id, name: f.item.name, price: f.item.price, image: f.item.image || f.cat.image, qty: l.qty, options, note: l.note });
    }
    toast.success(missing.length ? `رجّعنا طلبك للسلة، بس في إشي مش متوفر هسّا: ${missing.join('، ')}` : 'رجّعنا طلبك للسلة بأسعار اليوم. راجعه وكمّل', { duration: 4000 });
    setCartOpen(true);
  }, [store, reorder]); // eslint-disable-line react-hooks/exhaustive-deps

  // «بتحب تزيد؟»: a drink, fries and coleslaw when the cart has a meal but not these yet
  const suggestions = useMemo(() => {
    if (!store) return [];
    const sides = categories.find(c => c.id === 'sides')?.items ?? [];
    const catOf = new Map(categories.flatMap(c => c.items.map(i => [i.id, c.id] as const)));
    const names = cart.lines.map(l => l.name);
    if (!cart.lines.some(l => !['sides', store.settings.sauce_category].includes(catOf.get(l.item_id) ?? 'sides'))) return [];
    const pick = (want: RegExp, has: RegExp) => names.some(n => has.test(n)) ? null
      : sides.find(i => want.test(i.name) && i.id !== store.settings.cheese_item_id && !unavailable(i.id)) ?? null;
    return [pick(/مشروب غازي علبة/, /مشروب|ماء|عصير/), pick(/بطاطا/, /بطاطا/), pick(/كول سلو صغير/, /كول سلو/)].filter((x): x is Item => !!x);
  }, [store, categories, cart.lines, unavailable]);
  const addSuggestion = (item: Item) => {
    cart.add({ item_id: item.id, name: item.name, price: item.price, image: item.image, qty: 1, options: [], note: '' });
    toast.success(`انضاف ${item.name.replace(/\s+/g, ' ')}`, { duration: 1500 });
  };

  if (view.name === 'track') return <Shell><Tracking token={view.token} onNewOrder={() => go({ name: 'menu' })} onReorder={() => { setReorder(view.token); go({ name: 'menu' }); }} /></Shell>;
  if (loadError) return <Shell><div className="flex flex-col items-center gap-4 px-4 py-24 text-center"><p className="font-bold">ما قدرنا نحمّل المنيو. تأكد من الإنترنت.</p><Button onClick={load}>جرّب مرة ثانية</Button></div></Shell>;
  if (!store) return <Shell><MenuSkeleton /></Shell>;

  const s = store.settings;
  const open = hoursOpen(s);
  const canOrder = s.enabled && open && !!branch && !branchPaused(branch);
  const closedNote = !s.enabled ? 'الطلب الأونلاين متوقف حالياً. تقدر تتصفح المنيو.'
    : !open ? `الطلب الأونلاين من ${hourLabel(s.open_time)} لـ ${hourLabel(s.last_order_time)}.`
    : branchPaused(branch) ? 'هالفرع موقّف الطلبات شوي. جرّب فرع ثاني.' : '';

  if (!branch || (!picked && view.name === 'menu')) return (
    <Shell><div className="mx-auto max-w-lg px-4 pt-5 pb-10">
      <h1 className="mb-1 font-display text-3xl">أهلين 👋</h1>
      <p className="mb-6 text-soft">اختار طريقة الاستلام والفرع، وبعدين اطلب من المنيو. الدفع عند الاستلام.</p>
      <RecentOrderBar onOpen={token => go({ name: 'track', token })} onRepeat={setReorder} />
      <BranchPicker branches={store.branches} places={store.content.branches} branchId={branchId} mode={mode}
        onDone={(b, m) => {
          setBranchId(b); setMode(m); setPicked(true);
        }} />
    </div></Shell>
  );

  if (view.name === 'checkout' && cart.count > 0) return (
    <Shell>
      <Checkout cart={cart} branchId={branch.id} branchName={branch.name} mode={mode} onModeChange={setMode} contactPhone={s.phone} requireOtp={!!s.require_otp} zones={s.zones_enabled ? store.zones.filter(z => z.branch_id === branch.id) : []}
        onBack={() => history.back()}
        onUnavailable={() => reloadAvailability().then(u => setStore(st => st && { ...st, unavailable: u }))}
        onPlaced={token => { cart.clear(); go({ name: 'track', token }, true); }} onTrack={token => go({ name: 'track', token })} />
    </Shell>
  );

  const openItem = (item: Item, cat: Category) => {
    if (!canOrder) return toast(closedNote);
    setSheet({ item, cat });
  };
  const quickAdd = (item: Item, cat: Category) => {
    if (!canOrder) return toast(closedNote);
    cart.add({ item_id: item.id, name: item.name, price: item.price, image: item.image || cat.image, qty: 1, options: [], note: '' });
    toast.success(`انضاف ${item.name}`, { duration: 1500 });
  };

  return (
    <Shell wide header={<BranchChip label={`${mode === 'pickup' ? 'استلام' : 'توصيل'} · ${branch.name.replace('فرع ', '')}`} onClick={() => setPickerOpen(true)} />}>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:px-6">
        <div className="min-w-0">
          <div className="px-4 pt-3 lg:px-0"><RecentOrderBar onOpen={token => go({ name: 'track', token })} onRepeat={setReorder} />{lastOrder() && <InstallPrompt className="mb-4" />}</div>
          <Hero slogan={store.content.brand.slogan} note={closedNote || `مفتوح للطلب لحد ${hourLabel(s.last_order_time)}`} open={!closedNote}
            where={`${mode === 'pickup' ? 'استلام من' : 'توصيل من'} ${branch.name}`} onChange={() => setPickerOpen(true)} />
          <Menu categories={categories} unavailable={unavailable} onOpen={openItem} onQuickAdd={quickAdd} />
        </div>
        <div className="hidden pt-4 lg:block">
          <CartPanel cart={cart} delivery={mode === 'delivery'} unavailable={unavailable} suggestions={suggestions} onSuggest={addSuggestion}
            onCheckout={() => { if (!canOrder) return toast(closedNote); go({ name: 'checkout' }); }} />
        </div>
      </div>

      {cart.count > 0 && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 px-4 pt-2 lg:hidden">
          <button key={cart.count} onClick={() => setCartOpen(true)}
            className="mx-auto flex h-16 w-full max-w-lg animate-[bump_0.35s_ease-out] items-center justify-between rounded-3xl bg-brand-deep px-5 text-white shadow-[0_12px_30px_rgb(178_16_23/0.35)] active:scale-[0.99]">
            <span className="flex items-center gap-3 font-bold">
              <span className="relative"><ShoppingBag size={24} /><span className="num absolute -top-2 -end-2 grid size-5 place-items-center rounded-full bg-mustard text-xs text-ink">{cart.count}</span></span>
              عرض السلة
            </span>
            <span className="num text-lg font-bold">{money(cart.total)} د.أ</span>
          </button>
        </div>
      )}

      <ItemSheet item={sheet?.item ?? null} category={sheet?.cat ?? null}
        addons={sheet ? addonsFor(sheet.cat, store.content, s) : { sauces: [], cheese: null }} unavailable={unavailable}
        onClose={() => setSheet(null)}
        onAdd={(qty, options, note) => {
          if (!sheet) return;
          cart.add({ item_id: sheet.item.id, name: sheet.item.name, price: sheet.item.price, image: sheet.item.image || sheet.cat.image, qty, options, note: note.trim() });
          toast.success(`انضاف ${sheet.item.name}`, { duration: 1500 });
          setSheet(null);
        }} />
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} cart={cart} delivery={mode === 'delivery'} unavailable={unavailable} suggestions={suggestions} onSuggest={addSuggestion}
        onCheckout={() => { if (!canOrder) return toast(closedNote); setCartOpen(false); go({ name: 'checkout' }); }} />
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen} title="الفرع وطريقة الاستلام">
        <BranchPicker branches={store.branches} places={store.content.branches} branchId={branchId} mode={mode}
          onDone={(b, m) => { setBranchId(b); setMode(m); setPickerOpen(false); }} />
      </Sheet>
    </Shell>
  );
}

function Shell({ children, header, wide }: { children: React.ReactNode; header?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-dvh">
      <header className="bg-brand px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 lg:px-6">
        <div className={cn('mx-auto flex items-center justify-between gap-3', wide ? 'max-w-6xl' : 'max-w-lg lg:max-w-5xl')}>
          <a href="/" className="flex shrink-0 items-center gap-2" aria-label="بروستد عالطريق، الصفحة الرئيسية">
            <img src="/img/logo-sm.png" alt="" className="h-11 w-auto drop-shadow" />
            <span className="font-display text-xl leading-none text-white">اطلب أونلاين</span>
          </a>
          {header}
        </div>
      </header>
      <div className="h-2.5 bg-[repeating-conic-gradient(var(--color-asphalt)_0_25%,#fff_0_50%)] bg-[length:10px_10px]" aria-hidden />
      <main className={cn('mx-auto', wide ? 'max-w-lg lg:max-w-6xl' : 'max-w-lg lg:max-w-5xl')}>{children}</main>
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 pt-4" aria-label="عم نحمّل المنيو">
      <div className="h-12 animate-pulse rounded-2xl bg-white" />
      <div className="flex gap-2">{[0, 1, 2].map(i => <div key={i} className="h-10 w-24 animate-pulse rounded-full bg-white" />)}</div>
      {[0, 1, 2, 3].map(i => <div key={i} className="h-32 animate-pulse rounded-3xl bg-white" />)}
    </div>
  );
}

// Brand banner: food photo, slogan, ordering status and where the order goes
function Hero({ slogan, note, open, where, onChange }: { slogan: string; note: string; open: boolean; where: string; onChange: () => void }) {
  return (
    <div className="px-4 pt-4 lg:px-0">
      <div className="relative overflow-hidden rounded-[28px] bg-asphalt text-white">
        <img src="/img/scene-12.webp" alt="" className="absolute inset-0 size-full object-cover object-[50%_40%]" />
        <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/50 to-black/5" />
        <div className="relative flex min-h-48 flex-col justify-end gap-3 p-5 lg:min-h-60 lg:p-8">
          <p className="font-display text-4xl leading-tight drop-shadow lg:text-6xl">{slogan}</p>
          <p className="flex items-center gap-2 text-sm font-bold" role="status">
            <span className={cn('size-2.5 rounded-full', open ? 'bg-emerald-400 shadow-[0_0_0_4px_rgb(52_211_153/0.25)]' : 'bg-mustard')} />{note}
          </p>
          <div className="flex flex-wrap gap-2 text-sm font-bold">
            <button onClick={onChange} className="h-9 rounded-full bg-white/15 px-3 backdrop-blur transition-colors hover:bg-white/25">{where} · غيّر</button>
            <span className="flex h-9 items-center rounded-full bg-mustard px-3 text-ink">الدفع عند الاستلام: كاش أو كليك</span>
          </div>
        </div>
        <div className="relative h-4 bg-asphalt" aria-hidden>
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-[repeating-linear-gradient(to_left,var(--color-mustard)_0_28px,transparent_28px_48px)]" />
        </div>
      </div>
    </div>
  );
}

// a recent order from this device: one tap back to its tracking page; an older one: order it again
function RecentOrderBar({ onOpen, onRepeat }: { onOpen: (token: string) => void; onRepeat: (token: string) => void }) {
  const o = latestOrder();
  const last = o ? null : lastOrder();
  const cls = 'mb-4 flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-start font-bold shadow-[0_0_0_2px_var(--color-mustard)]';
  if (o) return (
    <button onClick={() => onOpen(o.token)} className={cls}>
      <span>عندك طلب <span className="num">#{o.number}</span>. تابع حالته</span>
      <span aria-hidden>←</span>
    </button>
  );
  if (last?.lines?.length) return (
    <button onClick={() => onRepeat(last.token)} className={cls}>
      <span>اطلب طلبك الأخير مرة ثانية</span>
      <span aria-hidden>↻</span>
    </button>
  );
  return null;
}
