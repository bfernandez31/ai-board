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
  HeatmapFilters,
  HeatmapYearOption,
  HeatmapYearSelection,
} from '@/lib/activity/heatmap-types';

interface ActivityHeatmapFiltersProps {
  filters: HeatmapFilters;
  yearOptions: HeatmapYearOption[];
  agentOptions: HeatmapAgentOption[];
  onChange: (next: Partial<HeatmapFilters>) => void;
}

export function ActivityHeatmapFilters({
  filters,
  yearOptions,
  agentOptions,
  onChange,
}: ActivityHeatmapFiltersProps) {
  const agentSelectableCount = agentOptions.filter((o) => o.value !== 'all').length;
  const showAgentFilter = agentSelectableCount >= 2;
  const yearDisabled = yearOptions.length <= 1;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="activity-heatmap-filters"
    >
      <Select
        value={filters.year}
        onValueChange={(value) => onChange({ year: value as HeatmapYearSelection })}
        disabled={yearDisabled}
      >
        <SelectTrigger className="w-[160px]" data-testid="activity-heatmap-year-filter">
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showAgentFilter && (
        <Select
          value={filters.agent}
          onValueChange={(value) => onChange({ agent: value as HeatmapAgentFilter })}
        >
          <SelectTrigger className="w-[160px]" data-testid="activity-heatmap-agent-filter">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            {agentOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
