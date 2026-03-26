'use client';

import { cn } from '@/lib/utils';
import type { CommandPaletteResponse, CommandPaletteResult } from '@/lib/types';

interface CommandPaletteResultsProps {
  groups: CommandPaletteResponse['groups'];
  selectedIndex: number;
  onSelect: (result: CommandPaletteResult) => void;
  isLoading?: boolean;
  error?: Error | null;
}

export function CommandPaletteResults({
  groups,
  selectedIndex,
  onSelect,
  isLoading,
  error,
}: CommandPaletteResultsProps) {
  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Searching project…</div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">Command palette unavailable</div>
    );
  }

  const flatResults = [...groups.destinations, ...groups.tickets];

  if (flatResults.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No destinations or tickets found.
      </div>
    );
  }

  return (
    <div role="listbox" aria-label="Command palette results">
      {groups.destinations.length > 0 && (
        <div className="border-b border-border/60 p-2">
          <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Destinations
          </p>
          <div className="space-y-1">
            {groups.destinations.map((result, index) => {
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={result.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected}
                  onClick={() => onSelect(result)}
                  className={cn(
                    'flex w-full items-start justify-between rounded-lg px-2 py-2 text-left transition-colors',
                    'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected && 'bg-primary text-primary-foreground hover:bg-primary'
                  )}
                >
                  <span className="font-medium">{result.label}</span>
                  <span className="text-xs opacity-80">{result.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {groups.tickets.length > 0 && (
        <div className="p-2">
          <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tickets
          </p>
          <div className="space-y-1">
            {groups.tickets.map((result, index) => {
              const isSelected =
                groups.destinations.length + index === selectedIndex;

              return (
                <button
                  key={result.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected}
                  onClick={() => onSelect(result)}
                  className={cn(
                    'flex w-full flex-col rounded-lg px-2 py-2 text-left transition-colors',
                    'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected && 'bg-primary text-primary-foreground hover:bg-primary'
                  )}
                >
                  <span className="text-xs font-medium opacity-80">{result.ticketKey}</span>
                  <span className="truncate font-medium">{result.label}</span>
                  <span className="text-xs opacity-80">{result.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
