import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

const base = 'w-full rounded-2xl border-2 bg-white px-4 text-base text-ink placeholder:text-soft/60 outline-none transition-colors focus:border-asphalt';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <input ref={ref} className={cn(base, 'h-13', invalid ? 'border-brand' : 'border-line', className)} aria-invalid={invalid || undefined} {...props} />
  )
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, 'min-h-22 resize-none border-line py-3', className)} {...props} />
));
Textarea.displayName = 'Textarea';

// Visible label + helper/error under the field (never placeholder-only)
export function Field({ id, label, hint, error, optional, children }: { id: string; label: string; hint?: string; error?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label} {optional && <span className="font-normal text-soft">(اختياري)</span>}
      </label>
      {children}
      {error ? <p className="text-sm font-semibold text-brand-deep" role="alert">{error}</p> : hint ? <p className="text-sm text-soft">{hint}</p> : null}
    </div>
  );
}
