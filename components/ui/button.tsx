import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED] active:bg-[#6D28D9] shadow-sm hover:shadow-md',
        destructive:
          'bg-[#f38ba8] text-white hover:bg-[#e5758a] shadow-sm',
        outline:
          'border-2 border-[#8B5CF6] bg-transparent text-[#8B5CF6] hover:bg-[#8B5CF6]/10 active:bg-[#8B5CF6]/20',
        secondary:
          'bg-[#313244] text-[#cdd6f4] hover:bg-[#45475a] active:bg-[#585b70]',
        ghost: 'text-[#cdd6f4] hover:bg-[#313244] hover:text-[#cdd6f4]',
        link: 'text-[#8B5CF6] underline-offset-4 hover:underline hover:text-[#7C3AED]',
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
