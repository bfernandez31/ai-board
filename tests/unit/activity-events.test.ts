/**
 * Unit Test: Activity Event Utilities
 * Feature: AIB-177-project-activity-feed
 *
 * Tests for event derivation, merging, and pagination utilities
 */

import { describe, it, expect } from 'vitest';
import type { Job, Ticket, Comment, User } from '@prisma/client';
import {
  createUserActor,
  createSystemActor,
  createTicketReference,
  getStageTransition,
  deriveJobEvents,
  deriveCommentEvent,
  deriveTicketCreatedEvent,
  mergeActivityEvents,
  encodeCursor,
  decodeCursor,
  applyPagination,
  COMMAND_STAGE_TRANSITIONS,
  type JobWithTicket,
  type CommentWithUser,
} from '@/app/lib/utils/activity-events';
import type { ActivityEvent, PaginationCursor } from '@/app/lib/types/activity-event';

// Mock data factories
function createMockTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 1,
    title: 'Test Ticket',
    description: 'Test description',
    stage: 'BUILD',
    version: 1,
    projectId: 1,
    ticketNumber: 1,
    ticketKey: 'TEST-1',
    branch: 'test-branch',
    previewUrl: null,
    autoMode: false,
    workflowType: 'FULL',
    attachments: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    clarificationPolicy: null,
    closedAt: null,
    ...overrides,
  };
}

function createMockJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 1,
    ticketId: 1,
    command: 'implement',
    status: 'COMPLETED',
    branch: 'test-branch',
    commitSha: 'abc123',
    logs: null,
    startedAt: new Date('2026-01-01T10:00:00Z'),
    completedAt: new Date('2026-01-01T10:30:00Z'),
    createdAt: new Date('2026-01-01T09:00:00Z'),
    updatedAt: new Date('2026-01-01T10:30:00Z'),
    projectId: 1,
    inputTokens: null,
    outputTokens: null,
    cacheReadTokens: null,
    cacheCreationTokens: null,
    costUsd: null,
    durationMs: 1800000,
    model: null,
    toolsUsed: [],
    ...overrides,
  };
}

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: null,
    image: 'https://example.com/avatar.png',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    ticketId: 1,
    userId: 'user-1',
    content: 'This is a test comment',
    createdAt: new Date('2026-01-01T12:00:00Z'),
    updatedAt: new Date('2026-01-01T12:00:00Z'),
    ...overrides,
  };
}

describe('Actor Factory Functions', () => {
  describe('createUserActor', () => {
    it('should create actor from user with all fields', () => {
      const user = createMockUser();
      const actor = createUserActor(user);

      expect(actor.type).toBe('user');
      expect(actor.id).toBe('user-1');
      expect(actor.name).toBe('Test User');
      expect(actor.image).toBe('https://example.com/avatar.png');
    });

    it('should use email as name fallback when name is null', () => {
      const user = createMockUser({ name: null });
      const actor = createUserActor(user);

      expect(actor.name).toBe('test@example.com');
    });

    it('should handle deleted user (null)', () => {
      const actor = createUserActor(null);

      expect(actor.type).toBe('user');
      expect(actor.id).toBeNull();
      expect(actor.name).toBe('[Deleted user]');
      expect(actor.image).toBeNull();
    });
  });

  describe('createSystemActor', () => {
    it('should create AI-BOARD system actor', () => {
      const actor = createSystemActor();

      expect(actor.type).toBe('system');
      expect(actor.id).toBe('ai-board');
      expect(actor.name).toBe('AI-BOARD');
      expect(actor.image).toBeNull();
    });
  });
});

describe('Ticket Reference Factory', () => {
  describe('createTicketReference', () => {
    it('should create reference from existing ticket', () => {
      const ticket = createMockTicket();
      const ref = createTicketReference(ticket);

      expect(ref.id).toBe(1);
      expect(ref.ticketKey).toBe('TEST-1');
      expect(ref.title).toBe('Test Ticket');
      expect(ref.exists).toBe(true);
      expect(ref.stage).toBe('BUILD');
    });

    it('should handle deleted ticket (null)', () => {
      const ref = createTicketReference(null, { id: 999, ticketKey: 'OLD-1' });

      expect(ref.id).toBe(999);
      expect(ref.ticketKey).toBe('OLD-1');
      expect(ref.title).toBe('[Deleted ticket]');
      expect(ref.exists).toBe(false);
      expect(ref.stage).toBeNull();
    });

    it('should use fallback values when ticket and info are null', () => {
      const ref = createTicketReference(null);

      expect(ref.id).toBe(0);
      expect(ref.ticketKey).toBe('[Unknown]');
    });
  });
});

