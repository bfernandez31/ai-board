# Phase 0 Research: Insights — Analyze Every Agent Session of a Ticket

**Feature**: AIB-852 | **Date**: 2026-06-07 | **Spec**: [spec.md](./spec.md)

This document resolves the open questions from the Technical Context, inventories the
existing files the feature touches, and records the concrete patterns the
implementation MUST follow (extracted from the real code, with line references).

---

## Decisions (NEEDS CLARIFICATION resolution)

### D1 — Coverage source of truth: a per-session marker table, not the period cursor

- **Decision**: Introduce a new `InsightsSessionCoverage` row per analyzed session
  (`jobId @unique → reportId`). A session is "already analyzed" **iff** a coverage
  row exists for its job. The global cursor (`getLastCompletedRunEnd()` reading
  `InsightsReport.periodEnd`) is demoted from *source of truth* to a *display/derived*
  value only.
- **Rationale**: FR-004 requires a stable per-session marker "not a single global
  period cursor". `jobId @unique` enforces FR-006 (at most once) at the DB layer,
  mirroring the existing `InsightsReport_one_running_uniq` partial-unique pattern.
- **Alternatives rejected**:
  - *Keep the cursor, dedup by window only* — reintroduces the boundary loss/double-count
    the spec names as a defect (FR-005). A single timestamp cannot represent "session X
    covered, session Y at the same instant not yet".
  - *Boolean flag on `JobLog`* — couples coverage to the log row, can't attribute which
    run covered a session, and complicates re-analysis.

### D2 — Selection is decoupled from SHIP and from `TicketOutcome`

- **Decision**: Selection joins `Job → Ticket → Project` directly, **not** through
  `TicketOutcome`. In-scope = terminal (`COMPLETED|FAILED|CANCELLED`) Claude jobs that
  belong to a ticket and have a `JobLog` row (capture was attempted). The SHIP-only
  filter (`TicketOutcome.shippedAt`) is removed from the predicate.
- **Rationale**: FR-008 — in-progress / abandoned / rolled-back tickets must be eligible.
  The current predicate (`predicate.ts:63-79`) starts from `ticketOutcome.findMany`,
  which structurally excludes every non-shipped ticket. The Auto-Resolved Decision in
  the spec confirms inclusion.
- **Alternatives rejected**: *Keep TicketOutcome join, add unshipped via UNION* — two
  selection paths drift (the exact FR-016/SC-006 hazard).

### D3 — A session's "completion timestamp" = `Job.completedAt ?? Job.updatedAt ?? Job.startedAt`

- **Decision**: Use `Job.completedAt` as the session completion instant for window
  placement; fall back to `updatedAt` then `startedAt` for legacy rows where
  `completedAt` is null on a terminal job.
- **Rationale**: FR-005 boundary semantics need the session's *own completion* time. The
  current code keys on `startedAt` (`predicate.ts:114,169`); that is the *start*, not
  completion, and is wrong for boundary attribution.

### D4 — "Expected" vs "analyzed" split

- **Decision**:
  - **expected set** = all in-scope uncovered terminal Claude jobs with `completedAt < periodEnd`
    (a `JobLog` row exists), regardless of whether the raw transcript is present.
  - **analyzable / analyzed set** = the subset whose `JobLog.captureStatus = 'CAPTURED'`
    **and** `rawArtifactKey` is non-null (the workflow can actually fetch it).
  - gap = `expected − analyzed`, reason category = `TRANSCRIPT_NOT_AVAILABLE`.
- **Rationale**: FR-010/FR-011/FR-012. A session whose transcript has not uploaded yet
  (`UNAVAILABLE`) or has been pruned (`PRUNED`) is honestly reported as expected-but-not-analyzed
  and becomes eligible again once a transcript lands (it is never coverage-marked unless analyzed).
- **Edge resolved**: A just-completed job whose `JobLog` row has not been written yet is
  not double-counted nor lost — it simply appears in a later run once its log row exists
  (consistent with FR-010 "becomes eligible once available"). Documented as an accepted,
  self-healing gap.

### D5 — Coverage advances only on COMPLETED, keyed on the workflow's analyzed jobIds

- **Decision**: The workflow reports the exact list of jobIds it analyzed in the
  `PATCH …/status` COMPLETED call (`analyzedJobIds: number[]`). The status handler inserts
  `InsightsSessionCoverage` rows for exactly those jobs, in the **same transaction** as the
  RUNNING→COMPLETED flip. FAILED does nothing.
