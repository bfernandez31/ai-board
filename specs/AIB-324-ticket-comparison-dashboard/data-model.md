# Data Model: Ticket Comparison Dashboard (AIB-324)

**Date**: 2026-03-20

## New Entities

### Comparison

Represents a single comparison event where multiple tickets were analyzed against each other.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Int | PK, auto-increment | Unique identifier |
| projectId | Int | FK → Project.id, NOT NULL | Project scope |
| sourceTicketId | Int | FK → Ticket.id, NOT NULL | Ticket that initiated the comparison |
| recommendation | String | NOT NULL | Final recommendation text |
| notes | String? | nullable | Additional notes/context |
| createdAt | DateTime | default: now() | When comparison was created |
| updatedAt | DateTime | @updatedAt | Last update timestamp |

**Relations**:
- `project` → Project (many-to-one)
- `sourceTicket` → Ticket (many-to-one)
- `entries` → ComparisonEntry[] (one-to-many)
- `decisionPoints` → ComparisonDecisionPoint[] (one-to-many)

**Indexes**:
- `@@index([projectId])` — project-scoped queries
- `@@index([sourceTicketId])` — source ticket lookups

---

### ComparisonEntry

Represents one ticket's data within a comparison. This is the bidirectional join table enabling "find all comparisons for ticket X".

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Int | PK, auto-increment | Unique identifier |
| comparisonId | Int | FK → Comparison.id, NOT NULL | Parent comparison |
| ticketId | Int | FK → Ticket.id, NOT NULL | Participating ticket |
| rank | Int | NOT NULL | Position in ranking (1 = best) |
| score | Float | NOT NULL | Overall score (0-100) |
| isWinner | Boolean | default: false | Whether this entry won |
| keyDifferentiators | String | NOT NULL | Key strengths/differentiators text |
| linesAdded | Int | NOT NULL | Lines of code added |
| linesRemoved | Int | NOT NULL | Lines of code removed |
| sourceFileCount | Int | NOT NULL | Number of source files changed |
| testFileCount | Int | NOT NULL | Number of test files changed |
| testRatio | Float | NOT NULL | Test file ratio (0.0-1.0) |
| complianceData | String | NOT NULL | JSON string: `{ principles: [{ name, passed, notes }] }` |
| createdAt | DateTime | default: now() | When entry was created |

**Relations**:
- `comparison` → Comparison (many-to-one, onDelete: Cascade)
- `ticket` → Ticket (many-to-one)

**Indexes**:
- `@@index([comparisonId])` — entries for a comparison
- `@@index([ticketId])` — comparisons for a ticket (bidirectional lookup)
- `@@unique([comparisonId, ticketId])` — a ticket appears once per comparison

---

### ComparisonDecisionPoint

Represents one implementation choice analyzed across tickets in a comparison.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Int | PK, auto-increment | Unique identifier |
| comparisonId | Int | FK → Comparison.id, NOT NULL | Parent comparison |
| topic | String | NOT NULL | Decision topic (e.g., "Error handling approach") |
| verdict | String | NOT NULL | Overall verdict/assessment |
| approaches | String | NOT NULL | JSON string: `{ ticketKey: { approach, assessment } }` |
| createdAt | DateTime | default: now() | When entry was created |

**Relations**:
- `comparison` → Comparison (many-to-one, onDelete: Cascade)

**Indexes**:
- `@@index([comparisonId])` — decision points for a comparison

---

## Prisma Schema Additions

```prisma
model Comparison {
  id              Int       @id @default(autoincrement())
  projectId       Int
  sourceTicketId  Int
  recommendation  String
  notes           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  project         Project   @relation(fields: [projectId], references: [id])
  sourceTicket    Ticket    @relation("ComparisonSource", fields: [sourceTicketId], references: [id])
  entries         ComparisonEntry[]
  decisionPoints  ComparisonDecisionPoint[]

  @@index([projectId])
  @@index([sourceTicketId])
}

model ComparisonEntry {
  id                  Int       @id @default(autoincrement())
  comparisonId        Int
  ticketId            Int
  rank                Int
  score               Float
  isWinner            Boolean   @default(false)
  keyDifferentiators  String
  linesAdded          Int
  linesRemoved        Int
  sourceFileCount     Int
  testFileCount       Int
  testRatio           Float
  complianceData      String
  createdAt           DateTime  @default(now())

  comparison          Comparison @relation(fields: [comparisonId], references: [id], onDelete: Cascade)
  ticket              Ticket     @relation(fields: [ticketId], references: [id])

  @@unique([comparisonId, ticketId])
  @@index([comparisonId])
  @@index([ticketId])
}

model ComparisonDecisionPoint {
  id            Int       @id @default(autoincrement())
  comparisonId  Int
  topic         String
  verdict       String
  approaches    String
  createdAt     DateTime  @default(now())

  comparison    Comparison @relation(fields: [comparisonId], references: [id], onDelete: Cascade)

  @@index([comparisonId])
}
```

## Existing Model Modifications

### Ticket

Add reverse relations:

```prisma
// Add to existing Ticket model
comparisonsAsSource  Comparison[]       @relation("ComparisonSource")
comparisonEntries    ComparisonEntry[]
```

### Project

Add reverse relation:

```prisma
// Add to existing Project model
comparisons  Comparison[]
```

## State Transitions

### Comparison Lifecycle

```
Created (via POST API after /compare command)
  → Immutable (comparisons are point-in-time snapshots, never updated)
  → Readable (via GET API from any participating ticket)
```

No update or delete operations. Comparisons are historical records.

## Validation Rules

- `score`: 0.0 to 100.0
- `rank`: 1 to N (where N = number of entries)
- `testRatio`: 0.0 to 1.0
- `complianceData`: Valid JSON matching `{ principles: [{ name: string, passed: boolean, notes?: string }] }`
- `approaches`: Valid JSON matching `{ [ticketKey: string]: { approach: string, assessment: string } }`
- Exactly one entry per comparison must have `isWinner: true`
- `sourceTicketId` must reference a ticket in the same project
- All `ticketId` values in entries must reference tickets in the same project
