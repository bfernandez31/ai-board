'use client';

import * as React from 'react';

import { ChevronUp, ChevronDown } from 'lucide-react';

interface MobileScrollButtonProps {
  direction: 'up' | 'down';
  onClick: () => void;
  visible: boolean;
}

/**
 * Mobile scroll button component for scrolling within columns on touch devices
 * Displays a floating button with an arrow that allows scrolling up or down
 */
export const MobileScrollButton = React.memo(
  ({ direction, onClick, visible }: MobileScrollButtonProps) => {
    if (!visible) return null;

    const Icon = direction === 'up' ? ChevronUp : ChevronDown;
    const positionClass =
      direction === 'up'
        ? 'top-2' // Position near top of column
        : 'bottom-2'; // Position near bottom of column

    return (
      <button
        onClick={onClick}
        className={`
          absolute ${positionClass} right-2 z-10
          bg-zinc-800/90 hover:bg-zinc-700/90
          border border-zinc-600/50 hover:border-zinc-500
          rounded-full p-2
          shadow-lg
          transition-all duration-200
          active:scale-95
          md:hidden
        `}
        aria-label={`Scroll ${direction}`}
        type="button"
      >
        <Icon className="w-5 h-5 text-zinc-200" strokeWidth={2.5} />
      </button>
    );
  }
);

MobileScrollButton.displayName = 'MobileScrollButton';
