# Phase 1 Data Model: Capture Ticket Outcomes at SHIP

**Feature**: AIB-742
**Branch**: `AIB-742-capture-ticket-outcomes`
**Date**: 2026-04-26

## Overview

Two new Prisma models (`TicketOutcome`, `BackfillProgress`) plus an in-code lookup (`STACK_INDICATORS` constant in `lib/outcomes/stack-indicator-lookup.ts`). No edits to existing models. All schema changes ship in a single Prisma migration generated via `bunx prisma migrate dev --name ticket_outcomes`.

## Entity 1: TicketOutcome

**Purpose**: One immutable row per shipped ticket — the canonical, append-only record of how that ticket was delivered.

**Cardinality**: 1:1 with Ticket (enforced via `@@unique([ticketId])`). 0:1 with Project for query convenience.

### Prisma model

```prisma
model TicketOutcome {
  id                  Int      @id @default(autoincrement())

  // Identity & lookup
  ticketId            Int      @unique
  projectId           Int      // Denormalised — Ticket already belongs to a Project, but querying outcomes by project is the dominant access pattern (analytics).
  workflowType        WorkflowType  // FULL | QUICK | CLEAN — denormalised snapshot at SHIP time
  shippedAt           DateTime  // The moment SHIP transition committed (passed in from caller; NOT defaulted to now())
  capturedAt          DateTime @default(now())  // The moment this row was written
  ruleSetVersion      Int      // Pinned classification/threshold/lookup version used for this row

  // Job-aggregate telemetry (sums across ALL jobs of the ticket regardless of stage/command)
  totalCostUsd        Float?   // null only if every job had null costUsd
  totalDurationMs     Int?
  totalInputTokens    Int?
  totalOutputTokens   Int?
  totalThinkingTokens Int?
  totalCacheReadTokens     Int?
  totalCacheCreationTokens Int?
  toolsUsed           String[]  @default([])  // Union across all jobs

  // Job-count classification
  pipelineJobCount    Int      @default(0)
  frictionJobCount    Int      @default(0)
  totalJobCount       Int      @default(0)
  // Per-prefix breakdown for downstream analysis (JSON map: { iterate: 2, "comment-build": 1, ... })
  jobCountByPrefix    Json     @default("{}")

  // Quality
  qualityScore        Int?   // Last COMPLETED verify-job qualityScore; null for QUICK / no-verify tickets

  // Change-shape (null when partial=true and shape unavailable)
  filesTouched        String[]  @default([])
  linesAdded          Int?
  linesRemoved        Int?
  // ratio = linesInTestPaths / max(linesAdded + linesRemoved, 1) — see lib/outcomes/derivation.ts
  testCodeRatio       Float?

  // Structural domains
  // domains: unique top-level path segments (e.g., ["app", "lib", "tests"])
  domains             String[]  @default([])
  // domainFileCounts: frequency map { app: 5, lib: 2, tests: 3 } — JSON for compactness
  domainFileCounts    Json     @default("{}")

  // Semantic tags
  touchedDbSchema     Boolean  @default(false)
  touchedTests        Boolean  @default(false)
  touchedCi           Boolean  @default(false)

  // Derived booleans
  frictionFree        Boolean  @default(false)

  // Partial-state flags
  partial             Boolean  @default(false)
  partialReason       String?  @db.VarChar(40)  // Enum-like; see PartialReason union below

  // Relations
  ticket              Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  project             Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, shippedAt(sort: Desc)])    // analytics: list outcomes by project, newest first
  @@index([projectId, frictionFree])             // analytics: fraction frictionFree per project
  @@index([projectId, partial])                  // analytics: filter partial rows out
  @@index([shippedAt])                           // cross-project time queries
}
```

### Companion changes to existing models

```prisma
model Ticket {
  // ... unchanged fields ...
  outcome             TicketOutcome?
}

model Project {
  // ... unchanged fields ...
  outcomes            TicketOutcome[]
  backfillProgress    BackfillProgress?
}
```

These are relation back-pointers only — no schema-level field additions.

### Validation rules (enforced in `lib/outcomes/persist.ts` via Zod before `prisma.create`)

