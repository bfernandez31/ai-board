import { describe, it, expect } from 'vitest';
import { getWorkflowJob, getAIBoardJob, getLatestQualityScore } from '@/lib/utils/job-filtering';
import type { Job } from '@prisma/client';
import type { Stage } from '@/lib/validations/ticket';

describe('getWorkflowJob', () => {
  it('returns null for empty array', () => {
    const result = getWorkflowJob([], 'SPECIFY' as Stage);
    expect(result).toBe(null);
  });

  it('returns null for INBOX stage (no workflow jobs in INBOX)', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'quick-impl',
        status: 'FAILED',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getWorkflowJob(jobs, 'INBOX' as Stage);
    expect(result).toBe(null);
  });

  it('returns verify job for VERIFY stage', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        command: 'verify',
        status: 'RUNNING',
        startedAt: new Date('2024-01-02'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getWorkflowJob(jobs, 'VERIFY' as Stage);
    expect(result).not.toBe(null);
    expect(result?.id).toBe(2);
    expect(result?.command).toBe('verify');
  });

  it('returns null for SHIP stage (no workflow jobs in SHIP)', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getWorkflowJob(jobs, 'SHIP' as Stage);
    expect(result).toBe(null);
  });

  it('filters out comment jobs', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'specify',
        status: 'RUNNING',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        command: 'comment-plan',
        status: 'RUNNING',
        startedAt: new Date('2024-01-02'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getWorkflowJob(jobs, 'SPECIFY' as Stage);
    expect(result).not.toBe(null);
    expect(result?.command).toBe('specify');
    expect(result?.id).toBe(1);
  });

  it('returns most recent workflow job by startedAt DESC', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'specify',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        command: 'plan',
        status: 'RUNNING',
        startedAt: new Date('2024-01-02'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 3,
        command: 'implement',
        status: 'PENDING',
        startedAt: new Date('2024-01-03'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getWorkflowJob(jobs, 'BUILD' as Stage);
    expect(result?.id).toBe(3);
    expect(result?.command).toBe('implement');
  });

  it('returns null when only comment jobs exist', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'comment-specify',
        status: 'RUNNING',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        command: 'comment-plan',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-02'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: new Date('2024-01-02'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getWorkflowJob(jobs, 'SPECIFY' as Stage);
    expect(result).toBe(null);
  });

  it('handles mixed workflow and comment jobs correctly', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'comment-specify',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-03'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: new Date('2024-01-03'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        command: 'quick-impl',
        status: 'RUNNING',
        startedAt: new Date('2024-01-02'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 3,
        command: 'specify',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getWorkflowJob(jobs, 'BUILD' as Stage);
    expect(result?.id).toBe(2);
    expect(result?.command).toBe('quick-impl');
  });
});

/**
 * T018: Unit tests for getAIBoardJob (User Story 2)
 *
 * Tests that AI-BOARD jobs are filtered correctly:
 * - Filter only comment jobs (command LIKE 'comment-%')
 * - Stage match (comment-specify visible only in SPECIFY stage)
 * - Returns null for stage mismatch
 * - Returns most recent AI-BOARD job by startedAt DESC
 */
describe('getAIBoardJob', () => {
  it('returns null for empty array', () => {
    const result = getAIBoardJob([], 'SPECIFY' as Stage);
    expect(result).toBe(null);
  });

  it('filters only comment jobs and returns matching stage', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'specify',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        command: 'comment-specify',
        status: 'RUNNING',
        startedAt: new Date('2024-01-02'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getAIBoardJob(jobs, 'SPECIFY' as Stage);
    expect(result).not.toBe(null);
    expect(result?.id).toBe(2);
    expect(result?.command).toBe('comment-specify');
  });

  it('returns null for stage mismatch (comment-specify in PLAN stage)', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'comment-specify',
        status: 'RUNNING',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Ticket is in PLAN stage, but job is comment-specify (should not match)
    const result = getAIBoardJob(jobs, 'PLAN' as Stage);
    expect(result).toBe(null);
  });

  it('returns most recent AI-BOARD job by startedAt DESC when stage matches', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'comment-plan',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        command: 'comment-plan',
        status: 'RUNNING',
        startedAt: new Date('2024-01-02'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 3,
        command: 'comment-plan',
        status: 'PENDING',
        startedAt: new Date('2024-01-03'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getAIBoardJob(jobs, 'PLAN' as Stage);
    expect(result?.id).toBe(3);
    expect(result?.command).toBe('comment-plan');
  });

  it('returns null when only workflow jobs exist (no comment jobs)', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'specify',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        command: 'plan',
        status: 'RUNNING',
        startedAt: new Date('2024-01-02'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getAIBoardJob(jobs, 'SPECIFY' as Stage);
    expect(result).toBe(null);
  });

  it('handles mixed workflow and comment jobs with stage matching', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'specify',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-03'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: new Date('2024-01-03'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        command: 'comment-specify',
        status: 'RUNNING',
        startedAt: new Date('2024-01-02'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 3,
        command: 'comment-plan',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-04'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: new Date('2024-01-04'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Only comment-specify should match SPECIFY stage
    const result = getAIBoardJob(jobs, 'SPECIFY' as Stage);
    expect(result?.id).toBe(2);
    expect(result?.command).toBe('comment-specify');
  });

  it('handles case-insensitive stage matching (comment-SPECIFY matches SPECIFY)', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'comment-SPECIFY',
        status: 'RUNNING',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getAIBoardJob(jobs, 'SPECIFY' as Stage);
    expect(result).not.toBe(null);
    expect(result?.id).toBe(1);
  });
});

describe('getLatestQualityScore', () => {
  const baseJob = {
    ticketId: 1,
    projectId: 1,
    branch: null,
    commitSha: null,
    logs: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('returns null for empty array', () => {
    expect(getLatestQualityScore([])).toBe(null);
  });

  it('returns null when no verify jobs have quality scores', () => {
    const jobs: Job[] = [
      {
        ...baseJob,
        id: 1,
        command: 'verify',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-01'),
        qualityScore: null,
      } as Job,
    ];
    expect(getLatestQualityScore(jobs)).toBe(null);
  });

  it('returns quality score from COMPLETED verify job', () => {
    const jobs: Job[] = [
      {
        ...baseJob,
        id: 1,
        command: 'verify',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-01'),
        qualityScore: 85,
      } as Job,
    ];
    expect(getLatestQualityScore(jobs)).toBe(85);
  });

  it('returns score from latest COMPLETED verify job (after rollback)', () => {
    const jobs: Job[] = [
      {
        ...baseJob,
        id: 1,
        command: 'verify',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-01'),
        qualityScore: 60,
      } as Job,
      {
        ...baseJob,
        id: 2,
        command: 'verify',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-05'),
        completedAt: new Date('2024-01-05'),
        qualityScore: 90,
      } as Job,
    ];
    expect(getLatestQualityScore(jobs)).toBe(90);
  });

  it('ignores non-verify jobs', () => {
    const jobs: Job[] = [
      {
        ...baseJob,
        id: 1,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-01'),
        qualityScore: 95,
      } as Job,
    ];
    expect(getLatestQualityScore(jobs)).toBe(null);
  });

  it('ignores FAILED verify jobs', () => {
    const jobs: Job[] = [
      {
        ...baseJob,
        id: 1,
        command: 'verify',
        status: 'FAILED',
        startedAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-01'),
        qualityScore: 50,
      } as Job,
    ];
    expect(getLatestQualityScore(jobs)).toBe(null);
  });
});
