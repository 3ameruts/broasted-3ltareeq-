import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ShoppingBag } from 'lucide-react';
import type { Category, Item } from '../lib/types';
import { useCart, usePersisted } from './cart';
import { addonsFor, branchPaused, hourLabel, hoursOpen, isUnavailable, loadStore, money, reloadAvailability, reloadBranches, watchStore, type Store } from './data';
import { BranchPicker, type Mode } from './screens/BranchPicker';
import { BranchChip, Menu } from './screens/Menu';
import { ItemSheet } from './screens/ItemSheet';
import { CartSheet } from './screens/CartSheet';
import { Checkout } from './screens/Checkout';
import { Tracking } from './screens/Tracking';
import { Sheet } from './ui/drawer';
import { Button } from './ui/button';

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [sheet, setSheet] = useState<{ item: Item; cat: Category } | null>(null);
  const [, tick] = useState(0);
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

  if (view.name === 'track') return <Shell><Tracking token={view.token} onNewOrder={() => go({ name: 'menu' })} /></Shell>;
  if (loadError) return <Shell><div className="flex flex-col items-center gap-4 px-4 py-24 text-center"><p className="font-bold">ما قدرنا نحمّل المنيو. تأكد من الإنترنت.</p><Button onClick={load}>جرّب مرة ثانية</Button></div></Shell>;
  if (!store) return <Shell><MenuSkeleton /></Shell>;

  const s = store.settings;
  const open = hoursOpen(s);
  const canOrder = s.enabled && open && !!branch && !branchPaused(branch);
  const closedNote = !s.enabled ? 'الطلب الأونلاين متوقف حالياً. تقدر تتصفح المنيو.'
    : !open ? `الطلب الأونلاين من ${hourLabel(s.open_time)} لـ ${hourLabel(s.last_order_time)}.`
    : branchPaused(branch) ? 'هالفرع موقّف الطلبات شوي. جرّب فرع ثاني.' : '';

  if (!branch) return (
    <Shell><div className="mx-auto max-w-lg px-4 pt-5 pb-10">
      <h1 className="mb-1 font-display text-3xl">أهلاً فيك 👋</h1>
      <p className="mb-6 text-soft">اختار طريقة الاستلام والفرع، وبعدين اطلب من المنيو. الدفع عند الاستلام.</p>
      <BranchPicker branches={store.branches} places={store.content.branches} branchId={branchId} mode={mode}
        onDone={(b, m) => { setBranchId(b); setMode(m); }} />
    </div></Shell>
  );

  if (view.name === 'checkout' && cart.count > 0) return (
    <Shell>
      <Checkout cart={cart} branchId={branch.id} branchName={branch.name} mode={mode} onModeChange={setMode} contactPhone={s.phone}
        onBack={() => history.back()}
        onUnavailable={() => reloadAvailability().then(u => setStore(st => st && { ...st, unavailable: u }))}
        onPlaced={token => { cart.clear(); go({ name: 'track', token }, true); }} />
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
    <Shell header={<BranchChip label={`${mode === 'pickup' ? 'استلام' : 'توصيل'} · ${branch.name.replace('فرع ', '')}`} onClick={() => setPickerOpen(true)} />}>
      {closedNote && <p className="mx-4 mt-3 rounded-2xl bg-mustard/30 px-4 py-3 text-sm font-bold" role="status">{closedNote}</p>}
      <Menu categories={categories} unavailable={unavailable} onOpen={openItem} onQuickAdd={quickAdd} />

      {cart.count > 0 && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 px-4 pt-2">
          <button onClick={() => setCartOpen(true)}
            className="mx-auto flex h-16 w-full max-w-lg items-center justify-between rounded-3xl bg-brand-deep px-5 text-white shadow-[0_12px_30px_rgb(178_16_23/0.35)] active:scale-[0.99]">
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
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} cart={cart} delivery={mode === 'delivery'} unavailable={unavailable}
        onCheckout={() => { if (!canOrder) return toast(closedNote); setCartOpen(false); go({ name: 'checkout' }); }} />
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen} title="الفرع وطريقة الاستلام">
        <BranchPicker branches={store.branches} places={store.content.branches} branchId={branchId} mode={mode}
          onDone={(b, m) => { setBranchId(b); setMode(m); setPickerOpen(false); }} />
      </Sheet>
    </Shell>
  );
}

function Shell({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="bg-brand px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <a href="/" className="flex shrink-0 items-center gap-2" aria-label="بروستد عالطريق، الصفحة الرئيسية">
            <img src="/img/logo-sm.png" alt="" className="h-11 w-auto drop-shadow" />
            <span className="font-display text-xl leading-none text-white">اطلب أونلاين</span>
          </a>
          {header}
        </div>
      </header>
      <main className="mx-auto max-w-lg">{children}</main>
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
