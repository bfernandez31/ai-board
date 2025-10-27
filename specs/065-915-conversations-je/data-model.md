# Data Model: GitHub-Style Ticket Conversations

**Feature**: 065-915-conversations-je
**Date**: 2025-10-27

## Overview

This feature does NOT introduce new database entities. It leverages existing `Comment` and `Job` tables to generate a unified conversation timeline. The data model describes TypeScript types for client-side data transformation and UI rendering.

---

## Existing Database Entities (Read-Only)

### Comment (Existing)

**Source**: `prisma/schema.prisma` (lines ~100-120)

```prisma
model Comment {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  userId    String
  content   String   @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([ticketId, createdAt])
}
```

**Used Fields**:
- `id`: Unique identifier for key prop in React rendering
- `ticketId`: Filter comments by ticket
- `userId`: Resolve comment author
- `content`: Display comment text
- `createdAt`: Timestamp for chronological sorting
- `user`: Relation to fetch author name/email (via CommentWithUser type)

### Job (Existing)

**Source**: `prisma/schema.prisma` (lines ~30-60)

```prisma
model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  projectId   Int
  command     String
  status      JobStatus @default(PENDING)
  workflowType WorkflowType @default(FULL)
  branch      String?
  startedAt   DateTime  @default(now())
  completedAt DateTime?

  ticket  Ticket  @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([ticketId, status, startedAt])
  @@index([projectId])
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

enum WorkflowType {
  FULL
  QUICK
}
```

**Used Fields**:
- `id`: Unique identifier for key prop and job event identification
- `ticketId`: Filter jobs by ticket
- `command`: Map to user-friendly display name (e.g., "specify" → "Specification generation")
- `status`: Determine event type (PENDING/RUNNING → start event, COMPLETED/FAILED/CANCELLED → completion event)
- `workflowType`: Indicate "quick workflow" when QUICK
- `startedAt`: Timestamp for chronological sorting (job start event)
- `completedAt`: Timestamp for job completion event (null for PENDING/RUNNING)

---

## TypeScript Types (New)

### ConversationEvent (Discriminated Union)

**Purpose**: Unified type representing either a comment or job event for timeline rendering

**Location**: `lib/types/conversation-event.ts`

```typescript
import type { CommentWithUser } from '@/lib/types/comment';
import type { Job } from '@prisma/client';

/**
 * Base event interface with common discriminator
 */
interface BaseConversationEvent {
  type: 'comment' | 'job';
  timestamp: string; // ISO 8601 for consistent sorting
}

/**
 * Comment event - represents user comment on ticket
 */
export interface CommentEvent extends BaseConversationEvent {
  type: 'comment';
  timestamp: string; // Same as comment.createdAt
  data: CommentWithUser;
}

/**
 * Job event - represents automated workflow or AI-BOARD job execution
 *
 * Job lifecycle:
 * - PENDING/RUNNING → Job start event (shows "started" message)
 * - COMPLETED → Job completion event (shows "completed" message)
 * - FAILED → Job failure event (shows "failed" message)
 * - CANCELLED → Job cancellation event (shows "cancelled" message)
 */
export interface JobEvent extends BaseConversationEvent {
  type: 'job';
  timestamp: string; // job.startedAt for start event, job.completedAt for completion event
  data: Job;
  eventType: 'start' | 'complete'; // Distinguishes start vs completion events
}

/**
 * Union type for all conversation events
 */
export type ConversationEvent = CommentEvent | JobEvent;
```

### JobEventType

**Purpose**: Categorize job events for visual styling

```typescript
export type JobEventType =
  | 'start'      // Job started (PENDING/RUNNING status)
  | 'complete'   // Job completed successfully (COMPLETED status)
  | 'fail'       // Job failed (FAILED status)
  | 'cancel';    // Job cancelled (CANCELLED status)

/**
 * Determine job event type from job status
 */
export function getJobEventType(status: JobStatus): JobEventType {
  switch (status) {
    case 'PENDING':
    case 'RUNNING':
      return 'start';
    case 'COMPLETED':
      return 'complete';
    case 'FAILED':
      return 'fail';
    case 'CANCELLED':
      return 'cancel';
  }
}
```

