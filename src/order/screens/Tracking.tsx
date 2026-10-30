import { useEffect, useState } from 'react';
import { Check, Copy, Phone, RotateCcw } from 'lucide-react';
import { getOrder, money, orderFor, splitLine, type Tracked } from '../data';
import { Button } from '../ui/button';
import { InstallPrompt } from './InstallPrompt';
import { cn } from '../ui/cn';

const STEPS = {
  pickup: ['وصل طلبك للفرع', 'عم يتحضّر', 'جاهز للاستلام', 'تم الاستلام'],
  delivery: ['وصل طلبك للفرع', 'عم يتحضّر', 'بالطريق إليك', 'تم التوصيل'],
};
// a printed order is already in the kitchen, so it counts as being prepared
const stepOf = (o: Tracked) => ({ new: o.printed_at ? 1 : 0, accepted: 1, ready: 2, delivered: 3, rejected: -1, no_show: -1 }[o.status]);

// Order status page (tracking link). Refreshes every 10 seconds until the order is finished.
export function Tracking({ token, onNewOrder, onReorder }: { token: string; onNewOrder: () => void; onReorder: () => void }) {
  const [o, setO] = useState<Tracked | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let stop = false; let timer = 0;
    const tick = async () => {
      try { const r = await getOrder(token); if (!stop) setO(r); if (r && ['delivered', 'rejected', 'no_show'].includes(r.status)) return; }
      catch { /* keep the last known state; try again */ }
      if (!stop) timer = window.setTimeout(tick, 10000);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [token]);

  if (o === undefined) return <p className="px-4 py-24 text-center text-soft">عم نجيب طلبك…</p>;
  if (o === null) return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="font-bold">ما لقينا هالطلب.</p>
      <Button onClick={onNewOrder}>اطلب من المنيو</Button>
    </div>
  );

  const step = stepOf(o);
  // not printed after 3 minutes: the branch printer may be off, so ask the customer to call
  const stuck = o.status === 'new' && !o.printed_at && Date.now() - new Date(o.created_at).getTime() > 3 * 60000;
  const steps = STEPS[o.type];
  const copy = async () => { try { await navigator.clipboard.writeText(o.cliq_alias ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ } };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-4 pb-16">
      <div className="rounded-3xl bg-asphalt p-5 text-white">
        <p className="text-sm text-white/70">رقم طلبك</p>
        <p className="font-display text-5xl leading-tight"><span className="num">{o.number}</span> <span className="text-2xl text-mustard">{o.code}</span></p>
        <p className="mt-1 text-white/80">{o.branch} · {o.type === 'pickup' ? 'استلام من الفرع' : 'توصيل'}</p>
      </div>

      {step < 0 ? (
        <div className="rounded-3xl bg-white p-5 shadow-[0_0_0_2px_var(--color-line)]" role="status">
          <p className="text-lg font-bold text-brand-deep">{o.status === 'rejected' ? 'للأسف ما قدرنا نجهّز طلبك' : 'انلغى الطلب'}</p>
          {o.reject_reason && <p className="mt-1 text-soft">{o.reject_reason}</p>}
        </div>
      ) : (
        <ol className="flex flex-col gap-0 rounded-3xl bg-white p-5 shadow-[0_0_0_2px_var(--color-line)]" aria-live="polite">
          {steps.map((label, i) => (
            <li key={label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cn('grid size-8 place-items-center rounded-full text-sm font-bold',
                  i < step || step === 3 ? 'bg-brand-deep text-white' : i === step ? 'bg-mustard text-ink ring-4 ring-mustard/30' : 'bg-paper text-soft')}>
                  {i < step || step === 3 ? <Check size={16} strokeWidth={3} /> : i + 1}
                </span>
                {i < steps.length - 1 && <span className={cn('my-1 w-0.5 flex-1', i < step ? 'bg-brand-deep' : 'bg-line')} />}
              </div>
              <p className={cn('pb-5 pt-1 font-bold', i > step && 'text-soft font-semibold')}>{label}</p>
            </li>
          ))}
        </ol>
      )}

      {stuck && (
        <div className="flex flex-col gap-3 rounded-3xl bg-mustard/30 p-5" role="alert">
          <p className="font-bold">الفرع ما استلم طلبك لسا. اتصل فينا نتأكد.</p>
          <a href={`tel:${o.contact_phone}`} className="num flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand-deep font-bold text-white"><Phone size={18} />{o.contact_phone}</a>
        </div>
      )}

      {o.pay_method === 'cliq' && o.cliq_alias && step >= 0 && (
        <div className="rounded-3xl bg-mustard/25 p-5">
          <p className="font-bold">الدفع كليك عند الاستلام</p>
          <p className="mt-1 text-sm text-soft">حوّل المبلغ كامل (مع التوصيل إذا في) على:</p>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3">
            <div><p className="num text-lg font-bold">{o.cliq_alias}</p>{o.cliq_name && <p className="text-sm text-soft">{o.cliq_name}</p>}</div>
            <Button variant="outline" size="sm" onClick={copy}><Copy size={16} />{copied ? 'انسخ ✓' : 'انسخ'}</Button>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-white p-5 shadow-[0_0_0_2px_var(--color-line)]">
        <ul className="flex flex-col gap-1 text-sm">
          {o.items.map((it, i) => {
            const { base, extras } = splitLine(it.line_total, it.qty, it.options);
            return (
              <li key={i}>
                <div className="flex justify-between gap-2">
                  <span><span className="num">{it.qty}×</span> {it.name}{it.note ? ` («${it.note}»)` : ''}</span><span className="num shrink-0">{money(base)}</span>
                </div>
                {extras.map((x, j) => (
                  <div key={j} className="flex justify-between gap-2 ps-5 text-soft">
                    <span>+ {x.name}{x.qty > 1 ? ` ×${x.qty}` : ''}</span><span className="num shrink-0">{money(x.total)}</span>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex justify-between border-t border-line pt-3 font-bold">
          <span>المجموع</span><span className="num">{money(o.subtotal)} د.أ</span>
        </div>
        <p className="mt-1 text-sm text-soft">الدفع عند الاستلام: {o.pay_method === 'cash' ? 'كاش' : 'كليك'}{o.type === 'delivery' ? ' · + التوصيل' : ''}</p>
      </div>

      {!!orderFor(token)?.lines?.length && ['delivered', 'accepted', 'ready'].includes(o.status) && (
        <Button size="lg" className="w-full" onClick={onReorder}><RotateCcw size={18} /> اطلب نفس الطلب مرة ثانية</Button>
      )}
      <div className="grid grid-cols-2 gap-3">
        <a href={`tel:${o.contact_phone}`} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white font-bold shadow-[0_0_0_2px_var(--color-line)]">
          <Phone size={18} /> اتصل فينا
        </a>
        <Button variant="accent" onClick={onNewOrder}><RotateCcw size={18} /> طلب جديد</Button>
      </div>
      <InstallPrompt />
      <p className="text-center text-sm text-soft">احفظ هالرابط عشان تتابع طلبك.</p>
    </div>
  );
}
