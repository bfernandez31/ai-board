'use client';

import { DollarSign, Clock, Zap, Database } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { TicketStats } from '@/lib/types/job-types';
import {
  formatCost,
  formatDuration,
  formatPercentage,
  formatNumber,
} from '@/lib/analytics/aggregations';

interface StatsSummaryCardsProps {
  stats: TicketStats;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string | undefined;
}

function StatCard({ icon, label, value, sublabel }: StatCardProps) {
  return (
    <Card className="bg-[#1e1e2e] border-[#313244]">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 text-[#89b4fa]">{icon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[#a6adc8] uppercase tracking-wider mb-1">
              {label}
            </p>
            <p className="text-lg font-bold text-[#cdd6f4] truncate">{value}</p>
            {sublabel && (
              <p className="text-xs text-[#6c7086] mt-0.5">{sublabel}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsSummaryCards({ stats }: StatsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        icon={<DollarSign className="w-5 h-5" />}
        label="Total Cost"
        value={stats.totalCost > 0 ? formatCost(stats.totalCost) : '—'}
      />
      <StatCard
        icon={<Clock className="w-5 h-5" />}
        label="Total Duration"
        value={stats.totalDuration > 0 ? formatDuration(stats.totalDuration) : '—'}
      />
      <StatCard
        icon={<Zap className="w-5 h-5" />}
        label="Total Tokens"
        value={stats.totalTokens > 0 ? formatNumber(stats.totalTokens) : '—'}
        sublabel={
          stats.totalTokens > 0
            ? `${formatNumber(stats.totalInputTokens)} in / ${formatNumber(stats.totalOutputTokens)} out`
            : undefined
        }
      />
      <StatCard
        icon={<Database className="w-5 h-5" />}
        label="Cache Efficiency"
        value={
          stats.cacheEfficiency !== null
            ? formatPercentage(stats.cacheEfficiency)
            : '—'
        }
        sublabel={
          stats.cacheReadTokens > 0
            ? `${formatNumber(stats.cacheReadTokens)} cached`
            : undefined
        }
      />
    </div>
  );
}
