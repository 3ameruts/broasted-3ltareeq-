import { useState } from 'react';
import { Bike, Check, LocateFixed, MapPin, Store as StoreIcon } from 'lucide-react';
import { locate } from '../../lib/geo';
import type { Branch } from '../../lib/types';
import { branchPaused, type OrderBranch } from '../data';
import { Button } from '../ui/button';
import { cn } from '../ui/cn';

export type Mode = 'pickup' | 'delivery';

// Step 1: pickup or delivery, then the branch (nearest suggested if the customer allows location)
export function BranchPicker({ branches, places, branchId, mode, onDone }: {
  branches: OrderBranch[]; places: Branch[]; branchId: string | null; mode: Mode; onDone: (branchId: string, mode: Mode) => void;
}) {
  const [m, setM] = useState<Mode>(mode);
  const [b, setB] = useState<string | null>(branchId);
  const [dist, setDist] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);
  const [geoError, setGeoError] = useState('');

  const findNearest = async () => {
    setBusy(true); setGeoError('');
    try { const r = await locate(places); setDist(r.distances); setB(r.nearestId); }
    catch { setGeoError('ما قدرنا نعرف موقعك. اختار الفرع بإيدك.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 text-lg font-bold">كيف بدك طلبك؟</h2>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="طريقة الاستلام">
          {([['pickup', 'استلام من الفرع', StoreIcon], ['delivery', 'توصيل', Bike]] as const).map(([v, label, Icon]) => (
            <button key={v} role="radio" aria-checked={m === v} onClick={() => setM(v)}
              className={cn('flex h-24 flex-col items-center justify-center gap-2 rounded-3xl border-2 bg-white font-bold transition-colors active:scale-[0.98]',
                m === v ? 'border-brand-deep text-brand-deep shadow-[0_0_0_3px_rgb(178_16_23/0.12)]' : 'border-line text-ink')}>
              <Icon size={28} strokeWidth={2.2} />{label}
            </button>
          ))}
        </div>
        {m === 'delivery' && <p className="mt-2 text-sm text-soft">سعر التوصيل بيحددلك ياه الفرع لما يتصل يأكد طلبك.</p>}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{m === 'delivery' ? 'من أي فرع؟' : 'من وين بدك تستلم؟'}</h2>
          <Button variant="ghost" size="sm" onClick={findNearest} disabled={busy}>
            <LocateFixed size={18} />{busy ? 'بندوّر…' : 'الأقرب إلي'}
          </Button>
        </div>
        {geoError && <p className="mb-2 text-sm text-brand-deep" role="alert">{geoError}</p>}
        <div className="flex flex-col gap-3" role="radiogroup" aria-label="الفرع">
          {branches.map(br => {
            const paused = branchPaused(br);
            const d = dist?.[br.id];
            return (
              <button key={br.id} role="radio" aria-checked={b === br.id} onClick={() => setB(br.id)}
                className={cn('flex min-h-16 items-center gap-3 rounded-3xl border-2 bg-white px-4 py-3 text-start transition-colors active:scale-[0.99]',
                  b === br.id ? 'border-brand-deep' : 'border-line')}>
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', b === br.id ? 'bg-brand-deep text-white' : 'bg-paper text-ink')}>
                  {b === br.id ? <Check size={20} /> : <MapPin size={20} />}
                </span>
                <span className="flex-1">
                  <span className="block font-bold">{br.name}</span>
                  <span className="block text-sm text-soft">
                    {paused ? 'موقّف الطلبات مؤقتاً' : d != null ? <><span className="num">{d.toFixed(1)}</span> كم عنك</> : 'إربد'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <Button size="lg" className="w-full" disabled={!b} onClick={() => b && onDone(b, m)}>يلا نشوف المنيو</Button>
    </div>
  );
}
