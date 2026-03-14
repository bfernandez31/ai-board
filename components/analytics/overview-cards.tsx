'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  Ship,
  CircleCheckBig,
} from 'lucide-react';
import type { OverviewMetrics } from '@/lib/analytics/types';
import { formatCost, formatDuration, formatPercentage } from '@/lib/analytics/aggregations';
import { cn } from '@/lib/utils';

interface OverviewCardsProps {
  metrics: OverviewMetrics;
}

export function OverviewCards({ metrics }: OverviewCardsProps) {
  const trendUp = metrics.costTrend >= 0;
  const trendIcon = trendUp ? (
    <TrendingUp className="h-4 w-4 text-destructive" />
  ) : (
    <TrendingDown className="h-4 w-4 text-foreground" />
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Total Cost</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCost(metrics.totalCost)}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {trendIcon}
            <span className={cn(trendUp ? 'text-destructive' : 'text-foreground')}>
              {trendUp ? '+' : ''}
              {formatPercentage(metrics.costTrend)}
            </span>
            <span>vs previous period</span>
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Tickets Shipped</CardTitle>
          <Ship className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.ticketsShipped.count}</div>
          <p className="text-xs text-muted-foreground">{metrics.ticketsShipped.label}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Tickets Closed</CardTitle>
          <CircleCheckBig className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.ticketsClosed.count}</div>
          <p className="text-xs text-muted-foreground">{metrics.ticketsClosed.label}</p>
        </CardContent>
      </Card>
    </div>
  );
}
