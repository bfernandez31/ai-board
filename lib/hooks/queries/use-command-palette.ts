'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { CommandPaletteResponse } from '@/lib/types';

async function fetchCommandPalette(
  projectId: number,
  query: string
): Promise<CommandPaletteResponse> {
  const response = await fetch(
    `/api/projects/${projectId}/command-palette?q=${encodeURIComponent(query)}`
  );

  if (!response.ok) {
    throw new Error('Command palette request failed');
  }

  return response.json();
}

export function useCommandPalette(projectId: number, query: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.projects.commandPalette(projectId, query),
    queryFn: () => fetchCommandPalette(projectId, query),
    enabled: enabled && projectId > 0,
    staleTime: 30_000,
  });
}
