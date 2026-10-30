import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Banknote, LocateFixed, MapPin, Smartphone } from 'lucide-react';
import { usePersisted, type Cart } from '../cart';
import { createOrder, deviceFor, ERRORS, latestOrder, money, normPhone, rememberDevice, rememberOrder, type OrderPayload, type Zone } from '../data';
import { PhoneCheck } from './PhoneCheck';
import { ZonePicker } from './ZonePicker';
import type { Mode } from './BranchPicker';
import { Button } from '../ui/button';
import { Field, Input, Textarea } from '../ui/field';
import { cn } from '../ui/cn';

type Customer = { name: string; phone: string; area: string; street: string; building: string; floor: string; landmark: string };
const EMPTY: Customer = { name: '', phone: '', area: '', street: '', building: '', floor: '', landmark: '' };
const ATTEMPT = 'broasted-order-attempt-v1';
const phoneOk = (p: string) => /^07[789]\d{7}$/.test(p.replace(/\D/g, '').replace(/^(00962|962)/, '0').replace(/^7/, '07'));

// Checkout: details, address (manual, location optional), pay at receipt. One idempotency key per attempt,
// kept until the order is confirmed, so a double tap or a retry after a dropped connection never makes two orders.
export function Checkout({ cart, branchId, branchName, mode, onModeChange, onBack, onPlaced, onTrack, onUnavailable, contactPhone, requireOtp, zones = [] }: {
  cart: Cart; branchId: string; branchName: string; mode: Mode; onModeChange: (m: Mode) => void; onBack: () => void;
  onPlaced: (token: string) => void; onTrack: (token: string) => void; onUnavailable: (names: string[]) => void; contactPhone: string; requireOtp?: boolean;
  zones?: Zone[];
}) {
  const [c, setC] = usePersisted<Customer>('broasted-order-customer-v1', EMPTY);
  const [note, setNote] = useState('');
  const [pay, setPay] = useState<'cash' | 'cliq'>('cash');
  const [change, setChange] = useState<number | null>(null);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locState, setLocState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [errors, setErrors] = useState<Partial<Record<keyof Customer, string>>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'checking' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [openToken, setOpenToken] = useState<string | null>(null);
  // delivery area from the branch's list (fee shown now), or «منطقتي مش بالقائمة» (fee by phone)
  const hasZones = mode === 'delivery' && zones.length > 0;
  const [zone, setZone] = useState<Zone | null>(() => zones.find(z => z.name === c.area) ?? null);
  const [notListed, setNotListed] = useState(false);
  const fee = hasZones && !notListed && zone ? zone.fee : null;
  const total = cart.total + (fee ?? 0);
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => { topRef.current?.scrollIntoView(); }, []);
  const set = (k: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement>) => setC(p => ({ ...p, [k]: e.target.value }));

  const shareLocation = () => {
    if (!('geolocation' in navigator)) return setLocState('error');
    setLocState('busy');
    navigator.geolocation.getCurrentPosition(p => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocState('idle'); },
      () => setLocState('error'), { enableHighAccuracy: true, timeout: 12000 });
  };

  const validate = () => {
    const e: typeof errors = {};
    if (c.name.trim().length < 2) e.name = 'اكتب اسمك.';
    if (!phoneOk(c.phone)) e.phone = 'رقم أردني، مثل 0791234567.';
    if (mode === 'delivery') {
      if (hasZones && !notListed) { if (!zone) e.area = 'اختار منطقتك من القائمة، أو كبس «منطقتي مش بالقائمة».'; }
      else if (!c.area.trim()) e.area = 'اكتب المنطقة أو الحي.';
      if (!c.street.trim()) e.street = 'اكتب الشارع.';
      if (!c.building.trim()) e.building = 'اكتب رقم أو اسم البناية.';
    }
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) document.getElementById('f-' + first)?.focus();
    return !first;
  };

  const submit = async () => {
    if (state === 'sending' || state === 'checking' || !validate()) return;
    // first order from this phone on this device: confirm it with a WhatsApp code
    if (requireOtp && !deviceFor(c.phone)) { setChecking(true); return; }
    let key = sessionStorage.getItem(ATTEMPT);
    if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(ATTEMPT, key); }
    const payload: OrderPayload = {
      idempotency_key: key, branch_id: branchId, type: mode, name: c.name.trim(), phone: c.phone, pay_method: pay,
      change_for: pay === 'cash' ? change : null, note: note.trim() || undefined,
      address: mode === 'delivery' ? { area: c.area, street: c.street, building: c.building, floor: c.floor, landmark: c.landmark } : undefined,
      location: mode === 'delivery' ? loc : null,
      device: requireOtp ? deviceFor(c.phone) : undefined,
      zone_id: fee !== null && zone ? zone.id : undefined,
      items: cart.lines.map(l => ({ item_id: l.item_id, qty: l.qty, note: l.note || undefined, options: l.options.map(o => ({ id: o.id, qty: o.qty })) })),
    };
    setMessage('');
    // retry the same key a few times if the connection drops; the database returns the same order if it already got it
    for (let attempt = 0; attempt < 3; attempt++) {
      setState(attempt ? 'checking' : 'sending');
      try {
        const r = await createOrder(payload);
        if (r.ok) {
          sessionStorage.removeItem(ATTEMPT);
          rememberOrder({ token: r.token, number: r.number, phone: normPhone(c.phone) ?? c.phone, at: Date.now(),
            lines: cart.lines.map(l => ({ item_id: l.item_id, qty: l.qty, note: l.note, options: l.options.map(o => ({ id: o.id, qty: o.qty })) })) });
          onPlaced(r.token); return;
        }
        sessionStorage.removeItem(ATTEMPT);
        setState('idle');
        setOpenToken(r.error === 'open_order' ? latestOrder(c.phone)?.token ?? null : null);
        if (r.error === 'verify_phone') { rememberDevice(c.phone, null); setChecking(true); }
        else if (r.error === 'unavailable') { onUnavailable(r.items ?? []); setMessage(`${ERRORS.unavailable} ${(r.items ?? []).join('، ')}`); }
        else if (r.error === 'bad_phone' || r.error === 'bad_name' || r.error === 'bad_address') { setMessage(ERRORS[r.error]); validate(); }
        else setMessage(ERRORS[r.error] ?? 'صار خطأ، جرّب مرة ثانية.');
        return;
      } catch {
        await new Promise(res => setTimeout(res, 1200 * (attempt + 1)));
      }
    }
    setState('failed');
    setMessage('ما قدرنا نتأكد إذا طلبك وصل بسبب الإنترنت. اكبس «جرّب مرة ثانية»، الطلب ما رح يتكرر.');
  };

  const busy = state === 'sending' || state === 'checking';
  const alert = message && <div className="text-sm font-semibold text-brand-deep" role="alert">{message}{(message === ERRORS.blocked || message === ERRORS.open_order) && <> <a className="num underline" href={`tel:${contactPhone}`}>{contactPhone}</a></>}
    {message === ERRORS.open_order && openToken && <Button variant="outline" className="mt-2 w-full" onClick={() => onTrack(openToken)}>شوف طلبك</Button>}</div>;
  const submitButton = (
    <Button size="lg" className="w-full" onClick={submit} disabled={busy || cart.count === 0} aria-busy={busy}>
      {state === 'sending' ? 'عم نبعت طلبك…' : state === 'checking' ? 'عم نتأكد من طلبك…' : state === 'failed' ? 'جرّب مرة ثانية'
        : <>تأكيد الطلب · <span className="num">{money(total)}</span> د.أ</>}
    </Button>
  );
  return (
    <div ref={topRef} className="mx-auto max-w-lg px-4 pt-3 pb-40 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10 lg:px-6 lg:pb-16">
    <div className="flex flex-col gap-6">
      <button onClick={onBack} className="flex h-11 items-center gap-2 self-start font-bold text-soft"><ArrowRight size={20} /> رجوع للمنيو</button>
      <h1 className="font-display text-3xl">كمّل طلبك</h1>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1 shadow-[0_0_0_2px_var(--color-line)]" role="radiogroup" aria-label="طريقة الاستلام">
        {([['pickup', 'استلام من الفرع'], ['delivery', 'توصيل']] as const).map(([v, l]) => (
          <button key={v} role="radio" aria-checked={mode === v} onClick={() => onModeChange(v)}
            className={cn('h-11 rounded-xl font-bold transition-colors', mode === v ? 'bg-asphalt text-white' : 'text-ink')}>{l}</button>
        ))}
      </div>
      <p className="-mt-3 text-sm text-soft">{mode === 'pickup' ? `من ${branchName}` : hasZones ? `التوصيل من ${branchName}.` : `التوصيل من ${branchName}. سعر التوصيل بيحددلك ياه الفرع لما يتصل يأكد.`}</p>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">معلوماتك</h2>
        <Field id="f-name" label="الاسم" error={errors.name}>
          <Input id="f-name" autoComplete="name" value={c.name} onChange={set('name')} invalid={!!errors.name} maxLength={60} />
        </Field>
        <Field id="f-phone" label="رقم الجوال" hint="الفرع ممكن يتصل يأكد الطلب." error={errors.phone}>
          <Input id="f-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" className="text-right" placeholder="07XXXXXXXX"
            value={c.phone} onChange={set('phone')} invalid={!!errors.phone} maxLength={16} />
        </Field>
      </section>

      {mode === 'delivery' && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">عنوان التوصيل</h2>
          {hasZones && (
            <button onClick={() => { setNotListed(!notListed); setZone(null); setC(p => ({ ...p, area: '' })); setErrors(e => ({ ...e, area: undefined })); }}
              className={cn('flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 px-4 font-bold', notListed ? 'border-brand-deep bg-brand/5 text-brand-deep' : 'border-line bg-white')}>
              {notListed ? '← رجوع لقائمة المناطق' : 'منطقتي مش بالقائمة'}
            </button>
          )}
          {hasZones && !notListed ? (
            <Field id="f-area" label="منطقتك" error={errors.area}>
              <ZonePicker zones={zones} value={zone} invalid={!!errors.area}
                onPick={z => { setZone(z); setC(p => ({ ...p, area: z?.name ?? '' })); if (z) setErrors(e => ({ ...e, area: undefined })); }} />
            </Field>
          ) : (
            <>
              <Field id="f-area" label="المنطقة أو الحي" error={errors.area}>
                <Input id="f-area" autoComplete="address-level3" value={c.area} onChange={set('area')} invalid={!!errors.area} maxLength={80} />
              </Field>
              {hasZones && <p className="-mt-2 rounded-2xl bg-mustard/25 px-3 py-2 text-sm font-semibold">سعر التوصيل لمنطقتك بيحكيلك ياه الكول سنتر لما يتصل يأكّد الطلب.</p>}
            </>
          )}
          <Field id="f-street" label="الشارع" error={errors.street}>
            <Input id="f-street" autoComplete="address-line1" value={c.street} onChange={set('street')} invalid={!!errors.street} maxLength={80} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="f-building" label="البناية" error={errors.building}>
              <Input id="f-building" value={c.building} onChange={set('building')} invalid={!!errors.building} maxLength={60} />
            </Field>
            <Field id="f-floor" label="الطابق والشقة" optional>
              <Input id="f-floor" value={c.floor} onChange={set('floor')} maxLength={40} />
            </Field>
          </div>
          <Field id="f-landmark" label="أقرب معلم" optional>
            <Input id="f-landmark" value={c.landmark} onChange={set('landmark')} maxLength={120} placeholder="مثلاً: جنب مسجد…" />
          </Field>
          <Button variant="outline" onClick={shareLocation} disabled={locState === 'busy'} className={cn(loc && 'border-brand-deep text-brand-deep')}>
            {loc ? <><MapPin size={18} /> تم إضافة موقعك</> : <><LocateFixed size={18} />{locState === 'busy' ? 'بندوّر…' : 'أضف موقعي على الخريطة (اختياري)'}</>}
          </Button>
          {locState === 'error' && <p className="-mt-2 text-sm text-soft">ما قدرنا ناخذ موقعك. العنوان المكتوب بيكفي.</p>}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">الدفع عند الاستلام</h2>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="طريقة الدفع">
          {([['cash', 'كاش', Banknote], ['cliq', 'كليك', Smartphone]] as const).map(([v, l, Icon]) => (
            <button key={v} role="radio" aria-checked={pay === v} onClick={() => setPay(v)}
              className={cn('flex h-16 items-center justify-center gap-2 rounded-2xl border-2 bg-white font-bold transition-colors',
                pay === v ? 'border-brand-deep text-brand-deep' : 'border-line')}>
              <Icon size={22} />{l}
            </button>
          ))}
        </div>
        {pay === 'cash' ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">بدك فكّة لكم؟ <span className="font-normal text-soft">(اختياري)</span></p>
            <div className="flex flex-wrap gap-2">
              {[null, 5, 10, 20, 50].map(v => (
                <button key={String(v)} onClick={() => setChange(v)} aria-pressed={change === v}
                  className={cn('h-11 rounded-full px-4 text-sm font-bold', change === v ? 'bg-asphalt text-white' : 'bg-white shadow-[0_0_0_2px_var(--color-line)]')}>
                  {v == null ? 'معي مبلغ مظبوط' : <><span className="num">{v}</span> د.أ</>}
                </button>
              ))}
            </div>
          </div>
        ) : <p className="text-sm text-soft">بتحوّل المبلغ كامل كليك وقت الاستلام. رح نعرضلك اسم الحساب بعد الطلب.</p>}
      </section>

      <Field id="f-note" label="ملاحظة على الطلب" optional>
        <Textarea id="f-note" value={note} onChange={e => setNote(e.target.value)} maxLength={300} />
      </Field>

    </div>
    <aside className="mt-6 flex flex-col gap-3 lg:sticky lg:top-4 lg:mt-12">
      <section className="rounded-3xl bg-white p-4 shadow-[0_0_0_2px_var(--color-line)]">
        <h2 className="mb-2 font-bold">ملخص الطلب</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {cart.lines.map(l => (
            <li key={l.key}>
              <div className="flex justify-between gap-2"><span><span className="num">{l.qty}×</span> {l.name}</span><span className="num shrink-0">{money(l.price * l.qty)}</span></div>
              {l.options.map(o => (
                <div key={o.id} className="flex justify-between gap-2 ps-5 text-soft">
                  <span>+ {o.name}{o.qty > 1 ? ` ×${o.qty}` : ''}</span><span className="num shrink-0">{money(o.price * o.qty * l.qty)}</span>
                </div>
              ))}
            </li>
          ))}
        </ul>
        {fee !== null && (
          <div className="mt-3 flex justify-between gap-2 border-t border-line pt-3 text-sm">
            <span>التوصيل ({zone?.name})</span><span className="num">{money(fee)}</span>
          </div>
        )}
        <div className={cn('flex justify-between font-bold', fee === null ? 'mt-3 border-t border-line pt-3' : 'mt-1')}>
          <span>المجموع</span><span className="num">{money(total)} د.أ</span>
        </div>
        {mode === 'delivery' && fee === null && <p className="mt-1 text-sm text-soft">+ التوصيل بيتحدد بالاتصال</p>}
      </section>
      <div className="hidden flex-col gap-2 lg:flex">{alert}{submitButton}</div>
    </aside>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg flex-col gap-2">{alert}{submitButton}</div>
      </div>
      <PhoneCheck open={checking} phone={c.phone} onClose={() => setChecking(false)} onVerified={() => { setChecking(false); setTimeout(submit, 0); }} />
    </div>
  );
}
