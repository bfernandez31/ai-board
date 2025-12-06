# Data Model: Add Stats Tab to Ticket Detail Modal

**Feature Branch**: `AIB-99-add-stats-tab`
**Date**: 2025-12-06

## Overview

This feature reads from existing data models. **No schema changes required.**

The Stats tab aggregates telemetry data from the existing `Job` model to display ticket-level statistics.

---

## Existing Entities Used

### Job (Read-Only)

The `Job` model already contains all required telemetry fields:

| Field | Type | Purpose | Used In Stats |
|-------|------|---------|---------------|
| `id` | Int | Primary key | Job timeline key |
| `ticketId` | Int | Foreign key to Ticket | Filter jobs by ticket |
| `command` | String | Job type (specify, plan, implement, etc.) | Job row display |
| `status` | JobStatus | PENDING, RUNNING, COMPLETED, FAILED, CANCELLED | Status icon |
| `startedAt` | DateTime | When job started | Timeline ordering |
| `completedAt` | DateTime? | When job finished | Duration display |
| `inputTokens` | Int? | Total input tokens | Summary card, token breakdown |
| `outputTokens` | Int? | Total output tokens | Summary card, token breakdown |
| `cacheReadTokens` | Int? | Cache read tokens | Cache efficiency, token breakdown |
| `cacheCreationTokens` | Int? | Cache creation tokens | Token breakdown |
| `costUsd` | Float? | Cost in USD | Summary card, job row |
| `durationMs` | Int? | API duration in ms | Summary card, job row |
| `model` | String? | Model used (claude-opus-4-5) | Job row display |
| `toolsUsed` | String[] | Tools used (Edit, Read, Bash) | Tools usage section |

**Source**: `prisma/schema.prisma:29-59`

### Ticket (Read-Only, via relationship)

The parent `Ticket` entity is referenced only for relationship context:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | Int | Primary key, used to filter jobs |
| `jobs` | Job[] | One-to-many relationship with Job |

---

## New TypeScript Types

### TicketJobWithTelemetry

Extended interface for jobs with full telemetry data:

```typescript
// lib/types/job-types.ts

export interface TicketJobWithTelemetry {
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

### TicketStats

Aggregated statistics computed from jobs:

```typescript
// lib/hooks/use-ticket-stats.ts

export interface TicketStats {
  // Summary cards
  totalCost: number;           // Sum of all job costUsd
  totalDuration: number;       // Sum of all job durationMs
  totalTokens: number;         // inputTokens + outputTokens
  cacheEfficiency: number;     // Percentage (0-100)

  // Detailed breakdowns
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;

  // Jobs list (sorted chronologically)
  jobs: TicketJobWithTelemetry[];

  // Tool usage (sorted by frequency)
  toolsUsage: Array<{ tool: string; count: number }>;
}
```

---

## Data Relationships

```
Ticket (1) ──────────> (*) Job
           ticketId
```

- One Ticket has many Jobs
- Jobs filtered by `ticketId` for Stats tab
- Jobs sorted by `startedAt ASC` for chronological timeline
- Cascade delete: Deleting ticket removes all jobs

---

## Computed Fields

### Cache Efficiency

```typescript
const cacheEfficiency =
  (inputTokens + cacheReadTokens) > 0
    ? (cacheReadTokens / (inputTokens + cacheReadTokens)) * 100
    : 0;
```

### Total Tokens

```typescript
const totalTokens = inputTokens + outputTokens;
```

### Tool Usage Aggregation

```typescript
const toolsUsage = jobs
  .flatMap(job => job.toolsUsed)
  .reduce((acc, tool) => {
    acc[tool] = (acc[tool] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)
  // Convert to array sorted by count descending
  .sort((a, b) => b.count - a.count);
```

---

## Null Handling

All telemetry fields are nullable. Stats aggregation handles nulls:

| Scenario | Behavior |
|----------|----------|
| `costUsd` is null | Treat as 0 for summation |
| `durationMs` is null | Treat as 0 for summation |
| `inputTokens` is null | Treat as 0 for summation |
| All jobs have null telemetry | Show "N/A" for summary cards |
| `toolsUsed` is empty array | Show "No tools recorded" |

---

## Validation Rules

No new validation rules required. Existing Job model constraints apply:
- `command` max 50 chars (VARCHAR(50))
- `model` max 50 chars (VARCHAR(50))
- `toolsUsed` is always array (default `[]`)

---

## State Transitions

No state transitions in Stats tab. Jobs transition through:

```
PENDING → RUNNING → COMPLETED | FAILED | CANCELLED
```

Stats tab displays all job states but only aggregates telemetry from jobs with data.
