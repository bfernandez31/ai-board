# Phase 1 Data Model: Insights — Analyze Every Agent Session

**Feature**: AIB-852 | **Date**: 2026-06-07 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Source of truth for schema is `prisma/schema.prisma`. This document specifies the
**delta** introduced by AIB-852.

---

## New entity: `InsightsSessionCoverage`

Per-session "already analyzed" marker. Source of truth for selection (replaces the global
`InsightsReport.periodEnd` cursor for the *covered?* decision — D1, FR-004, FR-006).

```prisma
/// AIB-852: per-session coverage marker. One row per Claude agent session (Job)
/// that has been included in a COMPLETED Insights run. `jobId @unique` enforces
/// "analyzed at most once" (FR-006) at the DB layer; rows are written only inside
/// the RUNNING→COMPLETED transaction (FR-007 — a FAILED run writes nothing).
model InsightsSessionCoverage {
  id        Int            @id @default(autoincrement())
  jobId     Int            @unique
  job       Job            @relation(fields: [jobId], references: [id], onDelete: Cascade)
  reportId  Int
  report    InsightsReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  coveredAt DateTime       @default(now())

  @@index([reportId])
}
```

| Field | Type | Notes |
|-------|------|-------|
| `jobId` | `Int @unique` | The covered session (Job). Unique → at-most-once (FR-006). |
| `reportId` | `Int` | The COMPLETED report that covered it (attribution; FR-013). |
| `coveredAt` | `DateTime` | When coverage was recorded (= completion-transaction time). |

**Relations added**:
- `Job` gains `insightsCoverage InsightsSessionCoverage?` (back-relation).
- `InsightsReport` gains `coveredSessions InsightsSessionCoverage[]`.

**Cascade**: `onDelete: Cascade` on both FKs. If a Job is pruned/deleted its coverage row
goes too (the session is no longer selectable anyway); if a report is deleted its coverage
rows go too (only relevant in test cleanup — production never deletes COMPLETED reports).

**Validation rules**:
- A coverage row is created **only** for a job that was actually analyzed in a COMPLETED
  run (its raw transcript was fetched). Never for expected-but-unavailable sessions.
- Insertion uses `createMany({ skipDuplicates: true })` so re-delivered COMPLETED callbacks
  and explicit re-analysis are idempotent (FR-006 exception, P-1).

---

## Modified entity: `InsightsReport`

Add expected/gap accounting (FR-011, FR-012). `sessionsCount` is **redefined** as the
*analyzed* session count (already a column; previously equal to enumerated count).

