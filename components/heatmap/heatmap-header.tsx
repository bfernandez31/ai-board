'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { HeatmapAgentOption } from '@/lib/heatmap/types';

interface HeatmapHeaderProps {
  totalJobs: number;
  totalShipped: number;
  periodLabel: string;
  year: string;
  agent: string;
  availableYears: string[];
  availableAgents: HeatmapAgentOption[];
  accountCreatedYear: number;
  onYearChange: (year: string) => void;
  onAgentChange: (agent: string) => void;
}

export function HeatmapHeader({
  totalJobs,
  totalShipped,
  periodLabel,
  year,
  agent,
  availableYears,
  availableAgents,
  accountCreatedYear,
  onYearChange,
  onAgentChange,
}: HeatmapHeaderProps) {
  const currentYear = new Date().getUTCFullYear();
  const showYearSelector = accountCreatedYear < currentYear;
  const showAgentFilter = availableAgents.length > 2;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-testid="heatmap-header">
      <p className="text-sm text-muted-foreground" data-testid="heatmap-summary">
        <span className="font-medium text-foreground">{totalJobs.toLocaleString()} jobs</span>
        {' · '}
        <span className="font-medium text-foreground">{totalShipped.toLocaleString()} tickets shipped</span>
        {' '}
        {periodLabel}
      </p>

      <div className="flex items-center gap-2">
        {showYearSelector ? (
          <Select value={year} onValueChange={onYearChange}>
            <SelectTrigger className="w-[160px]" data-testid="heatmap-year-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rolling">Last 12 months</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground" data-testid="heatmap-year-label">
            Last 12 months
          </span>
        )}

        {showAgentFilter && (
          <Select value={agent} onValueChange={onAgentChange}>
            <SelectTrigger className="w-[160px]" data-testid="heatmap-agent-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableAgents.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
