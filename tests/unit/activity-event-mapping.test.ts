/**
 * Activity Event Mapping Unit Tests
 * Feature: AIB-172 Project Activity Feed
 *
 * Tests for activity event transformation utilities that convert
 * database records to unified ActivityEvent types.
 */

import { describe, it, expect } from 'vitest';
import type { Stage, JobStatus } from '@prisma/client';
import {
  generateEventId,
  createActor,
  createDeletedUserActor,
  createAiBoardActor,
  createTicketReference,
  transformTicketToCreatedEvent,
  transformTicketToStageChangedEvent,
  transformCommentToEvent,
  transformJobToStartedEvent,
  transformJobToCompletedEvent,
  transformJobToFailedEvent,
  transformJobToEvents,
  mergeAndSortEvents,
  getCommandDisplayName,
} from '@/app/lib/utils/activity-events';
import {
  isTicketCreatedEvent,
  isTicketStageChangedEvent,
  isCommentPostedEvent,
  isJobStartedEvent,
  isJobCompletedEvent,
  isJobFailedEvent,
  isJobEvent,
} from '@/app/lib/types/activity-event';

// Test fixtures
const mockUser = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  image: 'https://example.com/avatar.jpg',
};

const mockTicket = {
  id: 42,
  ticketKey: 'ABC-42',
  title: 'Test Ticket',
  description: 'Test Description',
  stage: 'BUILD' as Stage,
  projectId: 1,
  createdAt: new Date('2025-01-15T10:00:00Z'),
  updatedAt: new Date('2025-01-15T12:00:00Z'),
  closedAt: null,
  branch: null,
  previewUrl: null,
  workflowType: 'FULL' as const,
  deletedAt: null,
  userId: 'user-123',
  user: mockUser,
};

const mockComment = {
  id: 100,
  ticketId: 42,
  userId: 'user-123',
  content: 'This is a test comment that is longer than one hundred characters to test the truncation functionality in the preview.',
  createdAt: new Date('2025-01-15T11:00:00Z'),
  user: mockUser,
  ticket: { id: 42, ticketKey: 'ABC-42', projectId: 1 },
};

const mockJob = {
  id: 200,
  ticketId: 42,
  projectId: 1,
  command: 'implement',
  status: 'COMPLETED' as JobStatus,
  startedAt: new Date('2025-01-15T10:30:00Z'),
  completedAt: new Date('2025-01-15T10:45:00Z'),
  createdAt: new Date('2025-01-15T10:30:00Z'),
  errorMessage: null,
  ticket: { id: 42, ticketKey: 'ABC-42', projectId: 1 },
};

const mockAiBoardActor = createAiBoardActor('ai-board-user-id');

describe('Event ID Generation', () => {
  it('should generate ticket_created event ID', () => {
    const id = generateEventId('ticket_created', 'ticket-123');
    expect(id).toBe('tc_ticket-123');
  });

  it('should generate ticket_stage_changed event ID', () => {
    const id = generateEventId('ticket_stage_changed', 'ticket-123');
    expect(id).toBe('tsc_ticket-123');
  });

  it('should generate comment_posted event ID', () => {
    const id = generateEventId('comment_posted', 'comment-456');
    expect(id).toBe('cp_comment-456');
  });

  it('should generate job_started event ID', () => {
    const id = generateEventId('job_started', 'job-789');
    expect(id).toBe('js_job-789');
  });

  it('should generate job_completed event ID', () => {
    const id = generateEventId('job_completed', 'job-789');
    expect(id).toBe('jc_job-789');
  });

  it('should generate job_failed event ID', () => {
    const id = generateEventId('job_failed', 'job-789');
    expect(id).toBe('jf_job-789');
  });
});

