'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeatmapGrid } from './heatmap-grid';
import { HeatmapFilters } from './heatmap-filters';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActivityHeatmapResponse } from '@/lib/db/activity';

interface ActivityHeatmapProps {
  initialData?: ActivityHeatmapResponse | null;
}

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const range = searchParams.get('range') || 'last-12-months';
  const agent = searchParams.get('agent') || 'all';

  const { data, isLoading } = useQuery<ActivityHeatmapResponse>({
    queryKey: ['activity-heatmap', range, agent],
    queryFn: async () => {
      const params = new URLSearchParams({ range, agent });
      const response = await fetch(`/api/activity?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch activity data');
      const result = await response.json();
      return result as ActivityHeatmapResponse;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const updateFilters = (newRange?: string, newAgent?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newRange) params.set('range', newRange);
    if (newAgent) params.set('agent', newAgent);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const isDefaultView = range === 'last-12-months' && agent === 'all';
  const heatmap = data ?? (isDefaultView ? initialData : undefined);

  return (
    <Card className="w-full mt-12 bg-card/50 backdrop-blur-sm border-accent/20">
      <CardHeader className="pb-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              Activity
              {heatmap && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {heatmap.stats.totalJobs} jobs · {heatmap.stats.totalTicketsShipped} tickets shipped in the {range === 'last-12-months' ? 'last year' : range}
                </span>
              )}
            </CardTitle>
          </div>
          <HeatmapFilters 
            currentRange={range} 
            currentAgent={agent}
            userCreatedAt={heatmap?.userCreatedAt}
            availableAgents={heatmap?.availableAgents}
            onRangeChange={(r) => updateFilters(r)}
            onAgentChange={(a) => updateFilters(undefined, a)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {(isLoading && !heatmap) ? (
          <div className="h-[180px] w-full flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        ) : heatmap ? (
          <HeatmapGrid 
            data={heatmap.data} 
            range={range} 
          />
        ) : (
          <div className="h-[180px] flex items-center justify-center text-muted-foreground">
            Failed to load activity data
          </div>
        )}
      </CardContent>
    </Card>
  );
}
