'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AgentOption } from '@/lib/analytics/types';

interface HeatmapFiltersProps {
  year: string;
  onYearChange: (year: string) => void;
  availableYears: number[];
  agent: string;
  onAgentChange: (agent: string) => void;
  availableAgents: AgentOption[];
}

export function HeatmapFilters({
  year,
  onYearChange,
  availableYears,
  agent,
  onAgentChange,
  availableAgents,
}: HeatmapFiltersProps) {
  return (
    <div className="flex gap-2">
      <Select value={year} onValueChange={onYearChange}>
        <SelectTrigger className="w-[160px]" data-testid="heatmap-year-filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="rolling">Last 12 months</SelectItem>
          {availableYears.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={agent} onValueChange={onAgentChange}>
        <SelectTrigger className="w-[150px]" data-testid="heatmap-agent-filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableAgents.map((a) => (
            <SelectItem key={a.value} value={a.value}>
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