- **Rationale**: FR-007 (a failed run must not advance coverage) and Phase 5 of the
  Internal Process ("Advance coverage — on success only, mark the analyzed sessions").
  Re-deriving the set server-side at completion time would risk marking late-arriving,
  never-analyzed sessions as covered (silent loss). The workflow already enumerates the
  precise jobId list; sending it back is the only drift-free option.
- **Idempotency**: coverage insert uses `skipDuplicates` on the unique `jobId` so a
  re-delivered/late COMPLETED callback (P-1 idempotence) and explicit re-analysis are no-ops.

### D6 — Pre-flight estimate is in **sessions**, from the same predicate as enumeration

- **Decision**: Replace `countShippedClaudeTicketsSince()` (distinct tickets) with
  `countAnalyzableClaudeSessions()` (uncovered, transcript-present sessions). Pre-flight,
  the `/preflight` endpoint, and the workflow's `/jobs` enumeration all call the **same**
  inner query so the count and the enumerated list cannot drift.
- **Rationale**: FR-015 (estimate in sessions, must not undercount multi-session tickets)
  and FR-016/SC-006 (no drift). This preserves the existing "single source of truth"
  discipline documented at `predicate.ts:12-16`.

### D7 — Period bounds become derived/descriptive; the marker drives correctness

- **Decision**: `periodEnd = now` at trigger; `periodStart` = max `completedAt` among
  already-covered sessions, else the oldest available session's completion on the first
  run (FR-014), else `now`. Selection correctness comes from the coverage marker +
  `completedAt < periodEnd`, not from `periodStart`. `periodStart/periodEnd` remain on
  `InsightsReport` for display and for explicit-period re-analysis (retry).
- **Rationale**: FR-005 exactly-once is guaranteed by the marker (covered → excluded) plus
  the half-open `completedAt < periodEnd` upper bound; a session at the previous run's
  boundary is uncovered and falls into the next run exactly once. FR-014 first-run bound.

### D8 — Explicit re-analysis (retry of a chosen period) bypasses the coverage filter

- **Decision**: The existing retry path (trigger with explicit `periodStart/periodEnd`)
  selects sessions by `completedAt ∈ [start,end)` **ignoring** the coverage marker, so an
  admin can deliberately re-analyze a window. Coverage rows are upserted with
  `skipDuplicates`, so re-analysis never corrupts coverage of other periods.
