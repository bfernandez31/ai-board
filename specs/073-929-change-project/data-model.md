# Data Model: Project Card Redesign

**Feature**: Display last shipped ticket instead of project description
**Date**: 2025-10-29

## Overview

This feature modifies the Project entity to include deployment URL and updates the query pattern to fetch last shipped ticket information. No new entities are required; changes are additive to existing schema.

---

## Entity Changes

### 1. Project (MODIFIED)

**New Field**:
```prisma
model Project {
  id                  Int                 @id @default(autoincrement())
  name                String              @db.VarChar(100)
  description         String              @db.VarChar(1000)
  githubOwner         String              @db.VarChar(100)
  githubRepo          String              @db.VarChar(100)
  userId              String
  deploymentUrl       String?             @db.VarChar(500)  // NEW: Optional deployment URL
  createdAt           DateTime            @default(now())
  updatedAt           DateTime
  clarificationPolicy ClarificationPolicy @default(AUTO)

  user                User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  tickets             Ticket[]
  members             ProjectMember[]

  @@unique([githubOwner, githubRepo])
  @@index([githubOwner, githubRepo])
  @@index([userId])
}
```

**Field Details**:
- **deploymentUrl**: Nullable string (max 500 characters)
  - **Purpose**: Store production/staging deployment URL for quick access
  - **Validation**: Must be valid URL format if provided (Zod: `z.string().url().max(500).nullable()`)
  - **Display**: Shown on project card with copy-to-clipboard functionality
  - **Nullable**: Projects without deployments leave field null (no empty strings)

**No Changes Required**:
- Ticket entity already has all fields needed (id, title, updatedAt, stage)
- Existing indexes sufficient for query performance

---

## TypeScript Types

### ProjectWithCount (MODIFIED)

**Current**:
```typescript
export interface ProjectWithCount {
  id: number;
  name: string;
  description: string;
  updatedAt: string; // ISO 8601
  ticketCount: number;
}
```

**New**:
```typescript
export interface ProjectWithCount {
  id: number;
  name: string;
  description: string;
  githubOwner: string;         // NEW: For GitHub link display
  githubRepo: string;          // NEW: For GitHub link display
  deploymentUrl: string | null; // NEW: Optional deployment URL
  updatedAt: string;           // ISO 8601
  ticketCount: number;
  lastShippedTicket: {         // NEW: Last ticket in SHIP stage
    id: number;
    title: string;
    updatedAt: string;         // ISO 8601
  } | null;                    // null if no shipped tickets
}
```

### New Utility Types

```typescript
// For shipped ticket display logic
export interface ShippedTicketDisplay {
  title: string;
  timestamp: string;           // Formatted relative time
  hasShipped: boolean;
}
```

---

## Validation Rules

### Project Validation (Zod Schema)

**New Validation**:
```typescript
import { z } from 'zod';

export const projectUpdateSchema = z.object({
  name: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  githubOwner: z.string().max(100).optional(),
  githubRepo: z.string().max(100).optional(),
  deploymentUrl: z.string().url().max(500).nullable().optional(),
  clarificationPolicy: z.enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE']).optional(),
});
```

**Validation Rules**:
- `deploymentUrl` must be valid URL format (protocol required: http/https)
- Maximum 500 characters
- `null` explicitly allowed (distinguishes from empty string)
- Optional field (can be omitted from update requests)

---

## Database Queries

### Get Projects with Shipped Tickets

**Modified Query** (`lib/db/projects.ts`):
```typescript
export async function getUserProjects() {
  const userId = await requireAuth();

  return prisma.project.findMany({
    where: {
      OR: [
        { userId },                            // Owner access
        { members: { some: { userId } } }      // Member access
      ]
    },
    include: {
      _count: {
        select: { tickets: true }              // Total ticket count
      },
      tickets: {
        where: { stage: 'SHIP' },              // Only shipped tickets
        orderBy: { updatedAt: 'desc' },        // Most recent first
        take: 1,                               // Only last shipped ticket
        select: {
          id: true,
          title: true,
          updatedAt: true,
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });
}
```

