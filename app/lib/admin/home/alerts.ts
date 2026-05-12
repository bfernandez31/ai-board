import type { AlertCard } from './types';

export const CRITICAL_CRONS = ['nightly-health', 'nightly-log-prune'] as const;
export type CriticalCronName = (typeof CRITICAL_CRONS)[number];

export async function detectAlerts(): Promise<AlertCard[]> {
  return [];
}
