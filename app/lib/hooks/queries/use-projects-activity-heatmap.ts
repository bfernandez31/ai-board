'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  ProjectsActivityFilters,
  ProjectsActivityHeatmapResponse,
} from '@/app/lib/types/project';
import { buildProjectsActivitySearchParams } from '@/app/lib/utils/projects-activity-filters';

interface UseProjectsActivityHeatmapOptions {
  filters: ProjectsActivityFilters;
  initialData?: ProjectsActivityHeatmapResponse;
}

function filtersMatch(
  left: ProjectsActivityFilters,
  right: ProjectsActivityFilters
): boolean {
  return (
    left.period === right.period &&
    left.year === right.year &&
    left.agent === right.agent
  );
}

async function fetchProjectsActivityHeatmap(
  filters: ProjectsActivityFilters
): Promise<ProjectsActivityHeatmapResponse> {
  const params = buildProjectsActivitySearchParams(filters);
  const response = await fetch(`/api/projects/activity?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch projects activity heatmap');
  }

  return response.json();
}

export function useProjectsActivityHeatmap({
  filters,
  initialData,
}: UseProjectsActivityHeatmapOptions) {
  const shouldUseInitialData =
    initialData !== undefined && filtersMatch(filters, initialData.filters);

  return useQuery({
    queryKey: queryKeys.projects.activityHeatmap(
      filters.period,
      filters.year === null ? 'null' : String(filters.year),
      filters.agent
    ),
    queryFn: () => fetchProjectsActivityHeatmap(filters),
    initialData: shouldUseInitialData ? initialData : undefined,
    placeholderData: (previousData) => previousData,
    refetchInterval: 15000,
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });
}
