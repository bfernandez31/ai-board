# Data Model: Ticket Search

**Feature**: AIB-114 - Recherche de ticket
**Date**: 2025-12-19

## Overview

This feature uses **existing data models** with no schema changes required. The search functionality queries the existing `Ticket` model with specific field selections for optimal performance.

---

## Entities

### 1. Ticket (Existing - No Changes)

**Location**: `prisma/schema.prisma`

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
  // ... relations omitted

  @@index([projectId])        // Used for filtering
  @@index([ticketKey])        // Used for key lookups
  @@index([updatedAt])        // Used for sorting
}
```

**Search-Relevant Fields**:
| Field | Type | Search Role |
|-------|------|-------------|
| `ticketKey` | String (max 20) | Primary search - exact/partial match (e.g., "AIB-123") |
| `title` | String (max 100) | Secondary search - keyword match |
| `description` | String (max 2500) | Tertiary search - content match |
| `projectId` | Int | Filter - scope to current project |

---

### 2. SearchResult (New TypeScript Interface)

**Purpose**: Represents a single search result for display in the dropdown.

**Location**: `/app/lib/types/search.ts` (new file)

```typescript
/**
 * Represents a ticket search result for display in the dropdown.
 * Minimal data needed for rendering the result item.
 */
export interface SearchResult {
  /** Unique ticket identifier */
  id: number;
  /** Formatted ticket key (e.g., "AIB-123") */
  ticketKey: string;
  /** Ticket title for display */
  title: string;
  /** Current stage for visual indicator (optional) */
  stage: Stage;
}

/**
 * Search API response structure
 */
export interface SearchResponse {
  /** Array of matching tickets */
  results: SearchResult[];
  /** Total count of matches (may exceed displayed results) */
  totalCount: number;
}

/**
 * Search query parameters
 */
export interface SearchParams {
  /** Search query string (minimum 2 characters) */
  query: string;
  /** Maximum results to return (default: 10) */
  limit?: number;
}
```

---

### 3. Stage (Existing Enum - No Changes)

**Location**: `prisma/schema.prisma`

```prisma
enum Stage {
  INBOX
  SPECIFY
  PLAN
  BUILD
  VERIFY
  SHIP
}
```

**Usage in Search**: Optional stage indicator in results for visual context.

---

## Relationships

```
Project (1) ──────────< Ticket (N)
   │                      │
   │ projectId            │ searchable fields:
   │                      │ - ticketKey
   └──────────────────────┴ - title
                            - description
```

**Search Scope**: Always filtered by `projectId` to ensure users only see tickets from the current project.

---

## Validation Rules

### Search Query Validation

| Rule | Value | Rationale |
|------|-------|-----------|
| Minimum length | 2 characters | Avoid matching all tickets |
| Maximum length | 100 characters | Prevent abuse |
| Sanitization | Trim whitespace | Clean input |
| Special characters | Allowed (searched literally) | Support searching for symbols |

### Response Validation

| Rule | Value | Rationale |
|------|-------|-----------|
| Maximum results | 10 | Keep dropdown manageable |
| Required fields | id, ticketKey, title | Minimum for display |
| Null handling | description can be null | Graceful degradation |

---

## State Transitions

This feature does not modify ticket state. It's a **read-only** operation.

### Component State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                        SEARCH STATES                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  IDLE ──(user types)──> TYPING ──(debounce)──> SEARCHING   │
│    ↑                       │                       │        │
│    │                       │                       ↓        │
│    │                       │                    RESULTS     │
│    │                       │                    ├─ empty    │
│    │                       │                    ├─ found    │
│    │                       │                    └─ error    │
│    │                       │                       │        │
│    │                       │                       │        │
│    └──(clear/escape)───────┴──(select/escape)──────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

State Descriptions:
- IDLE: Input empty or less than 2 characters
- TYPING: User entering text, debounce timer active
- SEARCHING: API request in flight
- RESULTS: Results displayed (empty, found, or error)
```

---

## Database Queries

### Primary Search Query

```typescript
// Prisma query for ticket search
const results = await prisma.ticket.findMany({
  where: {
    projectId: projectId,
    OR: [
      { ticketKey: { contains: query, mode: 'insensitive' } },
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
    ],
  },
  select: {
    id: true,
    ticketKey: true,
    title: true,
    stage: true,
  },
  take: 10,
  orderBy: { updatedAt: 'desc' },
});
```

### Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Full table scan | `projectId` filter uses index |
| Large descriptions | `contains` on VARCHAR(2500) may be slow |
| Result limit | Hard limit of 10 results |
| Debouncing | 300ms debounce reduces query frequency |

### Index Usage

| Index | Query Usage |
|-------|-------------|
| `@@index([projectId])` | WHERE projectId = ? |
| `@@index([ticketKey])` | Not optimal for LIKE queries |
| `@@index([updatedAt])` | ORDER BY updatedAt DESC |

**Note**: For high-volume search, consider adding PostgreSQL trigram index:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_ticket_title_trgm ON "Ticket" USING gin (title gin_trgm_ops);
```

---

## Type Definitions Summary

### New Types to Create

| Type | Location | Purpose |
|------|----------|---------|
| `SearchResult` | `/app/lib/types/search.ts` | Search result item |
| `SearchResponse` | `/app/lib/types/search.ts` | API response wrapper |
| `SearchParams` | `/app/lib/types/search.ts` | Query parameters |

### Existing Types Used

| Type | Location | Purpose |
|------|----------|---------|
| `Stage` | Prisma generated | Stage enum |
| `Ticket` | Prisma generated | Full ticket model |
