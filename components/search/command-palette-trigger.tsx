'use client';

import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CommandPaletteTriggerProps {
  onClick: () => void;
}

export function CommandPaletteTrigger({
  onClick,
}: CommandPaletteTriggerProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="hidden h-10 w-full max-w-sm items-center justify-between rounded-xl border-border/80 bg-card/70 px-3 text-sm text-muted-foreground lg:flex"
      aria-label="Open command palette"
      data-testid="command-palette-trigger"
    >
      <span className="flex items-center gap-2">
        <Search className="h-4 w-4" />
        <span>Jump to view or ticket...</span>
      </span>
      <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
        Cmd/Ctrl K
      </span>
    </Button>
  );
}
