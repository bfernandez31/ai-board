# Data Model: Add Stats Tab to Ticket Detail Modal

**Feature Branch**: `AIB-98-add-stats-tab`
**Date**: 2025-12-06

## Entity Overview

This feature does **not** require new database entities. It extends existing types and creates derived data structures for UI rendering.

## Existing Entities (No Changes)

### Job (Prisma Model)

Already contains all required telemetry fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int` | Primary key |
| `ticketId` | `Int` | Foreign key to Ticket |
| `command` | `String` | Workflow command (specify, plan, implement, etc.) |
| `status` | `JobStatus` | PENDING, RUNNING, COMPLETED, FAILED, CANCELLED |
| `startedAt` | `DateTime` | Job start timestamp |
| `completedAt` | `DateTime?` | Job completion timestamp |
| `inputTokens` | `Int?` | Total input tokens consumed |
| `outputTokens` | `Int?` | Total output tokens generated |
| `cacheReadTokens` | `Int?` | Cache read tokens |
| `cacheCreationTokens` | `Int?` | Cache creation tokens |
| `costUsd` | `Float?` | Total cost in USD |
| `durationMs` | `Int?` | Duration in milliseconds |
| `model` | `String?` | AI model used |
| `toolsUsed` | `String[]` | List of tools used |

### Ticket (Prisma Model)

Existing relation to Job:

```prisma
model Ticket {
  // ...existing fields...
  jobs Job[]  // One-to-many relation
}
```

## New TypeScript Types

### TicketJobWithStats

Extends existing `TicketJob` interface with telemetry fields:

```typescript
// lib/types/job-types.ts

export interface TicketJobWithStats {
  id: number;
  command: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedAt: string;           // ISO 8601
  completedAt: string | null;  // ISO 8601
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
// lib/stats/ticket-stats.ts

export interface TicketStats {
  totalCost: number;           // Sum of costUsd, USD
  totalDuration: number;       // Sum of durationMs, milliseconds
  totalInputTokens: number;    // Sum of inputTokens
  totalOutputTokens: number;   // Sum of outputTokens
  totalTokens: number;         // inputTokens + outputTokens
  cacheReadTokens: number;     // Sum of cacheReadTokens
  cacheEfficiency: number | null; // (cacheReadTokens / totalInputTokens) * 100, null if no input
  toolUsage: ToolUsageCount[]; // Aggregated tool counts
}
```

### ToolUsageCount

Individual tool usage count:

```typescript
// lib/stats/ticket-stats.ts

export interface ToolUsageCount {
  tool: string;   // Tool name (Edit, Read, Bash, etc.)
  count: number;  // Usage count across all jobs
}
```

### JobTimelineItem

Derived type for timeline row display:

```typescript
// components/ticket/job-timeline.tsx

export interface JobTimelineItem {
  id: number;
  stage: string;               // Derived from command (SPECIFY, PLAN, BUILD, VERIFY)
  command: string;             // Original command
  status: string;
  statusIcon: React.ReactNode; // Check, X, Clock, etc.
  duration: string;            // Formatted "Xm Xs" or "—"
  cost: string;                // Formatted "$X.XX" or "—"
  model: string;               // Model name or "—"
  startedAt: Date;             // For sorting
  isExpandable: boolean;       // Has token data
  tokenBreakdown: TokenBreakdown | null;
}
```

### TokenBreakdown

Token details for expanded job row:

```typescript
// components/ticket/job-timeline-row.tsx

export interface TokenBreakdown {
  inputTokens: string;         // Formatted with abbreviations
  outputTokens: string;
  cacheReadTokens: string;
  cacheCreationTokens: string;
}
```

## Validation Rules

### TicketJobWithStats

- `id`: Positive integer
- `command`: Non-empty string
- `status`: One of PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
- `startedAt`: Valid ISO 8601 datetime
- `completedAt`: Valid ISO 8601 datetime or null
- Token fields: Non-negative integers or null
- `costUsd`: Non-negative float or null
- `durationMs`: Non-negative integer or null
- `toolsUsed`: Array of strings (may be empty)

### Aggregation Rules

- Null values treated as 0 for summation
- Cache efficiency: `null` when totalInputTokens is 0 (avoid division by zero)
- Tool aggregation: Count occurrences, sort descending by count

## State Transitions

Jobs have existing state machine (no changes):

```
PENDING → RUNNING → COMPLETED
                  → FAILED
                  → CANCELLED
```

Stats visibility depends on job count:
- `jobs.length === 0`: Stats tab hidden
- `jobs.length > 0`: Stats tab visible

## API Response Schema

Extended `/api/projects/[projectId]/tickets/[id]/jobs?includeStats=true`:

```typescript
// Response type
interface JobsWithStatsResponse {
  jobs: TicketJobWithStats[];
}
```

Zod schema:

```typescript
const TicketJobWithStatsSchema = z.object({
  id: z.number().int().positive(),
  command: z.string().min(1),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  cacheReadTokens: z.number().int().nonnegative().nullable(),
  cacheCreationTokens: z.number().int().nonnegative().nullable(),
  costUsd: z.number().nonnegative().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  model: z.string().nullable(),
  toolsUsed: z.array(z.string()),
});
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Database                                 │
│  ┌────────────┐    ┌──────────────────────────────────────────┐ │
│  │   Ticket   │───►│  Job (with telemetry fields)             │ │
│  └────────────┘    └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┬┘
                                                                  │
                         API Layer                                │
┌─────────────────────────────────────────────────────────────────┤
│  GET /api/projects/:id/tickets/:id/jobs?includeStats=true      │
│  Returns: TicketJobWithStats[]                                  │
└─────────────────────────────────────────────────────────────────┤
                                                                  │
                        Client Layer                              │
┌─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌───────────────────┐   ┌───────────────┐  │
│  │ Board.tsx    │──►│ TicketDetailModal │──►│ StatsTab      │  │
│  │ (polling)    │   │ (receives jobs)   │   │ (aggregates)  │  │
│  └──────────────┘   └───────────────────┘   └───────┬───────┘  │
│                                                      │          │
│  ┌───────────────────────────────────────────────────┴───────┐ │
│  │                    calculateTicketStats()                  │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐│ │
│  │  │ TicketStats │  │ToolUsage[] │  │ JobTimelineItem[]   ││ │
│  │  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘│ │
│  └─────────┼────────────────┼────────────────────┼───────────┘ │
│            ▼                ▼                    ▼             │
│  ┌─────────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ SummaryCards    │ │ ToolsUsage   │ │ JobTimeline          │ │
│  └─────────────────┘ └──────────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```
