'use client';

import { ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ComparisonHeroCard } from '@/components/comparison/comparison-hero-card';
import { ComparisonParticipantGrid } from '@/components/comparison/comparison-participant-grid';
import { ComparisonStatCards } from '@/components/comparison/comparison-stat-cards';
import { ComparisonUnifiedMetrics } from '@/components/comparison/comparison-unified-metrics';
import { ComparisonDecisionPoints } from '@/components/comparison/comparison-decision-points';
import { ComparisonComplianceHeatmap } from '@/components/comparison/comparison-compliance-heatmap';
import type { ComparisonDetail } from '@/lib/types/comparison';

interface ComparisonInlineDetailProps {
  detail: ComparisonDetail | null;
  isLoading: boolean;
  onCollapse: () => void;
}

export function ComparisonInlineDetail({ detail, isLoading, onCollapse }: ComparisonInlineDetailProps) {
  if (isLoading || !detail) {
    return (
      <Card className="mt-2 border-primary/30">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const winner = detail.participants.find((p) => p.ticketId === detail.winnerTicketId);

  if (!winner) {
    return null;
  }

  return (
    <Card className="mt-2 border-primary/30" data-testid="comparison-inline-detail">
      <CardContent className="p-4 sm:p-6 space-y-6">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onCollapse}>
            <ChevronUp className="h-4 w-4 mr-1" />
            Collapse
          </Button>
        </div>

        <div className="space-y-6">
          <ComparisonHeroCard
            winner={winner}
            recommendation={detail.overallRecommendation}
            keyDifferentiators={detail.keyDifferentiators}
            generatedAt={detail.generatedAt}
            sourceTicketKey={detail.sourceTicketKey}
          />

          <ComparisonParticipantGrid participants={detail.participants} />

          <ComparisonStatCards winner={winner} participants={detail.participants} />

          <ComparisonUnifiedMetrics participants={detail.participants} />

          <ComparisonDecisionPoints decisionPoints={detail.decisionPoints} />

          {detail.complianceRows.length > 0 && (
            <ComparisonComplianceHeatmap
              rows={detail.complianceRows}
              participants={detail.participants}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
