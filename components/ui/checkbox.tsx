'use client';

import * as React from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange'> {
  checked?: boolean | 'indeterminate';
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
    const isIndeterminate = checked === 'indeterminate';
    const isChecked = checked === true;

    const inputRef = React.useRef<HTMLInputElement | null>(null);
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (inputRef.current) inputRef.current.indeterminate = isIndeterminate;
    }, [isIndeterminate]);

    return (
      <span className={cn('relative inline-flex h-5 w-5 items-center justify-center', className)}>
        <input
          ref={inputRef}
          type="checkbox"
          className="peer h-5 w-5 cursor-pointer appearance-none rounded-sm border border-primary bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checked:bg-primary checked:border-primary"
          checked={isChecked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          aria-checked={isIndeterminate ? 'mixed' : isChecked}
          {...props}
        />
        {isIndeterminate ? (
          <Minus className="pointer-events-none absolute h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
        ) : isChecked ? (
          <Check className="pointer-events-none absolute h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
        ) : null}
      </span>
    );
  },
);
Checkbox.displayName = 'Checkbox';
