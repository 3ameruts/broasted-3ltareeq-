import { useEffect, useState } from 'react';
import { Check, Flame, Minus, Plus } from 'lucide-react';
import type { Category, Item } from '../../lib/types';
import type { CartOption } from '../cart';
import type { Spice } from '../spice';
import { imgUrl, money } from '../data';
import { Sheet } from '../ui/drawer';
import { Button } from '../ui/button';
import { Textarea } from '../ui/field';
import { Stepper } from '../ui/stepper';
import { cn } from '../ui/cn';

export type Addons = { sauces: Item[]; cheese: Item | null };

// Item details: hot or regular (or split for big meals), sauces (each +price), cheese slice for sandwiches, a note and the quantity
export function ItemSheet({ item, category, addons, unavailable, onClose, onAdd, askSpice, split }: {
  item: Item | null; category: Category | null; addons: Addons; unavailable: (id: string) => boolean;
  onClose: () => void; onAdd: (qty: number, options: CartOption[], note: string, spice?: Spice, hot?: number) => void; askSpice?: boolean;
  split?: { pieces: number; step: number } | null;
}) {
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const [spice, setSpice] = useState<Spice | null>(null);
  const [needSpice, setNeedSpice] = useState(false);
  const [hot, setHot] = useState(0);
  useEffect(() => { if (item) { setQty(1); setPicked({}); setNote(''); setSpice(null); setNeedSpice(false); setHot(0); } }, [item]);
  // a split starts at half (rounded to the step), so 12 broasted → 8 hot + 4 regular is one tap away
  const startSplit = () => { if (!split) return; setSpice('mixed'); setNeedSpice(false); setHot(h => h || Math.max(split.step, Math.round(split.pieces / 2 / split.step) * split.step)); };

  const extras = [...(addons.cheese ? [addons.cheese] : []), ...addons.sauces];
  const options: CartOption[] = extras.filter(e => picked[e.id]).map(e => ({ id: e.id, name: e.name, price: e.price, qty: 1 }));
  const unit = (item?.price ?? 0) + options.reduce((s, o) => s + o.price, 0);
  const img = imgUrl(item?.image || category?.image);
  const toggle = (id: string) => setPicked(p => ({ ...p, [id]: !p[id] }));

  return (
    <Sheet open={!!item} onOpenChange={o => !o && onClose()} title={item?.name ?? ''}
      footer={item && (
        <div className="flex items-center gap-3">
          <Stepper value={qty} onChange={setQty} label="الكمية" />
          <Button size="lg" className="flex-1 justify-between whitespace-nowrap" onClick={() => {
            if (askSpice && !spice) { setNeedSpice(true); document.getElementById('spice-choice')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
            onAdd(qty, options, note, askSpice ? spice! : undefined, askSpice && spice === 'mixed' ? hot : undefined);
          }}>
            <span>أضف للسلة</span><span className="num">{money(unit * qty)}</span>
          </Button>
        </div>
      )}>
      {item && (
        <div className="flex flex-col gap-5">
          {img && (
            <div className="-mx-1 overflow-hidden rounded-3xl bg-white">
              <img src={img} alt="" className="aspect-[4/3] w-full object-contain" />
            </div>
          )}
          <div>
            <p className="num text-2xl font-bold text-brand-deep">{money(item.price)} <span className="text-base text-soft">د.أ</span></p>
            {item.contents && <p className="mt-1 leading-relaxed text-soft">{item.contents}</p>}
          </div>

          {askSpice && (
            <div id="spice-choice" className="flex flex-col gap-2">
              <p className={cn('flex items-center gap-2 font-bold', needSpice && 'text-brand-deep')}>
                عادي ولا حار؟ <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">إجباري</span>
                {needSpice && <span className="text-sm">اختار عشان تكمّل</span>}
              </p>
              <div className={cn('grid gap-2 rounded-2xl', split ? 'grid-cols-3' : 'grid-cols-2', needSpice && 'shadow-[0_0_0_2px_var(--color-brand)]')} role="radiogroup" aria-label="عادي ولا حار">
                {([['regular', split ? 'كله عادي' : 'عادي'], ['hot', split ? 'كله حار 🌶️' : 'حار 🌶️'], ...(split ? [['mixed', 'قسّمها']] as const : [])] as const).map(([v, l]) => (
                  <button key={v} role="radio" aria-checked={spice === v} onClick={() => (v === 'mixed' ? startSplit() : (setSpice(v), setNeedSpice(false)))}
                    className={cn('h-13 rounded-2xl border-2 bg-white px-1 font-bold', split ? 'text-base' : 'text-lg', spice === v ? 'border-brand-deep text-brand-deep' : 'border-line')}>{l}</button>
                ))}
              </div>
              {split && spice === 'mixed' && <SplitPicker pieces={split.pieces} step={split.step} hot={hot} onChange={setHot} perMeal={qty > 1} />}
            </div>
          )}
          {addons.cheese && (
            <OptionGroup title="زيادة على الساندويش">
              <OptionRow item={addons.cheese} on={!!picked[addons.cheese.id]} disabled={unavailable(addons.cheese.id)} onToggle={() => toggle(addons.cheese!.id)} />
            </OptionGroup>
          )}
          {addons.sauces.length > 0 && (
            <OptionGroup title="صوصات" hint={`كل صوص بـ ${money(addons.sauces[0].price)} د.أ`}>
              {addons.sauces.map(s => <OptionRow key={s.id} item={s} on={!!picked[s.id]} disabled={unavailable(s.id)} onToggle={() => toggle(s.id)} />)}
            </OptionGroup>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="item-note" className="text-sm font-bold">ملاحظة <span className="font-normal text-soft">(اختياري)</span></label>
            <Textarea id="item-note" maxLength={120} value={note} onChange={e => setNote(e.target.value)} placeholder="مثلاً: بدون مخلل" />
          </div>
        </div>
      )}
    </Sheet>
  );
}

function OptionGroup({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-bold">
        {title}{hint && <span className="font-normal text-soft">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function OptionRow({ item, on, disabled, onToggle }: { item: Item; on: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button role="checkbox" aria-checked={on} disabled={disabled} onClick={onToggle}
      className={cn('flex min-h-13 items-center gap-3 rounded-2xl border-2 bg-white px-4 text-start transition-colors active:scale-[0.99] disabled:opacity-45',
        on ? 'border-brand-deep' : 'border-line')}>
      <span className={cn('grid size-6 shrink-0 place-items-center rounded-lg border-2', on ? 'border-brand-deep bg-brand-deep text-white' : 'border-ink/25')}>
        {on && <Check size={16} strokeWidth={3} />}
      </span>
      <span className="flex-1 font-semibold">{item.name}</span>
      <span className="text-sm text-soft">{disabled ? 'خلص' : <>+<span className="num">{money(item.price)}</span></>}</span>
    </button>
  );
}

// split a big meal: a row of pieces (red = hot) and a stepper; broasted moves by 4, tender by 1
function SplitPicker({ pieces, step, hot, onChange, perMeal }: { pieces: number; step: number; hot: number; onChange: (n: number) => void; perMeal: boolean }) {
  const min = step, max = pieces - step, set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n / step) * step)));
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_0_0_2px_var(--color-line)]">
      <div className="flex flex-wrap justify-center gap-1.5" aria-hidden>
        {Array.from({ length: pieces }, (_, i) => (
          <span key={i} className={cn('size-5 rounded-full transition-colors duration-200', i < hot ? 'bg-brand shadow-[0_0_0_2px_rgb(178_16_23/0.25)]' : 'bg-mustard/70', step > 1 && i % step === 0 && i > 0 && 'ms-1.5')} />
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="text-center">
          <p className="num text-3xl font-bold text-brand-deep">{hot}</p>
          <p className="flex items-center justify-center gap-1 text-sm font-bold text-brand-deep"><Flame size={14} /> حار</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="grid size-11 place-items-center rounded-full bg-brand text-white disabled:opacity-40" aria-label="حار أكثر" disabled={hot >= max} onClick={() => set(hot + step)}><Plus size={18} /></button>
          <button className="grid size-11 place-items-center rounded-full bg-paper shadow-[0_0_0_2px_var(--color-line)] disabled:opacity-40" aria-label="حار أقل" disabled={hot <= min} onClick={() => set(hot - step)}><Minus size={18} /></button>
        </div>
        <div className="text-center">
          <p className="num text-3xl font-bold">{pieces - hot}</p>
          <p className="text-sm font-bold text-soft">عادي</p>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={hot} onChange={e => set(Number(e.target.value))} dir="rtl"
        aria-label="عدد القطع الحار" className="w-full accent-[var(--color-brand)]" />
      <p className="text-center text-xs text-soft">{step > 1 ? `بالبروستد التقسيم كل ${step} قطع` : 'اختار أي عدد'}{perMeal ? '، وهالتقسيم لكل وجبة' : ''}</p>
    </div>
  );
}