describe('Stage Transition Mapping', () => {
  describe('COMMAND_STAGE_TRANSITIONS', () => {
    it('should have correct transitions for stage-advancing commands', () => {
      expect(COMMAND_STAGE_TRANSITIONS['specify']).toEqual({
        fromStage: 'INBOX',
        toStage: 'SPECIFY',
      });
      expect(COMMAND_STAGE_TRANSITIONS['plan']).toEqual({
        fromStage: 'SPECIFY',
        toStage: 'PLAN',
      });
      expect(COMMAND_STAGE_TRANSITIONS['implement']).toEqual({
        fromStage: 'PLAN',
        toStage: 'BUILD',
      });
      expect(COMMAND_STAGE_TRANSITIONS['quick-impl']).toEqual({
        fromStage: 'INBOX',
        toStage: 'BUILD',
      });
      expect(COMMAND_STAGE_TRANSITIONS['verify']).toEqual({
        fromStage: 'BUILD',
        toStage: 'VERIFY',
      });
    });

    it('should not have transitions for non-stage-advancing commands', () => {
      expect(COMMAND_STAGE_TRANSITIONS['deploy-preview']).toBeUndefined();
      expect(COMMAND_STAGE_TRANSITIONS['clean']).toBeUndefined();
      expect(COMMAND_STAGE_TRANSITIONS['rollback-reset']).toBeUndefined();
    });
  });

  describe('getStageTransition', () => {
    it('should return transition for valid command', () => {
      const transition = getStageTransition('implement');
      expect(transition).toEqual({ fromStage: 'PLAN', toStage: 'BUILD' });
    });

    it('should return null for non-advancing command', () => {
      const transition = getStageTransition('deploy-preview');
      expect(transition).toBeNull();
    });

    it('should return null for unknown command', () => {
      const transition = getStageTransition('unknown-command');
      expect(transition).toBeNull();
    });
  });
});