describe('Actor Creation', () => {
  it('should create actor from user record', () => {
    const actor = createActor(mockUser);
    expect(actor).toEqual({
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      image: 'https://example.com/avatar.jpg',
      isSystem: false,
    });
  });

  it('should create system actor when specified', () => {
    const actor = createActor(mockUser, true);
    expect(actor.isSystem).toBe(true);
  });

  it('should create deleted user actor', () => {
    const actor = createDeletedUserActor('deleted-user-id');
    expect(actor).toEqual({
      id: 'deleted-user-id',
      name: 'Deleted user',
      email: 'deleted@example.com',
      image: null,
      isSystem: false,
    });
  });

  it('should create AI-BOARD system actor', () => {
    const actor = createAiBoardActor('ai-board-user-id');
    expect(actor).toEqual({
      id: 'ai-board-user-id',
      name: 'AI-BOARD',
      email: 'ai-board@system.local',
      image: null,
      isSystem: true,
    });
  });
});

describe('Ticket Reference Creation', () => {
  it('should create ticket reference from ticket record', () => {
    const ref = createTicketReference(mockTicket);
    expect(ref).toEqual({
      ticketKey: 'ABC-42',
      ticketId: '42',
      isDeleted: false,
    });
  });

  it('should mark deleted ticket reference', () => {
    const ref = createTicketReference(mockTicket, true);
    expect(ref.isDeleted).toBe(true);
  });
});

describe('Ticket Event Transformation', () => {
  const actor = createActor(mockUser);

  it('should transform ticket to created event', () => {
    const event = transformTicketToCreatedEvent(mockTicket, actor);

    expect(event.id).toBe('tc_42');
    expect(event.type).toBe('ticket_created');
    expect(event.timestamp).toBe('2025-01-15T10:00:00.000Z');
    expect(event.actor).toEqual(actor);
    expect(event.ticket.ticketKey).toBe('ABC-42');
    expect(event.projectId).toBe('1');
    expect(event.data.title).toBe('Test Ticket');
  });

  it('should transform ticket to stage changed event when updated', () => {
    const event = transformTicketToStageChangedEvent(mockTicket, mockAiBoardActor);

    expect(event).not.toBeNull();
    expect(event!.id).toBe('tsc_42');
    expect(event!.type).toBe('ticket_stage_changed');
    expect(event!.timestamp).toBe('2025-01-15T12:00:00.000Z');
    expect(event!.data.toStage).toBe('BUILD');
  });

  it('should return null for stage changed event if no update', () => {
    const ticketWithoutUpdate = {
      ...mockTicket,
      updatedAt: mockTicket.createdAt,
    };
    const event = transformTicketToStageChangedEvent(ticketWithoutUpdate, mockAiBoardActor);

    expect(event).toBeNull();
  });

  it('should include fromStage if provided', () => {
    const event = transformTicketToStageChangedEvent(mockTicket, mockAiBoardActor, 'PLAN' as Stage);

    expect(event!.data.fromStage).toBe('PLAN');
    expect(event!.data.toStage).toBe('BUILD');
  });
});

describe('Comment Event Transformation', () => {
  it('should transform comment to event', () => {
    const event = transformCommentToEvent(mockComment);

    expect(event.id).toBe('cp_100');
    expect(event.type).toBe('comment_posted');
    expect(event.timestamp).toBe('2025-01-15T11:00:00.000Z');
    expect(event.actor.name).toBe('Test User');
    expect(event.ticket.ticketKey).toBe('ABC-42');
  });

  it('should truncate long content preview', () => {
    const event = transformCommentToEvent(mockComment);

    expect(event.data.contentPreview.length).toBeLessThanOrEqual(103); // 100 + "..."
    expect(event.data.contentPreview.endsWith('...')).toBe(true);
  });

  it('should not truncate short content', () => {
    const shortComment = {
      ...mockComment,
      content: 'Short comment',
    };
    const event = transformCommentToEvent(shortComment);

    expect(event.data.contentPreview).toBe('Short comment');
    expect(event.data.contentPreview.endsWith('...')).toBe(false);
  });

  it('should detect @ai-board mention', () => {
    const mentionComment = {
      ...mockComment,
      content: 'Hello @ai-board please help',
    };
    const event = transformCommentToEvent(mentionComment);

    expect(event.data.isAiBoardMention).toBe(true);
  });

  it('should detect @ai-board mention case-insensitively', () => {
    const mentionComment = {
      ...mockComment,
      content: 'Hello @AI-BOARD please help',
    };
    const event = transformCommentToEvent(mentionComment);

    expect(event.data.isAiBoardMention).toBe(true);
  });

  it('should not detect ai-board mention without @', () => {
    const noMentionComment = {
      ...mockComment,
      content: 'Hello ai-board please help',
    };
    const event = transformCommentToEvent(noMentionComment);

    expect(event.data.isAiBoardMention).toBe(false);
  });
});

