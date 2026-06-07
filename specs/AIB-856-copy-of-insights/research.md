# Research: Insights Analysis Covers All Agent Sessions of Every Ticket (AIB-856)

**Branch**: `AIB-856-copy-of-insights` | **Date**: 2026-06-07
**Spec**: [spec.md](./spec.md)

This feature is a **brownfield change** to the existing platform-wide Insights
analysis shipped in AIB-791. It does not introduce a new subsystem; it changes
*which* agent sessions are selected, *how* their coverage is tracked, and *what*
counts the report surfaces. The research below inventories the existing code,
extracts the patterns the new code must follow, and records the design
decisions that resolve the spec's three documented CONSERVATIVE fallbacks.

---

## Decisions

### D-1: "Session" is the `Job` row (one agent run per ticket stage)

- **Decision**: Treat the spec's *Agent Session* entity as a single `Job` row
  whose `command` is a Claude agent command (specify, plan, implement,
  quick-impl, iterate, verify, comment-*) and which produced a captured native
  transcript (`JobLog.rawArtifactKey != null`). The per-session "analyzed"
  marker is therefore **per-Job**.
- **Rationale**: The spec enumerates sessions as "specify → plan → implement →
  iterate → verify" — exactly the per-stage `Job` rows. The existing capture
  model already records one `JobLog`/`rawArtifactKey` per `Job`, and the
  existing `sessionsCount` is a job count. Job granularity matches the spec, the
  data, and the existing UI vocabulary with zero new abstraction.
