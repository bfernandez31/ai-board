# Data Model: Project Activity Feed

**Feature**: AIB-177-project-activity-feed
**Date**: 2026-01-22

## Overview

The activity feed derives all events from existing database tables (jobs, comments, tickets). No new database tables are created. This document defines the virtual entities used for API responses and UI rendering.

## Virtual Entities

### ActivityEvent (Discriminated Union)

The core event type representing any activity in the project. Uses TypeScript discriminated union pattern for type-safe event handling.

```typescript
// Base fields shared by all events
interface BaseActivityEvent {
  id: string;              // Composite: {type}_{sourceId}_{timestamp}
  timestamp: string;       // ISO 8601 datetime
  actor: Actor;            // Who performed the action
  ticket: TicketReference; // Related ticket
}

// Event type discriminants
type ActivityEventType =
  | 'ticket_created'
  | 'stage_changed'
  | 'comment_posted'
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'pr_created'
  | 'preview_deployed';

// Specific event types with their data payloads
interface TicketCreatedEvent extends BaseActivityEvent {
  type: 'ticket_created';
  data: {
    title: string;
  };
}

interface StageChangedEvent extends BaseActivityEvent {
  type: 'stage_changed';
  data: {
    fromStage: Stage;
    toStage: Stage;
  };
}

interface CommentPostedEvent extends BaseActivityEvent {
  type: 'comment_posted';
  data: {
    preview: string;     // First 100 chars of comment
    commentId: number;
  };
}

interface JobStartedEvent extends BaseActivityEvent {
  type: 'job_started';
  data: {
    command: JobCommand;
    jobId: number;
  };
}

interface JobCompletedEvent extends BaseActivityEvent {
  type: 'job_completed';
  data: {
    command: JobCommand;
    jobId: number;
    durationMs: number | null;
  };
}

interface JobFailedEvent extends BaseActivityEvent {
  type: 'job_failed';
  data: {
    command: JobCommand;
    jobId: number;
  };
}

interface PRCreatedEvent extends BaseActivityEvent {
  type: 'pr_created';
  data: {
    jobId: number;
  };
}

interface PreviewDeployedEvent extends BaseActivityEvent {
  type: 'preview_deployed';
  data: {
    jobId: number;
    previewUrl: string | null;
  };
}

// Union type
type ActivityEvent =
  | TicketCreatedEvent
  | StageChangedEvent
  | CommentPostedEvent
  | JobStartedEvent
  | JobCompletedEvent
  | JobFailedEvent
  | PRCreatedEvent
  | PreviewDeployedEvent;
```

### Actor

Represents the user or system that performed an action.

```typescript
interface Actor {
  type: 'user' | 'system';
  id: string | null;       // User ID or null for system
  name: string;            // Display name or "AI-BOARD" or "[Deleted user]"
  image: string | null;    // Avatar URL or null
}

// Factory functions
function createUserActor(user: User | null): Actor {
  if (!user) {
    return { type: 'user', id: null, name: '[Deleted user]', image: null };
  }
  return {
    type: 'user',
    id: user.id,
    name: user.name || user.email,
    image: user.image,
  };
}

function createSystemActor(): Actor {
  return {
    type: 'system',
    id: 'ai-board',
    name: 'AI-BOARD',
    image: null, // Use system icon in UI
  };
}
```

### TicketReference

Lightweight reference to a ticket for navigation.

```typescript
interface TicketReference {
  id: number;
  ticketKey: string;    // e.g., "AIB-123"
  title: string;
  exists: boolean;      // false if ticket was deleted
  stage: Stage | null;  // null if ticket deleted
}

// When ticket exists
{
  id: 123,
  ticketKey: "AIB-123",
  title: "Add activity feed",
  exists: true,
  stage: "BUILD"
}

// When ticket was deleted
{
  id: 123,
  ticketKey: "AIB-123",
  title: "[Deleted ticket]",
  exists: false,
  stage: null
}
```

### PaginationCursor

Cursor for stable pagination through the activity feed.

```typescript
interface PaginationCursor {
  timestamp: string;    // ISO 8601 datetime
  id: string;          // Event ID
  eventType: string;   // Event type for disambiguation
}

// Encoded as base64 JSON for URL parameter
function encodeCursor(cursor: PaginationCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

function decodeCursor(encoded: string): PaginationCursor {
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
}
```

### ActivityFeedResponse

API response structure for the activity feed endpoint.

```typescript
interface ActivityFeedResponse {
  events: ActivityEvent[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;  // base64 encoded PaginationCursor
    totalCount: number;         // Total events in 30-day window
  };
  metadata: {
    projectId: number;
    rangeStart: string;         // 30 days ago, ISO 8601
    rangeEnd: string;           // Now, ISO 8601
    fetchedAt: string;          // Query timestamp, ISO 8601
  };
}
```

## Source Table Mappings

### From `tickets` Table

| Ticket Field | Activity Usage |
|-------------|----------------|
| id | TicketReference.id |
| ticketKey | TicketReference.ticketKey |
| title | TicketReference.title, TicketCreatedEvent.data.title |
| stage | TicketReference.stage |
| createdAt | TicketCreatedEvent.timestamp |