- **Rationale**: FR-006 exception ("except when an administrator explicitly requests a
  re-analysis of a chosen period") and the spec's error-behavior note.

### D9 — Report attribution surface: report-view metadata header (not the iframe HTML)

- **Decision**: analyzed-vs-expected counts and the gap flag are stored on
  `InsightsReport` and rendered in the existing **metadata header card**
  (`insights-report-view.tsx:233-242`, phrasing built by `formatMetadataPhrasing`
  at `:45-57`). The per-session ticket/stage/shipped attribution (FR-013) is produced by
  the native `/insights` HTML corpus itself (each session JSONL carries its job context);
  the AI-Board UI surfaces the aggregate counts + gap.
- **Rationale**: The report HTML is generated by the native Claude Code `/insights` slash
  command (workflow step `Run Claude Code /insights`), which AI-Board does not author. The
  counts/gap are AI-Board-owned metadata and belong in the header the app already renders.

---

## Existing Files (inventory — MANDATORY)

### Selection / coverage / pre-flight (core change surface)

| Path | Covers | Action |
|------|--------|--------|
| `app/lib/insights/predicate.ts` | SHIP-coupled, one-per-ticket selection + distinct-ticket count + earliest-job timestamp | **Extend/rewrite**: decouple from `TicketOutcome`, select all sessions, add coverage filter, session counts |
| `app/lib/insights/preflight.ts` | `computePreflightSnapshot` (distinct shipped tickets) | **Extend**: count sessions, new refusal codes/wording |
| `app/lib/insights/repository.ts` | `getLastCompletedRunEnd`, `createRunningReportAndJob`, `markFailed`, `toListEntry`, `ReportListEntry` | **Extend**: add coverage-advance helper, periodStart derivation, expected/analyzed fields in `ReportListEntry` |
| `app/lib/insights/reconcile.ts` | timeout auto-FAIL of orphaned RUNNING rows | **Reuse as-is** (FAILED must not advance coverage — already correct) |
| `app/lib/insights/blob-keys.ts` | `buildInsightsReportKey` | Reuse as-is |
| `app/lib/insights/output-validation.ts` | HTML marker validation | Reuse as-is |

### API routes

| Path | Covers | Action |
|------|--------|--------|
| `app/api/admin/insights/trigger/route.ts` | POST trigger; period computation; dispatch; FAILED+delete on dispatch error | **Extend**: session-based pre-flight, derived periodStart, new refusal codes |
| `app/api/admin/insights/jobs/route.ts` | GET workflow enumeration `{ jobs }` | **Extend**: return analyzable jobs **and** `expectedCount` |
| `app/api/admin/insights/jobs/[jobId]/raw-native/route.ts` | workflow raw transcript download; currently 404s unshipped tickets | **Extend**: drop the `!job.ticket.outcome` 404 gate (FR-008); keep Claude effective-agent + key canonicalization |
| `app/api/admin/insights/reports/[id]/status/route.ts` | PATCH terminal transition + Job cascade | **Extend**: accept `analyzedJobIds` + `expectedSessionsCount`; advance coverage on COMPLETED in-txn |
| `app/api/admin/insights/reports/[id]/finalize/route.ts` | PUT HTML artifact | Reuse as-is |
| `app/api/admin/insights/reports/route.ts` + `[id]/route.ts` + `[id]/html/route.ts` | list / detail / iframe HTML | **Touch** only if `ReportListEntry` gains fields (serialization) |
| `app/api/admin/insights/preflight/route.ts` | GET preflight snapshot | **Touch**: shape change from `computePreflightSnapshot` |

### Data model / migrations

| Path | Action |
|------|--------|
| `prisma/schema.prisma` (`InsightsReport` 934-960, `Job` 29-87, `JobLog` 89-114) | **Add** `InsightsSessionCoverage` model + new `InsightsReport` fields (`expectedSessionsCount`, `coverageGapReason`); relation on `Job` |
| `prisma/migrations/20260511130000_insights_single_running_index` | Pattern reference for partial-unique index |
| `prisma/migrations/<new>_insights_session_coverage` | **Create**: new table + columns |

### UI / hooks

| Path | Action |
|------|--------|
| `components/admin/insights/insights-report-view.tsx` | **Extend**: `formatMetadataPhrasing` → analyzed-vs-expected + gap; header "since previous run" → sessions wording |
| `components/admin/insights/run-analysis-button.tsx` | **Touch**: refusal-code wording only if codes change |
| `app/lib/hooks/queries/use-insights-preflight.ts` | **Touch**: `InsightsPreflight` type fields |
| `app/lib/hooks/queries/use-insights-reports.ts` | Reuse (shape via `ReportListEntry`) |
| `app/admin/insights/page.tsx` | **Touch**: passes preflight/reports through; minimal |

### Workflow / command

| Path | Action |
|------|--------|
| `.github/workflows/insights-analyze.yml` | **Extend**: enumerate returns `expectedCount`; PATCH COMPLETED sends `analyzedJobIds` + `expectedSessionsCount`; counts step computes analyzed jobId list |
| `.github/scripts/run-agent.sh` | Reuse as-is (runs `/insights`) |

### Existing tests (extend, do NOT duplicate — constitution §III)

| Path | Action |
|------|--------|
| `tests/unit/lib/insights/predicate.test.ts` | **Rewrite/extend**: all-sessions selection, coverage filter, session counts, completion-timestamp boundary, non-shipped inclusion |
| `tests/unit/lib/insights/reconcile.test.ts` | Reuse (assert FAILED reconcile does not write coverage) |
| `tests/integration/api/admin/insights/preflight.test.ts` | **Extend**: session count, new refusals |
| `tests/integration/api/admin/insights/trigger.test.ts` | **Extend**: derived period, non-shipped eligibility |
| `tests/integration/api/admin/insights/jobs-raw-native.test.ts` | **Extend**: unshipped ticket now returns 200 (was 404) |
| `tests/integration/api/admin/insights/status-patch.test.ts` | **Extend**: coverage rows written on COMPLETED, not on FAILED; idempotent re-PATCH |
| `tests/integration/api/admin/insights/effective-agent.test.ts` | **Extend**: parity of session count vs enumeration (FR-016) |
| `tests/integration/api/admin/insights/reports-list.test.ts` | **Touch**: new serialized fields |
| `tests/unit/components/admin/insights/insights-report-view.test.tsx` | **Extend**: analyzed-vs-expected header + gap flag rendering |
| `tests/integration/api/admin/insights/finalize-put.test.ts`, `reports-html.test.ts`, `parity-404.test.ts` | Reuse |
| `tests/e2e/admin/insights-flow.spec.ts` | **Touch** only if header copy assertions change |
| **NEW** `tests/integration/api/admin/insights/coverage.test.ts` | **Create**: exactly-once across two runs, boundary session, failed-run re-eligibility, no double-count (no existing file covers cross-run coverage) |

---

## Patterns to Follow (extracted from reference code)

### P1 — Single-source-of-truth predicate (no count/enumeration drift)
`predicate.ts:12-16, 55-120` — both the count and the list call one private inner query
(`queryShippedJobs`). New code MUST keep this: `countAnalyzableClaudeSessions`,
`listAnalyzableClaudeSessions`, and the expected-count helper share one inner query so
FR-016/SC-006 hold. The existing test `predicate.test.ts:128-177` ("count vs list
agreement") is the regression guard to preserve and extend.

### P2 — Effective-agent resolution (one definition, reused everywhere)
`predicate.ts:122-126` and the duplicate inline check at
`jobs/[jobId]/raw-native/route.ts:63-67`: `effective = ticket.agent ?? project.defaultAgent
?? 'CLAUDE'`. New selection MUST use this exact rule (FR-009). Non-Claude → excluded from
both expected and analyzed, and the raw-native endpoint keeps returning 404 for non-Claude.

### P3 — Atomic conditional transition with `WHERE status='RUNNING'` guard
`repository.ts:124-138` (`markFailed`) and `status/route.ts:60-63` (`applyTerminalTransition`):
every terminal flip is `updateMany({ where: { id, status: 'RUNNING' }, ... })`; `count===0`
→ idempotent no-op (`status/route.ts:64-74`). **Coverage advance MUST happen inside the
same `$transaction` as the COMPLETED flip, gated on the same guard**, so a late/duplicate
callback neither double-writes coverage nor flips a terminal row (P-1, FR-007, SC-012).
Follow the transaction pattern from `repository.ts:79-108` (`createRunningReportAndJob`).

### P4 — Single-RUNNING enforced at the DB layer, mapped to a refusal
`migrations/20260511130000_insights_single_running_index/migration.sql` creates a partial
unique index; `repository.ts:109-117` maps `P2002` → `InsightsAlreadyRunningError`;
`trigger/route.ts:184-195` maps that to an `ALREADY_RUNNING` 409. Concurrent-analysis
safety (spec edge case) is already covered — do not add app-level locking.

### P5 — DB-mutation-then-external-call ordering with compensating rollback
`trigger/route.ts:175-254`: the RUNNING row + Job are inserted first; if the **Octokit
dispatch** fails, the code `markFailed` + deletes the Job (`:202-203, :239-242`) so no
orphan RUNNING row is left (constitution §V). New trigger logic MUST preserve this
dispatch-then-rollback ordering; only the period/pre-flight computation changes.

### P6 — Job cascade without notification side effects
`status/route.ts:80-94`: the linked Job is updated via direct `updateMany`, never through
`PATCH /api/jobs/:id/status`, to suppress push-notification side effects (FR-022 from the
prior feature). Keep this — coverage writes join this same in-txn cascade.

### P7 — Raw-artifact key canonicalization (path-traversal defense)
`jobs/[jobId]/raw-native/route.ts:90-102` runs `canonicalizeRawArtifactKey` before
streaming. Decoupling from SHIP removes only the `!job.ticket.outcome` gate
(`:74-76`); the canonicalization and Claude-agent checks MUST stay.

### P8 — Test mocking targets the real import chain
`predicate.test.ts:3-8` mocks `@/lib/db/client` (the exact module the predicate imports).
New tests follow this; constitution §III: "Mocks MUST target the same module instance the
code under test imports."

---

## Constraints & non-goals confirmed by research

- **Global scope (FR-003/US5 guardrail)**: no `projectId` filter is added anywhere in
  selection. The host-project lookup in `trigger/route.ts:150-171` is only for the driving
  Job's `projectId`; it is NOT a selection filter and stays.
- **No new artifact location**: the analyzer corpus stays the existing
  `raw-logs/<projectId>/<ticketId>/<jobId>.{tar,jsonl}.gz` blobs; both layouts already
  handled by the workflow (`insights-analyze.yml:83-145`) and `artifact-key.ts`.
- **Report HTML authorship unchanged**: the native `/insights` slash command still
  produces the HTML; only AI-Board-owned counts/metadata change.
</content>
</invoke>
