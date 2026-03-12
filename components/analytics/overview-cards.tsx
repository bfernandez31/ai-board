'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle, Ship } from 'lucide-react';
import type { OverviewMetrics } from '@/lib/analytics/types';
import { formatCost, formatDuration, formatPercentage } from '@/lib/analytics/aggregations';
import { cn } from '@/lib/utils';

interface OverviewCardsProps {
  metrics: OverviewMetrics;
}

export function OverviewCards({ metrics }: OverviewCardsProps) {
  const trendIcon =
    metrics.costTrend >= 0 ? (
      <TrendingUp className="h-4 w-4 text-red-400" />
    ) : (
      <TrendingDown className="h-4 w-4 text-green-400" />
    );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Cost */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Total Cost</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCost(metrics.totalCost)}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {trendIcon}
            <span
              className={cn(metrics.costTrend >= 0 ? 'text-red-400' : 'text-green-400')}
            >
              {metrics.costTrend >= 0 ? '+' : ''}
              {formatPercentage(metrics.costTrend)}
            </span>
            <span>vs previous period</span>
          </div>
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Success Rate</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPercentage(metrics.successRate)}</div>
          <p className="text-xs text-muted-foreground">of jobs completed successfully</p>
        </CardContent>
      </Card>

      {/* Avg Duration */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Avg Duration</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatDuration(metrics.avgDuration)}</div>
          <p className="text-xs text-muted-foreground">per job execution</p>
        </CardContent>
      </Card>

      {/* Tickets Shipped */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Tickets Shipped</CardTitle>
          <Ship className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.ticketsShipped}</div>
          <p className="text-xs text-muted-foreground">this month</p>
        </CardContent>
      </Card>
    </div>
  );
}
