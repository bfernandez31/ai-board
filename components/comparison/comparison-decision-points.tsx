'use client';

import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import type { ComparisonDecisionPointsProps, ComparisonDecisionPointsEnhancedProps } from './types';

function VerdictDot({
  verdictTicketId,
  winnerTicketId,
}: {
  verdictTicketId: number | null;
  winnerTicketId: number;
}) {
  if (verdictTicketId === null) {
    return (
      <div
        data-testid="verdict-dot-neutral"
        className="h-3 w-3 shrink-0 rounded-full bg-muted-foreground/30"
      />
    );
  }
  if (verdictTicketId === winnerTicketId) {
    return (
      <div
        className="h-3 w-3 shrink-0 rounded-full bg-ctp-green"
        style={{ boxShadow: '0 0 8px hsl(var(--ctp-green) / 0.5)' }}
      />
    );
  }
  return (
    <div
      className="h-3 w-3 shrink-0 rounded-full bg-ctp-yellow"
      style={{ boxShadow: '0 0 8px hsl(var(--ctp-yellow) / 0.5)' }}
    />
  );
}

function getVerdictColor(verdictTicketId: number | null, winnerTicketId: number | null): {
  cardBg: string;
  cardBorder: string;
  pillBg: string;
  pillText: string;
} {
  if (verdictTicketId === null || winnerTicketId === null) {
    return {
      cardBg: 'bg-foreground/[0.02]',
      cardBorder: 'border-foreground/10',
      pillBg: 'bg-muted-foreground/10',
      pillText: 'text-muted-foreground',
    };
  }
  if (verdictTicketId === winnerTicketId) {
    return {
      cardBg: 'bg-ctp-green/[0.06]',
      cardBorder: 'border-ctp-green/20',
      pillBg: 'bg-ctp-green/15',
      pillText: 'text-ctp-green',
    };
  }
  return {
    cardBg: 'bg-ctp-yellow/[0.06]',
    cardBorder: 'border-ctp-yellow/20',
    pillBg: 'bg-ctp-yellow/15',
    pillText: 'text-ctp-yellow',
  };
}

export function ComparisonDecisionPoints(
  props: ComparisonDecisionPointsProps | ComparisonDecisionPointsEnhancedProps
) {
  const { decisionPoints } = props;
  const winnerTicketId = 'winnerTicketId' in props ? props.winnerTicketId : null;

  return (
    <div className="space-y-1">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Decision Points
      </h3>
      <div className="space-y-3">
        {decisionPoints.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No saved decision points for this comparison.
          </div>
        )}
        {decisionPoints.map((point) => {
          const verdictColors = getVerdictColor(point.verdictTicketId, winnerTicketId);

          return (
            <Collapsible key={point.id} defaultOpen={point.displayOrder === 0}>
              <div className={`rounded-xl border ${verdictColors.cardBorder} ${verdictColors.cardBg}`}>
                <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-4 text-left">
                  <div className="flex items-start gap-3">
                    {winnerTicketId != null && (
                      <div className="mt-1.5">
                        <VerdictDot
                          verdictTicketId={point.verdictTicketId}
                          winnerTicketId={winnerTicketId}
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{point.title}</div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {point.verdictSummary}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {point.verdictTicketId != null && (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${verdictColors.pillBg} ${verdictColors.pillText}`}>
                        Verdict
                      </span>
                    )}
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t border-foreground/10 px-5 py-4">
                  <p className="text-sm text-muted-foreground">{point.rationale}</p>
                  {point.participantApproaches.length > 0 ? (
                    <div className="mt-3 space-y-2.5">
                      {point.participantApproaches.map((approach) => (
                        <div key={approach.ticketId}>
                          <div className="text-sm font-medium text-foreground">
                            <Badge variant="outline" className="mr-2">
                              {approach.ticketKey}
                            </Badge>
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {approach.summary}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-muted-foreground">
                      No saved participant approaches for this decision point.
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
