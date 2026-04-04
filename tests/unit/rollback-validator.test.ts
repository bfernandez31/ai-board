import { describe, it, expect } from 'vitest';
import { canRollbackToInbox, canRollbackToPlan, canRollbackSpecifyToInbox, canRollbackPlanToSpecify, canRollbackBuildToPlan, canRollbackVerifyToBuild, type Job } from '@/app/lib/workflows/rollback-validator';
import { Stage, JobStatus, WorkflowType } from '@prisma/client';

describe('canRollbackToInbox', () => {
  describe('Valid rollback scenarios', () => {
    it('should allow rollback when BUILD → INBOX with QUICK workflowType and FAILED job', () => {
      const job: Job = {
        id: 1,
        status: 'FAILED' as JobStatus,
        command: 'quick-impl',
      };

      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, job);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow rollback when BUILD → INBOX with QUICK workflowType and CANCELLED job', () => {
      const job: Job = {
        id: 1,
        status: 'CANCELLED' as JobStatus,
        command: 'quick-impl',
      };

      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, job);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('Invalid workflow type', () => {
    it('should block rollback for FULL workflow type', () => {
      const job: Job = {
        id: 1,
        status: 'FAILED' as JobStatus,
        command: 'implement',
      };

      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'FULL' as WorkflowType, job);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rollback only available for quick-impl workflows. Normal workflows cannot be rolled back.');
    });
  });

  describe('Invalid stage transitions', () => {
    it('should block rollback from SPECIFY → INBOX', () => {
      const job: Job = {
        id: 1,
        status: 'FAILED' as JobStatus,
        command: 'specify',
      };

      const result = canRollbackToInbox('SPECIFY' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, job);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rollback only available from BUILD to INBOX stage');
    });

    it('should block rollback from BUILD → VERIFY', () => {
      const job: Job = {
        id: 1,
        status: 'FAILED' as JobStatus,
        command: 'quick-impl',
      };

      const result = canRollbackToInbox('BUILD' as Stage, 'VERIFY' as Stage, 'QUICK' as WorkflowType, job);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rollback only available from BUILD to INBOX stage');
    });

    it('should block rollback from INBOX → INBOX', () => {
      const job: Job = {
        id: 1,
        status: 'FAILED' as JobStatus,
        command: 'quick-impl',
      };

      const result = canRollbackToInbox('INBOX' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, job);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rollback only available from BUILD to INBOX stage');
    });
  });

  describe('Missing job scenarios', () => {
    it('should block rollback when no job exists', () => {
      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, null);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No workflow job found for this ticket');
    });
  });

  describe('Invalid job status scenarios', () => {
    it('should block rollback when job is RUNNING', () => {
      const job: Job = {
        id: 1,
        status: 'RUNNING' as JobStatus,
        command: 'quick-impl',
      };

      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, job);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Cannot rollback: workflow is still running. Wait for completion or cancel the job.');
    });

    it('should block rollback when job is COMPLETED', () => {
      const job: Job = {
        id: 1,
        status: 'COMPLETED' as JobStatus,
        command: 'quick-impl',
      };

      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, job);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Cannot rollback: workflow completed successfully. Rollback only available for failed or cancelled jobs.');
    });

    it('should block rollback when job is PENDING', () => {
      const job: Job = {
        id: 1,
        status: 'PENDING' as JobStatus,
        command: 'quick-impl',
      };

      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, job);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Cannot rollback: workflow is pending. Wait for completion or cancel the job.');
    });
  });

  describe('Edge cases', () => {
    it('should allow rollback for quick-impl with any workflow command', () => {
      const job: Job = {
        id: 1,
        status: 'FAILED' as JobStatus,
        command: 'quick-impl',
      };

      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, job);

      expect(result.allowed).toBe(true);
    });

    it('should work regardless of command type (filtering happens upstream)', () => {
      // Note: The validator doesn't filter jobs - it trusts the most recent job passed to it
      // Job filtering by command name happens in the API endpoint
      const aiboardJob: Job = {
        id: 1,
        status: 'FAILED' as JobStatus,
        command: 'comment-specify', // AI-BOARD job
      };

      const result = canRollbackToInbox('BUILD' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, aiboardJob);

      // Validator allows it (assumes filtering happened upstream)
      expect(result.allowed).toBe(true);
    });
  });
});

