'use client';

import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComparisonDecisionPointsProps } from './types';

export function ComparisonDecisionPoints({
  decisionPoints,
}: ComparisonDecisionPointsProps) {
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
                <div>
                  <div className="font-medium text-foreground">{point.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {point.verdictSummary}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-border px-4 py-3">
                <p className="text-sm text-muted-foreground">{point.rationale}</p>
                <div className="mt-3 space-y-2">
                  {point.participantApproaches.map((approach) => (
                    <div key={approach.ticketId}>
                      <div className="text-sm font-medium text-foreground">
                        {approach.ticketKey}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {approach.summary}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
}