describe('Job Event Transformation', () => {
  it('should transform job to started event', () => {
    const event = transformJobToStartedEvent(mockJob, mockAiBoardActor);

    expect(event).not.toBeNull();
    expect(event!.id).toBe('js_200');
    expect(event!.type).toBe('job_started');
    expect(event!.timestamp).toBe('2025-01-15T10:30:00.000Z');
    expect(event!.data.command).toBe('implement');
    expect(event!.data.displayName).toBe('Implementation');
  });

  it('should return null for started event if no startedAt', () => {
    const jobWithoutStart = { ...mockJob, startedAt: null };
    const event = transformJobToStartedEvent(jobWithoutStart, mockAiBoardActor);

    expect(event).toBeNull();
  });

  it('should transform completed job to completed event', () => {
    const event = transformJobToCompletedEvent(mockJob, mockAiBoardActor);

    expect(event).not.toBeNull();
    expect(event!.id).toBe('jc_200');
    expect(event!.type).toBe('job_completed');
    expect(event!.timestamp).toBe('2025-01-15T10:45:00.000Z');
    expect(event!.data.durationMs).toBe(15 * 60 * 1000); // 15 minutes
  });

  it('should return null for completed event if not completed status', () => {
    const runningJob = { ...mockJob, status: 'RUNNING' as JobStatus };
    const event = transformJobToCompletedEvent(runningJob, mockAiBoardActor);

    expect(event).toBeNull();
  });

  it('should transform failed job to failed event', () => {
    const failedJob = { ...mockJob, status: 'FAILED' as JobStatus };
    const event = transformJobToFailedEvent(failedJob, mockAiBoardActor);

    expect(event).not.toBeNull();
    expect(event!.id).toBe('jf_200');
    expect(event!.type).toBe('job_failed');
    expect(event!.data.durationMs).toBe(15 * 60 * 1000);
  });

  it('should return null for failed event if not failed status', () => {
    const event = transformJobToFailedEvent(mockJob, mockAiBoardActor);

    expect(event).toBeNull();
  });

  it('should create multiple events for completed job', () => {
    const events = transformJobToEvents(mockJob, mockAiBoardActor);

    expect(events.length).toBe(2);
    expect(events[0].type).toBe('job_started');
    expect(events[1].type).toBe('job_completed');
  });

  it('should create multiple events for failed job', () => {
    const failedJob = { ...mockJob, status: 'FAILED' as JobStatus };
    const events = transformJobToEvents(failedJob, mockAiBoardActor);

    expect(events.length).toBe(2);
    expect(events[0].type).toBe('job_started');
    expect(events[1].type).toBe('job_failed');
  });

  it('should create only started event for running job', () => {
    const runningJob = {
      ...mockJob,
      status: 'RUNNING' as JobStatus,
      completedAt: null,
    };
    const events = transformJobToEvents(runningJob, mockAiBoardActor);

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('job_started');
  });
});

