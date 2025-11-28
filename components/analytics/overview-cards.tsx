'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalyticsSummary } from '@/lib/analytics/types';
import { formatDuration } from '@/lib/analytics/calculations';
import { DollarSign, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

interface OverviewCardsProps {
  summary: AnalyticsSummary;
}

export function OverviewCards({ summary }: OverviewCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Cost Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${summary.totalCostUsd.toFixed(2)}
          </div>
          {summary.costTrendPercent !== null && (
            <p className="text-xs text-muted-foreground">
              {summary.costTrendPercent > 0 ? '+' : ''}
              {summary.costTrendPercent.toFixed(1)}% vs. previous period
            </p>
          )}
          {summary.costTrendPercent === null && (
            <p className="text-xs text-muted-foreground">No previous data</p>
          )}
        </CardContent>
      </Card>

      {/* Success Rate Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.successRatePercent !== null
              ? `${summary.successRatePercent.toFixed(1)}%`
              : 'N/A'}
          </div>
          {summary.successRatePercent === null && (
            <p className="text-xs text-muted-foreground">
              No completed jobs
            </p>
          )}
          {summary.successRatePercent !== null && (
            <p className="text-xs text-muted-foreground">
              Jobs completed successfully
            </p>
          )}
        </CardContent>
      </Card>

      {/* Average Duration Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.avgDurationMs !== null
              ? formatDuration(summary.avgDurationMs)
              : 'N/A'}
          </div>
          {summary.avgDurationMs === null && (
            <p className="text-xs text-muted-foreground">
              No completed jobs
            </p>
          )}
          {summary.avgDurationMs !== null && (
            <p className="text-xs text-muted-foreground">
              Per completed job
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tickets Shipped Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tickets Shipped</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.ticketsShippedThisMonth}
          </div>
          <p className="text-xs text-muted-foreground">This month</p>
        </CardContent>
      </Card>
    </div>
  );
}