| Field | Rule | Source |
|---|---|---|
| `ticketId` | Must reference an existing Ticket whose `stage = SHIP` at the moment of write | FR-012, FR-001 |
| `projectId` | Must equal `ticket.projectId` (denormalisation invariant) | FR-018 |
| `workflowType` | Must equal `ticket.workflowType` at SHIP time | FR-011 |
| `ruleSetVersion` | Must equal `RULE_SET_VERSION` exported by `lib/outcomes/classification.ts` | FR-020 |
| `pipelineJobCount + frictionJobCount === totalJobCount` | Must hold; aggregation invariant | FR-005 |
| `frictionFree === true` ⇒ `frictionJobCount === 0 AND qualityScore !== null AND qualityScore >= 75` | Single boolean; computed once | FR-006 |
| `partial === true` ⇒ `linesAdded === null AND linesRemoved === null AND domains.length === 0 AND filesTouched.length === 0 AND touchedDbSchema === false AND touchedTests === false AND touchedCi === false` | "partial means no change-shape" | FR-010 |
| `partial === true` ⇒ `partialReason !== null` | Reason code required when partial | FR-010 |
| `partialReason` ∈ `{ no_jobs, no_commit_reference, repository_unreachable, fetch_failed_after_retry }` | Closed enum (see TS union below) | Spec edge cases |

### State / lifecycle

There are **no state transitions** on this entity. The row is created once, never updated, never deleted (except by cascade if the parent Ticket is hard-deleted, which is not part of any normal flow). The single transition is `(does not exist) → exists`. Constitution §V "soft deletes preserve audit trails" does not apply — outcomes are append-only by design and have no deletion semantic.

### TypeScript types (`lib/outcomes/types.ts`)

```ts
export const RULE_SET_VERSION = 1 as const;
export const QUALITY_THRESHOLD_FRICTION_FREE = 75 as const;

export type PartialReason =
  | 'no_jobs'
  | 'no_commit_reference'
  | 'repository_unreachable'
  | 'fetch_failed_after_retry';

export interface DerivedOutcome {
  ticketId: number;
  projectId: number;
  workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  shippedAt: Date;
  ruleSetVersion: typeof RULE_SET_VERSION;

  // ... fields exactly mirroring Prisma model above (camelCased) ...

  partial: boolean;
  partialReason: PartialReason | null;
}
```

## Entity 2: BackfillProgress

**Purpose**: Per-project resume cursor for the backfill workflow. Lets a workflow that was interrupted (timeout, runner failure) pick up where it left off when re-dispatched.

**Cardinality**: 0:1 with Project. A row exists only after the first backfill is started for that project.

### Prisma model

```prisma
model BackfillProgress {
  id                    Int      @id @default(autoincrement())
  projectId             Int      @unique
  status                BackfillStatus @default(IN_PROGRESS)
  // Cursor: the most recently processed ticketId within this project. The next iteration
  // resumes by selecting tickets with id < lastProcessedTicketId (newest-first order per Spec Assumption).
  lastProcessedTicketId Int?
  ticketsProcessed      Int      @default(0)
  ticketsWithPartial    Int      @default(0)
  startedAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  completedAt           DateTime?
  // Optimistic locking — guards against two concurrent workflow_dispatch invocations
  version               Int      @default(1)
  // Last error message for operator visibility; cleared on successful resume
  lastError             String?  @db.VarChar(2000)

  project               Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([status])
}

enum BackfillStatus {
  IN_PROGRESS
  COMPLETED
  FAILED
}
```

### Validation rules

| Field | Rule | Source |
|---|---|---|
| `projectId` | Unique — only one progress row per project | FR-013 |
| `status === COMPLETED` ⇒ `completedAt !== null AND lastError === null` | Terminal-state invariant | FR-013 |
| `lastProcessedTicketId` | Either null (no tickets processed yet) or a valid `Ticket.id` belonging to `projectId` | FR-015 |
| `version` | Incremented on every update; updates use `where: { projectId, version }` filter | FR-014, FR-017 |

### State / lifecycle

```
(no row) ──[backfill dispatched first time]──▶ IN_PROGRESS
   IN_PROGRESS ──[every successful row write]──▶ IN_PROGRESS (cursor advances, version increments)
   IN_PROGRESS ──[no remaining tickets]──▶ COMPLETED
   IN_PROGRESS ──[unhandled error after retries]──▶ FAILED (operator can re-dispatch to retry)
   COMPLETED  ──[backfill re-dispatched]──▶ IN_PROGRESS (idempotent — finds zero remaining tickets, returns to COMPLETED with ticketsProcessed unchanged)
   FAILED     ──[backfill re-dispatched]──▶ IN_PROGRESS (resume from cursor)
```

Re-dispatch on a `COMPLETED` row is a no-op in steady state but must never error — this is the SC-005 idempotency guarantee.

## Entity 3 (in-code, not DB): STACK_INDICATORS

**Purpose**: System-owned mapping from a project's declared `services` / `testing.framework` / `language` to the file-pattern indicators used for `touched_db_schema` / `touched_tests` / `touched_ci` semantic tags.

**Storage**: TypeScript const exported from `lib/outcomes/stack-indicator-lookup.ts`. Versioned alongside `RULE_SET_VERSION` (any change to the constant requires bumping the version per FR-020).

### Shape

