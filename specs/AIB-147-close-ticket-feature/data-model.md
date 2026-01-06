# Data Model: Close Ticket Feature

**Feature**: AIB-147-close-ticket-feature
**Date**: 2026-01-06

## Schema Changes

### Stage Enum Extension

```prisma
enum Stage {
  INBOX
  SPECIFY
  PLAN
  BUILD
  VERIFY
  SHIP
  CLOSED  // NEW: Terminal state for abandoned/cancelled work
}
```

**Migration SQL**:
```sql
ALTER TYPE "Stage" ADD VALUE 'CLOSED';
```

### Ticket Model Extension

```prisma
model Ticket {
  id                  Int                  @id @default(autoincrement())
  title               String               @db.VarChar(100)
  description         String               @db.VarChar(2500)
  stage               Stage                @default(INBOX)
  version             Int                  @default(1)
  projectId           Int
  ticketNumber        Int
  ticketKey           String               @unique @db.VarChar(20)
  branch              String?              @db.VarChar(200)
  previewUrl          String?              @db.VarChar(500)
  autoMode            Boolean              @default(false)
  workflowType        WorkflowType         @default(FULL)
  attachments         Json?                @default("[]")
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @default(now()) @updatedAt
  clarificationPolicy ClarificationPolicy?
  closedAt            DateTime?            // NEW: Timestamp when ticket entered CLOSED state

  // Relations
  comments            Comment[]
  jobs                Job[]
  notifications       Notification[]
  project             Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, ticketNumber])
  @@index([projectId])
  @@index([stage])
  @@index([updatedAt])
  @@index([projectId, workflowType])
  @@index([ticketKey])
}
```

**Migration SQL**:
```sql
ALTER TABLE "Ticket" ADD COLUMN "closedAt" TIMESTAMP(3);
```

## Entity Relationships

### State Transitions

```
INBOX ─────> SPECIFY ─────> PLAN ─────> BUILD ─────> VERIFY ─────> SHIP
                                                         │
                                                         └────> CLOSED (terminal)
```

**Transition Rules**:
| From Stage | To Stage | Allowed | Condition |
|------------|----------|---------|-----------|
| VERIFY | CLOSED | ✅ Yes | No active jobs, no cleanup lock |
| CLOSED | Any | ❌ No | Terminal state, no outbound transitions |
| Other | CLOSED | ❌ No | Only VERIFY can close |

### Validation Rules

**FR-005**: Block closure when `job.status IN ('PENDING', 'RUNNING')`
**FR-006**: Block closure when `project.activeCleanupJobId IS NOT NULL` and cleanup job status is PENDING/RUNNING

### Field Behaviors

| Field | On Close | Notes |
|-------|----------|-------|
| `stage` | Set to `CLOSED` | Removed from board columns |
| `closedAt` | Set to `NOW()` | Tracks closure timestamp |
| `branch` | Preserved | FR-008: Do NOT delete branch |
| `previewUrl` | Preserved | May still be useful for reference |
| `version` | Incremented | Optimistic concurrency |

## Query Patterns

### Board Query (Exclude CLOSED)

```typescript
// Tickets for board display
const boardTickets = await prisma.ticket.findMany({
  where: {
    projectId,
    stage: { not: 'CLOSED' },
  },
  orderBy: { updatedAt: 'desc' },
});
```

### Search Query (Include CLOSED)

```typescript
// Search includes all tickets
const searchResults = await prisma.ticket.findMany({
  where: {
    projectId,
    OR: [
      { ticketKey: { contains: query, mode: 'insensitive' } },
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
    ],
    // Note: No stage filter - CLOSED tickets are included
  },
  select: {
    id: true,
    ticketKey: true,
    title: true,
    stage: true,
    closedAt: true, // For display in results
  },
});
```

### Close Ticket Transaction

```typescript
// Atomic close operation
const closedTicket = await prisma.$transaction(async (tx) => {
  // 1. Update ticket stage and closedAt
  const updated = await tx.ticket.update({
    where: {
      id: ticketId,
      version: currentVersion, // OCC
    },
    data: {
      stage: 'CLOSED',
      closedAt: new Date(),
      version: { increment: 1 },
    },
  });

  // 2. Note: PR closure happens outside transaction (external API)

  return updated;
});
```

## TypeScript Interfaces

```typescript
// Extended Stage type
export type Stage =
  | 'INBOX'
  | 'SPECIFY'
  | 'PLAN'
  | 'BUILD'
  | 'VERIFY'
  | 'SHIP'
  | 'CLOSED';

// Ticket with closedAt
export interface TicketWithVersion {
  id: number;
  ticketKey: string;
  title: string;
  description: string | null;
  stage: Stage;
  version: number;
  projectId: number;
  branch: string | null;
  previewUrl: string | null;
  autoMode: boolean;
  workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  closedAt: string | null; // ISO date string or null
  // ... other fields
}

// Close validation result
export interface CloseValidationResult {
  allowed: boolean;
  reason?: string;
}

// Close operation result
export interface CloseTicketResult {
  success: boolean;
  ticket?: TicketWithVersion;
  prsClosed?: number;
  error?: string;
}
```
