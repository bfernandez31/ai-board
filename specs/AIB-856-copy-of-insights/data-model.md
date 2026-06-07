# Data Model: Insights Analysis Covers All Agent Sessions (AIB-856)

**Branch**: `AIB-856-copy-of-insights` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Source of truth remains `prisma/schema.prisma`. This document describes only the
**deltas** AIB-856 introduces and the entities it reinterprets.

---

## New Entity: `InsightsAnalyzedSession` (the per-session "analyzed" marker)

Records that one agent session (one `Job`) was **successfully analyzed by a
completed run**. A row exists iff the session is covered; absence = eligible.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `Int` | PK, autoincrement | |
| `jobId` | `Int` | **`@unique`**, FK → `Job.id`, `onDelete: Cascade` | The analyzed session. Unique = once-and-only-once (FR-003, SC-002). |
| `reportId` | `Int` | FK → `InsightsReport.id`, `onDelete: Cascade` | Which run covered it (audit / coverage debugging). |
| `analyzedAt` | `DateTime` | `@default(now())` | When the covering run completed. |

**Indexes**: `@@index([reportId])` (list a run's covered sessions).
The `@unique` on `jobId` doubles as the dedup index.

**Back-relations**:
- `Job.insightsAnalyzedSession InsightsAnalyzedSession?` — enables the
  eligibility anti-join `where: { insightsAnalyzedSession: null }`.
- `InsightsReport.analyzedSessions InsightsAnalyzedSession[]`.

**Lifecycle**:
- Created **only** inside the guarded `COMPLETED` transition of
  `reports/[id]/status` (P-1), via `createMany({ skipDuplicates: true })` over
  the workflow-reported `analyzedJobIds` (after server-side eligibility
  filtering, P-4). Never created on enumeration or on a FAILED transition.
- Cascade-deleted with its `Job` or `InsightsReport`.

**Validation rules** (FR mapping):
- A marker is written **only** for sessions actually read and analyzed (FR-006,
  FR-009) — pruned/unreadable sessions get no marker and remain eligible.
- A FAILED/aborted/timed-out run writes **no** markers (FR-006, US2-AC3).
- `jobId` uniqueness prevents a session being marked twice (FR-003, FR-005).

---

## Modified Entity: `InsightsReport`

| Field | Change | Notes |
|-------|--------|-------|
| `expectedSessionsCount` | **NEW** `Int?` | Eligible-unanalyzed sessions the run enumerated. `null` for legacy rows. (FR-010) |
| `sessionsCount` | **Repurposed** (type unchanged `Int?`) | Now = sessions **actually analyzed** (markers written). Previously ≈ ticket count (one job/ticket). (FR-015) |
| `ticketsCount` | Unchanged `Int?` | Distinct tickets among **analyzed** sessions; stays consistent with the all-sessions corpus (FR-015). |
| `periodStart` / `periodEnd` | **Reinterpreted** (unchanged columns) | Display-only window: `periodStart` = earliest eligible-unanalyzed session `startedAt`; `periodEnd` = trigger time. No longer drives selection (D-5). |
| `analyzedSessions` | **NEW** relation | `InsightsAnalyzedSession[]` back-relation. |

**Derived display value**: `coverageGap = expectedSessionsCount −
sessionsCount`. When `> 0`, the report signals partial coverage (FR-011). When
`expectedSessionsCount === sessionsCount`, coverage is complete (SC-006).

**Status enum** `InsightsRunStatus { RUNNING, COMPLETED, FAILED }` — unchanged.
Single-RUNNING partial unique index — unchanged (FR-013).

---

## Reinterpreted Entity: `Job` (the Agent Session)

No column changes beyond the new back-relation. The session-eligibility
predicate is now (D-3):

```
eligible(Job j) ⇔
     j.status      = 'COMPLETED'
 AND j.ticketId   IS NOT NULL                 -- excludes insights-analyze jobs
 AND j.log.rawArtifactKey IS NOT NULL          -- transcript available (FR-009)
 AND effectiveAgent(j) = 'CLAUDE'              -- ticket.agent ?? project.defaultAgent ?? 'CLAUDE'
 -- NO TicketOutcome / shippedAt join          -- any outcome (FR-007)

eligibleUnanalyzed(Job j) ⇔ eligible(j) AND j.insightsAnalyzedSession IS NULL
```

`effectiveAgent` is the existing rule from
`app/api/jobs/[id]/logs/raw-artifact/route.ts` and `predicate.ts:122-126`.

---

## Coverage Accounting (conceptual, not a table)

For a run, the relationship the report exposes:

| Quantity | Source | FR |
|----------|--------|-----|
| expected | `expectedSessionsCount` — enumeration snapshot at run start | FR-010 |
| analyzed | `sessionsCount` — markers written (readable subset) | FR-010, FR-015 |
| gap | `expected − analyzed` — pruned/unreadable transcripts | FR-009, FR-011 |
| tickets | `ticketsCount` — distinct tickets among analyzed sessions | FR-015 |

---

## State Transitions (run lifecycle — unchanged shape, new side effect)

```
            trigger (marker-based pre-flight passes)
                         │  create InsightsReport(RUNNING) + Job(PENDING)  [single tx, P-5]
                         ▼
                     RUNNING ──────────────────────────────────────────────┐
                         │                                                  │
   workflow PATCH COMPLETED                          workflow PATCH FAILED  │ reconcile timeout
   { analyzedJobIds[], expectedSessionsCount,        { errorReason }        │
     ticketsCount, artifactKey, artifactSize }            │                 │
   ── blob re-validate (P-4) ──                            ▼                 ▼
         │ ok           │ invalid                       FAILED            FAILED
         ▼              ▼                          (no markers written)  (no markers)
     COMPLETED        FAILED
   + createMany markers       (no markers)
     for eligible analyzedJobIds
     (in same guarded tx, P-1/P-3)
```

A second concurrent run cannot enter RUNNING (partial unique index, FR-013). A
late duplicate terminal PATCH hits `count===0` and is an idempotent no-op (no
duplicate markers — also guarded by the `jobId` unique index).

---

## Migration Notes

- New migration directory (timestamp > `20260511130000`):
  1. `CREATE TABLE "InsightsAnalyzedSession"` with the unique index on `jobId`
     and the `reportId` index; FKs `ON DELETE CASCADE`.
  2. `ALTER TABLE "InsightsReport" ADD COLUMN "expectedSessionsCount" INTEGER;`
     (nullable — legacy rows stay null).
- **No data backfill** (D-6): existing markers intentionally absent so the first
  new run re-establishes coverage over the full eligible corpus (FR-014),
  bounded by `LOG_RETENTION_DAYS`.
- Run `bunx prisma generate` after editing `schema.prisma` (per CLAUDE.md).
</content>
