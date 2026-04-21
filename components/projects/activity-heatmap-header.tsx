'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAgentLabel } from '@/app/lib/utils/agent-resolution';
import type { AgentFilter } from '@/lib/analytics/types';
import type {
  HeatmapAgentOption,
  HeatmapData,
  HeatmapPeriodKey,
} from '@/lib/heatmap/types';
import { serializePeriodParam } from '@/lib/heatmap/period';

interface ActivityHeatmapHeaderProps {
  totals: HeatmapData['totals'];
  period: HeatmapData['period'];
  selectedPeriod: HeatmapPeriodKey;
  availableYears: number[];
  onPeriodChange: (next: HeatmapPeriodKey) => void;
  availableAgents: HeatmapAgentOption[];
  selectedAgent: AgentFilter;
  onAgentChange: (next: AgentFilter) => void;
}

export function ActivityHeatmapHeader({
  totals,
  period,
  selectedPeriod,
  availableYears,
  onPeriodChange,
  availableAgents,
  selectedAgent,
  onAgentChange,
}: ActivityHeatmapHeaderProps) {
  const showPeriodSelector = availableYears.length > 0;
  const showAgentFilter = availableAgents.length >= 2;
  const periodValue = serializePeriodParam(selectedPeriod);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p
        className="text-sm text-foreground"
        data-testid="activity-heatmap-counter"
      >
        <span className="font-medium">{totals.jobs}</span>
        {' jobs · '}
        <span className="font-medium">{totals.ticketsShipped}</span>
        {' tickets shipped in '}
        {period.label}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {showPeriodSelector && (
          <Select
            value={periodValue}
            onValueChange={(value) => {
              if (value === '12m') {
                onPeriodChange({ kind: 'rolling', months: 12 });
              } else {
                const parsedYear = Number(value);
                if (!Number.isNaN(parsedYear)) {
                  onPeriodChange({ kind: 'year', year: parsedYear });
                }
              }
            }}
          >
            <SelectTrigger
              className="w-[180px]"
              data-testid="activity-heatmap-period-filter"
            >
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12m">Last 12 months</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {showAgentFilter && (
          <Select
            value={selectedAgent}
            onValueChange={(value) => onAgentChange(value as AgentFilter)}
          >
            <SelectTrigger
              className="w-[160px]"
              data-testid="activity-heatmap-agent-filter"
            >
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {availableAgents.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {getAgentLabel(option.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
