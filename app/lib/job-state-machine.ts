export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/** Valid state transitions. Terminal states only allow self-transitions (idempotent). */
export const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  PENDING: ['PENDING', 'RUNNING', 'CANCELLED'],
  RUNNING: ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: ['COMPLETED'],
  FAILED: ['FAILED'],
  CANCELLED: ['CANCELLED'],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function isTerminalStatus(status: JobStatus): boolean {
  const allowed = VALID_TRANSITIONS[status];
  return allowed.length === 1 && allowed[0] === status;
}

export class InvalidTransitionError extends Error {
  constructor(from: JobStatus, to: JobStatus) {
    super(`Invalid transition from ${from} to ${to}`);
    this.name = 'InvalidTransitionError';
  }
}
