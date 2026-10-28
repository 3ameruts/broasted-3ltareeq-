import { Minus, Plus, Trash2 } from 'lucide-react';

// Quantity control with 44px touch targets; at 1 the minus becomes "remove" when onRemove is given
export function Stepper({ value, onChange, min = 1, max = 20, onRemove, label }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; onRemove?: () => void; label: string;
}) {
  const atMin = value <= min;
  return (
    <div className="flex w-fit items-center gap-1 rounded-full bg-white p-1 shadow-[0_0_0_2px_var(--color-line)]" role="group" aria-label={label}>
      <button className="grid size-11 place-items-center rounded-full bg-paper text-ink active:scale-95 disabled:opacity-40"
        onClick={() => (atMin && onRemove ? onRemove() : onChange(Math.max(min, value - 1)))} disabled={atMin && !onRemove}
        aria-label={atMin && onRemove ? 'احذف' : 'أنقص'}>
        {atMin && onRemove ? <Trash2 size={18} /> : <Minus size={18} />}
      </button>
      <span className="num min-w-8 text-center text-lg font-bold" aria-live="polite">{value}</span>
      <button className="grid size-11 place-items-center rounded-full bg-mustard text-ink active:scale-95 disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="زيد">
        <Plus size={18} />
      </button>
    </div>
  );
}
