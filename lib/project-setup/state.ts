import type { ProjectSetupAttempt, ProjectSetupStatus } from '@prisma/client';
import type { DerivedProjectSetupState } from './types';

const ACTIVE_STATUSES: ProjectSetupStatus[] = ['PENDING', 'RUNNING'];
const TERMINAL_STATUSES: ProjectSetupStatus[] = ['COMPLETED', 'FAILED'];

const ALLOWED_TRANSITIONS: Record<
  ProjectSetupStatus,
  ProjectSetupStatus[]
> = {
  PENDING: ['RUNNING', 'FAILED'],
  RUNNING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
};

export function isSetupRequired(project: {
  config: unknown;
  configSyncedAt: Date | null;
}): boolean {
  return !(project.config && project.configSyncedAt);
}

export function isActiveSetupStatus(status: ProjectSetupStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function isTerminalSetupStatus(status: ProjectSetupStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function getElapsedSeconds(
  attempt: Pick<ProjectSetupAttempt, 'createdAt' | 'startedAt' | 'completedAt'>
): number | null {
  const startedAt = attempt.startedAt ?? attempt.createdAt;
  const endedAt = attempt.completedAt ?? new Date();
  const elapsedMs = endedAt.getTime() - startedAt.getTime();

  if (elapsedMs < 0) {
    return 0;
  }

  return Math.floor(elapsedMs / 1000);
}

export function canTransitionSetupStatus(
  currentStatus: ProjectSetupStatus,
  nextStatus: ProjectSetupStatus
): boolean {
  if (currentStatus === nextStatus) {
    return true;
  }

  return ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function deriveProjectSetupState(project: {
  config: unknown;
  configSyncedAt: Date | null;
  setupAttempts: ProjectSetupAttempt[];
}): DerivedProjectSetupState {
  const latestAttempt = project.setupAttempts[0] ?? null;

  if (!isSetupRequired(project)) {
    return { kind: 'not_required', latestAttempt };
  }

  if (!latestAttempt) {
    return { kind: 'ready_to_start', latestAttempt: null };
  }

  switch (latestAttempt.status) {
    case 'PENDING':
      return { kind: 'pending', latestAttempt };
    case 'RUNNING':
      return {
        kind: 'running',
        latestAttempt,
        elapsedSeconds: getElapsedSeconds(latestAttempt) ?? 0,
      };
    case 'FAILED':
      return { kind: 'failed', latestAttempt };
    case 'COMPLETED':
      return { kind: 'completed', latestAttempt };
  }
}
