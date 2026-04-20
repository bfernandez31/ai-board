"use client";

import { HeatmapStats, HeatmapFilters } from "@/lib/types/activity";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface ActivityHeatmapHeaderProps {
  stats: HeatmapStats;
  filters: HeatmapFilters;
}

export function ActivityHeatmapHeader({ stats, filters }: ActivityHeatmapHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleAgentChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("agent");
    } else {
      params.set("agent", value);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleYearChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "last-12-months") {
      params.delete("year");
    } else {
      params.set("year", value);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
      <div className="flex flex-col">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          AI Activity
        </h2>
        <div className="flex gap-4 mt-1">
          <div className="text-xs text-muted-foreground">
            <span className="text-foreground font-semibold">{stats.totalJobs}</span> Jobs
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="text-foreground font-semibold">{stats.totalShippedTickets}</span> Shipped
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={filters.currentAgent || "all"}
          onValueChange={handleAgentChange}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs bg-muted/30 border-border/50">
            <SelectValue placeholder="All Agents" />
          </SelectTrigger>
          <SelectContent className="aurora-glass border-border/40">
            <SelectItem value="all" className="text-xs">All Agents</SelectItem>
            {filters.availableAgents.map((agent) => (
              <SelectItem key={agent} value={agent} className="text-xs">
                {agent}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.currentYear}
          onValueChange={handleYearChange}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs bg-muted/30 border-border/50">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent className="aurora-glass border-border/40">
            <SelectItem value="last-12-months" className="text-xs">Last 12 Months</SelectItem>
            {filters.availableYears.map((year) => (
              <SelectItem key={year} value={year.toString()} className="text-xs">
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