### From `jobs` Table

| Job Field | Activity Usage |
|-----------|----------------|
| id | Event data.jobId |
| ticketId | Link to ticket for TicketReference |
| command | Event data.command, event type derivation |
| status | Event type derivation (COMPLETED/FAILED) |
| startedAt | JobStartedEvent.timestamp |
| completedAt | JobCompletedEvent/JobFailedEvent.timestamp |
| durationMs | JobCompletedEvent.data.durationMs |

### From `comments` Table

| Comment Field | Activity Usage |
|--------------|----------------|
| id | CommentPostedEvent.data.commentId |
| ticketId | Link to ticket for TicketReference |
| userId | Actor derivation |
| content | CommentPostedEvent.data.preview (truncated) |
| createdAt | CommentPostedEvent.timestamp |

### From `users` Table (via joins)

| User Field | Activity Usage |
|-----------|----------------|
| id | Actor.id |
| name | Actor.name |
| email | Actor.name (fallback) |
| image | Actor.image |

## Event Type Derivation Rules

### Job-Based Events

```typescript
function deriveJobEvents(job: JobWithTicket): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const actor = createSystemActor(); // All jobs are AI-triggered
  const ticket = createTicketReference(job.ticket);

  // Job started event (if startedAt exists and status is not PENDING)
  if (job.startedAt && job.status !== 'PENDING') {
    events.push({
      type: 'job_started',
      id: `job_started_${job.id}`,
      timestamp: job.startedAt.toISOString(),
      actor,
      ticket,
      data: { command: job.command, jobId: job.id },
    });
  }

  // Job completion events (if completedAt exists)
  if (job.completedAt) {
    if (job.status === 'COMPLETED') {
      events.push({
        type: 'job_completed',
        id: `job_completed_${job.id}`,
        timestamp: job.completedAt.toISOString(),
        actor,
        ticket,
        data: { command: job.command, jobId: job.id, durationMs: job.durationMs },
      });

      // Derive stage change for stage-advancing commands
      const stageTransition = getStageTransition(job.command);
      if (stageTransition) {
        events.push({
          type: 'stage_changed',
          id: `stage_changed_${job.id}`,
          timestamp: job.completedAt.toISOString(),
          actor,
          ticket,
          data: stageTransition,
        });
      }

      // Derive PR created for verify command
      if (job.command === 'verify') {
        events.push({
          type: 'pr_created',
          id: `pr_created_${job.id}`,
          timestamp: job.completedAt.toISOString(),
          actor,
          ticket,
          data: { jobId: job.id },
        });
      }

      // Derive preview deployed for deploy-preview command
      if (job.command === 'deploy-preview') {
        events.push({
          type: 'preview_deployed',
          id: `preview_deployed_${job.id}`,
          timestamp: job.completedAt.toISOString(),
          actor,
          ticket,
          data: { jobId: job.id, previewUrl: job.ticket.previewUrl },
        });
      }
    } else if (job.status === 'FAILED') {
      events.push({
        type: 'job_failed',
        id: `job_failed_${job.id}`,
        timestamp: job.completedAt.toISOString(),
        actor,
        ticket,
        data: { command: job.command, jobId: job.id },
      });
    }
  }

  return events;
}
```

### Stage Transition Mapping

```typescript
const COMMAND_STAGE_TRANSITIONS: Partial<Record<JobCommand, { fromStage: Stage; toStage: Stage }>> = {
  'specify': { fromStage: 'INBOX', toStage: 'SPECIFY' },
  'plan': { fromStage: 'SPECIFY', toStage: 'PLAN' },
  'implement': { fromStage: 'PLAN', toStage: 'BUILD' },
  'quick-impl': { fromStage: 'INBOX', toStage: 'BUILD' },
  'verify': { fromStage: 'BUILD', toStage: 'VERIFY' },
  // Note: deploy-preview, clean, rollback-reset, comment-* don't advance stages
};

function getStageTransition(command: JobCommand): { fromStage: Stage; toStage: Stage } | null {
  return COMMAND_STAGE_TRANSITIONS[command] || null;
}
```

## Validation Rules

### ActivityEvent Validation

- `id`: Required, non-empty string, format: `{type}_{sourceId}[_{qualifier}]`
- `timestamp`: Required, valid ISO 8601 datetime string
- `type`: Required, must be one of the defined ActivityEventType values
- `actor`: Required, valid Actor object
- `ticket`: Required, valid TicketReference object
- `data`: Required, structure depends on event type

### Pagination Validation

- `limit`: Integer, 1-100, default 50
- `cursor`: Optional, valid base64-encoded PaginationCursor
- Events must be within 30-day window

## State Transitions

Activity events are immutable - they represent historical actions and cannot be modified. The activity feed only supports read operations:

1. **Query** - Fetch events with pagination
2. **Poll** - Re-fetch to detect new events

No create/update/delete operations are exposed for activity events.

## Indexes (Existing - No Changes)

The following existing indexes support efficient activity queries:

```
jobs: [projectId, startedAt, status]
jobs: [ticketId, status, startedAt]
comments: [ticketId, createdAt]
tickets: [projectId]
tickets: [createdAt]
```