**Performance Characteristics**:
- **Index Usage**: Leverages `@@index([projectId, stage, updatedAt])` on Ticket model
- **Query Cost**: Single query fetches projects + last shipped ticket (no N+1)
- **Result Set**: O(num_projects) rows, minimal data transfer
- **Expected Performance**: <100ms p95 for typical datasets (100 projects, 1000 tickets)

---

## State Transitions

No state machine changes required. Ticket stage transitions remain unchanged:
- INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP

The feature only **reads** ticket state (SHIP stage), does not modify workflow.

---

## Migration Plan

### Step 1: Schema Migration
```bash
# Update prisma/schema.prisma with deploymentUrl field
npx prisma migrate dev --name add_deployment_url
```

**Generated Migration**:
```sql
-- Add deploymentUrl column to Project table
ALTER TABLE "Project" ADD COLUMN "deploymentUrl" VARCHAR(500);
```

**Rollback Plan** (if needed):
```sql
ALTER TABLE "Project" DROP COLUMN "deploymentUrl";
```

### Step 2: Type Updates
1. Update `app/lib/types/project.ts` with new ProjectWithCount interface
2. Update Zod schemas in `app/lib/schemas/` for validation
3. Regenerate Prisma types: `npx prisma generate`

### Step 3: Query Updates
1. Modify `lib/db/projects.ts` - add tickets include to getUserProjects()
2. Update `app/api/projects/route.ts` - map new fields to response

### Step 4: Validation
- Run existing tests to ensure no breaking changes
- Add new tests for deploymentUrl validation
- Verify query performance with EXPLAIN ANALYZE

**No Data Migration Required**: Existing projects get `null` deploymentUrl automatically.

---

## Constraints & Indexes

**Existing Indexes Used**:
- `Ticket.@@index([projectId])` - Filter tickets by project
- `Ticket.@@index([stage])` - Filter by SHIP stage
- `Ticket.@@index([updatedAt])` - Order by most recent

**No New Indexes Required**: Existing composite index on (projectId, stage, updatedAt) sufficient for query performance.

**Database Constraints**:
- `deploymentUrl` nullable (no NOT NULL constraint)
- No unique constraint (multiple projects can share deployment URL - e.g., monorepos)
- No foreign keys (simple string field)

---

## Edge Cases

| Scenario | Behavior | Implementation |
|----------|----------|----------------|
| Project with 0 tickets | `ticketCount: 0`, `lastShippedTicket: null` | Display "No tickets yet" |
| Project with tickets but none shipped | `ticketCount: N`, `lastShippedTicket: null` | Display "No tickets shipped yet · N total" |
| Ticket title > 100 chars | Truncated with ellipsis | CSS: `text-overflow: ellipsis` + tooltip |
| Ticket shipped years ago | Absolute date format | formatTimestamp() returns "Oct 23, 2023" |
| deploymentUrl is null | Section hidden | Conditional render: `{deploymentUrl && <div>...</div>}` |
| deploymentUrl very long | Truncated display | CSS: `max-width` + `overflow: hidden` + tooltip |
| Invalid deploymentUrl | Validation error on update | Zod schema rejects non-URL strings |
| Concurrent ticket updates | Most recent by updatedAt | Prisma orderBy handles race conditions |

---

## Summary

**Schema Changes**:
- 1 field added to Project model (deploymentUrl)
- 0 new tables
- 0 new indexes
- 1 migration file

**Type Changes**:
- ProjectWithCount interface extended (5 new fields)
- 1 new utility interface (ShippedTicketDisplay)

**Query Changes**:
- getUserProjects() enhanced with tickets include
- No breaking changes to existing queries

**Validation**:
- deploymentUrl: URL format, max 500 chars, nullable

All changes are **additive and backward-compatible**. Existing projects continue to function; new fields enhance display without breaking existing functionality.
