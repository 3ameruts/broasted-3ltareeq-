import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { myRating, rateOrder, type Rating } from '../data';
import { Button } from '../ui/button';
import { Textarea } from '../ui/field';
import { cn } from '../ui/cn';

const LABELS = ['', 'سيء', 'مش منيح', 'عادي', 'منيح', 'ممتاز'];

// «كيف كان طلبك؟»: 1–5 stars and an optional comment; the customer can change it later from the same page
export function RateOrder({ token }: { token: string }) {
  const [saved, setSaved] = useState<Rating | null | undefined>(undefined);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { myRating(token).then(r => { setSaved(r); if (r) { setStars(r.stars); setComment(r.comment ?? ''); } }); }, [token]);
  if (saved === undefined) return null;

  if (saved && !editing) return (
    <div className="flex items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-[0_0_0_2px_var(--color-line)]">
      <div>
        <p className="font-bold">شكراً على تقييمك 🙏</p>
        <p className="flex gap-0.5 text-mustard" aria-label={`${saved.stars} من 5`}>{[1, 2, 3, 4, 5].map(n => <Star key={n} size={18} fill={n <= saved.stars ? 'currentColor' : 'none'} />)}</p>
      </div>
      <button className="text-sm font-bold text-soft underline" onClick={() => setEditing(true)}>غيّر</button>
    </div>
  );

  const send = async () => {
    setBusy(true); setError('');
    try {
      const r = await rateOrder(token, stars, comment.trim());
      if (r.ok) { setSaved({ stars, comment: comment.trim() || null }); setEditing(false); }
      else setError(r.error === 'too_late' ? 'مرّ وقت طويل على الطلب.' : 'ما زبط، جرّب مرة ثانية.');
    } catch { setError('ما زبط، تأكد من الإنترنت.'); }
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-[0_0_0_2px_var(--color-mustard)]">
      <p className="text-lg font-bold">كيف كان طلبك؟</p>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="التقييم">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} role="radio" aria-checked={stars === n} aria-label={`${n} من 5`} onClick={() => setStars(n)}
            className={cn('grid size-11 place-items-center rounded-full transition-transform active:scale-90', n <= stars ? 'text-mustard' : 'text-line')}>
            <Star size={32} fill={n <= stars ? 'currentColor' : 'none'} strokeWidth={1.8} />
          </button>
        ))}
        {stars > 0 && <span className="ms-2 font-bold text-soft">{LABELS[stars]}</span>}
      </div>
      {stars > 0 && (
        <>
          <Textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={300} rows={2}
            placeholder={stars <= 3 ? 'شو اللي ما عجبك؟ ملاحظتك بتوصل للإدارة مباشرة.' : 'بدك تحكيلنا إشي؟ (اختياري)'} aria-label="تعليق" />
          {error && <p className="text-sm font-semibold text-brand-deep" role="alert">{error}</p>}
          <Button onClick={send} disabled={busy}>{busy ? 'لحظة…' : 'ابعت التقييم'}</Button>
        </>
      )}
    </div>
  );
}
