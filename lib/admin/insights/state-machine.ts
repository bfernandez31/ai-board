import type { AdminInsightsReportStatus } from '@prisma/client';

export const VALID_INSIGHTS_TRANSITIONS: Record<
  AdminInsightsReportStatus,
  AdminInsightsReportStatus[]
> = {
  RUNNING: ['RUNNING', 'COMPLETED', 'FAILED'],
  COMPLETED: ['COMPLETED'],
  FAILED: ['FAILED'],
};

export function canTransition(
  from: AdminInsightsReportStatus,
  to: AdminInsightsReportStatus
): boolean {
  return VALID_INSIGHTS_TRANSITIONS[from].includes(to);
}

export function isTerminalStatus(status: AdminInsightsReportStatus): boolean {
  return status === 'COMPLETED' || status === 'FAILED';
}

export class InvalidInsightsTransitionError extends Error {
  constructor(
    public from: AdminInsightsReportStatus,
    public to: AdminInsightsReportStatus
  ) {
    super(`Invalid transition from ${from} to ${to}`);
    this.name = 'InvalidInsightsTransitionError';
  }
}
