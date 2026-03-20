'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { ComparisonDecisionPointData } from './types';

interface ComparisonDecisionsProps {
  decisionPoints: ComparisonDecisionPointData[];
}

export function ComparisonDecisions({ decisionPoints }: ComparisonDecisionsProps) {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const toggleItem = (id: number) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (decisionPoints.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No decision points recorded.</p>
    );
  }

  return (
    <div className="space-y-3">
      {decisionPoints.map((dp) => (
        <Collapsible
          key={dp.id}
          open={openItems.has(dp.id)}
          onOpenChange={() => toggleItem(dp.id)}
        >
          <div className="rounded-lg border bg-card text-card-foreground">
            <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground">
                  {dp.topic}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {dp.verdict}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ml-2 ${
                  openItems.has(dp.id) ? 'rotate-180' : ''
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t px-4 pb-4 pt-3 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Verdict
                  </p>
                  <p className="text-sm text-foreground">{dp.verdict}</p>
                </div>
                {Object.entries(dp.approaches).map(([ticketKey, data]) => (
                  <div key={ticketKey} className="rounded-md border p-3">
                    <p className="text-xs font-semibold text-foreground mb-1">
                      {ticketKey}
                    </p>
                    <p className="text-sm text-foreground">
                      <span className="text-muted-foreground">Approach: </span>
                      {data.approach}
                    </p>
                    <p className="text-sm text-foreground mt-1">
                      <span className="text-muted-foreground">Assessment: </span>
                      {data.assessment}
                    </p>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  );
}
