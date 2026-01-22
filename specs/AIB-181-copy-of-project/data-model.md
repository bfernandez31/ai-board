# Data Model: Project Activity Feed (AIB-181)

**Date**: 2026-01-22
**Note**: Per FR-005, no new database tables are created. This document describes the virtual/aggregated data model.

## Overview

The Activity Feed aggregates events from three existing tables into a unified timeline:

```
┌─────────────────────────────────────────────────────────────────┐
│                        ActivityEvent                             │
│              (Virtual model - no database table)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │   Job    │    │ Comment  │    │  Ticket  │    │  Ticket  │  │
│  │ started  │    │ posted   │    │ created  │    │  stage   │  │
│  │completed │    │          │    │          │    │ changed  │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Entity Definitions

### ActivityEvent (Virtual)

A discriminated union type representing any event that can appear in the activity feed.

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'job' \| 'comment' \| 'ticket_created' \| 'stage_changed' \| 'pr_created' \| 'preview_deployed'` | Event discriminator |
| `timestamp` | `string` (ISO 8601) | When the event occurred |
| `ticketKey` | `string` | Reference to source ticket (e.g., "AIB-123") |
| `ticketTitle` | `string` | Ticket title for display |
| `ticketId` | `number` | Ticket ID for navigation |
| `ticketDeleted` | `boolean` | Whether ticket was deleted |
| `actor` | `Actor` | Who/what caused the event |
| `data` | Event-specific payload | Additional data based on type |

### Actor (Virtual)

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'user' \| 'system'` | Human or AI-BOARD |
| `id` | `string \| null` | User ID (null for system) |
| `name` | `string` | Display name ("AI-BOARD" for system) |
| `email` | `string \| null` | Email (null for system) |
| `image` | `string \| null` | Avatar URL (null for system) |

---

## Event Type Payloads

### JobEvent

Derived from `Job` table. Each job generates 1-2 events (start + optional completion).

| Field | Type | Source |
|-------|------|--------|
| `eventType` | `'start' \| 'complete'` | Computed from status |
| `jobId` | `number` | `job.id` |
| `command` | `string` | `job.command` |
| `status` | `JobStatus` | `job.status` |
| `displayName` | `string` | From `getJobDisplayName(command)` |

**Timestamp Mapping**:
- `start` event: uses `job.startedAt`
- `complete` event: uses `job.completedAt`

**Actor**: Always `{ type: 'system', name: 'AI-BOARD' }`

### CommentEvent

Derived from `Comment` table.

| Field | Type | Source |
|-------|------|--------|
| `commentId` | `number` | `comment.id` |
| `content` | `string` | `comment.content` (truncated for preview) |

**Timestamp**: `comment.createdAt`

**Actor**: `comment.user` (with fallback for deleted users)

### TicketCreatedEvent

Derived from `Ticket` table.

| Field | Type | Source |
|-------|------|--------|
| `workflowType` | `WorkflowType` | `ticket.workflowType` |

**Timestamp**: `ticket.createdAt`

**Actor**: Inferred from context (system for CLEAN workflows, first commenter otherwise)

### StageChangedEvent

Derived from `Job` completion events where the job implies a stage transition.

| Field | Type | Source |
|-------|------|--------|
| `fromStage` | `Stage` | Inferred from job command |
| `toStage` | `Stage` | Inferred from job status |

**Timestamp**: `job.completedAt`

**Actor**: `{ type: 'system', name: 'AI-BOARD' }`

### PRCreatedEvent

Derived from `Job` where `command = 'verify'` and status is `COMPLETED`.

| Field | Type | Source |
|-------|------|--------|
| `prUrl` | `string \| null` | Extracted from job context if available |

**Timestamp**: `job.completedAt`

**Actor**: `{ type: 'system', name: 'AI-BOARD' }`

### PreviewDeployedEvent

Derived from `Job` where `command = 'deploy-preview'` and status is `COMPLETED`.

| Field | Type | Source |
|-------|------|--------|
| `previewUrl` | `string` | `ticket.previewUrl` |

**Timestamp**: `job.completedAt`

**Actor**: `{ type: 'system', name: 'AI-BOARD' }`

---

## Source Table References

### Job Table (Existing)

```prisma
model Job {
  id          Int       @id
  ticketId    Int
  projectId   Int
  command     String    // specify, plan, implement, verify, quick-impl, etc.
  status      JobStatus // PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  startedAt   DateTime
  completedAt DateTime?
  ticket      Ticket    @relation(...)
}
```

**Used for**: JobEvent, StageChangedEvent, PRCreatedEvent, PreviewDeployedEvent

### Comment Table (Existing)

```prisma
model Comment {
  id        Int      @id
  ticketId  Int
  userId    String
  content   String
  createdAt DateTime
  ticket    Ticket   @relation(...)
  user      User     @relation(...)
}
```

**Used for**: CommentEvent

### Ticket Table (Existing)

```prisma
model Ticket {
  id           Int      @id
  ticketKey    String   @unique
  title        String
  stage        Stage
  projectId    Int
  workflowType WorkflowType
  previewUrl   String?
  createdAt    DateTime
  closedAt     DateTime?
}
```

**Used for**: TicketCreatedEvent, all event ticket references

---

## Validation Rules

### Input Validation (API)

| Parameter | Rule | Default |
|-----------|------|---------|
| `projectId` | Positive integer, valid project | Required |
| `limit` | 1-100 | 50 |
| `offset` | Non-negative integer | 0 |

### Authorization

| Check | Error | Status |
|-------|-------|--------|
| User not authenticated | "Unauthorized: Please sign in" | 401 |
| User not owner/member | "Forbidden: You do not have access" | 403 |
| Project not found | "Project not found" | 404 |

---

## Event Aggregation Query Logic

```sql
-- Pseudo-SQL for understanding the data flow
-- (Actual implementation uses Prisma queries)