- **Alternatives considered**: Tracking by internal Claude `sessionId` (a single
  job's tar.gz may contain several). Rejected — `sessionId` is not a first-class
  DB entity, is not durably indexed, and the spec's enumerated examples map to
  stages (jobs), not internal session ids. The workflow already splits a job's
  artifact into `<sessionId>.jsonl` files for `/insights` to consume; that is an
  ingestion detail below the unit of accounting.

### D-2: Per-session coverage via an insert-only marker table (FR-004, FR-005, FR-006)

- **Decision**: Add a new table `InsightsAnalyzedSession (jobId UNIQUE, reportId,
  analyzedAt)`. A marker row exists **iff** that session was *successfully*
  analyzed by a *completed* run. Absence of a marker = eligible. The `@unique`
  on `jobId` is the once-and-only-once guarantee.
- **Rationale**: This replaces the single global time-cursor
  (`getLastCompletedRunEnd → InsightsReport.periodEnd`) the spec forbids
  (FR-004). Insert-only semantics give the exact properties the spec demands:
  - **No overlap** (FR-005, SC-002): the unique index rejects a second mark.
  - **No skip / failed-run-safe** (FR-005, FR-006, US2-AC3): markers are written
    **only** on the `COMPLETED` transition, so a FAILED/aborted run marks
    nothing and its sessions stay eligible.
  - **Boundary-safe** (US2-AC2): a session that becomes eligible *after* a run's
    enumeration snapshot is simply not in that run's marked set, so it remains
    eligible for the next run.
- **Alternatives considered**:
  - A nullable `Job.insightsAnalyzedAt` column. Rejected — widens the hot `Job`
    table and loses the "which run covered this" audit trail; a dedicated table
    is cleaner and indexable for the eligibility anti-join.
  - Keeping the time-cursor and merely removing the dedup. Rejected — the spec
    explicitly forbids a single global cursor (FR-004, documented CONSERVATIVE
    fallback) because window boundaries lose/duplicate sessions (US2).

### D-3: Eligibility = any-outcome Claude session with an available transcript (FR-007, FR-009)

- **Decision**: A session is eligible iff: `status='COMPLETED'` **AND**
  `log.rawArtifactKey != null` **AND** effective agent resolves to `CLAUDE`
  **AND** `ticketId != null`. Eligibility is **decoupled from `TicketOutcome`**
  (ship status) entirely — shipped, in-progress, failed, abandoned, and
  rolled-back tickets all contribute their sessions.
- **Rationale**: FR-007 mandates selection by *session activity*, not by SHIP.
  The `rawArtifactKey != null` gate is the FR-009 transcript-availability rule
  reused from the existing predicate (a session the workflow cannot fetch must
  not be promised). `ticketId != null` naturally excludes the `insights-analyze`
  jobs themselves (recursive self-analysis) and matches the raw-native route's
  existing ticket requirement.
- **Alternatives considered**: Keeping the `TicketOutcome.shippedAt` join.
  Rejected — it is the exact defect being fixed (non-shipped, "most instructive"
  work was invisible).

### D-4: Expected vs analyzed counts; pruned transcripts are a reported gap (FR-009, FR-010, FR-011)

- **Decision**: Add `InsightsReport.expectedSessionsCount Int?`. On a run:
  - **expected** = the count of eligible-unanalyzed sessions the workflow
    enumerated at run start.
  - **analyzed** (`sessionsCount`, repurposed) = the count of those sessions the
    workflow could actually read and feed to `/insights` (markers written).
  - **gap** = `expected − analyzed`, surfaced in the report metadata when > 0
    (FR-011). A session whose transcript was pruned between enumeration and
    download is counted in `expected` but not `analyzed`, never silently
    dropped, and does not fail the whole run.
- **Rationale**: Without a visible analyzed-vs-expected figure, partial coverage
  is indistinguishable from full coverage (the original "sessions are missing"
  impression). The workflow is the only actor that knows which downloads 404'd,
  so it reports the analyzed set; the API marks exactly that set.
- **Alternatives considered**: Having the API re-derive readability by probing
  blobs at terminal time. Rejected — duplicates the workflow's download work and
  races with retention; the workflow already has ground truth.

### D-5: Marker-driven enumeration; `period*` becomes display-only (FR-004, FR-013)

- **Decision**: The `/api/admin/insights/jobs` enumeration endpoint returns
  **all eligible-unanalyzed sessions as of the call** (marker anti-join), no
  longer window-filtered. `InsightsReport.periodStart/periodEnd` are retained
  for the report's display window (periodStart = earliest eligible-unanalyzed
  session's `startedAt`; periodEnd = trigger time) but no longer drive
  selection. The single-RUNNING partial-unique index (FR-013) is preserved
  unchanged, so only one run enumerates-and-marks at a time — making overlap
  across runs structurally impossible.
- **Rationale**: Marker-driven selection is the FR-004 requirement and removes
  all window-boundary edge cases (US2). The single-run guard means a session
  cannot be enumerated by two concurrent runs.
- **Alternatives considered**: Keeping window params authoritative for
  selection. Rejected — reintroduces the boundary loss/duplication the spec
  forbids.

### D-6: No marker backfill — first post-migration run covers the full eligible corpus (FR-014)

- **Decision**: Do **not** backfill `InsightsAnalyzedSession` rows for sessions
  touched by pre-AIB-856 runs. After migration no session has a marker, so the
  first new run enumerates every currently-eligible session (bounded by
  `LOG_RETENTION_DAYS`, default 30, since `rawArtifactKey` availability is the
  gate).
- **Rationale**: The old model only ever analyzed *one* (earliest) session per
  shipped ticket; the overwhelming majority of sessions were **never** analyzed.
  "Already covered" is meaningless for the all-sessions corpus, so a clean start
  is the correct behavior and is exactly FR-014's "first-ever run covers all
  eligible sessions from the earliest available session forward." Corpus size is
  naturally bounded by transcript retention.
- **Alternatives considered**: Backfilling markers for the earliest job of each
  past-shipped ticket. Rejected — would wrongly suppress the very sessions
  (plan/implement/iterate/verify) the feature exists to surface.

### D-7: Refusal codes re-expressed in session terms (FR-012)

- **Decision**: Rename refusal codes `NO_CLAUDE_JOBS → NO_CLAUDE_SESSIONS` and
  `NO_NEW_SHIPPED → NO_NEW_SESSIONS`; `ALREADY_RUNNING` is unchanged. The
  pre-flight gate counts eligible-unanalyzed sessions rather than newly-shipped
  tickets.
- **Rationale**: FR-012 requires the gate and its message to be about
  not-yet-analyzed sessions. Codes are admin-only/internal (no public API
  contract), so renaming is safe and improves clarity.

### D-8: raw-native route must allow non-shipped tickets (FR-007)

- **Decision**: Remove the `if (!job.ticket.outcome) return 404` shipped gate
  (lines 69-76) from
  `app/api/admin/insights/jobs/[jobId]/raw-native/route.ts`. Keep the
  `ticketId != null` and effective-agent `CLAUDE` gates.
- **Rationale**: Enumeration now lists non-shipped sessions; the download route
  must let the workflow fetch them or every non-shipped session would 404 and be
  reported as a (false) gap. See **Security** note below — this stays within the
  existing workflow-token trust boundary.

---

## Existing Files

### Database & schema

| Path | Covers | Action |
|------|--------|--------|
| `prisma/schema.prisma` (`model Job` L29-87) | Session unit; `command`, `status`, `startedAt`, `ticketId?`, `projectId`, `log` relation | **Extend**: add `insightsAnalyzedSession InsightsAnalyzedSession?` back-relation |
| `prisma/schema.prisma` (`model JobLog` L89-108) | `rawArtifactKey` transcript availability gate; `captureStatus` enum (CAPTURED/UNAVAILABLE/PRUNED) | Reuse as-is (read `rawArtifactKey`) |
| `prisma/schema.prisma` (`model InsightsReport` L934-960) | Run row: status, period, `sessionsCount`, `ticketsCount`, artifact | **Extend**: add `expectedSessionsCount Int?` + `analyzedSessions` back-relation |
| `prisma/schema.prisma` (`model TicketOutcome` L761-822) | `shippedAt` — the current (to-be-removed) eligibility join | Reference only; no longer joined for eligibility |
| `prisma/migrations/20260511120000_add_insights_report/` | Original report table + nullable `Job.ticketId` | Pattern reference for new migration |
| `prisma/migrations/20260511130000_insights_single_running_index/` | Partial unique index enforcing one RUNNING row | Reuse as-is (FR-013); pattern for partial unique index on `jobId` |

### Selection / library layer (`app/lib/insights/`)

| Path | Covers | Action |
|------|--------|--------|
| `predicate.ts` | `queryShippedJobs`, `isClaudeRow`, `countShippedClaudeTicketsSince`, `listShippedClaudeJobsForWindow` (earliest-per-ticket dedup), `getEarliestClaudeJobTimestamp` | **Rewrite**: marker-aware eligible-session queries, no dedup, no shipped join |
| `repository.ts` | Atomic report+job insert, `markFailed`, `getLastCompletedRunEnd`, `ReportListEntry`/`toListEntry` serializers | **Extend**: add `expectedSessionsCount` to serializer; add marker-write helper; keep `getLastCompletedRunEnd` for display only |
| `preflight.ts` | `computePreflightSnapshot` (shipped-since count + refusal) | **Modify**: marker-based count, renamed refusal codes/field |
| `reconcile.ts` | `reconcileOrphanedRunningReports` (timeout auto-FAIL) | Reuse as-is (pattern reference for atomic `updateMany` guard) |
| `output-validation.ts` | `validateInsightsOutput` (structural markers) | Reuse as-is |
| `blob-keys.ts` | `buildInsightsReportKey` | Reuse as-is |

### API routes (`app/api/admin/insights/`)

| Path | Covers | Action |
|------|--------|--------|
| `trigger/route.ts` | POST: pre-flight gate, single-tx insert, dispatch, dispatch-failure rollback | **Modify**: marker-based pre-flight, renamed refusals, periodStart from earliest eligible |
| `jobs/route.ts` | GET enumeration (workflow): `listShippedClaudeJobsForWindow` | **Modify**: marker-driven enumeration (all eligible-unanalyzed) |
| `jobs/[jobId]/raw-native/route.ts` | GET raw transcript stream (workflow), effective-agent + shipped gate | **Modify**: remove shipped gate (D-8) |
| `reports/[id]/status/route.ts` | PATCH terminal transition + blob re-validation + job cascade | **Modify**: accept `analyzedJobIds`+`expectedSessionsCount`, mark sessions in-tx, compute counts |
| `preflight/route.ts` | GET preflight snapshot (UI) | Reuse (delegates to `preflight.ts`) |
| `reports/route.ts`, `reports/[id]/route.ts`, `reports/[id]/html/route.ts`, `reports/[id]/finalize/route.ts` | List / single / HTML stream / artifact upload | Reuse as-is (serializer gains `expectedSessionsCount`) |

### UI (`components/admin/insights/`, hooks)

| Path | Covers | Action |
|------|--------|--------|
| `insights-report-view.tsx` | Report list + metadata card + iframe | **Modify**: analyzed-vs-expected phrasing, gap warning (FR-011), scope note (FR-008), header rewording |
| `run-analysis-button.tsx` | Trigger button + refusal display | **Modify**: renamed refusal-code references |
| `app/lib/hooks/queries/use-insights-preflight.ts` | `InsightsPreflight` type + 15s polling | **Modify**: renamed field + refusal codes |
| `app/lib/hooks/queries/use-insights-reports.ts` | Reports list polling | Reuse (type gains `expectedSessionsCount`) |

### Workflow

| Path | Covers | Action |
|------|--------|--------|
| `.github/workflows/insights-analyze.yml` | Enumerate → download (abort-if-empty) → `/insights` → finalize → PATCH counts | **Modify**: marker-driven enumerate, 404-tolerant download collecting readable jobIds, send `analyzedJobIds`+`expectedSessionsCount` on COMPLETED |
| `.github/scripts/run-agent.sh` | Claude CLI install/auth/capture | Reuse as-is |

### Existing tests (extend — do NOT duplicate; Constitution §III)

| Path | Covers | Action |
|------|--------|--------|
| `tests/unit/lib/insights/predicate.test.ts` | effective-agent grid, count/list parity, earliest dedup, raw-artifact gate | **Rewrite**: all-sessions (no dedup), non-shipped inclusion, marker anti-join, ticketId-null exclusion |
| `tests/unit/components/admin/insights/insights-report-view.test.tsx` | metadata phrasing, list selection | **Extend**: analyzed-vs-expected, gap warning |
| `tests/unit/components/admin/insights/run-analysis-button.test.tsx` | refusal display | **Extend**: renamed refusal codes |
| `tests/integration/admin/insights-api.test.ts` | API structure | **Extend**: marker-driven preflight + enumeration |
| `tests/integration/admin/analysis-workflow.test.ts` | run lifecycle | **Extend**: status PATCH marks sessions, counts |
| `tests/integration/api/admin/insights/effective-agent.test.ts` | effective-agent predicate | **Extend/verify** still valid under new eligibility |
| `tests/integration/outcomes/ship-transition-capture-resilience.test.ts` | count/list parity | **Modify**: parity now over eligible-session set |
| `tests/e2e/admin/insights-flow.spec.ts` | full page flow | **Extend** only if a UI behavior (gap badge) needs a browser; prefer integration |

### New test file (justified — distinct concern)

- `tests/integration/admin/insights-session-coverage.test.ts` — **NEW**.
  Covers US2 (no gap / no overlap across two consecutive runs, boundary
  session) and US4 (expected vs analyzed counts, pruned-transcript gap). No
  existing file covers per-session coverage accounting; folding it into
  `insights-api.test.ts` would mix unrelated concerns.

---

## Patterns to Follow

These come from reading the actual reference implementations. New code MUST
match them, not merely "follow existing patterns."

### P-1: Atomic conditional transition with `updateMany WHERE status='RUNNING'`

From `repository.ts:124-138` (`markFailed`) and
`reports/[id]/status/route.ts:60-74`. Every lifecycle transition uses
`updateMany({ where: { id, status: 'RUNNING' }, ... })` and treats `count===0`
as the idempotent no-op (late/duplicate callback). **The new marker write MUST
happen only when this guarded update actually flips the row** — i.e., inside the
same successful transition, never on a `count===0` no-op. Wrap the report
transition + marker `createMany` + job cascade in a single
`prisma.$transaction` (interactive form, as in `repository.ts:80-108`) so a
crash cannot leave a COMPLETED report with unmarked sessions or vice-versa.

### P-2: Single-source predicate shared by count/enumeration (no drift)

From `predicate.ts:13-18` and its consumers (`trigger`, `preflight`, `jobs`,
`raw-native`). The pre-flight count, the enumeration list, and the raw-native
gate ALL derive from one private query so they cannot diverge (the AIB-787-class
regression). The rewritten predicate MUST keep this: one
`queryEligibleSessions` helper feeding `countEligibleUnanalyzedSessions`,
`listEligibleUnanalyzedSessions`, and `getEarliestEligibleSessionTimestamp`, and
the raw-native route MUST apply the same effective-agent rule.

### P-3: Database-enforced concurrency, not TOCTOU reads

From `repository.ts:27-32,109-117` + the partial unique index migration. The
single-RUNNING guarantee is enforced by a partial unique index, with the
`P2002` violation mapped to `ALREADY_RUNNING`. The once-only marker guarantee
follows the **same pattern**: a `@unique` on `InsightsAnalyzedSession.jobId`
(+`createMany({ skipDuplicates: true })`) enforces no-double-count at the DB
layer rather than via a read-then-write check (FR-003, SC-002).

### P-4: Surface external-call failures, never swallow (Constitution §IV)

From `reports/[id]/status/route.ts:80-94,164-200`. The blob re-fetch returns
`503 BLOB_UNREACHABLE` on a transient outage (so the RUNNING row is untouched
and the workflow retries) but overrides to FAILED on genuine validation
failure. The job cascade is wrapped in try/catch that **logs and continues**
(orphan picked up by reconciliation) rather than failing the callback. New
marker-write code MUST keep blob-re-validation intact and MUST NOT let a marker
write failure silently report success.

### P-5: Dispatch-then-rollback on external failure (Constitution §V)

From `trigger/route.ts:175-254`. The DB rows are created in a committed
transaction *first*; if the Octokit dispatch then fails, the report is
`markFailed`'d and the orphan Job deleted — no orphaned RUNNING row, no success
returned to the caller. The trigger changes preserve this exact ordering.

### P-6: Zod validation matching DB constraints (Constitution §IV)

From `status/route.ts:12-36` (refinements force the artifact fields on
COMPLETED) and `trigger/route.ts:27-42`. New PATCH fields MUST be validated:
`analyzedJobIds: z.array(z.number().int().positive())` (required on COMPLETED),
`expectedSessionsCount: z.number().int().nonnegative()` (required on COMPLETED),
via a `.refine` mirroring the existing COMPLETED-requires-fields refinement.

### P-7: Reconcile at every lifecycle entry point

From `trigger/route.ts:80` and the reports GET route — `reconcileOrphanedRunning
Reports(new Date())` runs at the top of every read/mutate entry point. No change
needed; documented so the new code does not remove it.

---

## Security

- **raw-native widening (D-8)**: removing the shipped gate lets a
  `WORKFLOW_API_TOKEN` holder stream raw native transcripts of **non-shipped**
  Claude jobs. This stays inside the existing trust boundary: the token already
  grants cross-tenant read/write to log artifacts via
  `/api/jobs/:id/logs/raw-artifact`, and the effective-agent `CLAUDE` gate is
  retained. The change only aligns the download route with the (now broader)
  enumeration set. Documented per Constitution §IV.
- **Marker poisoning defense (P-4 + defense-in-depth)**: the status route MUST
  filter caller-supplied `analyzedJobIds` to sessions that are *currently
  eligible Claude sessions* before writing markers, mirroring the existing
  server-side `validateInsightsOutput` re-check — a buggy/compromised workflow
  must not be able to mark an arbitrary job as analyzed and thereby exclude it
  from all future runs.

## Performance / Scale

- First post-migration run enumerates the full eligible corpus (bounded by
  `LOG_RETENTION_DAYS`, default 30 days of Claude jobs). This is intended
  (D-6, FR-014). Steady-state runs enumerate only sessions since the last
  completed run (the marker anti-join), so per-run corpus stays small.
- The eligibility query is a single `job.findMany` with the marker relation
  filter (`insightsAnalyzedSession: null`) + index on `Job.status`/`startedAt`
  and the new `InsightsAnalyzedSession.jobId` unique index. No N+1.

## Open Questions

None. All three spec CONSERVATIVE fallbacks (per-session marker, non-shipped
inclusion, transcript-availability eligibility) are resolved by D-2, D-3, and
D-4 respectively. No `NEEDS CLARIFICATION` remains.
</content>
</invoke>
