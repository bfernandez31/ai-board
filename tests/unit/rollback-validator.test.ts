import { describe, it, expect } from 'vitest';
import {
  canRollbackToInbox,
  canRollbackToPlan,
  canRollbackToSpecify,
  canRollbackToBuild,
  validateRollback,
  ROLLBACK_MESSAGES,
  type Job,
} from '@/app/lib/workflows/rollback-validator';
import { Stage, JobStatus, WorkflowType } from '@prisma/client';

describe('canRollbackToInbox', () => {
  describe('BUILD → INBOX (QUICK)', () => {
    it('should allow rollback with QUICK workflowType and FAILED job', () => {
      const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'quick-impl' };
      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, job);
      expect(result.allowed).toBe(true);
    });

    it('should allow rollback with QUICK workflowType and CANCELLED job', () => {
      const job: Job = { id: 1, status: 'CANCELLED' as JobStatus, command: 'quick-impl' };
      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, job);
      expect(result.allowed).toBe(true);
    });

    it('should block rollback for FULL workflow type', () => {
      const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'implement' };
      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'FULL' as WorkflowType, job);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('quick-impl');
    });
  });

  describe('SPECIFY → INBOX (any workflow)', () => {
    it('should allow rollback with FAILED job', () => {
      const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'specify' };
      const result = canRollbackToInbox('SPECIFY' as Stage, 'INBOX' as Stage, 'FULL' as WorkflowType, job);
      expect(result.allowed).toBe(true);
    });

    it('should allow rollback with CANCELLED job', () => {
      const job: Job = { id: 1, status: 'CANCELLED' as JobStatus, command: 'specify' };
      const result = canRollbackToInbox('SPECIFY' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, job);
      expect(result.allowed).toBe(true);
    });

    it('should block rollback when job is RUNNING', () => {
      const job: Job = { id: 1, status: 'RUNNING' as JobStatus, command: 'specify' };
      const result = canRollbackToInbox('SPECIFY' as Stage, 'INBOX' as Stage, 'FULL' as WorkflowType, job);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('still running');
    });
  });

  describe('Invalid transitions', () => {
    it('should block rollback from PLAN to INBOX', () => {
      const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'plan' };
      const result = canRollbackToInbox('PLAN' as Stage, 'INBOX' as Stage, 'FULL' as WorkflowType, job);
      expect(result.allowed).toBe(false);
    });

    it('should block rollback when no job exists', () => {
      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, null);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No workflow job found for this ticket');
    });

    it('should block rollback when job is COMPLETED', () => {
      const job: Job = { id: 1, status: 'COMPLETED' as JobStatus, command: 'quick-impl' };
      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, job);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('completed successfully');
    });

    it('should block rollback when job is PENDING', () => {
      const job: Job = { id: 1, status: 'PENDING' as JobStatus, command: 'quick-impl' };
      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, job);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('pending');
    });
  });
});

describe('canRollbackToSpecify', () => {
  it('should allow PLAN → SPECIFY with FAILED job', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'plan' };
    const result = canRollbackToSpecify('PLAN' as Stage, 'SPECIFY' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should allow PLAN → SPECIFY with CANCELLED job', () => {
    const job: Job = { id: 1, status: 'CANCELLED' as JobStatus, command: 'plan' };
    const result = canRollbackToSpecify('PLAN' as Stage, 'SPECIFY' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should block when job is RUNNING', () => {
    const job: Job = { id: 1, status: 'RUNNING' as JobStatus, command: 'plan' };
    const result = canRollbackToSpecify('PLAN' as Stage, 'SPECIFY' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });

  it('should block invalid stage pair', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'specify' };
    const result = canRollbackToSpecify('SPECIFY' as Stage, 'SPECIFY' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });

  it('should block when no job exists', () => {
    const result = canRollbackToSpecify('PLAN' as Stage, 'SPECIFY' as Stage, 'FULL' as WorkflowType, null);
    expect(result.allowed).toBe(false);
  });
});

