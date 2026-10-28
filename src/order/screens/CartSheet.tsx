import { ShoppingBag } from 'lucide-react';
import { lineTotal, type Cart } from '../cart';
import { money } from '../data';
import { Sheet } from '../ui/drawer';
import { Button } from '../ui/button';
import { Stepper } from '../ui/stepper';

export function CartSheet({ open, onOpenChange, cart, delivery, unavailable, onCheckout }: {
  open: boolean; onOpenChange: (o: boolean) => void; cart: Cart; delivery: boolean; unavailable: (itemId: string) => boolean; onCheckout: () => void;
}) {
  const blocked = cart.lines.some(l => unavailable(l.item_id) || l.options.some(o => unavailable(o.id)));
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="سلتك"
      footer={cart.count > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="font-bold">المجموع</span>
            <span className="num text-xl font-bold">{money(cart.total)} <span className="text-sm text-soft">د.أ</span></span>
          </div>
          {delivery && <p className="text-sm text-soft">+ التوصيل حسب المنطقة، بيحكيلك ياه الفرع.</p>}
          {blocked && <p className="text-sm font-semibold text-brand-deep" role="alert">شيل الأصناف اللي خلصت عشان تكمل.</p>}
          <Button size="lg" className="w-full" disabled={blocked} onClick={onCheckout}>كمّل الطلب</Button>
        </div>
      )}>
      {cart.count === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-soft">
          <ShoppingBag size={44} strokeWidth={1.6} />
          <p className="font-semibold">سلتك فاضية</p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>شوف المنيو</Button>
        </div>
      ) : (
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
      )}
    </Sheet>
  );
}
