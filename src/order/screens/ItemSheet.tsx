import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { Category, Item } from '../../lib/types';
import type { CartOption } from '../cart';
import { imgUrl, money } from '../data';
import { Sheet } from '../ui/drawer';
import { Button } from '../ui/button';
import { Textarea } from '../ui/field';
import { Stepper } from '../ui/stepper';
import { cn } from '../ui/cn';

export type Addons = { sauces: Item[]; cheese: Item | null };

// Item details: sauces (each +price), cheese slice for sandwiches, a note and the quantity
export function ItemSheet({ item, category, addons, unavailable, onClose, onAdd }: {
  item: Item | null; category: Category | null; addons: Addons; unavailable: (id: string) => boolean;
  onClose: () => void; onAdd: (qty: number, options: CartOption[], note: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  useEffect(() => { if (item) { setQty(1); setPicked({}); setNote(''); } }, [item]);

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
          <Button size="lg" className="flex-1 justify-between whitespace-nowrap" onClick={() => onAdd(qty, options, note)}>
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