describe('canRollbackToPlan', () => {
  describe('VERIFY → PLAN (FULL)', () => {
    it('should allow rollback with COMPLETED job', () => {
      const job: Job = { id: 1, status: 'COMPLETED' as JobStatus, command: 'verify' };
      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);
      expect(result.allowed).toBe(true);
    });

    it('should allow rollback with FAILED job', () => {
      const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'verify' };
      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);
      expect(result.allowed).toBe(true);
    });

    it('should allow rollback with CANCELLED job', () => {
      const job: Job = { id: 1, status: 'CANCELLED' as JobStatus, command: 'verify' };
      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);
      expect(result.allowed).toBe(true);
    });

    it('should block rollback for QUICK workflow type', () => {
      const job: Job = { id: 1, status: 'COMPLETED' as JobStatus, command: 'verify' };
      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'QUICK' as WorkflowType, job);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('QUICK');
    });

    it('should block rollback for CLEAN workflow type', () => {
      const job: Job = { id: 1, status: 'COMPLETED' as JobStatus, command: 'verify' };
      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'CLEAN' as WorkflowType, job);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('CLEAN');
    });
  });

  describe('BUILD → PLAN (FULL)', () => {
    it('should allow rollback with FAILED job', () => {
      const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'implement' };
      const result = canRollbackToPlan('BUILD' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);
      expect(result.allowed).toBe(true);
    });

    it('should allow rollback with CANCELLED job', () => {
      const job: Job = { id: 1, status: 'CANCELLED' as JobStatus, command: 'implement' };
      const result = canRollbackToPlan('BUILD' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);
      expect(result.allowed).toBe(true);
    });

    it('should block rollback for QUICK workflow', () => {
      const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'quick-impl' };
      const result = canRollbackToPlan('BUILD' as Stage, 'PLAN' as Stage, 'QUICK' as WorkflowType, job);
      expect(result.allowed).toBe(false);
    });
  });

  describe('Invalid transitions', () => {
    it('should block rollback from VERIFY → INBOX', () => {
      const job: Job = { id: 1, status: 'COMPLETED' as JobStatus, command: 'verify' };
      const result = canRollbackToPlan('VERIFY' as Stage, 'INBOX' as Stage, 'FULL' as WorkflowType, job);
      expect(result.allowed).toBe(false);
    });

    it('should block rollback when no job exists', () => {
      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, null);
      expect(result.allowed).toBe(false);
    });

    it('should block rollback when job is RUNNING', () => {
      const job: Job = { id: 1, status: 'RUNNING' as JobStatus, command: 'verify' };
      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);
      expect(result.allowed).toBe(false);
    });

    it('should block rollback when job is PENDING', () => {
      const job: Job = { id: 1, status: 'PENDING' as JobStatus, command: 'verify' };
      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);
      expect(result.allowed).toBe(false);
    });
  });
});

describe('canRollbackToBuild', () => {
  it('should allow VERIFY → BUILD with FAILED job', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'verify' };
    const result = canRollbackToBuild('VERIFY' as Stage, 'BUILD' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should allow VERIFY → BUILD with CANCELLED job', () => {
    const job: Job = { id: 1, status: 'CANCELLED' as JobStatus, command: 'verify' };
    const result = canRollbackToBuild('VERIFY' as Stage, 'BUILD' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should block when job is RUNNING', () => {
    const job: Job = { id: 1, status: 'RUNNING' as JobStatus, command: 'verify' };
    const result = canRollbackToBuild('VERIFY' as Stage, 'BUILD' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });

  it('should block invalid stage pair', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'implement' };
    const result = canRollbackToBuild('BUILD' as Stage, 'BUILD' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });
});

describe('validateRollback', () => {
  it('should delegate SPECIFY → INBOX to canRollbackToInbox', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'specify' };
    const result = validateRollback('SPECIFY' as Stage, 'INBOX' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should delegate PLAN → SPECIFY to canRollbackToSpecify', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'plan' };
    const result = validateRollback('PLAN' as Stage, 'SPECIFY' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should delegate BUILD → PLAN to canRollbackToPlan', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'implement' };
    const result = validateRollback('BUILD' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should delegate VERIFY → BUILD to canRollbackToBuild', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'verify' };
    const result = validateRollback('VERIFY' as Stage, 'BUILD' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should return not allowed for invalid target', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'verify' };
    const result = validateRollback('VERIFY' as Stage, 'SHIP' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });
});

describe('ROLLBACK_MESSAGES', () => {
  it('should have messages for all rollback paths', () => {
    expect(ROLLBACK_MESSAGES['SPECIFY→INBOX']).toBeDefined();
    expect(ROLLBACK_MESSAGES['PLAN→SPECIFY']).toBeDefined();
    expect(ROLLBACK_MESSAGES['BUILD→PLAN']).toBeDefined();
    expect(ROLLBACK_MESSAGES['BUILD→INBOX']).toBeDefined();
    expect(ROLLBACK_MESSAGES['VERIFY→BUILD']).toBeDefined();
    expect(ROLLBACK_MESSAGES['VERIFY→PLAN']).toBeDefined();
  });
});
