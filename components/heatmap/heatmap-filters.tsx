'use client';

import type { AgentOption, AgentFilter } from '@/lib/analytics/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface HeatmapFiltersProps {
  year: string;
  agent: AgentFilter;
  availableYears: number[];
  availableAgents: AgentOption[];
  userCreatedYear: number;
  onYearChange: (year: string) => void;
  onAgentChange: (agent: AgentFilter) => void;
}

export function HeatmapFilters({
  year,
  agent,
  availableYears,
  availableAgents,
  userCreatedYear,
  onYearChange,
  onAgentChange,
}: HeatmapFiltersProps) {
  const currentYear = new Date().getFullYear();
  const showYearSelector = userCreatedYear < currentYear;
  // Agent filter hidden when 0 or 1 real agents (excluding "all")
  const realAgents = availableAgents.filter((a) => a.value !== 'all');
  const showAgentFilter = realAgents.length > 1;

  return (
    <div className="flex items-center gap-2">
      {showYearSelector && (
        <Select value={year} onValueChange={onYearChange}>
          <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="heatmap-year-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last-12-months">Last 12 months</SelectItem>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showAgentFilter && (
        <Select value={agent} onValueChange={(v) => onAgentChange(v as AgentFilter)}>
          <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="heatmap-agent-filter">
            <SelectValue />
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
    </div>
  );
}
