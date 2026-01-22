# Data Model: Project Activity Feed

**Feature**: AIB-172 Project Activity Feed
**Date**: 2026-01-22

## Overview

The activity feed uses a **virtual entity model** - no new database tables are created. Activity events are derived at query time from existing tables (Job, Comment, Ticket) and transformed into a unified `ActivityEvent` discriminated union type.

## Existing Tables Used

### Ticket (source: tickets)
```prisma
model Ticket {
  id           String    @id @default(cuid())
  ticketKey    String    @unique
  title        String
  stage        Stage     @default(INBOX)
  projectId    String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  project      Project   @relation(...)
  comments     Comment[]
  jobs         Job[]
}
```
**Activity Events Derived**:
- `ticket_created`: From `createdAt`
- `ticket_stage_changed`: When `updatedAt > createdAt` (detected via timestamp comparison)

### Job (source: jobs)
```prisma
model Job {
  id          String      @id @default(cuid())
  ticketId    String
  projectId   String
  command     String
  status      JobStatus   // PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime    @default(now())

  ticket      Ticket      @relation(...)
  project     Project     @relation(...)
}

// Relevant indexes
@@index([projectId])
@@index([startedAt])
@@index([ticketId, status, startedAt])
```
**Activity Events Derived**:
- `job_started`: From `startedAt` when status transitions to RUNNING
- `job_completed`: From `completedAt` when status = COMPLETED
- `job_failed`: From `completedAt` when status = FAILED

### Comment (source: comments)
```prisma
model Comment {
  id        String   @id @default(cuid())
  ticketId  String
  userId    String
  content   String   @db.VarChar(2000)
  createdAt DateTime @default(now())

  ticket    Ticket   @relation(...)
  user      User     @relation(...)
}

// Relevant indexes
@@index([ticketId, createdAt])
@@index([userId])
```
**Activity Events Derived**:
- `comment_posted`: From `createdAt`

### User (source: users - for actor resolution)
```prisma
model User {
  id        String   @id @default(cuid())
  name      String?
  email     String   @unique
  image     String?
}
```
**Used For**: Actor display (name, avatar)

## Virtual Entity: ActivityEvent

### TypeScript Type Definition

```typescript
// Base types for all events
interface Actor {
  id: string
  name: string | null
  email: string
  image: string | null
  isSystem: boolean  // true for AI-BOARD
}

interface TicketReference {
  ticketKey: string
  ticketId: string
  isDeleted: boolean
}

// Event type discriminated union
type ActivityEventType =
  | 'ticket_created'
  | 'ticket_stage_changed'
  | 'comment_posted'
  | 'job_started'
  | 'job_completed'
  | 'job_failed'

// Base event interface
interface BaseActivityEvent {
  id: string                    // Unique event identifier
  type: ActivityEventType
  timestamp: string             // ISO 8601
  actor: Actor
  ticket: TicketReference
  projectId: string
}

// Specific event types with additional data
interface TicketCreatedEvent extends BaseActivityEvent {
  type: 'ticket_created'
  data: {
    title: string
  }
}

interface TicketStageChangedEvent extends BaseActivityEvent {
  type: 'ticket_stage_changed'
  data: {
    fromStage?: Stage           // May not be available (derived)
    toStage: Stage
  }
}

interface CommentPostedEvent extends BaseActivityEvent {
  type: 'comment_posted'
  data: {
    contentPreview: string      // First 100 chars
    isAiBoardMention: boolean   // Contains @ai-board
  }
}

interface JobStartedEvent extends BaseActivityEvent {
  type: 'job_started'
  data: {
    command: string
    displayName: string         // Human-readable command name
  }
}

interface JobCompletedEvent extends BaseActivityEvent {
  type: 'job_completed'
  data: {
    command: string
    displayName: string
    durationMs?: number
  }
}

interface JobFailedEvent extends BaseActivityEvent {
  type: 'job_failed'
  data: {
    command: string
    displayName: string
    durationMs?: number
  }
}

// Union type
type ActivityEvent =
  | TicketCreatedEvent
  | TicketStageChangedEvent
  | CommentPostedEvent
  | JobStartedEvent
  | JobCompletedEvent
  | JobFailedEvent

// Type guards
function isTicketCreatedEvent(e: ActivityEvent): e is TicketCreatedEvent {
  return e.type === 'ticket_created'
}

function isCommentPostedEvent(e: ActivityEvent): e is CommentPostedEvent {
  return e.type === 'comment_posted'
}

function isJobEvent(e: ActivityEvent): e is JobStartedEvent | JobCompletedEvent | JobFailedEvent {
  return e.type.startsWith('job_')
}
```

### Event ID Generation

Event IDs are derived to ensure uniqueness and stability:

```typescript
// Format: {type}_{sourceId}_{suffix}
// Examples:
// - ticket_created: "tc_cuid123"
// - comment_posted: "cp_cuid456"
// - job_started: "js_cuid789"
// - job_completed: "jc_cuid789"
```

## API Response Types

### Activity Feed Response

```typescript
interface ActivityFeedResponse {
  events: ActivityEvent[]
  pagination: {
    offset: number
    limit: number
    total: number
    hasMore: boolean
  }
  actors: Record<string, Actor>  // Lookup map by actor ID
}
```

### Query Parameters

```typescript
interface ActivityFeedParams {
  offset?: number   // Default: 0
  limit?: number    // Default: 50, Max: 100
  since?: string    // ISO 8601, for polling (get events after timestamp)
}
```

## Data Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Ticket    │    │   Comment   │    │    Job      │
│   Table     │    │   Table     │    │   Table     │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌──────────────────────────────────────────────────┐
│           Activity Query Layer                    │
│  - Parallel queries to each source table          │
│  - Filter by projectId and date range             │
│  - Transform to ActivityEvent types               │
└──────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│           Merge & Sort Layer                      │
│  - Merge all events into single array             │
│  - Sort by timestamp (newest first)               │
│  - Apply pagination (offset/limit)                │
└──────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│           ActivityFeedResponse                    │
│  - events: ActivityEvent[]                        │
│  - pagination: { offset, limit, total, hasMore }  │
│  - actors: Record<string, Actor>                  │
└──────────────────────────────────────────────────┘
```

## Validation Rules

### Input Validation (Zod Schema)

```typescript
const activityFeedParamsSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  since: z.string().datetime().optional()
})
```

### Business Rules

1. **Date Window**: Only events from the last 30 days are returned
2. **Project Scope**: Events filtered by projectId (authorization enforced)
3. **No Duplicates**: Each event has unique ID based on source and type
4. **Stable Ordering**: Timestamp + ID for consistent pagination

## Relationships

```
Project (1) ──── (*) Ticket ──── (*) Comment
                      │              │
                      │              └─── (1) User (actor)
                      │
                      └──── (*) Job
                              │
                              └─── Actor: AI-BOARD system user
```

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Deleted ticket | `ticket.isDeleted: true`, non-clickable reference |
| Deleted user (actor) | `actor.name: "Deleted user"`, default avatar |
| No activity in 30 days | Empty events array, `hasMore: false` |
| Concurrent events (same timestamp) | Secondary sort by event ID |
| Job without startedAt | Skip job_started event, still show completion |
