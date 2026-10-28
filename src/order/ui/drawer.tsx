import type { ReactNode } from 'react';
import { Drawer as V } from 'vaul';
import { X } from 'lucide-react';
import { cn } from './cn';

// shadcn/ui-style bottom sheet (vaul): swipe down or tap outside to close
export function Sheet({ open, onOpenChange, title, children, footer, className }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode; footer?: ReactNode; className?: string;
}) {
  return (
    <V.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <V.Portal>
        <V.Overlay className="fixed inset-0 z-40 bg-ink/50" />
        <V.Content dir="rtl" className={cn('fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-lg flex-col rounded-t-[28px] bg-paper outline-none', className)}>
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-ink/20" aria-hidden />
          <div className="flex items-center justify-between gap-3 px-5 pt-2 pb-1">
            <V.Title className="font-display text-2xl leading-tight text-ink">{title}</V.Title>
            <V.Close asChild>
              <button className="grid size-11 place-items-center rounded-full bg-ink/5 text-ink" aria-label="سكّر"><X size={20} /></button>
            </V.Close>
          </div>
          <V.Description className="sr-only">{title}</V.Description>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
          {footer && <div className="pb-safe border-t border-line bg-paper px-5 pt-3">{footer}</div>}
        </V.Content>
      </V.Portal>
    </V.Root>
  );
}
