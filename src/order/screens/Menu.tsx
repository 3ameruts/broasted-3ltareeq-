import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import type { Category, Item } from '../../lib/types';
import { imgUrl, money } from '../data';
import { cn } from '../ui/cn';

type Layout = 'photo' | 'list' | 'compact';
// Sandwiches (studio cutouts) get big photo cards; sides/sauces a compact grid; the rest a list with a photo
const layoutOf = (c: Category): Layout =>
  c.id === 'sides' || c.id === 'sauces' ? 'compact' : c.items.filter(i => i.image).length >= c.items.length * 0.7 ? 'photo' : 'list';
const thumbOf = (c: Category) => imgUrl(c.image || c.items.find(i => i.image)?.image);

type Props = { categories: Category[]; unavailable: (id: string) => boolean; onOpen: (item: Item, cat: Category) => void; onQuickAdd: (item: Item, cat: Category) => void; best?: string[] };

// Menu: search, sticky category tabs that follow the scroll, and item cards with a quick "+"
export function Menu({ categories, unavailable, onOpen, onQuickAdd, best = [] }: Props) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(categories[0]?.id);
  const tabsRef = useRef<HTMLDivElement>(null);
  const query = q.trim();

  const shown = useMemo(() => {
    if (!query) return categories;
    return categories.map(c => ({ ...c, items: c.items.filter(i => i.name.includes(query) || (i.contents ?? '').includes(query)) })).filter(c => c.items.length);
  }, [categories, query]);

  useEffect(() => {
    if (query) return;
    const io = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id.replace('cat-', ''));
    }, { rootMargin: '-150px 0px -60% 0px' });
    categories.forEach(c => { const el = document.getElementById('cat-' + c.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [categories, query]);
  useEffect(() => {
    const tabs = tabsRef.current, tab = tabs?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    if (tabs && tab) tabs.scrollTo({ left: tab.offsetLeft - tabs.clientWidth / 2 + tab.clientWidth / 2, behavior: 'smooth' });
  }, [active]);

  return (
    <div>
      <div className="sticky top-0 z-20 bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
        <div className="px-4 pt-3 lg:px-0">
          <label className="relative block">
            <span className="sr-only">دوّر على صنف</span>
            <Search className="pointer-events-none absolute inset-y-0 start-4 my-auto text-soft" size={20} />
            <input value={q} onChange={e => setQ(e.target.value)} type="search" enterKeyHint="search" placeholder="دوّر على صنف…"
              className="h-12 w-full rounded-2xl border-2 border-line bg-white ps-12 pe-12 text-base outline-none focus:border-asphalt" />
            {q && <button onClick={() => setQ('')} className="absolute inset-y-0 end-1 my-auto grid size-10 place-items-center rounded-full text-soft" aria-label="امسح البحث"><X size={18} /></button>}
          </label>
        </div>
        {!query && (
          <div ref={tabsRef} className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3 lg:px-0" role="tablist" aria-label="الأقسام">
            {categories.map(c => {
              const t = thumbOf(c);
              return (
                <a key={c.id} href={'#cat-' + c.id} data-cat={c.id} role="tab" aria-selected={active === c.id} onClick={() => setActive(c.id)}
                  className={cn('flex h-11 shrink-0 items-center gap-2 rounded-full ps-1.5 pe-4 text-sm font-bold whitespace-nowrap transition-colors',
                    !t && 'ps-4', active === c.id ? 'bg-asphalt text-white' : 'bg-white text-ink shadow-[0_0_0_2px_var(--color-line)]')}>
                  {t && <img src={t} alt="" className="size-8 rounded-full bg-paper object-cover" />}{c.name}
                </a>
              );
            })}
          </div>
        )}
      </div>

      {shown.length === 0 && <p className="px-4 py-16 text-center text-soft">ما لقينا «{query}». جرّب كلمة ثانية.</p>}

      {shown.map(c => {
        const layout = layoutOf(c);
        return (
          <section key={c.id} id={'cat-' + c.id} className="scroll-mt-36 px-4 pt-6 lg:px-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="font-display text-3xl leading-tight text-ink">{c.name}</h2>
              {c.note && <p className="rounded-full bg-mustard px-3 py-1 text-sm font-bold">{c.note}</p>}
            </div>
            <ul className={cn('mt-3 grid gap-3',
              layout === 'photo' ? 'grid-cols-2 sm:grid-cols-3' : layout === 'compact' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2')}>
              {c.items.map(i => {
                const p = { item: i, cat: c, out: unavailable(i.id), hot: best.includes(i.id), onOpen, onQuickAdd };
                return <li key={i.id}>{layout === 'photo' ? <PhotoCard {...p} /> : layout === 'compact' ? <CompactCard {...p} /> : <ListCard {...p} />}</li>;
              })}
            </ul>
          </section>
        );
      })}
      <div className="h-32 lg:h-16" aria-hidden />
    </div>
  );
}

type CardProps = { item: Item; cat: Category; out: boolean; hot?: boolean; onOpen: Props['onOpen']; onQuickAdd: Props['onQuickAdd'] };
const Hot = () => <span className="inline-flex items-center gap-0.5 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">🔥 الأكثر طلباً</span>;

const AddButton = ({ item, cat, onQuickAdd, className }: Pick<CardProps, 'item' | 'cat' | 'onQuickAdd'> & { className?: string }) => (
  <button onClick={() => onQuickAdd(item, cat)} aria-label={`أضف ${item.name}`}
    className={cn('z-10 grid size-11 shrink-0 place-items-center rounded-full bg-mustard text-ink shadow-[0_0_0_3px_#fff] transition-transform active:scale-90', className)}>
    <Plus size={22} strokeWidth={2.6} />
  </button>
);
const Price = ({ item, out }: { item: Item; out: boolean }) =>
  out ? <span className="text-sm font-bold text-ink">غير متوفر حالياً</span>
    : <span className="font-bold text-brand-deep"><span className="num">{money(item.price)}</span> <span className="text-sm text-soft">د.أ</span></span>;
const OpenArea = ({ item, cat, out, onOpen }: Pick<CardProps, 'item' | 'cat' | 'out' | 'onOpen'>) =>
  <button className="absolute inset-0 rounded-[inherit]" onClick={() => !out && onOpen(item, cat)} disabled={out} aria-label={`${item.name}، التفاصيل`} />;

// photo first: the food sells itself
function PhotoCard({ item, cat, out, hot, onOpen, onQuickAdd }: CardProps) {
  return (
    <div className={cn('group relative flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-[0_0_0_2px_var(--color-line)] transition-shadow lg:hover:shadow-[0_0_0_2px_var(--color-asphalt)]', out && 'opacity-55')}>
      <OpenArea item={item} cat={cat} out={out} onOpen={onOpen} />
      <div className="pointer-events-none relative aspect-[4/3] bg-white">
        <img src={imgUrl(item.image)} alt="" loading="lazy" className="size-full object-contain p-2 transition-transform duration-300 lg:group-hover:scale-105" />
        {hot && !out && <span className="absolute top-2 start-2"><Hot /></span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3 pb-3">
        <h3 className="font-bold leading-snug">{item.name}</h3>
        {item.contents && <p className="line-clamp-2 text-xs leading-relaxed text-soft">{item.contents}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <Price item={item} out={out} />
          {!out && <AddButton item={item} cat={cat} onQuickAdd={onQuickAdd} />}
        </div>
      </div>
    </div>
  );
}

function ListCard({ item, cat, out, hot, onOpen, onQuickAdd }: CardProps) {
  const img = imgUrl(item.image || cat.image);
  return (
    <div className={cn('relative flex h-full items-stretch gap-3 rounded-3xl bg-white p-3 shadow-[0_0_0_2px_var(--color-line)] transition-shadow lg:hover:shadow-[0_0_0_2px_var(--color-asphalt)]', out && 'opacity-55')}>
      <OpenArea item={item} cat={cat} out={out} onOpen={onOpen} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
        {hot && !out && <Hot />}
        <h3 className="font-bold leading-snug">{item.name}</h3>
        {item.contents && <p className="line-clamp-2 text-sm leading-relaxed text-soft">{item.contents}</p>}
        <p className="mt-auto pt-1"><Price item={item} out={out} /></p>
      </div>
      <div className="relative shrink-0 self-center">
        {img ? <img src={img} alt="" loading="lazy" className={cn('pointer-events-none h-24 w-28 rounded-2xl bg-paper', item.image ? 'object-contain' : 'object-cover')} />
          : <div className="pointer-events-none grid h-24 w-28 place-items-center rounded-2xl bg-paper"><img src="/img/logo-sm.png" alt="" className="h-12 opacity-40 grayscale" /></div>}
        {!out && <AddButton item={item} cat={cat} onQuickAdd={onQuickAdd} className="absolute -bottom-2 -end-2" />}
      </div>
    </div>
  );
}

function CompactCard({ item, cat, out, hot, onOpen, onQuickAdd }: CardProps) {
  return (
    <div className={cn('relative flex h-full min-h-20 items-center gap-2 rounded-2xl bg-white ps-3 pe-2 py-2 shadow-[0_0_0_2px_var(--color-line)]', out && 'opacity-55')}>
      <OpenArea item={item} cat={cat} out={out} onOpen={onOpen} />
      <div className="min-w-0 flex-1">
        {hot && !out && <Hot />}
        <h3 className="text-sm font-bold leading-snug">{item.name}</h3>
        <Price item={item} out={out} />
      </div>
      {!out && <AddButton item={item} cat={cat} onQuickAdd={onQuickAdd} />}
    </div>
  );
}

export const BranchChip = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex h-11 max-w-full items-center gap-1 rounded-full bg-white/15 px-4 text-sm font-bold text-white transition-colors hover:bg-white/25 active:scale-[0.98]">
    <span className="truncate">{label}</span><ChevronDown size={16} />
  </button>
);