describe('Event Derivation Functions', () => {
  describe('deriveJobEvents', () => {
    it('should derive job_started event when job has startedAt', () => {
      const ticket = createMockTicket();
      const job = createMockJob({ status: 'RUNNING', completedAt: null });
      const jobWithTicket: JobWithTicket = { ...job, ticket };

      const events = deriveJobEvents(jobWithTicket);

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('job_started');
      expect(events[0]?.id).toBe('job_started_1');
      expect(events[0]?.actor.type).toBe('system');
      expect(events[0]?.actor.name).toBe('AI-BOARD');
    });

    it('should derive job_completed and stage_changed for completed implement job', () => {
      const ticket = createMockTicket();
      const job = createMockJob({ command: 'implement', status: 'COMPLETED' });
      const jobWithTicket: JobWithTicket = { ...job, ticket };

      const events = deriveJobEvents(jobWithTicket);

      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain('job_started');
      expect(eventTypes).toContain('job_completed');
      expect(eventTypes).toContain('stage_changed');
    });

    it('should derive pr_created for completed verify job', () => {
      const ticket = createMockTicket();
      const job = createMockJob({ command: 'verify', status: 'COMPLETED' });
      const jobWithTicket: JobWithTicket = { ...job, ticket };

      const events = deriveJobEvents(jobWithTicket);

      const prEvent = events.find((e) => e.type === 'pr_created');
      expect(prEvent).toBeDefined();
      expect(prEvent?.id).toBe('pr_created_1');
    });

    it('should derive preview_deployed for completed deploy-preview job', () => {
      const ticket = createMockTicket({ previewUrl: 'https://preview.example.com' });
      const job = createMockJob({ command: 'deploy-preview', status: 'COMPLETED' });
      const jobWithTicket: JobWithTicket = { ...job, ticket };

      const events = deriveJobEvents(jobWithTicket);

      const deployEvent = events.find((e) => e.type === 'preview_deployed');
      expect(deployEvent).toBeDefined();
      if (deployEvent?.type === 'preview_deployed') {
        expect(deployEvent.data.previewUrl).toBe('https://preview.example.com');
      }
    });

    it('should derive job_failed for failed job', () => {
      const ticket = createMockTicket();
      const job = createMockJob({ status: 'FAILED' });
      const jobWithTicket: JobWithTicket = { ...job, ticket };

      const events = deriveJobEvents(jobWithTicket);

      const failedEvent = events.find((e) => e.type === 'job_failed');
      expect(failedEvent).toBeDefined();
      expect(failedEvent?.id).toBe('job_failed_1');
    });

    it('should not derive events for PENDING job', () => {
      const ticket = createMockTicket();
      const job = createMockJob({ status: 'PENDING', startedAt: new Date(), completedAt: null });
      const jobWithTicket: JobWithTicket = { ...job, ticket };

      const events = deriveJobEvents(jobWithTicket);

      expect(events).toHaveLength(0);
    });
  });

  describe('deriveCommentEvent', () => {
    it('should create comment_posted event', () => {
      const user = createMockUser();
      const comment = createMockComment();
      const ticket = createMockTicket();
      const commentWithUser: CommentWithUser = { ...comment, user };

      const event = deriveCommentEvent(commentWithUser, ticket);

      expect(event.type).toBe('comment_posted');
      expect(event.id).toBe('comment_1');
      expect(event.actor.type).toBe('user');
      expect(event.actor.name).toBe('Test User');
      if (event.type === 'comment_posted') {
        expect(event.data.commentId).toBe(1);
        expect(event.data.preview).toBe('This is a test comment');
      }
    });

    it('should truncate long comment content to 100 chars', () => {
      const longContent = 'A'.repeat(150);
      const comment = createMockComment({ content: longContent });
      const ticket = createMockTicket();
      const commentWithUser: CommentWithUser = { ...comment, user: null };

      const event = deriveCommentEvent(commentWithUser, ticket);

      if (event.type === 'comment_posted') {
        expect(event.data.preview.length).toBe(103); // 100 + '...'
        expect(event.data.preview.endsWith('...')).toBe(true);
      }
    });
  });

  describe('deriveTicketCreatedEvent', () => {
    it('should create ticket_created event', () => {
      const ticket = createMockTicket();

      const event = deriveTicketCreatedEvent(ticket);

      expect(event.type).toBe('ticket_created');
      expect(event.id).toBe('ticket_created_1');
      expect(event.actor.type).toBe('system');
      if (event.type === 'ticket_created') {
        expect(event.data.title).toBe('Test Ticket');
      }
    });
  });
});

describe('Event Merging', () => {
  describe('mergeActivityEvents', () => {
    it('should sort events by timestamp DESC (newest first)', () => {
      const ticket = createMockTicket();
      const events: ActivityEvent[] = [
        {
          type: 'ticket_created',
          id: 'ticket_1',
          timestamp: '2026-01-01T00:00:00Z',
          actor: createSystemActor(),
          ticket: createTicketReference(ticket),
          data: { title: 'Test' },
        },
        {
          type: 'job_started',
          id: 'job_1',
          timestamp: '2026-01-01T12:00:00Z',
          actor: createSystemActor(),
          ticket: createTicketReference(ticket),
          data: { command: 'implement', jobId: 1 },
        },
        {
          type: 'comment_posted',
          id: 'comment_1',
          timestamp: '2026-01-01T06:00:00Z',
          actor: createUserActor(createMockUser()),
          ticket: createTicketReference(ticket),
          data: { preview: 'test', commentId: 1 },
        },
      ];

      const merged = mergeActivityEvents(events);

      expect(merged[0]?.id).toBe('job_1'); // 12:00
      expect(merged[1]?.id).toBe('comment_1'); // 06:00
      expect(merged[2]?.id).toBe('ticket_1'); // 00:00
    });

    it('should handle empty array', () => {
      const merged = mergeActivityEvents([]);
      expect(merged).toEqual([]);
    });

    it('should not mutate original array', () => {
      const ticket = createMockTicket();
      const events: ActivityEvent[] = [
        {
          type: 'ticket_created',
          id: 'ticket_1',
          timestamp: '2026-01-01T00:00:00Z',
          actor: createSystemActor(),
          ticket: createTicketReference(ticket),
          data: { title: 'Test' },
        },
      ];
      const originalLength = events.length;

      mergeActivityEvents(events);

      expect(events).toHaveLength(originalLength);
    });
  });
});