### TimelineItemType

**Purpose**: Discriminate between comment and job items for rendering logic

```typescript
export type TimelineItemType = 'comment' | 'job';
```

---

## Data Transformation Functions

### mergeConversationEvents

**Purpose**: Merge comments and jobs into unified timeline, sorted chronologically

**Location**: `lib/utils/conversation-events.ts`

```typescript
/**
 * Transform database records to ConversationEvent union
 */
export function createCommentEvent(comment: CommentWithUser): CommentEvent {
  return {
    type: 'comment',
    timestamp: comment.createdAt,
    data: comment,
  };
}

/**
 * Create job events from Job record
 *
 * Jobs generate TWO events:
 * 1. Start event (using job.startedAt timestamp)
 * 2. Completion event (using job.completedAt timestamp) - only if completedAt is not null
 */
export function createJobEvents(job: Job): JobEvent[] {
  const events: JobEvent[] = [];

  // Start event (always present for all jobs)
  events.push({
    type: 'job',
    timestamp: job.startedAt.toISOString(),
    data: job,
    eventType: 'start',
  });

  // Completion event (only if job finished)
  if (job.completedAt) {
    events.push({
      type: 'job',
      timestamp: job.completedAt.toISOString(),
      data: job,
      eventType: 'complete',
    });
  }

  return events;
}

/**
 * Merge and sort comments + jobs into unified timeline
 *
 * Performance: O(n log n) for sorting, optimized for <100 items
 * Memory: O(n) for merged array
 */
export function mergeConversationEvents(
  comments: CommentWithUser[],
  jobs: Job[]
): ConversationEvent[] {
  const commentEvents = comments.map(createCommentEvent);
  const jobEvents = jobs.flatMap(createJobEvents); // Each job creates 1-2 events

  // Spread operator optimal for <100 items
  const allEvents = [...commentEvents, ...jobEvents];

  // Single sort by timestamp (chronological order, oldest first)
  return allEvents.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}
```

### getJobDisplayName

**Purpose**: Map Job.command to user-friendly display name

**Location**: `lib/utils/job-display-names.ts`

```typescript
export const JOB_COMMAND_DISPLAY_NAMES: Record<string, string> = {
  // Normal workflow commands (FULL workflowType)
  'specify': 'Specification generation',
  'plan': 'Planning',
  'implement': 'Implementation',

  // Quick-impl workflow command (QUICK workflowType)
  'quick-impl': 'Quick implementation',

  // AI-BOARD assistance commands (comment-* pattern)
  'comment-specify': 'Specification assistance',
  'comment-plan': 'Planning assistance',
  'comment-build': 'Implementation assistance',
  'comment-verify': 'Verification assistance',
} as const;

export function getJobDisplayName(command: string): string {
  // Direct mapping lookup
  if (command in JOB_COMMAND_DISPLAY_NAMES) {
    return JOB_COMMAND_DISPLAY_NAMES[command as keyof typeof JOB_COMMAND_DISPLAY_NAMES];
  }

  // Pattern-based fallback for unmapped comment-* commands
  if (command.startsWith('comment-')) {
    const stageSuffix = command.substring('comment-'.length);
    const stageCapitalized = stageSuffix.charAt(0).toUpperCase() + stageSuffix.slice(1);
    return `${stageCapitalized} assistance`;
  }

  // Unknown commands: Return descriptive fallback
  return `Unknown command (${command})`;
}
```

---

## Validation Rules

### ConversationEvent Validation (Runtime)

No Zod schema required for ConversationEvent (client-side only type). Database validation already enforced by Prisma schema:

**Comment Validation** (existing):
- `ticketId`: Required integer (foreign key constraint)
- `userId`: Required string (foreign key constraint)
- `content`: Required text (NOT NULL in database)
- `createdAt`: Auto-generated timestamp

