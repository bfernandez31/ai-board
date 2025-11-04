import { describe, it, expect } from 'vitest';
import {
  getConfirmationMessage,
  getDeletionSummary,
} from '@/lib/utils/stage-confirmation-messages';
import { Ticket, Stage } from '@prisma/client';

/**
 * Unit tests for stage-specific confirmation messages
 *
 * Tests verify correct message generation for each stage:
 * - INBOX: No workflow artifacts
 * - SPECIFY: Branch + spec.md
 * - PLAN: Branch + planning docs
 * - BUILD: Branch + PR + artifacts
 * - VERIFY: Branch + preview + PR + artifacts
 * - SHIP: Not deletable (should never reach here)
 */

describe('getConfirmationMessage', () => {
  // T013: Unit test for getConfirmationMessage() INBOX stage
  describe('INBOX stage', () => {
    it('returns correct message for INBOX ticket', () => {
      const ticket: Ticket = {
        id: 1,
        ticketNumber: 1,
        ticketKey: 'TEST-1',
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
      };

      const message = getConfirmationMessage(ticket);

      expect(message).toContain('no workflow artifacts');
      expect(message).toContain('ticket record will be deleted');
    });
  });

  describe('SPECIFY stage', () => {
    it('returns correct message for SPECIFY ticket with branch', () => {
      const ticket: Ticket = {
        id: 2,
        ticketNumber: 2,
        ticketKey: 'TEST-2',
        title: 'SPECIFY Ticket',
        description: 'Test description',
        stage: Stage.SPECIFY,
        projectId: 1,
        version: 1,
        branch: '001-feature-name',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const message = getConfirmationMessage(ticket);

      expect(message).toContain('permanently delete');
      expect(message).toContain('Git branch: 001-feature-name');
      expect(message).toContain('spec.md');
      expect(message).toContain('cannot be undone');
    });

    it('returns correct message for SPECIFY ticket without branch', () => {
      const ticket: Ticket = {
        id: 3,
        ticketNumber: 3,
        ticketKey: 'TEST-3',
        title: 'SPECIFY Ticket No Branch',
        description: 'Test',
        stage: Stage.SPECIFY,
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
      };

      const message = getConfirmationMessage(ticket);

      expect(message).toContain('specification document');
      expect(message).toContain('cannot be undone');
      expect(message).not.toContain('Git branch');
    });
  });

  describe('PLAN stage', () => {
    it('returns correct message for PLAN ticket with branch', () => {
      const ticket: Ticket = {
        id: 4,
        ticketNumber: 4,
        ticketKey: 'TEST-4',
        title: 'PLAN Ticket',
        description: 'Test',
        stage: Stage.PLAN,
        projectId: 1,
        version: 1,
        branch: '002-another-feature',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const message = getConfirmationMessage(ticket);

      expect(message).toContain('permanently delete');
      expect(message).toContain('Git branch: 002-another-feature');
      expect(message).toContain('spec.md');
      expect(message).toContain('plan.md');
      expect(message).toContain('tasks.md');
      expect(message).toContain('cannot be undone');
    });

    it('returns correct message for PLAN ticket without branch', () => {
      const ticket: Ticket = {
        id: 5,
        ticketNumber: 5,
        ticketKey: 'TEST-5',
        title: 'PLAN Ticket No Branch',
        description: 'Test',
        stage: Stage.PLAN,
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
      };

      const message = getConfirmationMessage(ticket);

      expect(message).toContain('planning documents');
      expect(message).toContain('cannot be undone');
      expect(message).not.toContain('Git branch');
    });
  });

  describe('BUILD stage', () => {
    it('returns correct message for BUILD ticket with branch', () => {
      const ticket: Ticket = {
        id: 6,
        ticketNumber: 6,
        ticketKey: 'TEST-6',
        title: 'BUILD Ticket',
        description: 'Test',
        stage: Stage.BUILD,
        projectId: 1,
        version: 1,
        branch: '003-build-feature',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const message = getConfirmationMessage(ticket);

      expect(message).toContain('permanently delete');
      expect(message).toContain('Git branch: 003-build-feature');
      expect(message).toContain('pull requests');
      expect(message).toContain('Specification and planning documents');
      expect(message).toContain('Implementation artifacts');
      expect(message).toContain('cannot be undone');
    });

    it('returns correct message for BUILD ticket without branch', () => {
      const ticket: Ticket = {
        id: 7,
        ticketNumber: 7,
        ticketKey: 'TEST-7',
        title: 'BUILD Ticket No Branch',
        description: 'Test',
        stage: Stage.BUILD,
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
      };

      const message = getConfirmationMessage(ticket);

      expect(message).toContain('workflow artifacts');
      expect(message).toContain('cannot be undone');
      expect(message).not.toContain('Git branch');
    });
  });

  describe('VERIFY stage', () => {
    it('returns correct message for VERIFY ticket with branch and preview', () => {
      const ticket: Ticket = {
        id: 8,
        ticketNumber: 8,
        ticketKey: 'TEST-8',
        title: 'VERIFY Ticket',
        description: 'Test',
        stage: Stage.VERIFY,
        projectId: 1,
        version: 1,
        branch: '004-verify-feature',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: 'https://preview-004.vercel.app',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const message = getConfirmationMessage(ticket);

      expect(message).toContain('permanently delete');
      expect(message).toContain('Git branch: 004-verify-feature');
      expect(message).toContain('Preview deployment');
      expect(message).toContain('All pull requests');
      expect(message).toContain('Specification and planning documents');
      expect(message).toContain('Implementation artifacts');
      expect(message).toContain('cannot be undone');
    });

    it('returns correct message for VERIFY ticket without preview', () => {
      const ticket: Ticket = {
        id: 9,
        ticketNumber: 9,
        ticketKey: 'TEST-9',
        title: 'VERIFY Ticket No Preview',
        description: 'Test',
        stage: Stage.VERIFY,
        projectId: 1,
        version: 1,
        branch: '005-verify-no-preview',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const message = getConfirmationMessage(ticket);

      expect(message).toContain('permanently delete');
      expect(message).toContain('Git branch: 005-verify-no-preview');
      expect(message).not.toContain('Preview deployment');
      expect(message).toContain('All pull requests');
      expect(message).toContain('cannot be undone');
    });

    it('returns correct message for VERIFY ticket without branch', () => {
      const ticket: Ticket = {
        id: 10,
        ticketNumber: 10,
        ticketKey: 'TEST-10',
        title: 'VERIFY Ticket No Branch',
        description: 'Test',
        stage: Stage.VERIFY,
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
      };

      const message = getConfirmationMessage(ticket);

      expect(message).toContain('permanently delete');
      expect(message).toContain('Git branch: (none)');
      expect(message).toContain('All pull requests');
      expect(message).toContain('cannot be undone');
    });
  });

  describe('SHIP stage', () => {
    it('returns error message for SHIP ticket (should never reach here)', () => {
      const ticket: Ticket = {
        id: 11,
        ticketNumber: 11,
        ticketKey: 'TEST-11',
        title: 'SHIP Ticket',
        description: 'Test',
        stage: Stage.SHIP,
        projectId: 1,
        version: 1,
        branch: '006-shipped',
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const message = getConfirmationMessage(ticket);

      expect(message).toContain('SHIP stage tickets cannot be deleted');
    });
  });

  describe('Edge cases', () => {
    it('handles empty branch string as null', () => {
      const ticket: Ticket = {
        id: 12,
        ticketNumber: 12,
        ticketKey: 'TEST-12',
        title: 'Empty Branch',
        description: 'Test',
        stage: Stage.BUILD,
        projectId: 1,
        version: 1,
        branch: '', // Empty string
        autoMode: false,
        clarificationPolicy: null,
        workflowType: 'FULL',
        attachments: [],
        previewUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const message = getConfirmationMessage(ticket);

      // Empty branch should be treated as truthy, but message should handle it gracefully
      expect(message).toContain('permanently delete');
    });
  });
});

// Test getDeletionSummary helper function
describe('getDeletionSummary', () => {
  it('returns correct summary for INBOX ticket', () => {
    const ticket: Ticket = {
      id: 1,
      ticketNumber: 1,
      ticketKey: 'TEST-1',
      title: 'INBOX',
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
    };

    expect(getDeletionSummary(ticket)).toBe('Ticket record only');
  });

  it('returns correct summary for SPECIFY ticket with branch', () => {
    const ticket: Ticket = {
      id: 2,
      ticketNumber: 2,
      ticketKey: 'TEST-2',
      title: 'SPECIFY',
      description: 'Test',
      stage: Stage.SPECIFY,
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
    };

    expect(getDeletionSummary(ticket)).toBe('Branch + spec.md');
  });

  it('returns correct summary for SPECIFY ticket without branch', () => {
    const ticket: Ticket = {
      id: 3,
      ticketNumber: 3,
      ticketKey: 'TEST-3',
      title: 'SPECIFY No Branch',
      description: 'Test',
      stage: Stage.SPECIFY,
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
    };

    expect(getDeletionSummary(ticket)).toBe('Spec.md only');
  });

  it('returns correct summary for PLAN ticket with branch', () => {
    const ticket: Ticket = {
      id: 4,
      ticketNumber: 4,
      ticketKey: 'TEST-4',
      title: 'PLAN',
      description: 'Test',
      stage: Stage.PLAN,
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
    };

    expect(getDeletionSummary(ticket)).toBe('Branch + planning docs');
  });

  it('returns correct summary for PLAN ticket without branch', () => {
    const ticket: Ticket = {
      id: 5,
      ticketNumber: 5,
      ticketKey: 'TEST-5',
      title: 'PLAN No Branch',
      description: 'Test',
      stage: Stage.PLAN,
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
    };

    expect(getDeletionSummary(ticket)).toBe('Planning docs only');
  });

  it('returns correct summary for BUILD ticket with branch', () => {
    const ticket: Ticket = {
      id: 6,
      ticketNumber: 6,
      ticketKey: 'TEST-6',
      title: 'BUILD',
      description: 'Test',
      stage: Stage.BUILD,
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
    };

    expect(getDeletionSummary(ticket)).toBe('Branch + PR + artifacts');
  });

  it('returns correct summary for BUILD ticket without branch', () => {
    const ticket: Ticket = {
      id: 7,
      ticketNumber: 7,
      ticketKey: 'TEST-7',
      title: 'BUILD No Branch',
      description: 'Test',
      stage: Stage.BUILD,
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
    };

    expect(getDeletionSummary(ticket)).toBe('Workflow artifacts');
  });

  it('returns correct summary for VERIFY ticket with preview', () => {
    const ticket: Ticket = {
      id: 8,
      ticketNumber: 8,
      ticketKey: 'TEST-8',
      title: 'VERIFY',
      description: 'Test',
      stage: Stage.VERIFY,
      projectId: 1,
      version: 1,
      branch: '004-feature',
      autoMode: false,
      clarificationPolicy: null,
      workflowType: 'FULL',
        attachments: [],
      previewUrl: 'https://preview.vercel.app',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(getDeletionSummary(ticket)).toBe('Branch + PR + preview + artifacts');
  });

  it('returns correct summary for VERIFY ticket without preview', () => {
    const ticket: Ticket = {
      id: 9,
      ticketNumber: 9,
      ticketKey: 'TEST-9',
      title: 'VERIFY No Preview',
      description: 'Test',
      stage: Stage.VERIFY,
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
    };

    expect(getDeletionSummary(ticket)).toBe('Branch + PR + artifacts');
  });

  it('returns correct summary for SHIP ticket', () => {
    const ticket: Ticket = {
      id: 10,
      ticketNumber: 10,
      ticketKey: 'TEST-10',
      title: 'SHIP',
      description: 'Test',
      stage: Stage.SHIP,
      projectId: 1,
      version: 1,
      branch: '006-shipped',
      autoMode: false,
      clarificationPolicy: null,
      workflowType: 'FULL',
      attachments: [],
      previewUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(getDeletionSummary(ticket)).toBe('Cannot delete SHIP tickets');
  });
});
