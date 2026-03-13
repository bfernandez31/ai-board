'use client';

import { BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getStatusScopeLabel, type AnalyticsFilterState } from '@/lib/analytics/types';

interface EmptyStateProps {
  filters?: AnalyticsFilterState;
}

export function EmptyState({ filters }: EmptyStateProps) {
  const scopeSummary = filters
    ? `${getStatusScopeLabel(filters.statusScope)} in ${filters.periodLabel}${
        filters.agentScope === 'all' ? '' : ` for ${filters.agentScope}`
      }`
    : 'the selected filters';

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Analytics Data</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          No jobs or tickets matched {scopeSummary}. Adjust the date range, status, or agent
          filter to see analytics for a different slice.
        </p>
      </CardContent>
    </Card>
  );
}
