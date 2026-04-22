import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * AI-Board Button
 * ---------------------------------------------------------------------------
 * 4-level action doctrine — applies across the entire app:
 *
 *  - `default`     → Primary CTA (ONE per screen/flow).
 *                    "Night arc" gradient (primary-active → mauve → sapphire).
 *                    Ex: "Create ticket", "Save changes", "Confirm deploy".
 *
 *  - `outline`     → Strong standalone action or visible secondary CTA.
 *                    Aurora gradient border on crust background.
 *                    Ex: "See how it works", "Learn more", active filters.
 *
 *  - `secondary`   → Support action grouped with a primary.
 *                    Crust + surface-1 border (subtle, no semantic color).
 *                    Ex: "Cancel" next to "Save", "Back", "Dismiss".
 *
 *  - `ghost`       → Tertiary action, toolbars, icon buttons.
 *                    15% diluted mauve border.
 *                    Ex: Table actions, dropdown options.
 *
 *  - `destructive` → Irreversible deletion ONLY.
 *                    Catppuccin red.
 *                    Ex: "Delete ticket permanently", "Close sprint".
 *
 *  - `link`        → Inline navigation. Never for an action.
 *
 * ---------------------------------------------------------------------------
 * PREREQUISITE: app/globals.css defines `.aurora-btn-default` and
 * `.aurora-btn-outline` inside @layer components. These complex classes
 * (multi-stop gradients, double-background border-box) cannot be expressed
 * cleanly with Tailwind arbitrary values.
 * ---------------------------------------------------------------------------
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium',
    'ring-offset-background transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        /* DEFAULT — Night arc (global CSS: .aurora-btn-default) */
        default: 'aurora-btn-default text-white',

        /* OUTLINE — Aurora gradient border (global CSS: .aurora-btn-outline) */
        outline: 'aurora-btn-outline text-foreground hover:text-[hsl(var(--ctp-mauve))]',

        /* SECONDARY — Crust + surface-1 border */
        secondary: [
          'bg-[hsl(var(--ctp-crust))] text-[hsl(var(--ctp-subtext-1))]',
          'border border-[hsl(var(--ctp-surface-1))]',
          'hover:bg-[hsl(var(--ctp-surface-0))] hover:text-foreground hover:border-[hsl(var(--ctp-surface-2))]',
        ].join(' '),

        /* GHOST — 15% diluted mauve border */
        ghost: [
          'bg-transparent text-[hsl(var(--ctp-subtext-1))]',
          'border border-[hsl(var(--ctp-mauve)/0.15)]',
          'hover:bg-[hsl(var(--ctp-mauve)/0.08)] hover:text-[hsl(var(--ctp-mauve))] hover:border-[hsl(var(--ctp-mauve)/0.3)]',
        ].join(' '),

        /* DESTRUCTIVE — Catppuccin red */
        destructive: [
          'bg-destructive text-destructive-foreground font-semibold',
          'shadow-sm hover:bg-[hsl(var(--ctp-red))] hover:shadow-[0_3px_14px_hsl(var(--destructive)/0.4)]',
        ].join(' '),

        /* LINK — Inline navigation */
        link: 'text-primary underline-offset-4 hover:underline hover:text-primary-hover',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
