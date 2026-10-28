import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import type { Category, Item } from '../../lib/types';
import { imgUrl, money } from '../data';
import { cn } from '../ui/cn';

// Menu: search, sticky category tabs that follow the scroll, and item cards with a quick "+"
export function Menu({ categories, unavailable, onOpen, onQuickAdd }: {
  categories: Category[]; unavailable: (id: string) => boolean;
  onOpen: (item: Item, cat: Category) => void; onQuickAdd: (item: Item, cat: Category) => void;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(categories[0]?.id);
  const tabsRef = useRef<HTMLDivElement>(null);
  const query = q.trim();

  const shown = useMemo(() => {
    if (!query) return categories;
    return categories.map(c => ({ ...c, items: c.items.filter(i => i.name.includes(query) || (i.contents ?? '').includes(query)) })).filter(c => c.items.length);
  }, [categories, query]);

  // highlight the tab of the section in view
  useEffect(() => {
    if (query) return;
    const io = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id.replace('cat-', ''));
    }, { rootMargin: '-140px 0px -60% 0px' });
    categories.forEach(c => { const el = document.getElementById('cat-' + c.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [categories, query]);
  useEffect(() => {
    tabsRef.current?.querySelector(`[data-cat="${active}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [active]);

  return (
    <div>
      <div className="sticky top-0 z-20 bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
        <div className="px-4 pt-3">
          <label className="relative block">
            <span className="sr-only">دوّر على صنف</span>
            <Search className="pointer-events-none absolute inset-y-0 start-4 my-auto text-soft" size={20} />
            <input value={q} onChange={e => setQ(e.target.value)} type="search" enterKeyHint="search" placeholder="دوّر على صنف…"
              className="h-12 w-full rounded-2xl border-2 border-line bg-white ps-12 pe-12 text-base outline-none focus:border-asphalt" />
            {q && <button onClick={() => setQ('')} className="absolute inset-y-0 end-1 my-auto grid size-10 place-items-center rounded-full text-soft" aria-label="امسح البحث"><X size={18} /></button>}
          </label>
        </div>
        {!query && (
          <div ref={tabsRef} className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3" role="tablist" aria-label="الأقسام">
            {categories.map(c => (
              <a key={c.id} href={'#cat-' + c.id} data-cat={c.id} role="tab" aria-selected={active === c.id} onClick={() => setActive(c.id)}
                className={cn('flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors',
                  active === c.id ? 'bg-asphalt text-white' : 'bg-white text-ink shadow-[0_0_0_2px_var(--color-line)]')}>
                {c.name}
              </a>
            ))}
          </div>
        )}
      </div>

      {shown.length === 0 && <p className="px-4 py-16 text-center text-soft">ما لقينا «{query}». جرّب كلمة ثانية.</p>}

      {shown.map(c => (
        <section key={c.id} id={'cat-' + c.id} className="scroll-mt-32 px-4 pt-4">
          <h2 className="font-display text-2xl text-ink">{c.name}</h2>
          {c.note && <p className="mt-1 inline-block rounded-full bg-mustard px-3 py-1 text-sm font-bold">{c.note}</p>}
          <ul className="mt-3 flex flex-col gap-3">
            {c.items.map(i => {
              const out = unavailable(i.id);
              const img = imgUrl(i.image);
              return (
                <li key={i.id}>
                  <div className={cn('relative flex items-stretch gap-3 rounded-3xl bg-white p-3 shadow-[0_0_0_2px_var(--color-line)]', out && 'opacity-55')}>
                    <button className="absolute inset-0 rounded-3xl" onClick={() => !out && onOpen(i, c)} disabled={out} aria-label={`${i.name}، التفاصيل`} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
                      <h3 className="font-bold leading-snug">{i.name}</h3>
                      {i.contents && <p className="line-clamp-2 text-sm leading-relaxed text-soft">{i.contents}</p>}
                      <p className="mt-auto pt-1 font-bold text-brand-deep">
                        {out ? <span className="text-ink">غير متوفر حالياً بهالفرع</span> : <><span className="num">{money(i.price)}</span> <span className="text-sm text-soft">د.أ</span></>}
                      </p>
                    </div>
                    {img && <img src={img} alt="" loading="lazy" className="h-24 w-28 shrink-0 self-center rounded-2xl bg-paper object-contain" />}
                    {!out && (
                      <button onClick={() => onQuickAdd(i, c)} aria-label={`أضف ${i.name}`}
                        className="absolute bottom-2 end-2 z-10 grid size-11 place-items-center rounded-full bg-mustard text-ink shadow-[0_0_0_3px_#fff] active:scale-90">
                        <Plus size={22} strokeWidth={2.6} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className="h-32" aria-hidden />
    </div>
  );
}

export const BranchChip = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex h-11 max-w-full items-center gap-1 rounded-full bg-white/15 px-4 text-sm font-bold text-white active:scale-[0.98]">
    <span className="truncate">{label}</span><ChevronDown size={16} />
  </button>
);
