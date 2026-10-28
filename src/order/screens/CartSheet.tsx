import { ShoppingBag } from 'lucide-react';
import { lineTotal, type Cart } from '../cart';
import { money } from '../data';
import { Sheet } from '../ui/drawer';
import { Button } from '../ui/button';
import { Stepper } from '../ui/stepper';

type Props = { cart: Cart; delivery: boolean; unavailable: (itemId: string) => boolean; onCheckout: () => void };
const blockedBy = (cart: Cart, unavailable: Props['unavailable']) => cart.lines.some(l => unavailable(l.item_id) || l.options.some(o => unavailable(o.id)));

function CartLines({ cart, unavailable, onEmpty }: Pick<Props, 'cart' | 'unavailable'> & { onEmpty?: () => void }) {
  if (cart.count === 0) return (
    <div className="flex flex-col items-center gap-3 py-12 text-center text-soft">
      <ShoppingBag size={44} strokeWidth={1.6} />
      <p className="font-semibold">سلتك فاضية</p>
      {onEmpty ? <Button variant="outline" onClick={onEmpty}>شوف المنيو</Button> : <p className="text-sm">اختار من المنيو وكبس +</p>}
    </div>
  );
  return (
    <ul className="flex flex-col divide-y divide-line">
      {cart.lines.map(l => {
        const out = unavailable(l.item_id) || l.options.some(o => unavailable(o.id));
        return (
          <li key={l.key} className="flex flex-col gap-2 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold">{l.name}</p>
                {l.options.length > 0 && <p className="text-sm text-soft">+ {l.options.map(o => o.name).join('، ')}</p>}
                {l.note && <p className="text-sm text-soft">«{l.note}»</p>}
                {out && <p className="text-sm font-bold text-brand-deep">خلص هسّا بهالفرع</p>}
              </div>
              <span className="num shrink-0 font-bold">{money(lineTotal(l))}</span>
            </div>
            <Stepper value={l.qty} onChange={q => cart.setQty(l.key, q)} onRemove={() => cart.remove(l.key)} label={`كمية ${l.name}`} />
          </li>
        );
      })}
    </ul>
  );
}

function CartFooter({ cart, delivery, unavailable, onCheckout }: Props) {
  const blocked = blockedBy(cart, unavailable);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-bold">المجموع</span>
        <span className="num text-xl font-bold">{money(cart.total)} <span className="text-sm text-soft">د.أ</span></span>
      </div>
      {delivery && <p className="text-sm text-soft">+ التوصيل حسب المنطقة، بيحكيلك ياه الفرع.</p>}
      {blocked && <p className="text-sm font-semibold text-brand-deep" role="alert">شيل الأصناف اللي خلصت عشان تكمل.</p>}
      <Button size="lg" className="w-full" disabled={blocked} onClick={onCheckout}>كمّل الطلب</Button>
    </div>
  );
}

// Phones: bottom sheet
export function CartSheet({ open, onOpenChange, ...p }: Props & { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="سلتك" footer={p.cart.count > 0 && <CartFooter {...p} />}>
      <CartLines cart={p.cart} unavailable={p.unavailable} onEmpty={() => onOpenChange(false)} />
    </Sheet>
  );
}

// Desktop: always visible next to the menu
export function CartPanel(p: Props) {
  return (
    <aside className="sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_0_0_2px_var(--color-line)]" aria-label="سلتك">
      <div className="h-3 shrink-0 bg-[repeating-conic-gradient(var(--color-asphalt)_0_25%,#fff_0_50%)] bg-[length:12px_12px]" aria-hidden />
      <h2 className="px-5 pt-4 font-display text-2xl">سلتك {p.cart.count > 0 && <span className="num text-base text-soft">({p.cart.count})</span>}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        <CartLines cart={p.cart} unavailable={p.unavailable} />
      </div>
      {p.cart.count > 0 && <div className="border-t border-line p-5"><CartFooter {...p} /></div>}
    </aside>
  );
}
