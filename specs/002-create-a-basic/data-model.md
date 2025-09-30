# Data Model: Basic Kanban Board

**Feature**: 002-create-a-basic
**Date**: 2025-09-30
**Phase**: 1 - Design & Contracts

## Overview
Data model for the kanban board feature, defining entities, relationships, validation rules, and state transitions. Implemented using Prisma ORM with PostgreSQL.

## Entity Definitions

### Ticket

**Purpose**: Represents a work item moving through the kanban workflow

**Prisma Schema**:
```prisma
model Ticket {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(500)
  description String?  @db.Text
  stage       Stage    @default(IDLE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | Int | Primary Key, Auto-increment | Unique identifier for the ticket |
| `title` | String | Required, Max 500 chars | Ticket title (truncated at 2 lines in UI) |
| `description` | String? | Optional, Max 5000 chars | Detailed description (not displayed on card) |
| `stage` | Stage Enum | Required, Default: IDLE | Current workflow stage |
| `createdAt` | DateTime | Auto-set on creation | Timestamp when ticket was created |
| `updatedAt` | DateTime | Auto-updated | Timestamp of last modification |

**Validation Rules**:

```typescript
import { z } from 'zod';

export const TicketSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  description: z.string().max(5000, 'Description too long').nullable(),
  stage: z.enum(['IDLE', 'PLAN', 'BUILD', 'REVIEW', 'SHIPPED', 'ERRORED']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateTicketSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional(),
});

export type Ticket = z.infer<typeof TicketSchema>;
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
```

**Indexes**:
```prisma
model Ticket {
  // ... fields ...
  @@index([stage])  // Fast filtering by stage
  @@index([updatedAt])  // Fast sorting by recent activity
}
```

### Stage Enum

**Purpose**: Defines the 6 workflow stages in the kanban board

**Prisma Schema**:
```prisma
enum Stage {
  IDLE      // Initial state, no work started
  PLAN      // Planning phase
  BUILD     // Implementation phase
  REVIEW    // Code review phase
  SHIPPED   // Successfully completed
  ERRORED   // Error state (accessible from any stage)
}
```

**Stage Metadata**:

```typescript
export const STAGE_CONFIG = {
  IDLE: {
    label: 'Idle',
    color: 'gray',
    description: 'Tickets awaiting work',
    order: 0,
  },
  PLAN: {
    label: 'Plan',
    color: 'blue',
    description: 'Planning in progress',
    order: 1,
  },
  BUILD: {
    label: 'Build',
    color: 'green',
    description: 'Implementation in progress',
    order: 2,
  },
  REVIEW: {
    label: 'Review',
    color: 'orange',
    description: 'Under review',
    order: 3,
  },
  SHIPPED: {
    label: 'Shipped',
    color: 'purple',
    description: 'Successfully deployed',
    order: 4,
  },
  ERRORED: {
    label: 'Errored',
    color: 'red',
    description: 'Error occurred',
    order: 5,
  },
} as const;

export type StageKey = keyof typeof STAGE_CONFIG;
```

## Relationships

### Current Phase (MVP)
- **No relationships** - Tickets are standalone entities
- Single board (implicit, no Board entity yet)
- No user ownership (no authentication in this phase)

### Future Phases (Not Implemented)
- `Ticket` → `Board` (many-to-one): Support multiple boards
- `Ticket` → `User` (many-to-one): Ticket ownership/assignment
- `Ticket` → `Comment` (one-to-many): Ticket discussions
- `Ticket` → `Attachment` (one-to-many): File attachments

## State Transitions

### Ticket Stage Workflow

```
        ┌─────────┐
        │  IDLE   │ (Initial state)
        └────┬────┘
             │
        ┌────▼────┐
        │  PLAN   │
        └────┬────┘
             │
        ┌────▼────┐
        │  BUILD  │
        └────┬────┘
             │
        ┌────▼────┐
        │ REVIEW  │
        └────┬────┘
             │
        ┌────▼────┐
        │ SHIPPED │ (Terminal state)
        └─────────┘

     (Any stage can transition to ERRORED)
             │
        ┌────▼────┐
        │ ERRORED │
        └─────────┘
```

**Transition Rules** (Not enforced in MVP, future enhancement):
- Tickets typically progress: IDLE → PLAN → BUILD → REVIEW → SHIPPED
- ERRORED is accessible from any stage (error can occur at any time)
- SHIPPED is a terminal state (no transitions out in MVP)
- Future: Support backwards transitions (REVIEW → BUILD for rework)

**Implementation Note**: In this MVP phase, stage transitions are NOT implemented. Tickets remain in IDLE after creation. Stage transitions will be added in future drag-and-drop feature.

## Database Schema (Complete)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Stage {
  IDLE
  PLAN
  BUILD
  REVIEW
  SHIPPED
  ERRORED
}

model Ticket {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(500)
  description String?  @db.Text
  stage       Stage    @default(IDLE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([stage])
  @@index([updatedAt])
}
```

## TypeScript Type Definitions