describe('canRollbackToPlan', () => {
  describe('Valid rollback scenarios', () => {
    it('should allow rollback when VERIFY → PLAN with FULL workflowType and COMPLETED job', () => {
      const job: Job = {
        id: 1,
        status: 'COMPLETED' as JobStatus,
        command: 'verify',
      };

      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow rollback when VERIFY → PLAN with FULL workflowType and FAILED job', () => {
      const job: Job = {
        id: 1,
        status: 'FAILED' as JobStatus,
        command: 'verify',
      };

      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow rollback when VERIFY → PLAN with FULL workflowType and CANCELLED job', () => {
      const job: Job = {
        id: 1,
        status: 'CANCELLED' as JobStatus,
        command: 'verify',
      };

      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('Invalid workflow type', () => {
    it('should block rollback for QUICK workflow type', () => {
      const job: Job = {
        id: 1,
        status: 'COMPLETED' as JobStatus,
        command: 'verify',
      };

      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'QUICK' as WorkflowType, job);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rollback only available for FULL workflows. QUICK workflows skip PLAN stage.');
    });

    it('should block rollback for CLEAN workflow type', () => {
      const job: Job = {
        id: 1,
        status: 'COMPLETED' as JobStatus,
        command: 'verify',
      };

      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'CLEAN' as WorkflowType, job);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rollback only available for FULL workflows. CLEAN workflows have different stage progression.');
    });
  });

  describe('Invalid stage transitions', () => {
    it('should block rollback from VERIFY → INBOX', () => {
      const job: Job = {
        id: 1,
        status: 'COMPLETED' as JobStatus,
        command: 'verify',
      };

      const result = canRollbackToPlan('VERIFY' as Stage, 'INBOX' as Stage, 'FULL' as WorkflowType, job);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rollback only available from VERIFY to PLAN stage');
    });

    it('should block rollback from BUILD → PLAN', () => {
      const job: Job = {
        id: 1,
        status: 'COMPLETED' as JobStatus,
        command: 'implement',
      };

      const result = canRollbackToPlan('BUILD' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rollback only available from VERIFY to PLAN stage');
    });

    it('should block rollback from VERIFY → VERIFY', () => {
      const job: Job = {
        id: 1,
        status: 'COMPLETED' as JobStatus,
        command: 'verify',
      };

      const result = canRollbackToPlan('VERIFY' as Stage, 'VERIFY' as Stage, 'FULL' as WorkflowType, job);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rollback only available from VERIFY to PLAN stage');
    });
  });

  describe('Missing job scenarios', () => {
    it('should block rollback when no job exists', () => {
      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, null);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No workflow job found for this ticket');
    });
  });

  describe('Invalid job status scenarios', () => {
    it('should block rollback when job is RUNNING', () => {
      const job: Job = {
        id: 1,
        status: 'RUNNING' as JobStatus,
        command: 'verify',
      };

      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Cannot rollback: workflow is still running. Wait for completion or cancel the job.');
    });

    it('should block rollback when job is PENDING', () => {
      const job: Job = {
        id: 1,
        status: 'PENDING' as JobStatus,
        command: 'verify',
      };

      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Cannot rollback: workflow is pending. Wait for completion or cancel the job.');
    });
  });

  describe('Edge cases', () => {
    it('should work regardless of command type (filtering happens upstream)', () => {
      // Note: The validator doesn't filter jobs - it trusts the most recent job passed to it
      // Job filtering by command name happens in the API endpoint
      const aiboardJob: Job = {
        id: 1,
        status: 'COMPLETED' as JobStatus,
        command: 'comment-verify', // AI-BOARD job
      };

      const result = canRollbackToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, aiboardJob);

      // Validator allows it (assumes filtering happened upstream)
      expect(result.allowed).toBe(true);
    });
  });
});

describe('canRollbackSpecifyToInbox', () => {
  it('should allow SPECIFY → INBOX with FULL workflow and FAILED job', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'specify' };
    const result = canRollbackSpecifyToInbox('SPECIFY' as Stage, 'INBOX' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should allow SPECIFY → INBOX with CANCELLED job', () => {
    const job: Job = { id: 1, status: 'CANCELLED' as JobStatus, command: 'specify' };
    const result = canRollbackSpecifyToInbox('SPECIFY' as Stage, 'INBOX' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should block when job is RUNNING', () => {
    const job: Job = { id: 1, status: 'RUNNING' as JobStatus, command: 'specify' };
    const result = canRollbackSpecifyToInbox('SPECIFY' as Stage, 'INBOX' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('running');
  });

  it('should block when no job exists', () => {
    const result = canRollbackSpecifyToInbox('SPECIFY' as Stage, 'INBOX' as Stage, 'FULL' as WorkflowType, null);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('No workflow job found for this ticket');
  });

  it('should block wrong stage transition (BUILD → INBOX)', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'implement' };
    const result = canRollbackSpecifyToInbox('BUILD' as Stage, 'INBOX' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });

  it('should block QUICK workflow', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'specify' };
    const result = canRollbackSpecifyToInbox('SPECIFY' as Stage, 'INBOX' as Stage, 'QUICK' as WorkflowType, job);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('FULL');
  });
});