describe('Merge and Sort Events', () => {
  const actor = createActor(mockUser);

  it('should sort events by timestamp (newest first)', () => {
    const event1 = transformTicketToCreatedEvent(mockTicket, actor);
    const event2 = transformCommentToEvent(mockComment);
    const events = mergeAndSortEvents([event1, event2]);

    // Comment (11:00) is newer than ticket creation (10:00)
    expect(events[0].type).toBe('comment_posted');
    expect(events[1].type).toBe('ticket_created');
  });

  it('should use secondary sort by event ID for same timestamp', () => {
    const ticket1 = { ...mockTicket, id: 1 };
    const ticket2 = { ...mockTicket, id: 2 };

    const event1 = transformTicketToCreatedEvent(ticket1, actor);
    const event2 = transformTicketToCreatedEvent(ticket2, actor);
    const events = mergeAndSortEvents([event2, event1]);

    // Both have same timestamp, sort by ID alphabetically
    expect(events[0].id).toBe('tc_1');
    expect(events[1].id).toBe('tc_2');
  });

  it('should handle empty array', () => {
    const events = mergeAndSortEvents([]);
    expect(events).toEqual([]);
  });
});

describe('Type Guards', () => {
  const actor = createActor(mockUser);
  const ticketEvent = transformTicketToCreatedEvent(mockTicket, actor);
  const commentEvent = transformCommentToEvent(mockComment);
  const jobStartedEvent = transformJobToStartedEvent(mockJob, mockAiBoardActor)!;
  const jobCompletedEvent = transformJobToCompletedEvent(mockJob, mockAiBoardActor)!;
  const jobFailedEvent = transformJobToFailedEvent(
    { ...mockJob, status: 'FAILED' as JobStatus },
    mockAiBoardActor
  )!;

  it('should identify ticket created events', () => {
    expect(isTicketCreatedEvent(ticketEvent)).toBe(true);
    expect(isTicketCreatedEvent(commentEvent)).toBe(false);
  });

  it('should identify comment posted events', () => {
    expect(isCommentPostedEvent(commentEvent)).toBe(true);
    expect(isCommentPostedEvent(ticketEvent)).toBe(false);
  });

  it('should identify job started events', () => {
    expect(isJobStartedEvent(jobStartedEvent)).toBe(true);
    expect(isJobStartedEvent(jobCompletedEvent)).toBe(false);
  });

  it('should identify job completed events', () => {
    expect(isJobCompletedEvent(jobCompletedEvent)).toBe(true);
    expect(isJobCompletedEvent(jobStartedEvent)).toBe(false);
  });

  it('should identify job failed events', () => {
    expect(isJobFailedEvent(jobFailedEvent)).toBe(true);
    expect(isJobFailedEvent(jobCompletedEvent)).toBe(false);
  });

  it('should identify any job event', () => {
    expect(isJobEvent(jobStartedEvent)).toBe(true);
    expect(isJobEvent(jobCompletedEvent)).toBe(true);
    expect(isJobEvent(jobFailedEvent)).toBe(true);
    expect(isJobEvent(ticketEvent)).toBe(false);
    expect(isJobEvent(commentEvent)).toBe(false);
  });
});

describe('Stage Change Event Type Guard', () => {
  const stageChangedEvent = transformTicketToStageChangedEvent(
    mockTicket,
    mockAiBoardActor,
    'PLAN' as Stage
  )!;

  it('should identify ticket stage changed events', () => {
    expect(isTicketStageChangedEvent(stageChangedEvent)).toBe(true);
  });
});

describe('Command Display Names', () => {
  it('should return display name for known commands', () => {
    expect(getCommandDisplayName('implement')).toBe('Implementation');
    expect(getCommandDisplayName('verify')).toBe('Verification');
  });

  it('should return display name for extended commands', () => {
    expect(getCommandDisplayName('rollback-reset')).toBe('Rollback reset');
    expect(getCommandDisplayName('clean')).toBe('Cleanup');
  });

  it('should fall back to job display names', () => {
    expect(getCommandDisplayName('quick-impl')).toBe('Quick implementation');
    expect(getCommandDisplayName('deploy-preview')).toBe('Preview deployment');
  });
});