```ts
export const STACK_INDICATORS = {
  services: {
    postgres: { db_schema: ['prisma/schema.prisma', 'migrations/**', '*.sql', 'db/migrate/**'] },
    mysql:    { db_schema: ['migrations/**', '*.sql', 'db/migrate/**'] },
    sqlite:   { db_schema: ['migrations/**', '*.sql'] },
    mongodb:  { db_schema: ['migrations/**', 'models/**.ts', 'schemas/**'] },
    // ...future entries...
  },
  testing: {
    vitest:   { tests: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', 'tests/**', '__tests__/**'] },
    jest:     { tests: ['**/*.test.[jt]s', '**/*.spec.[jt]s', 'tests/**', '__tests__/**'] },
    playwright: { tests: ['**/*.e2e.ts', 'tests/e2e/**'] },
    pytest:   { tests: ['tests/**', '**/test_*.py', '**/*_test.py'] },
    'go-test':{ tests: ['**/*_test.go'] },
    'rust-test': { tests: ['**/tests/**', '**/*_test.rs'] },
    'zig-test':{ tests: ['**/test_*.zig', '**/*.test.zig'] },
  },
  languages: {
    typescript: { tests: ['**/*.test.ts', '**/*.spec.ts'], db_schema: [] },
    javascript: { tests: ['**/*.test.js', '**/*.spec.js'], db_schema: [] },
    python:     { tests: ['tests/**', '**/test_*.py'], db_schema: ['migrations/**', '*.sql'] },
    go:         { tests: ['**/*_test.go'], db_schema: ['migrations/**', '*.sql'] },
    rust:       { tests: ['**/tests/**', '**/*_test.rs'], db_schema: ['migrations/**', '*.sql'] },
    zig:        { tests: ['**/test_*.zig', '**/*.test.zig'], db_schema: [] },
  },
  ci: {
    generic: ['.github/workflows/**', '.gitlab-ci.yml', '.gitlab-ci.yaml', '.circleci/**', 'azure-pipelines.yml', '.travis.yml', 'Jenkinsfile', '.buildkite/**'],
  },
} as const;
```

### Lookup algorithm (pseudocode)

```ts
function deriveSemanticTags(files: string[], projectConfig: ProjectConfig): Tags {
  const services = projectConfig.services ?? [];
  const testFramework = projectConfig.testing?.framework;
  const language = projectConfig.project?.language;

  const dbPatterns: string[] = [
    ...services.flatMap(s => STACK_INDICATORS.services[s.type]?.db_schema ?? []),
    ...(language ? STACK_INDICATORS.languages[language]?.db_schema ?? [] : []),
  ];
  const testPatterns: string[] = [
    ...(testFramework ? STACK_INDICATORS.testing[testFramework]?.tests ?? [] : []),
    ...(language ? STACK_INDICATORS.languages[language]?.tests ?? [] : []),
  ];
  const ciPatterns = STACK_INDICATORS.ci.generic;

  return {
    touchedDbSchema: files.some(f => matchesAny(f, dbPatterns)),
    touchedTests:    files.some(f => matchesAny(f, testPatterns)),
    touchedCi:       files.some(f => matchesAny(f, ciPatterns)),
  };
}
```

Per FR-009 ("Missing coverage for a stack MUST yield `false` tags, never errors"), every lookup that misses falls through to `[]` and produces `false` — never throws.

## Migration plan

Single Prisma migration: `prisma/migrations/<timestamp>_ticket_outcomes/migration.sql`. Generated by:

```bash
bunx prisma migrate dev --name ticket_outcomes
```

Includes:
1. `CREATE TABLE TicketOutcome` with columns above + unique on `ticketId` + 4 indexes.
2. `CREATE TABLE BackfillProgress` with unique on `projectId` + 1 index.
3. `CREATE TYPE BackfillStatus AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED')`.
4. No data migration — both tables start empty. The backfill workflow populates `TicketOutcome` historically; `BackfillProgress` is created on first dispatch.

No risk of breaking existing flows since both tables are net-new. Rollback is `DROP TABLE`-safe (no production data depends on these tables until the feature is wired in).

## Cross-references

- Prisma schema reference: `prisma/schema.prisma` (Job, Ticket, Project models — read for inherited types and conventions; lines 29–201).
- Idempotency pattern: `prisma/schema.prisma:411-418` (`StripeEvent.id @id` enforces single-row-per-event).
- Optimistic locking pattern: `prisma/schema.prisma:167` (`Ticket.version Int @default(1)`); applied identically to `BackfillProgress.version`.
- Denormalisation pattern: `prisma/schema.prisma:443-465` (`ComparisonRecord` denormalises `projectId` despite reachable via tickets — same justification as `TicketOutcome.projectId`).