```prisma
model InsightsReport {
  // ... existing fields unchanged (id, status, generatedAt, periodStart,
  //     periodEnd, sessionsCount, ticketsCount, artifactKey, artifactSize,
  //     errorReason, jobId, completedAt, createdAt, updatedAt) ...

  // AIB-852 additions:
  expectedSessionsCount Int?                       // FR-011: in-scope sessions for the period (incl. no-transcript)
  coverageGapReason     InsightsCoverageGapReason? // FR-012: set when analyzed < expected

  coveredSessions InsightsSessionCoverage[]        // back-relation
}

/// AIB-852: why analyzed < expected. Extensible enum.
enum InsightsCoverageGapReason {
  TRANSCRIPT_NOT_AVAILABLE  // raw transcript not yet uploaded / pruned
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `sessionsCount` | `Int?` | **Analyzed** sessions (transcript fetched). FR-001/FR-011. |
| `expectedSessionsCount` | `Int?` | In-scope sessions for the period incl. those lacking a transcript. FR-011. |
| `coverageGapReason` | enum? | Non-null ⇔ `sessionsCount < expectedSessionsCount`. FR-012. |
| `ticketsCount` | `Int?` | Distinct tickets among **analyzed** sessions (attribution; unchanged column). |

**Invariants**:
- `sessionsCount <= expectedSessionsCount` for COMPLETED rows.
- `coverageGapReason != null` ⇔ `expectedSessionsCount > sessionsCount` (set by the
  status handler when it computes the gap).
- FAILED rows leave all counts null (no coverage advanced).

---

## Selection model (logical — no new storage)

The "current selection" is computed, not stored. Definitions (all join
`Job → Ticket → Project`, **no** project filter — FR-003):

- **completion(job)** = `job.completedAt ?? job.updatedAt ?? job.startedAt` (D3).
- **isClaude(job)** = `(ticket.agent ?? project.defaultAgent ?? 'CLAUDE') === 'CLAUDE'` (P2, FR-009).
- **terminal(job)** = `status ∈ {COMPLETED, FAILED, CANCELLED}`.
- **hasLog(job)** = a `JobLog` row exists (capture attempted).
- **covered(job)** = an `InsightsSessionCoverage` row exists for `job.id`.
- **analyzable(job)** = `JobLog.captureStatus = 'CAPTURED'` AND `JobLog.rawArtifactKey != null`.

| Set | Predicate |
|-----|-----------|
| **Expected** | `isClaude ∧ terminal ∧ hasLog ∧ ¬covered ∧ ticketId ≠ null ∧ completion < periodEnd` |
| **Analyzable / Analyzed** | Expected `∧ analyzable` |
| **Gap** | Expected `∧ ¬analyzable` → reason `TRANSCRIPT_NOT_AVAILABLE` |

Retry / explicit re-analysis (D8): drop `¬covered`; bound by `completion ∈ [periodStart, periodEnd)`.

---

## State transitions

### Run lifecycle (`InsightsReport.status`) — unchanged shape, new side effect
```
            trigger (insert)
                 │
                 ▼
            ┌─────────┐  PATCH status=COMPLETED      ┌───────────┐
            │ RUNNING │ ───────────────────────────► │ COMPLETED │  + write coverage rows (in-txn)
            └─────────┘   (atomic, WHERE status=     └───────────┘
                 │         'RUNNING'; P3)
                 │ PATCH status=FAILED  /  reconcile timeout
                 ▼
            ┌─────────┐
            │ FAILED  │  ← NO coverage written (FR-007); sessions stay eligible
            └─────────┘
```
- Terminal → terminal callbacks are idempotent no-ops (`count===0`, P3, SC-012).
- Coverage write is part of the same `$transaction` as the COMPLETED flip; if the flip
  loses the race (already terminal), no coverage is written.

### Session coverage (per Job) — monotonic
```
  uncovered ──(its run COMPLETED, transcript analyzed)──► covered  (terminal; jobId @unique)
```
- A FAILED run does not transition any session to covered.
- A session lacking a transcript at run time stays `uncovered` and is re-selected next run
  (FR-010). Coverage is never written speculatively.

---

## Migration

`prisma/migrations/<timestamp>_insights_session_coverage/migration.sql`:
- `CREATE TYPE "InsightsCoverageGapReason" AS ENUM ('TRANSCRIPT_NOT_AVAILABLE');`
- `ALTER TABLE "InsightsReport" ADD COLUMN "expectedSessionsCount" INTEGER, ADD COLUMN
  "coverageGapReason" "InsightsCoverageGapReason";`
- `CREATE TABLE "InsightsSessionCoverage" (...)` with `UNIQUE("jobId")`, FKs to `Job`
  (cascade) and `InsightsReport` (cascade), and `INDEX("reportId")`.
- Backfill: none required. Existing COMPLETED reports have no coverage rows → their sessions
  become eligible on the next run. This is acceptable (one-time re-coverage of already-shipped
  sessions; see plan §Risks). Operators may optionally pre-seed coverage from historical
  `periodEnd` cursors, but this is **not** part of the migration (avoids guessing which
  jobs a legacy run actually analyzed — it only ever analyzed one-per-ticket).

Run `bunx prisma generate` after editing the schema (CLAUDE.md commit rule).
</content>
