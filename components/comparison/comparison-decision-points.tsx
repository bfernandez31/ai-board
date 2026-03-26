'use client';

import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDecisionDotTheme, getDecisionVerdictTheme } from './comparison-theme';
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
        className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/30"
      />
    );
  }

  return (
    <div className={cn('h-2.5 w-2.5 shrink-0 rounded-full', getDecisionDotTheme(verdictTicketId, winnerTicketId))} />
  );
}

export function ComparisonDecisionPoints(
  props: ComparisonDecisionPointsProps | ComparisonDecisionPointsEnhancedProps
) {
  const { decisionPoints } = props;
  const winnerTicketId = 'winnerTicketId' in props ? props.winnerTicketId : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision Points</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {decisionPoints.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No saved decision points for this comparison.
          </div>
        )}
        {decisionPoints.map((point) => (
          <Collapsible key={point.id} defaultOpen={point.displayOrder === 0}>
            <div
              data-testid="decision-point-card"
              className={cn(
                'rounded-2xl border bg-ctp-mantle/70 shadow-lg backdrop-blur-sm',
                getDecisionVerdictTheme(point.verdictTicketId, winnerTicketId)
              )}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-4 text-left">
                <div className="flex items-start gap-2">
                  {winnerTicketId != null && (
                    <div className="mt-1.5">
                      <VerdictDot
                        verdictTicketId={point.verdictTicketId}
                        winnerTicketId={winnerTicketId}
                      />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-foreground">{point.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {point.verdictSummary}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    data-testid="decision-verdict-badge"
                    className={cn(
                      'rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.28em]',
                      getDecisionVerdictTheme(point.verdictTicketId, winnerTicketId)
                    )}
                  >
                    {point.verdictTicketId == null ? 'Mixed' : point.verdictTicketId === winnerTicketId ? 'Winner' : 'Alternate'}
                  </Badge>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-white/10 px-5 py-4">
                <p className="text-sm text-muted-foreground">{point.rationale}</p>
                {point.participantApproaches.length > 0 ? (
                  <div className="mt-3 space-y-2">
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
        ))}
      </CardContent>
    </Card>
  );
}
