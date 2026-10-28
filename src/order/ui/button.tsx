import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

// shadcn/ui-style button with the brand variants
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-[transform,background-color,opacity] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-mustard select-none',
  {
    variants: {
      variant: {
        primary: 'bg-brand-deep text-white hover:bg-brand-deep/90',
        accent: 'bg-mustard text-ink hover:bg-mustard/90',
        dark: 'bg-asphalt text-white hover:bg-asphalt/90',
        outline: 'border-2 border-asphalt/15 bg-white text-ink hover:bg-white/70',
        ghost: 'bg-transparent text-ink hover:bg-ink/5',
      },
      size: {
        md: 'h-12 px-5 text-base',
        lg: 'h-14 px-6 text-lg',
        icon: 'size-11 shrink-0 rounded-full',
        sm: 'h-9 px-3 text-sm rounded-xl',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, Props>(({ className, variant, size, type = 'button', ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = 'Button';