describe('Cursor Encoding/Decoding', () => {
  describe('encodeCursor', () => {
    it('should encode cursor to base64 string', () => {
      const cursor: PaginationCursor = {
        timestamp: '2026-01-01T00:00:00Z',
        id: 'event_123',
        eventType: 'job_started',
      };

      const encoded = encodeCursor(cursor);

      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
    });
  });

  describe('decodeCursor', () => {
    it('should decode valid cursor', () => {
      const cursor: PaginationCursor = {
        timestamp: '2026-01-01T00:00:00Z',
        id: 'event_123',
        eventType: 'job_started',
      };
      const encoded = encodeCursor(cursor);

      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(cursor);
    });

    it('should return null for invalid base64', () => {
      const decoded = decodeCursor('not-valid-base64!!!');
      expect(decoded).toBeNull();
    });

    it('should return null for invalid cursor structure', () => {
      const invalidJson = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64');
      const decoded = decodeCursor(invalidJson);
      expect(decoded).toBeNull();
    });
  });
});

describe('Pagination', () => {
  function createTestEvents(count: number): ActivityEvent[] {
    const ticket = createMockTicket();
    return Array.from({ length: count }, (_, i) => ({
      type: 'job_started' as const,
      id: `event_${i}`,
      timestamp: new Date(2026, 0, 1, i).toISOString(), // Spread across hours
      actor: createSystemActor(),
      ticket: createTicketReference(ticket),
      data: { command: 'implement' as const, jobId: i },
    })).reverse(); // Already sorted DESC
  }

  describe('applyPagination', () => {
    it('should return first page without cursor', () => {
      const events = createTestEvents(100);
      const result = applyPagination(events, null, 10);

      expect(result.events).toHaveLength(10);
      expect(result.events[0]?.id).toBe('event_99'); // Newest
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
      expect(result.cursorExpired).toBe(false);
    });

    it('should return next page with cursor', () => {
      const events = createTestEvents(100);
      const firstPage = applyPagination(events, null, 10);

      const cursor = decodeCursor(firstPage.nextCursor!);
      const secondPage = applyPagination(events, cursor, 10);

      expect(secondPage.events).toHaveLength(10);
      expect(secondPage.events[0]?.id).toBe('event_89'); // After first page
      expect(secondPage.hasMore).toBe(true);
      expect(secondPage.cursorExpired).toBe(false);
    });

    it('should return hasMore=false on last page', () => {
      const events = createTestEvents(25);
      const firstPage = applyPagination(events, null, 10);
      const cursor1 = decodeCursor(firstPage.nextCursor!);
      const secondPage = applyPagination(events, cursor1, 10);
      const cursor2 = decodeCursor(secondPage.nextCursor!);
      const thirdPage = applyPagination(events, cursor2, 10);

      expect(thirdPage.events).toHaveLength(5);
      expect(thirdPage.hasMore).toBe(false);
      expect(thirdPage.nextCursor).toBeNull();
    });

    it('should set cursorExpired=true when cursor not found', () => {
      const events = createTestEvents(10);
      const expiredCursor: PaginationCursor = {
        timestamp: '2020-01-01T00:00:00Z',
        id: 'event_nonexistent',
        eventType: 'job_started',
      };

      const result = applyPagination(events, expiredCursor, 10);

      expect(result.cursorExpired).toBe(true);
      expect(result.events[0]?.id).toBe('event_9'); // Restarted from beginning
    });

    it('should handle empty events array', () => {
      const result = applyPagination([], null, 10);

      expect(result.events).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.cursorExpired).toBe(false);
    });

    it('should handle exact page size', () => {
      const events = createTestEvents(10);
      const result = applyPagination(events, null, 10);

      expect(result.events).toHaveLength(10);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });
});