describe('canRollbackPlanToSpecify', () => {
  it('should allow PLAN → SPECIFY with FULL workflow and FAILED job', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'plan' };
    const result = canRollbackPlanToSpecify('PLAN' as Stage, 'SPECIFY' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should allow PLAN → SPECIFY with CANCELLED job', () => {
    const job: Job = { id: 1, status: 'CANCELLED' as JobStatus, command: 'plan' };
    const result = canRollbackPlanToSpecify('PLAN' as Stage, 'SPECIFY' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should block when job is RUNNING', () => {
    const job: Job = { id: 1, status: 'RUNNING' as JobStatus, command: 'plan' };
    const result = canRollbackPlanToSpecify('PLAN' as Stage, 'SPECIFY' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });

  it('should block QUICK workflow', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'plan' };
    const result = canRollbackPlanToSpecify('PLAN' as Stage, 'SPECIFY' as Stage, 'QUICK' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });

  it('should block wrong stage (BUILD → SPECIFY)', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'implement' };
    const result = canRollbackPlanToSpecify('BUILD' as Stage, 'SPECIFY' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });
});

describe('canRollbackBuildToPlan', () => {
  it('should allow BUILD → PLAN with FULL workflow and FAILED job', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'implement' };
    const result = canRollbackBuildToPlan('BUILD' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should allow BUILD → PLAN with CANCELLED job', () => {
    const job: Job = { id: 1, status: 'CANCELLED' as JobStatus, command: 'implement' };
    const result = canRollbackBuildToPlan('BUILD' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should block QUICK workflow', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'quick-impl' };
    const result = canRollbackBuildToPlan('BUILD' as Stage, 'PLAN' as Stage, 'QUICK' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });

  it('should block when job is RUNNING', () => {
    const job: Job = { id: 1, status: 'RUNNING' as JobStatus, command: 'implement' };
    const result = canRollbackBuildToPlan('BUILD' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });

  it('should block wrong stage (VERIFY → PLAN)', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'verify' };
    const result = canRollbackBuildToPlan('VERIFY' as Stage, 'PLAN' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });
});

describe('canRollbackVerifyToBuild', () => {
  it('should allow VERIFY → BUILD with FULL workflow and FAILED job', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'verify' };
    const result = canRollbackVerifyToBuild('VERIFY' as Stage, 'BUILD' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should allow VERIFY → BUILD with CANCELLED job', () => {
    const job: Job = { id: 1, status: 'CANCELLED' as JobStatus, command: 'verify' };
    const result = canRollbackVerifyToBuild('VERIFY' as Stage, 'BUILD' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(true);
  });

  it('should block QUICK workflow', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'verify' };
    const result = canRollbackVerifyToBuild('VERIFY' as Stage, 'BUILD' as Stage, 'QUICK' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });

  it('should block when job is COMPLETED', () => {
    const job: Job = { id: 1, status: 'COMPLETED' as JobStatus, command: 'verify' };
    const result = canRollbackVerifyToBuild('VERIFY' as Stage, 'BUILD' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });

  it('should block wrong stage (BUILD → BUILD)', () => {
    const job: Job = { id: 1, status: 'FAILED' as JobStatus, command: 'implement' };
    const result = canRollbackVerifyToBuild('BUILD' as Stage, 'BUILD' as Stage, 'FULL' as WorkflowType, job);
    expect(result.allowed).toBe(false);
  });
});
