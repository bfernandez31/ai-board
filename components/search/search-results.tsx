'use client';

import { cn } from '@/lib/utils';
import type { SearchResult } from '@/app/lib/types/search';

interface SearchResultsProps {
  results: SearchResult[];
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
  isLoading?: boolean;
  error?: Error | null;
}

export function SearchResults({
  results,
  selectedIndex,
  onSelect,
  isLoading,
  error,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Searching...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-sm text-destructive">
        Search unavailable
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No tickets found
      </div>
    );
  }

  return (
    <div role="listbox" aria-label="Search results">
      {results.map((result, index) => {
        const isClosed = result.stage === 'CLOSED';
        return (
          <button
            key={result.id}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            data-selected={index === selectedIndex}
            onClick={() => onSelect(result)}
            className={cn(
              'w-full text-left px-3 py-2 transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'focus:outline-none focus:bg-accent focus:text-accent-foreground',
              // AIB-150: Conditional styling for selected state based on closed status
              index === selectedIndex && (isClosed
                ? 'bg-muted text-foreground'  // High contrast for selected closed (8.4:1 - WCAG AAA)
                : 'bg-primary text-primary-foreground'),  // Primary for selected open
              // AIB-148/150: Muted styling for non-selected closed tickets only
              index !== selectedIndex && isClosed && 'opacity-60'
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn('font-mono text-xs', isClosed && 'text-muted-foreground')}>
                {result.ticketKey}
              </span>
              <span className={cn('truncate', isClosed && 'text-muted-foreground')}>
                {result.title}
              </span>
              {/* AIB-148: Closed badge */}
              {isClosed && (
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-gray-500/30 text-gray-400">
                  Closed
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
