'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  HeatmapAgentFilter,
  HeatmapAgentOption,
  HeatmapFilters as HeatmapFiltersType,
  HeatmapPeriod,
} from '@/lib/activity-heatmap/types';

interface HeatmapFiltersProps {
  filters: HeatmapFiltersType;
  availableYears: number[];
  availableAgents: HeatmapAgentOption[];
  onChange: (next: HeatmapFiltersType) => void;
}

const ROLLING_VALUE = 'last-12-months';

function periodValue(p: HeatmapPeriod): string {
  return p === 'last-12-months' ? ROLLING_VALUE : String(p);
}

function parsePeriod(value: string): HeatmapPeriod {
  if (value === ROLLING_VALUE) return 'last-12-months';
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 'last-12-months' : parsed;
}

export function HeatmapFilters({
  filters,
  availableYears,
  availableAgents,
  onChange,
}: HeatmapFiltersProps) {
  // Hide the agent filter entirely when 0 or 1 distinct agents have activity — but keep
  // it visible whenever a non-default agent is currently selected, so users can recover
  // from a stale/period-mismatched `agent` param (which would otherwise produce an empty
  // dataset the user couldn't clear from the UI).
  const namedAgents = availableAgents.filter((a) => a.value !== 'all');
  const showAgentFilter = namedAgents.length > 1 || filters.agent !== 'all';

  const showYearSelector = availableYears.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showAgentFilter && (
        <Select
          value={filters.agent}
          onValueChange={(value) =>
            onChange({ ...filters, agent: value as HeatmapAgentFilter })
          }
        >
          <SelectTrigger
            className="w-full sm:w-[160px]"
            data-testid="activity-heatmap-agent-filter"
          >
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            {availableAgents.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showYearSelector && (
        <Select
          value={periodValue(filters.period)}
          onValueChange={(value) => onChange({ ...filters, period: parsePeriod(value) })}
        >
          <SelectTrigger
            className="w-full sm:w-[180px]"
            data-testid="activity-heatmap-period-filter"
          >
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ROLLING_VALUE}>Last 12 months</SelectItem>
            {availableYears.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
