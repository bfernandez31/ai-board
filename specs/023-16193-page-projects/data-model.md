# Data Model: Projects List Page

**Feature**: Projects List Page
**Date**: 2025-10-11

## Entity Overview

This feature uses the existing `Project` entity with no schema modifications required. The ticket count is computed via Prisma aggregation at query time.

## Existing Database Schema

### Project Entity (Existing)

**Table**: `Project`
**Source**: `/prisma/schema.prisma`

```prisma
model Project {
  id          Int      @id @default(autoincrement())
  name        String   @db.VarChar(100)
  description String   @db.VarChar(1000)
  githubOwner String   @db.VarChar(100)
  githubRepo  String   @db.VarChar(100)
  tickets     Ticket[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([githubOwner, githubRepo])
  @@index([githubOwner, githubRepo])
}
```

**Fields Used in This Feature**:
- `id` (Int): Primary key, used for navigation URL (`/projects/{id}/board`)
- `name` (String): Display in card title
- `description` (String): Display in card description
- `updatedAt` (DateTime): Display as "Last updated" timestamp
- `tickets` (Ticket[]): Relation for counting tickets (via `_count`)

**Fields Not Used**:
- `githubOwner`: GitHub integration, not displayed in list
- `githubRepo`: GitHub integration, not displayed in list
- `createdAt`: Not required by spec (using `updatedAt` instead)

## Computed Fields

### ticketCount (Computed)

**Type**: `number`
**Source**: Prisma `_count` aggregation on `tickets` relation
**Computation**: Database-level COUNT query via Prisma

**Prisma Query**:
```typescript
const projects = await prisma.project.findMany({
  include: {
    _count: {
      select: { tickets: true }
    }
  },
  orderBy: { updatedAt: 'desc' }
});

// Access: projects[0]._count.tickets
```

**API Response Transformation**:
```typescript
// Transform Prisma result to API response
{
  id: project.id,
  name: project.name,
  description: project.description,
  updatedAt: project.updatedAt.toISOString(),
  ticketCount: project._count.tickets
}
```

## TypeScript Interfaces

### API Response Type

**Location**: `/app/api/projects/route.ts`

```typescript
// Response shape for GET /api/projects
interface ProjectWithCount {
  id: number;
  name: string;
  description: string;
  updatedAt: string; // ISO 8601 timestamp
  ticketCount: number;
}

// API returns: ProjectWithCount[]
```

### Component Props Type

**Location**: `/components/projects/project-card.tsx`

```typescript
// Props for ProjectCard component
interface ProjectCardProps {
  project: {
    id: number;
    name: string;
    description: string;
    updatedAt: string;
    ticketCount: number;
  };
}
```

## Data Flow

```
┌─────────────────┐
│  PostgreSQL DB  │
│   Project table │
│   Ticket table  │
└────────┬────────┘
         │
         │ Prisma query with _count
         │
         ▼
┌─────────────────────────────────┐
│  API Route                      │
│  GET /api/projects              │
│  - Fetch projects with _count   │
│  - Transform to JSON response   │
│  - Return ProjectWithCount[]    │
└────────┬────────────────────────┘
         │
         │ HTTP fetch
         │
         ▼
┌─────────────────────────────────┐
│  Server Component               │
│  /app/projects/page.tsx         │
│  - Fetch data from API          │
│  - Pass to client components    │
└────────┬────────────────────────┘
         │
         │ Props
         │
         ▼
┌─────────────────────────────────┐
│  Client Component               │
│  ProjectCard                    │
│  - Display project data         │
│  - Handle interactions          │
└─────────────────────────────────┘
```

## Validation Rules

### API Response Validation

**Location**: `/app/api/projects/route.ts`

```typescript
// Zod schema for API response validation
import { z } from 'zod';

const ProjectWithCountSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  updatedAt: z.string().datetime(), // ISO 8601
  ticketCount: z.number().int().min(0)
});

const ProjectsResponseSchema = z.array(ProjectWithCountSchema);
```

**Validation Enforcement**:
- TypeScript compiler enforces types at compile time
- Prisma ensures database-level constraints
- No runtime validation needed (read-only operation, trusted DB source)

## Performance Considerations

### Query Optimization

**Current Approach**:
```typescript
// Single query with aggregation
await prisma.project.findMany({
  include: { _count: { select: { tickets: true } } },
  orderBy: { updatedAt: 'desc' }
});
```

**Performance Characteristics**:
- Single database round-trip
- COUNT aggregation performed at database level
- Results ordered by `updatedAt` (uses existing index)
- No N+1 query problem

**Expected Performance**:
- <50ms for 100 projects (indexed query + aggregation)
- <200ms for 1000 projects
- Linear scaling with project count

### Caching Strategy

**Current**: No caching (fresh data on every request)
**Rationale**:
- Projects list doesn't change frequently
- `cache: 'no-store'` in Server Component fetch ensures fresh data
- Future optimization: Add `revalidate: 60` for 1-minute cache

## Schema Migrations

**Required**: None

This feature requires no database schema changes. The existing `Project` model contains all necessary fields.

**Why No Migrations**:
- `ticketCount` is computed at query time (not stored)
- All display fields already exist in schema
- Indexes already optimized for this query pattern

## Data Integrity

### Referential Integrity

**Existing Constraints** (already enforced):
- `tickets` relation uses `onDelete: Cascade`
- Ticket count automatically reflects deletions
- Foreign key constraints prevent orphaned records

**This Feature's Impact**: None (read-only operation)

### Data Consistency

**Consistency Guarantees**:
- `_count` aggregation is transactionally consistent
- Prisma query sees consistent snapshot of data
- No race conditions (read-only)

## Future Considerations

### Potential Optimizations (Not Implemented)

1. **Materialized ticket count**: Store count in `Project` table
   - **When**: If projects list becomes performance bottleneck
   - **Trade-off**: Write complexity vs. read performance

2. **GraphQL endpoint**: Replace REST with GraphQL
   - **When**: If frontend needs flexible queries
   - **Trade-off**: Added complexity vs. flexibility

3. **Caching layer**: Redis cache for projects list
   - **When**: If database queries exceed 200ms
   - **Trade-off**: Cache invalidation complexity

**Current Status**: None of these optimizations are needed for MVP. Follow YAGNI principle.

---

**Summary**: Existing `Project` schema is sufficient. No migrations required. Ticket count computed via Prisma aggregation. TypeScript types ensure compile-time safety. Performance adequate for expected scale.
