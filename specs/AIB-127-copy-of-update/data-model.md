# Data Model: Real-Time Ticket Modal Data Synchronization

**Feature Branch**: `AIB-127-copy-of-update`
**Date**: 2026-01-02

## Overview

This feature does NOT require database schema changes. The data model focuses on client-side data flow and cache management.

---

## Existing Entities (No Changes)

### Ticket

**Location**: `prisma/schema.prisma`

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| ticketNumber | Int | Sequential ticket number per project |
| ticketKey | String | Format: `{PROJECT_KEY}-{NUMBER}` |
| title | String | Ticket title |
| description | String? | Ticket description |
| stage | Stage | Current workflow stage |
| version | Int | Optimistic locking version |
| projectId | Int | Foreign key to Project |
| **branch** | String? | Git branch name (set by workflow) |
| previewUrl | String? | Vercel preview deployment URL |
| autoMode | Boolean | Auto-transition mode |
| clarificationPolicy | ClarificationPolicy? | Ticket-level policy override |
| workflowType | WorkflowType | FULL, QUICK, or CLEAN |
| attachments | Json? | Image attachments array |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Key for this feature**: The `branch` field is populated by the workflow when a ticket transitions to SPECIFY stage. The modal needs to display this field reactively.

### Job

**Location**: `prisma/schema.prisma`

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| ticketId | Int | Foreign key to Ticket |
| projectId | Int | Foreign key to Project |
| command | String | Job command (specify, plan, implement, etc.) |
| status | String | PENDING, RUNNING, COMPLETED, FAILED, CANCELLED |
| startedAt | DateTime? | When job started execution |
| completedAt | DateTime? | When job reached terminal status |
| branch | String? | Branch created/used by job |
| commitSha | String? | Git commit SHA |
| logs | String? | Job execution logs |
| inputTokens | Int? | LLM input tokens |
| outputTokens | Int? | LLM output tokens |
| cacheReadTokens | Int? | Cache read tokens |
| cacheCreationTokens | Int? | Cache creation tokens |
| costUsd | Decimal? | Total cost in USD |
| durationMs | Int? | Total duration in milliseconds |
| model | String? | LLM model used |
| toolsUsed | String[] | Array of tools used |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Key for this feature**: Full job data with telemetry fields is needed for Stats tab. Currently only fetched on initial server render.

---

## Client-Side Data Structures

### Query Keys (Existing)

**Location**: `app/lib/query-keys.ts`

```typescript
projects: {
  tickets: (id: number) => ['projects', id, 'tickets'],
  ticket: (projectId: number, ticketId: number) => ['projects', projectId, 'tickets', ticketId],
  jobsStatus: (id: number) => ['projects', id, 'jobs', 'status'],
}
```

### Query Keys (New)

**Location**: `app/lib/query-keys.ts`

```typescript
projects: {
  // ... existing keys
  ticketJobs: (projectId: number, ticketId: number) => ['projects', projectId, 'tickets', ticketId, 'jobs'],
}
```

### JobStatusDto (Existing - Polling)

**Location**: `app/lib/schemas/job-polling.ts`

```typescript
interface JobStatusDto {
  id: number;
  status: string;
  ticketId: number;
  command: string;
  updatedAt: string;
}
```

**Note**: Lightweight structure for 2-second polling. Does NOT include telemetry.

### TicketJobWithTelemetry (Existing - Stats)

**Location**: `lib/types/job-types.ts`

```typescript
interface TicketJobWithTelemetry {
  id: number;
  command: string;
  status: string;
  startedAt: Date | string;
  completedAt: Date | string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  model: string | null;
  toolsUsed: string[];
}
```

**Note**: Full telemetry structure needed for Stats tab calculations.

---

## Data Flow Diagrams

### Current Data Flow (Bug)

```
Server Render
     │
     ├─→ initialTicketsByStage ─→ queryClient.setQueryData() ─→ useTicketsByStage()
     │                                                              │
     └─→ initialJobs (static) ─────────────────────────────────→ Modal fullJobs prop
                                                                    │
                                                                    ▼
                                                               Stats Tab (stale)
```

**Problem**: `initialJobs` is static, never refreshed.

### Target Data Flow (Fix)

```
Server Render
     │
     ├─→ initialTicketsByStage ─→ queryClient.setQueryData() ─→ useTicketsByStage()
     │
     └─→ initialJobs ─→ queryClient.setQueryData(ticketJobs) ─→ useTicketJobs()
                                                                   │
                                                                   ▼
                                                              Modal fullJobs
                                                                   │
                                                                   ▼
                                                              Stats Tab (reactive)
```

**Solution**: Add `useTicketJobs` hook that queries from cache/server.

### Cache Invalidation Flow

```
useJobPolling() detects terminal job
           │
           ▼
    invalidateQueries()
           │
           ├─→ queryKeys.projects.tickets(projectId)      ─→ Ticket refetch ─→ Modal ticket prop updates
           │
           └─→ queryKeys.projects.ticketJobs(projectId, ticketId) ─→ Jobs refetch ─→ Modal fullJobs updates
```

---

## State Transitions

### Job Status Transitions (Existing)

```
PENDING → RUNNING → COMPLETED
              │
              ├──→ FAILED
              │
              └──→ CANCELLED
```

**Terminal statuses**: COMPLETED, FAILED, CANCELLED

### Cache Invalidation Triggers

| Event | Invalidates | Effect |
|-------|-------------|--------|
| Job → COMPLETED | `tickets`, `ticketJobs` | Ticket + jobs refetch |
| Job → FAILED | `tickets`, `ticketJobs` | Ticket + jobs refetch |
| Job → CANCELLED | `tickets`, `ticketJobs` | Ticket + jobs refetch |

---

## Validation Rules

### Ticket (No Changes)

- `title`: 1-200 characters
- `description`: Max 50,000 characters
- `stage`: Valid Stage enum value
- `branch`: Nullable, set by workflow

### Job (No Changes)

- `status`: One of PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
- `command`: Non-empty string (specify, plan, implement, etc.)
- Telemetry fields: All nullable (populated by workflow)

---

## API Contracts Summary

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/projects/{id}/tickets` | GET | Fetch all tickets | `TicketWithVersion[]` |
| `/api/projects/{id}/jobs/status` | GET | Poll job statuses | `{ jobs: JobStatusDto[] }` |
| `/api/projects/{id}/tickets/{id}/jobs` | GET | Fetch ticket jobs | `TicketJobWithTelemetry[]` |

**Note**: The existing `/api/projects/{id}/tickets/{id}/jobs` endpoint needs enhancement to return telemetry fields.

---

## Dependencies Between Entities

```
Project (1) ─────────────────────────────────────────────────────────────┐
    │                                                                     │
    ├──→ Ticket (N) ─────────────────────────────────────────────┐       │
    │        │                                                    │       │
    │        └──→ Job (N) ──────────────────────────────────────┼───────┘
    │                                                             │
    └──→ Query Cache ────────────────────────────────────────────┘
              │
              ├──→ tickets(projectId)
              ├──→ ticketJobs(projectId, ticketId)
              └──→ jobsStatus(projectId)
```
