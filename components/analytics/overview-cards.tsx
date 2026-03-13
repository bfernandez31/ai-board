'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle, Ship, XCircle } from 'lucide-react';
import type { OverviewMetrics, TimeRange } from '@/lib/analytics/types';
import { formatCost, formatDuration, formatPercentage, getTimeRangeLabel } from '@/lib/analytics/aggregations';
import { cn } from '@/lib/utils';

interface OverviewCardsProps {
  metrics: OverviewMetrics;
  timeRange: TimeRange;
}

export function OverviewCards({ metrics, timeRange }: OverviewCardsProps) {
  const rangeLabel = getTimeRangeLabel(timeRange);
  const costIncreased = metrics.costTrend >= 0;
  const trendColor = costIncreased ? 'text-red-400' : 'text-green-400';
  const TrendIcon = costIncreased ? TrendingUp : TrendingDown;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {/* Total Cost */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Total Cost</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCost(metrics.totalCost)}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendIcon className={cn('h-4 w-4', trendColor)} />
            <span className={trendColor}>
              {costIncreased ? '+' : ''}
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
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </CardContent>
      </Card>

      {/* Tickets Closed */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Tickets Closed</CardTitle>
          <XCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.ticketsClosed}</div>
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </CardContent>
      </Card>
    </div>
  );
}