```typescript
// lib/types.ts

import { Stage, Ticket as PrismaTicket } from '@prisma/client';

// Re-export Prisma types
export type { Stage };
export type Ticket = PrismaTicket;

// API types
export interface TicketsByStage {
  IDLE: Ticket[];
  PLAN: Ticket[];
  BUILD: Ticket[];
  REVIEW: Ticket[];
  SHIPPED: Ticket[];
  ERRORED: Ticket[];
}

export interface CreateTicketResponse {
  id: number;
  title: string;
  description: string | null;
  stage: Stage;
  createdAt: string;
  updatedAt: string;
}

export interface ErrorResponse {
  error: string;
  code?: string;
}

// UI Component Props
export interface TicketCardProps {
  ticket: Ticket;
}

export interface ColumnProps {
  stage: Stage;
  tickets: Ticket[];
}

export interface BoardProps {
  ticketsByStage: TicketsByStage;
}
```

## Data Access Patterns

### 1. Fetch All Tickets Grouped by Stage

```typescript
// lib/db.ts

import { PrismaClient } from '@prisma/client';
import type { TicketsByStage } from './types';

const prisma = new PrismaClient();

export async function getTicketsByStage(): Promise<TicketsByStage> {
  const tickets = await prisma.ticket.findMany({
    orderBy: { updatedAt: 'desc' },
  });

  // Group by stage
  const grouped: TicketsByStage = {
    IDLE: [],
    PLAN: [],
    BUILD: [],
    REVIEW: [],
    SHIPPED: [],
    ERRORED: [],
  };

  tickets.forEach((ticket) => {
    grouped[ticket.stage].push(ticket);
  });

  return grouped;
}
```

### 2. Create New Ticket

```typescript
// lib/db.ts (continued)

import { CreateTicketInput } from './validations';

export async function createTicket(input: CreateTicketInput) {
  return await prisma.ticket.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      stage: 'IDLE', // Default stage
    },
  });
}
```

### 3. Get Ticket Count by Stage

```typescript
// lib/db.ts (continued)

export async function getTicketCountByStage() {
  const counts = await prisma.ticket.groupBy({
    by: ['stage'],
    _count: { id: true },
  });

  return counts.reduce((acc, { stage, _count }) => {
    acc[stage] = _count.id;
    return acc;
  }, {} as Record<Stage, number>);
}
```

## Migration Strategy

### Initial Migration

```bash
# Initialize Prisma (if not already done)
npx prisma init

# Create migration for Ticket model and Stage enum
npx prisma migrate dev --name init-tickets
```

### Migration File (Generated):
```sql
-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('IDLE', 'PLAN', 'BUILD', 'REVIEW', 'SHIPPED', 'ERRORED');

-- CreateTable
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "stage" "Stage" NOT NULL DEFAULT 'IDLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ticket_stage_idx" ON "Ticket"("stage");

-- CreateIndex
CREATE INDEX "Ticket_updatedAt_idx" ON "Ticket"("updatedAt");
```

## Data Integrity Constraints

### Database-Level Constraints
- `id` PRIMARY KEY ensures uniqueness
- `title` NOT NULL ensures every ticket has a title
- `stage` ENUM constraint ensures only valid stages
- `stage` DEFAULT 'IDLE' ensures new tickets start in correct state
- `createdAt` DEFAULT now() auto-sets creation time
- `updatedAt` auto-updates on any modification

### Application-Level Validation
- Zod schemas validate input before database operations
- Title length: 1-500 characters
- Description length: 0-5000 characters (optional)
- Stage transitions: Not enforced in MVP (future enhancement)

### Prisma Client Validation
- TypeScript types prevent invalid stage values at compile time
- Required fields enforced by Prisma client
- Automatic timestamps prevent manual manipulation

## Performance Considerations

### Query Optimization
- Index on `stage` column enables fast filtering (O(log n))
- Index on `updatedAt` enables fast sorting (O(log n))
- Single query fetches all tickets (no N+1 problem)
- In-memory grouping by stage (negligible overhead for 100 tickets)

### Scale Projections
- **100 tickets**: ~10KB data, <10ms query time
- **1,000 tickets**: ~100KB data, <50ms query time
- **10,000 tickets**: ~1MB data, <200ms query time (within constraint)

**Note**: Pagination not needed for MVP (100 tickets max). Future enhancement if scale increases.

### Connection Pooling
```typescript
// lib/db.ts - Singleton pattern for Prisma Client

import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
```

## Testing Data

### Seed Script (Optional, for Development)

```typescript
// prisma/seed.ts

import { PrismaClient, Stage } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.ticket.deleteMany();

  // Create sample tickets
  const stages: Stage[] = ['IDLE', 'PLAN', 'BUILD', 'REVIEW', 'SHIPPED', 'ERRORED'];

  for (const stage of stages) {
    await prisma.ticket.create({
      data: {
        title: `Sample ticket in ${stage}`,
        description: `This is a test ticket in the ${stage} stage.`,
        stage,
      },
    });
  }

  console.log('Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Add to `package.json`:
```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

## Phase 1 Completion Checklist

- [x] Entity definitions documented (Ticket, Stage)
- [x] Prisma schema defined with constraints and indexes
- [x] TypeScript type definitions created
- [x] Validation rules specified (Zod schemas)
- [x] Data access patterns documented
- [x] Migration strategy defined
- [x] Database constraints documented
- [x] Performance considerations analyzed
- [x] Testing/seed data approach defined

**Status**: ✅ Data Model Complete - Ready for API Contract definition