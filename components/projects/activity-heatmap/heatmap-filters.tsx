'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AGENT_LABELS } from '@/app/lib/utils/agent-resolution';
import type { Agent } from '@prisma/client';
import type {
  HeatmapAgentFilter,
  HeatmapFilters,
} from '@/lib/analytics/heatmap-types';

interface HeatmapFiltersProps {
  filters: HeatmapFilters;
  distinctAgents: Agent[];
  availableYears: number[];
  onChange: (next: Partial<{ period: string; agent: HeatmapAgentFilter }>) => void;
}

export function HeatmapFilters({
  filters,
  distinctAgents,
  availableYears,
  onChange,
}: HeatmapFiltersProps) {
  const showYearSelect = availableYears.length >= 2;
  const showAgentSelect = distinctAgents.length >= 2;

  const periodValue =
    filters.period.kind === 'last-12-months'
      ? 'last-12-months'
      : String(filters.period.year);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showYearSelect && (
        <Select
          value={periodValue}
          onValueChange={(value) => onChange({ period: value })}
        >
          <SelectTrigger
            className="w-[150px]"
            data-testid="activity-heatmap-period-filter"
            aria-label="Select time period"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last-12-months">Last 12 months</SelectItem>
            {availableYears.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {showAgentSelect && (
        <Select
          value={filters.agent}
          onValueChange={(value) => onChange({ agent: value as HeatmapAgentFilter })}
        >
          <SelectTrigger
            className="w-[140px]"
            data-testid="activity-heatmap-agent-filter"
            aria-label="Filter by agent"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {distinctAgents.map((agent) => (
              <SelectItem key={agent} value={agent}>
                {AGENT_LABELS[agent]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
