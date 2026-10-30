import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import { money, searchZones, type Zone } from '../data';
import { Input } from '../ui/field';
import { cn } from '../ui/cn';

// Delivery area: type a few letters, pick the area, and the delivery fee shows straight away
export function ZonePicker({ zones, value, onPick, invalid }: { zones: Zone[]; value: Zone | null; onPick: (z: Zone | null) => void; invalid?: boolean }) {
  const [q, setQ] = useState('');
  if (value) return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_0_0_2px_var(--color-brand-deep)]">
      <span className="flex items-center gap-2 font-bold"><Check size={18} className="text-brand-deep" /> {value.name}</span>
      <span className="text-sm">توصيل <b className="num">{money(value.fee)}</b> د.أ</span>
      <button className="text-sm font-bold text-soft underline" onClick={() => { onPick(null); setQ(''); }}>غيّر</button>
    </div>
  );
  const found = searchZones(zones, q).slice(0, 8);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-soft" />
        <Input id="f-area" value={q} onChange={e => setQ(e.target.value)} placeholder="اكتب اسم منطقتك…" className="ps-10" invalid={invalid} autoComplete="off" />
      </div>
      <ul className="flex max-h-72 flex-col overflow-y-auto rounded-2xl bg-white shadow-[0_0_0_2px_var(--color-line)]" role="listbox" aria-label="المناطق">
        {found.map(z => (
          <li key={z.id}>
            <button role="option" aria-selected={false} onClick={() => onPick(z)}
              className={cn('flex min-h-12 w-full items-center justify-between gap-3 border-b border-line px-4 text-start last:border-0')}>
              <span className="font-semibold">{z.name}</span>
              <span className="num text-sm text-soft">{money(z.fee)} د.أ</span>
            </button>
          </li>
        ))}
        {!found.length && <li className="px-4 py-3 text-sm text-soft">ما لقينا هالمنطقة. جرّب اسم ثاني، أو كبس «منطقتي مش بالقائمة» فوق.</li>}
      </ul>
    </div>
  );
}
