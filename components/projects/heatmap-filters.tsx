'use client';

import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

interface HeatmapFiltersProps {
  currentRange: string;
  currentAgent: string;
  userCreatedAt?: string | undefined;
  availableAgents?: { value: string; label: string; jobCount: number }[] | undefined;
  onRangeChange: (range: string) => void;
  onAgentChange: (agent: string) => void;
}

export function HeatmapFilters({
  currentRange,
  currentAgent,
  userCreatedAt,
  availableAgents = [],
  onRangeChange,
  onAgentChange,
}: HeatmapFiltersProps) {
  const currentYear = new Date().getFullYear();
  const startYear = userCreatedAt ? new Date(userCreatedAt).getFullYear() : currentYear;
  
  const years = [];
  for (let y = currentYear; y >= startYear; y--) {
    years.push(y.toString());
  }

  const showAgentFilter = availableAgents.length > 1;

  return (
    <div className="flex items-center gap-2">
      {showAgentFilter && (
        <Select value={currentAgent} onValueChange={onAgentChange}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-background/50 border-accent/20">
            <SelectValue placeholder="All Agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {availableAgents.map((agent) => (
              <SelectItem key={agent.value} value={agent.value}>
                {agent.label} ({agent.jobCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {years.length > 0 && (
        <Select value={currentRange} onValueChange={onRangeChange}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-background/50 border-accent/20">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last-12-months">Last 12 months</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