**Job Validation** (existing):
- `ticketId`: Required integer (foreign key constraint)
- `command`: Required string (NOT NULL in database)
- `status`: Enum validation (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- `workflowType`: Enum validation (FULL, QUICK)
- `startedAt`: Auto-generated timestamp
- `completedAt`: Nullable timestamp (only set for terminal states)

---

## State Transitions

### Job Status → Event Type Mapping

```typescript
/**
 * Job Status State Machine (existing)
 *
 * PENDING → RUNNING → [COMPLETED | FAILED | CANCELLED]
 *
 * Event Generation Logic:
 * - PENDING status: Generate "start" event using job.startedAt
 * - RUNNING status: Generate "start" event using job.startedAt (no completion event yet)
 * - COMPLETED status: Generate "complete" event using job.completedAt
 * - FAILED status: Generate "fail" event using job.completedAt
 * - CANCELLED status: Generate "cancel" event using job.completedAt
 */

export function getJobEventMessage(
  command: string,
  eventType: JobEventType,
  workflowType: WorkflowType
): string {
  const displayName = getJobDisplayName(command);
  const quickIndicator = workflowType === 'QUICK' && command === 'quick-impl' ? ' ⚡' : '';

  switch (eventType) {
    case 'start':
      return `${displayName}${quickIndicator} started`;
    case 'complete':
      return `${displayName}${quickIndicator} completed`;
    case 'fail':
      return `${displayName}${quickIndicator} failed`;
    case 'cancel':
      return `${displayName}${quickIndicator} cancelled`;
  }
}
```

---

## Relationships

```
Ticket (1) ──< (many) Comment
           └──< (many) Job

ConversationEvent (union)
├── CommentEvent → Comment (data field)
└── JobEvent → Job (data field)

Timeline (UI)
└── ConversationEvent[] (sorted by timestamp)
    ├── CommentEvent → renders CommentItem component
    └── JobEvent → renders JobEventItem component
```

---

## Database Indexes (Existing)

**Comment**:
- `@@index([ticketId, createdAt])` - Optimizes query for fetching ticket comments in chronological order

**Job**:
- `@@index([ticketId, status, startedAt])` - Optimizes query for fetching ticket jobs filtered by status
- `@@index([projectId])` - Optimizes project-wide job queries

**Performance Impact**:
- Comment query: ~10ms for 25 comments
- Job query: ~10ms for 25 jobs
- Total data fetch: ~20-30ms for typical ticket

---

## Edge Cases

### 1. Job Without Completion Timestamp
**Scenario**: Job status is PENDING or RUNNING (completedAt is null)

**Handling**: Only generate start event; completion event appears when completedAt is set

### 2. Job With Missing Command Mapping
**Scenario**: Job.command not in JOB_COMMAND_DISPLAY_NAMES (legacy or future command)

**Handling**: Fallback display name: "Unknown command (command-name)"

### 3. Empty Timeline
**Scenario**: Ticket has no comments and no jobs

**Handling**: Display empty state message: "No activity yet"

### 4. Rapid Job Status Updates
**Scenario**: Job transitions PENDING → RUNNING → COMPLETED rapidly

**Handling**: Timeline shows start event (startedAt) and completion event (completedAt) with different timestamps; both events display correctly

### 5. Concurrent Comments and Jobs
**Scenario**: Comment posted while job is running (overlapping timestamps)

**Handling**: Sort order determined by timestamp comparison; events interleave naturally

### 6. VERIFY/SHIP Stage Jobs
**Scenario**: Future feature adds jobs for VERIFY or SHIP stages

**Handling**: Display name mapping table updated; existing logic handles new commands automatically via fallback pattern

---

## Summary

**Database Changes**: None (read-only from existing Comment and Job tables)

**New Types**: ConversationEvent (discriminated union), JobEvent, CommentEvent, JobEventType

**Key Functions**:
- `mergeConversationEvents()`: Merge and sort comments + jobs
- `createJobEvents()`: Generate start/completion events from Job record
- `getJobDisplayName()`: Map command to user-friendly name
- `getJobEventMessage()`: Generate event message with workflow type indicator

**Validation**: Enforced by existing Prisma schema (no new validation rules)

**Indexes**: Leverage existing indexes on Comment and Job tables for optimal query performance