SELECT
  'job' as type,
  j.started_at as timestamp,
  t.ticket_key,
  t.title as ticket_title,
  t.id as ticket_id,
  t.closed_at IS NOT NULL as ticket_deleted,
  'system' as actor_type,
  'AI-BOARD' as actor_name,
  j.id as job_id,
  j.command,
  j.status
FROM job j
JOIN ticket t ON j.ticket_id = t.id
WHERE j.project_id = :projectId
  AND j.started_at >= NOW() - INTERVAL '30 days'

UNION ALL

SELECT
  'comment' as type,
  c.created_at as timestamp,
  t.ticket_key,
  t.title as ticket_title,
  t.id as ticket_id,
  t.closed_at IS NOT NULL as ticket_deleted,
  'user' as actor_type,
  u.name as actor_name,
  c.id as comment_id,
  c.content
FROM comment c
JOIN ticket t ON c.ticket_id = t.id
JOIN "user" u ON c.user_id = u.id
WHERE t.project_id = :projectId
  AND c.created_at >= NOW() - INTERVAL '30 days'

UNION ALL

SELECT
  'ticket_created' as type,
  t.created_at as timestamp,
  t.ticket_key,
  t.title as ticket_title,
  t.id as ticket_id,
  t.closed_at IS NOT NULL as ticket_deleted,
  'system' as actor_type,
  'AI-BOARD' as actor_name,
  t.workflow_type
FROM ticket t
WHERE t.project_id = :projectId
  AND t.created_at >= NOW() - INTERVAL '30 days'

ORDER BY timestamp DESC
LIMIT :limit OFFSET :offset;
```

---

## State Transitions

### Ticket Lifecycle Events

```
INBOX ─────────────────────────────────────────────────────────────┐
  │                                                                │
  ├── [specify job] ──→ SPECIFY                                    │
  │                        │                                       │
  │                        └── [plan job] ──→ PLAN                 │
  │                                            │                   │
  │                                            └── [implement] ──→ BUILD
  │                                                                │
  └── [quick-impl] ─────────────────────────────────────────────→ BUILD
                                                                   │
                                                         [verify] ─┴──→ VERIFY
                                                                        │
                                                              [deploy] ─┴──→ SHIP
```

Events captured at each transition:
- **Job started**: When workflow begins
- **Job completed/failed**: When workflow ends
- **Stage changed**: Inferred from successful job completion

---

## TypeScript Type Definitions

```typescript
// Primary discriminated union type
export type ActivityEvent =
  | JobActivityEvent
  | CommentActivityEvent
  | TicketCreatedActivityEvent
  | StageChangedActivityEvent
  | PRCreatedActivityEvent
  | PreviewDeployedActivityEvent;

// Base interface
interface BaseActivityEvent {
  type: ActivityEventType;
  timestamp: string; // ISO 8601
  ticketKey: string;
  ticketTitle: string;
  ticketId: number;
  ticketDeleted: boolean;
  actor: Actor;
}

// Event-specific interfaces
interface JobActivityEvent extends BaseActivityEvent {
  type: 'job';
  data: {
    eventType: 'start' | 'complete';
    jobId: number;
    command: string;
    status: JobStatus;
    displayName: string;
  };
}

interface CommentActivityEvent extends BaseActivityEvent {
  type: 'comment';
  data: {
    commentId: number;
    content: string; // First 100 chars
  };
}

interface TicketCreatedActivityEvent extends BaseActivityEvent {
  type: 'ticket_created';
  data: {
    workflowType: WorkflowType;
  };
}

// ... additional event types
```

---

## Performance Considerations

1. **Query Optimization**:
   - Use indexed fields: `projectId`, `startedAt`/`createdAt`
   - Existing indexes on Job and Comment tables are sufficient

2. **Result Limiting**:
   - 30-day window reduces dataset size
   - 100 max limit prevents large responses
   - Pagination prevents memory issues

3. **No Joins on Large Tables**:
   - Ticket info fetched with events (small payload)
   - User info only for comments (limited set)
