'use client';

import { ChevronDown, Trophy } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ComparisonDashboard } from './comparison-viewer';
import type { ComparisonCardProps } from './types';

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

export function ComparisonCard({
  comparison,
  isExpanded,
  detail,
  isDetailLoading,
  onToggle,
}: ComparisonCardProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          data-testid={`comparison-card-${comparison.id}`}
          className={`w-full rounded-xl border px-4 py-4 text-left transition-colors ${
            isExpanded
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:bg-muted/40'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {comparison.winnerTicketKey}
                </span>
                {comparison.winnerScore != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <Trophy className="h-3 w-3" />
                    {comparison.winnerScore.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {comparison.winnerTicketTitle}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {truncate(comparison.summary, 120)}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="text-xs text-muted-foreground">
                {formatDate(comparison.generatedAt)}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="pt-4">
              {isDetailLoading && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Loading comparison detail...
                </div>
              )}
              {detail && <ComparisonDashboard detail={detail} />}
              {!isDetailLoading && !detail && isExpanded && (
                <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Unable to load comparison detail.
                </div>
              )}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
