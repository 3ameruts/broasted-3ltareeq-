import { Flame } from 'lucide-react';

// a split meal on staff screens: its own line under the item, hot in red and regular in a calm colour
export function SplitBadges({ hot, regular, perMeal }: { hot?: number | null; regular?: number | null; perMeal?: boolean }) {
  if (!hot || !regular) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 ps-5 text-sm font-bold">
      <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-white"><Flame size={13} /><span className="num">{hot}</span> حار</span>
      <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-0.5 text-ink shadow-[0_0_0_1.5px_var(--color-line)]"><span className="num">{regular}</span> عادي</span>
      {perMeal && <span className="font-normal text-soft">لكل وجبة</span>}
    </div>
  );
}
