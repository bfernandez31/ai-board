'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { CalibrationDashboardData } from '@/lib/calibration/types';

async function fetchCalibration(
  projectId: number
): Promise<CalibrationDashboardData> {
  const res = await fetch(`/api/projects/${projectId}/calibration`);
  if (!res.ok) {
    throw new Error(`Failed to load calibration: HTTP ${res.status}`);
  }
  return res.json();
}

export function useCalibrationDashboard(
  projectId: number,
  initialData?: CalibrationDashboardData
) {
  return useQuery<CalibrationDashboardData>({
    queryKey: queryKeys.calibration.dashboard(projectId),
    queryFn: () => fetchCalibration(projectId),
    ...(initialData !== undefined ? { initialData } : {}),
    refetchInterval: 15000,
    staleTime: 10000,
  });
}
