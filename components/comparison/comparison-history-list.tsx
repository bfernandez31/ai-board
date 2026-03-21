'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ComparisonHistoryListProps } from './types';

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ComparisonHistoryList({
  comparisons,
  selectedComparisonId,
  isLoading = false,
  onSelect,
}: ComparisonHistoryListProps) {
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading comparison history...</div>;
  }

  if (comparisons.length === 0) {
    return <div className="text-sm text-muted-foreground">No saved comparisons yet.</div>;
  }

  return (
    <div className="space-y-2">
      {comparisons.map((comparison) => (
        <Button
          key={comparison.id}
          type="button"
          variant="outline"
          className={cn(
            'h-auto w-full justify-start border-border px-4 py-3 text-left',
            comparison.id === selectedComparisonId && 'border-primary bg-primary/5'
          )}
          onClick={() => onSelect(comparison.id)}
        >
          <div className="min-w-0 space-y-1">
            <div className="truncate font-medium text-foreground">
              {comparison.winnerTicketKey} won over {comparison.participantTicketKeys.join(', ')}
            </div>
            <div className="text-xs text-muted-foreground">{formatDate(comparison.generatedAt)}</div>
            <div className="line-clamp-2 text-sm text-muted-foreground">{comparison.summary}</div>
          </div>
        </Button>
      ))}
    </div>
  );
}
