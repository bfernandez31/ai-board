'use client';

import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/30"
      />
    );
  }
  if (verdictTicketId === winnerTicketId) {
    return <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-ctp-green" />;
  }
  return <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-ctp-yellow" />;
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
            <div className="rounded-lg border border-border">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
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
                    <div className="font-medium text-foreground">{point.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {point.verdictSummary}
                    </div>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-border px-4 py-3">
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
