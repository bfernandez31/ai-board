'use client';

import { Keyboard } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useHoverCapability } from '@/lib/hooks/use-hover-capability';

interface ShortcutsHelpButtonProps {
  onClick: () => void;
}

export function ShortcutsHelpButton({ onClick }: ShortcutsHelpButtonProps) {
  const hasHover = useHoverCapability();

  if (!hasHover) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className="fixed bottom-4 right-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Keyboard shortcuts (?)"
        >
          <Keyboard className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>Keyboard shortcuts (?)</p>
      </TooltipContent>
    </Tooltip>
  );
}
