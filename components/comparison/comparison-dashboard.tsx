'use client';

import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useComparisonDetail } from '@/hooks/use-comparisons';
import { ComparisonRanking } from './comparison-ranking';
import { ComparisonMetrics } from './comparison-metrics';
import { ComparisonDecisions } from './comparison-decisions';
import { ComparisonCompliance } from './comparison-compliance';

interface ComparisonDashboardProps {
  projectId: number;
  comparisonId: number;
  onBack: () => void;
}

export function ComparisonDashboard({ projectId, comparisonId, onBack }: ComparisonDashboardProps) {
  const { data, isLoading, error } = useComparisonDetail(projectId, comparisonId, true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading comparison...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <p className="text-muted-foreground">Failed to load comparison details.</p>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to list
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-foreground">
            Comparison from {data.sourceTicketKey}
          </h3>
          <p className="text-xs text-muted-foreground truncate max-w-md">
            {data.recommendation}
          </p>
        </div>
      </div>

      <section>
        <h4 className="text-sm font-medium text-foreground mb-3">Ranking</h4>
        <ComparisonRanking entries={data.entries} />
      </section>

      <section>
        <h4 className="text-sm font-medium text-foreground mb-3">Metrics</h4>
        <ComparisonMetrics entries={data.entries} />
      </section>

      {data.decisionPoints.length > 0 && (
        <section>
          <h4 className="text-sm font-medium text-foreground mb-3">Decision Points</h4>
          <ComparisonDecisions decisionPoints={data.decisionPoints} />
        </section>
      )}

      <section>
        <h4 className="text-sm font-medium text-foreground mb-3">Constitution Compliance</h4>
        <ComparisonCompliance entries={data.entries} />
      </section>
    </div>
  );
}
