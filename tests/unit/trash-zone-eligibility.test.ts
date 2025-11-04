import { describe, it, expect } from 'vitest';
import { isTicketDeletable, getDeletionBlockReason } from '@/lib/utils/trash-zone-eligibility';
import { Ticket, Job, Stage, JobStatus } from '@prisma/client';

/**
 * Unit tests for trash zone eligibility logic
 *
 * Business Rules:
 * - SHIP stage tickets cannot be deleted
 * - Tickets with PENDING or RUNNING jobs cannot be deleted
 * - All other tickets can be deleted
 */

describe('isTicketDeletable', () => {
  // T010: Unit test for isTicketDeletable() with SHIP stage
  describe('SHIP stage tickets', () => {
    it('returns false for SHIP stage tickets (without jobs)', () => {
      const ticket = {
        id: 1,
        ticketNumber: 1,
        ticketKey: 'TEST-1',
        title: 'SHIP Ticket',
        description: 'Test description',
        stage: Stage.SHIP,
        projectId: 1,
        version: 1,
        branch: null,
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobs: [],
      } as Ticket & { jobs: Pick<Job, 'status'>[] };

      expect(isTicketDeletable(ticket)).toBe(false);
    });

    it('returns false for SHIP stage tickets (with completed jobs)', () => {
      const ticket = {
        id: 2,
        ticketNumber: 2,
        ticketKey: 'TEST-2',
        title: 'SHIP Ticket with Jobs',
        description: 'Test description',
        stage: Stage.SHIP,
        projectId: 1,
        version: 1,
        branch: '001-feature',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobs: [{ status: JobStatus.COMPLETED }],
      } as Ticket & { jobs: Pick<Job, 'status'>[] };

      expect(isTicketDeletable(ticket)).toBe(false);
    });
  });

  // T011: Unit test for isTicketDeletable() with active jobs
  describe('Tickets with active jobs', () => {
    it('returns false when ticket has PENDING job', () => {
      const ticket = {
        id: 3,
        ticketNumber: 3,
        ticketKey: 'TEST-3',
        title: 'Ticket with Pending Job',
        description: 'Test description',
        stage: Stage.BUILD,
        projectId: 1,
        version: 1,
        branch: '002-feature',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobs: [{ status: JobStatus.PENDING }],
      } as Ticket & { jobs: Pick<Job, 'status'>[] };

      expect(isTicketDeletable(ticket)).toBe(false);
    });

    it('returns false when ticket has RUNNING job', () => {
      const ticket = {
        id: 4,
        ticketNumber: 4,
        ticketKey: 'TEST-4',
        title: 'Ticket with Running Job',
        description: 'Test description',
        stage: Stage.VERIFY,
        projectId: 1,
        version: 1,
        branch: '003-feature',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobs: [{ status: JobStatus.RUNNING }],
      } as Ticket & { jobs: Pick<Job, 'status'>[] };

      expect(isTicketDeletable(ticket)).toBe(false);
    });

    it('returns false when ticket has multiple jobs including one PENDING', () => {
      const ticket = {
        id: 5,
        ticketNumber: 5,
        ticketKey: 'TEST-5',
        title: 'Ticket with Mixed Jobs',
        description: 'Test description',
        stage: Stage.PLAN,
        projectId: 1,
        version: 1,
        branch: '004-feature',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobs: [
          { status: JobStatus.COMPLETED },
          { status: JobStatus.PENDING }, // Active job blocks deletion
          { status: JobStatus.FAILED },
        ],
      } as Ticket & { jobs: Pick<Job, 'status'>[] };

      expect(isTicketDeletable(ticket)).toBe(false);
    });

    it('returns false when ticket has multiple jobs including one RUNNING', () => {
      const ticket = {
        id: 6,
        ticketNumber: 6,
        ticketKey: 'TEST-6',
        title: 'Ticket with Mixed Jobs (Running)',
        description: 'Test description',
        stage: Stage.SPECIFY,
        projectId: 1,
        version: 1,
        branch: '005-feature',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobs: [
          { status: JobStatus.COMPLETED },
          { status: JobStatus.RUNNING }, // Active job blocks deletion
          { status: JobStatus.CANCELLED },
        ],
      } as Ticket & { jobs: Pick<Job, 'status'>[] };

      expect(isTicketDeletable(ticket)).toBe(false);
    });
  });

  // T012: Unit test for isTicketDeletable() with valid tickets
  describe('Valid deletable tickets', () => {
    it('returns true for INBOX ticket with no jobs', () => {
      const ticket = {
        id: 7,
        ticketNumber: 7,
        ticketKey: 'TEST-7',
        title: 'INBOX Ticket',
        description: 'Test description',
        stage: Stage.INBOX,
        projectId: 1,
        version: 1,
        branch: null,
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobs: [],
      } as Ticket & { jobs: Pick<Job, 'status'>[] };

      expect(isTicketDeletable(ticket)).toBe(true);
    });

    it('returns true for SPECIFY ticket with COMPLETED jobs', () => {
      const ticket = {
        id: 8,
        ticketNumber: 8,
        ticketKey: 'TEST-8',
        title: 'SPECIFY Ticket',
        description: 'Test description',
        stage: Stage.SPECIFY,
        projectId: 1,
        version: 1,
        branch: '006-feature',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobs: [{ status: JobStatus.COMPLETED }],
      } as Ticket & { jobs: Pick<Job, 'status'>[] };

      expect(isTicketDeletable(ticket)).toBe(true);
    });

    it('returns true for PLAN ticket with FAILED jobs', () => {
      const ticket = {
        id: 9,
        ticketNumber: 9,
        ticketKey: 'TEST-9',
        title: 'PLAN Ticket',
        description: 'Test description',
        stage: Stage.PLAN,
        projectId: 1,
        version: 1,
        branch: '007-feature',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobs: [{ status: JobStatus.FAILED }],
      } as Ticket & { jobs: Pick<Job, 'status'>[] };

      expect(isTicketDeletable(ticket)).toBe(true);
    });

    it('returns true for BUILD ticket with CANCELLED jobs', () => {
      const ticket = {
        id: 10,
        ticketNumber: 10,
        ticketKey: 'TEST-10',
        title: 'BUILD Ticket',
        description: 'Test description',
        stage: Stage.BUILD,
        projectId: 1,
        version: 1,
        branch: '008-feature',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobs: [{ status: JobStatus.CANCELLED }],
      } as Ticket & { jobs: Pick<Job, 'status'>[] };

      expect(isTicketDeletable(ticket)).toBe(true);
    });

    it('returns true for VERIFY ticket with multiple terminal jobs', () => {
      const ticket = {
        id: 11,
        ticketNumber: 11,
        ticketKey: 'TEST-11',
        title: 'VERIFY Ticket',
        description: 'Test description',
        stage: Stage.VERIFY,
        projectId: 1,
        version: 1,
        branch: '009-feature',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: 'https://preview-009.vercel.app',
        createdAt: new Date(),
        updatedAt: new Date(),
        jobs: [
          { status: JobStatus.COMPLETED },
          { status: JobStatus.FAILED },
          { status: JobStatus.CANCELLED },
        ],
      } as Ticket & { jobs: Pick<Job, 'status'>[] };

      expect(isTicketDeletable(ticket)).toBe(true);
    });

    it('returns true when jobs array is undefined (no jobs relation)', () => {
      const ticket = {
        id: 12,
        ticketNumber: 12,
        ticketKey: 'TEST-12',
        title: 'Ticket without Jobs Relation',
        description: 'Test description',
        stage: Stage.INBOX,
        projectId: 1,
        version: 1,
        branch: null,
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Ticket & { jobs?: Pick<Job, 'status'>[] };

      expect(isTicketDeletable(ticket)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('handles ticket with empty jobs array', () => {
      const ticket = {
        id: 13,
        ticketNumber: 13,
        ticketKey: 'TEST-13',
        title: 'Ticket with Empty Jobs Array',
        description: 'Test description',
        stage: Stage.BUILD,
        projectId: 1,
        version: 1,
        branch: '010-feature',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobs: [],
      } as Ticket & { jobs: Pick<Job, 'status'>[] };

      expect(isTicketDeletable(ticket)).toBe(true);
    });
  });
});

// Test getDeletionBlockReason helper function
describe('getDeletionBlockReason', () => {
  it('returns SHIP stage message for SHIP tickets', () => {
    const ticket = {
      id: 1,
      ticketNumber: 1,
      ticketKey: 'TEST-1',
      title: 'SHIP Ticket',
      description: 'Test',
      stage: Stage.SHIP,
      projectId: 1,
      version: 1,
      branch: null,
      autoMode: false,
      clarificationPolicy: null,
      workflowType: 'FULL',
      attachments: [],
      previewUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      jobs: [],
    } as Ticket & { jobs: Pick<Job, 'status'>[] };

    expect(getDeletionBlockReason(ticket)).toBe('SHIP stage tickets cannot be deleted');
  });

  it('returns active job message for tickets with PENDING jobs', () => {
    const ticket = {
      id: 2,
      ticketNumber: 2,
      ticketKey: 'TEST-2',
      title: 'Ticket with Pending Job',
      description: 'Test',
      stage: Stage.BUILD,
      projectId: 1,
      version: 1,
      branch: '001-feature',
      autoMode: false,
      clarificationPolicy: null,
      workflowType: 'FULL',
      attachments: [],
      previewUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      jobs: [{ status: JobStatus.PENDING }],
    } as Ticket & { jobs: Pick<Job, 'status'>[] };

    expect(getDeletionBlockReason(ticket)).toBe('Cannot delete ticket while job is in progress');
  });

  it('returns active job message for tickets with RUNNING jobs', () => {
    const ticket = {
      id: 3,
      ticketNumber: 3,
      ticketKey: 'TEST-3',
      title: 'Ticket with Running Job',
      description: 'Test',
      stage: Stage.VERIFY,
      projectId: 1,
      version: 1,
      branch: '002-feature',
      autoMode: false,
      clarificationPolicy: null,
      workflowType: 'FULL',
      attachments: [],
      previewUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      jobs: [{ status: JobStatus.RUNNING }],
    } as Ticket & { jobs: Pick<Job, 'status'>[] };

    expect(getDeletionBlockReason(ticket)).toBe('Cannot delete ticket while job is in progress');
  });

  it('returns null for deletable tickets', () => {
    const ticket = {
      id: 4,
      ticketNumber: 4,
      ticketKey: 'TEST-4',
      title: 'Deletable Ticket',
      description: 'Test',
      stage: Stage.INBOX,
      projectId: 1,
      version: 1,
      branch: null,
      autoMode: false,
      clarificationPolicy: null,
      workflowType: 'FULL',
      attachments: [],
      previewUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      jobs: [],
    } as Ticket & { jobs: Pick<Job, 'status'>[] };

    expect(getDeletionBlockReason(ticket)).toBeNull();
  });

  it('prioritizes SHIP stage message over active job message', () => {
    const ticket = {
      id: 5,
      ticketNumber: 5,
      ticketKey: 'TEST-5',
      title: 'SHIP Ticket with Active Job',
      description: 'Test',
      stage: Stage.SHIP,
      projectId: 1,
      version: 1,
      branch: '003-feature',
      autoMode: false,
      clarificationPolicy: null,
      workflowType: 'FULL',
      attachments: [],
      previewUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      jobs: [{ status: JobStatus.RUNNING }],
    } as Ticket & { jobs: Pick<Job, 'status'>[] };

    expect(getDeletionBlockReason(ticket)).toBe('SHIP stage tickets cannot be deleted');
  });
});
