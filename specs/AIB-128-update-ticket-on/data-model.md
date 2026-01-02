# Data Model: Ticket Modal Real-Time Data Refresh

**Feature**: AIB-128
**Date**: 2026-01-02

## Overview

This feature does not introduce new entities or modify the database schema. It fixes data synchronization between existing entities via TanStack Query cache management.

## Existing Entities (No Changes)

### Ticket

**Location**: `prisma/schema.prisma`

```prisma
model Ticket {
  id                  Int                  @id @default(autoincrement())
  ticketNumber        Int
  ticketKey           String               @unique
  title               String               @db.VarChar(100)
  description         String?
  stage               Stage                @default(INBOX)
  version             Int                  @default(1)
  branch              String?              // Updated by workflow, triggers modal refresh
  workflowType        WorkflowType         @default(FULL)
  // ... other fields
}
```

**Relevant for this feature**:
- `branch`: Set by workflow when job completes; modal needs to show updated value
- `version`: Incremented on content updates (NOT on branch assignment)
- `workflowType`: Determines which artifact buttons to show

### Job

**Location**: `prisma/schema.prisma`

```prisma
model Job {
  id           Int       @id @default(autoincrement())
  ticketId     Int
  projectId    Int
  command      String    // 'specify', 'plan', 'implement', etc.
  status       JobStatus @default(PENDING)
  // ... telemetry fields (inputTokens, costUsd, etc.)
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

**Relevant for this feature**:
- `status`: Polled every 2s; terminal status triggers cache invalidation
- `command`: Determines which artifact button becomes visible

## Data Flow (No Changes to Flow, Fix to Sync)

```
Job Polling (2s interval)
    │
    ▼
Terminal Job Detected
    │
    ├─────────────────────────────────┐
    │                                 │
    ▼                                 ▼
Invalidate Tickets Cache    Invalidate Timeline Cache (NEW)
    │                                 │
    ▼                                 ▼
useTicketsByStage refetches   useConversationTimeline refetches
    │                                 │
    ▼                                 │
Board re-renders with new tickets    │
    │                                 │
    ▼                                 │
selectedTicket updates              │
    │                                 │
    ▼                                 │
Modal receives new ticket prop       │
    │                                 │
    ▼                                 ▼
localTicket syncs (FIX)        Stats tab receives fresh job data
    │
    ▼
Artifact buttons re-evaluate
    │
    ▼
UI shows Spec/Plan/Summary buttons
```

## Query Cache Keys

### Existing Keys (Used in Fix)

| Query Key | Purpose | Invalidation Trigger |
|-----------|---------|---------------------|
| `['projects', projectId, 'tickets']` | All tickets for project | Job reaches terminal status |
| `['projects', projectId, 'jobs', 'status']` | Lightweight job polling | 2-second interval refetch |
| `['projects', projectId, 'tickets', ticketId, 'timeline']` | Full job data + comments | Job reaches terminal status (NEW) |

## Type Definitions (No Changes)

### TicketData (Modal Props)

**Location**: `components/board/ticket-detail-modal.tsx:54-75`

```typescript
interface TicketData {
  id: number;
  branch: string | null;        // Key field - must sync to modal
  workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  // ... other display fields
}
```

### TicketJob (Polling Response)

**Location**: `components/board/ticket-detail-modal.tsx:80-84`

```typescript
interface TicketJob {
  id: number;
  command: string;   // 'specify', 'plan', 'implement'
  status: string;    // 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'
}
```

### JobStatusDto (API Response)

**Location**: `app/lib/schemas/job-polling.ts`

```typescript
interface JobStatusDto {
  id: number;
  ticketId: number;
  command: string;
  status: string;
  updatedAt: string;
}
```

## State Synchronization Points

| Component | State | Source | Sync Mechanism |
|-----------|-------|--------|----------------|
| Board | `ticketsByStage` | TanStack Query cache | Auto-updates on invalidation |
| Board | `selectedTicket` | Derived from `allTickets` | useMemo recalculates |
| Modal | `ticket` prop | Parent (Board) | React prop updates |
| Modal | `localTicket` | useState | **FIX**: useEffect always syncs |
| Modal | `jobs` prop | Parent (Board via polling) | React prop updates |
| Stats | `fullJobs` prop | Parent (Modal) | **FIX**: Timeline invalidation |

## Validation Rules (No Changes)

No new validation rules. Existing job status validation in Prisma enum.

## Relationships (No Changes)

- Ticket 1:N Job (existing)
- Project 1:N Ticket (existing)
- Project 1:N Job (existing)
