# Implementation Plan: Insights — Analyze Every Agent Session of a Ticket

**Branch**: `AIB-852-insights-analyser-toutes` | **Date**: 2026-06-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-852-insights-analyser-toutes/spec.md`

## Summary

Today the platform Insights analysis (`insights-analyze` workflow + `/api/admin/insights/*`)
selects **one** session per **shipped** ticket, deduped to the earliest job, and tracks
coverage with a single global cursor (`InsightsReport.periodEnd`). This loses implement/
iterate/verify work, ignores unshipped tickets, and risks boundary loss/double-count.

This feature reworks **selection and coverage** while leaving the report-generation
pipeline (native `/insights` slash command, blob artifact, RUNNING/COMPLETED/FAILED
lifecycle, single-RUNNING gate) intact:

1. **Per-session coverage marker** (`InsightsSessionCoverage`, `jobId @unique`) becomes the
   source of truth for "already analyzed", replacing the global cursor (FR-004/FR-006).
2. **Select every captured Claude session** of each in-scope ticket — all stages, all
   projects — decoupled from SHIP (`TicketOutcome`) (FR-001/FR-002/FR-008).
3. **Coverage advances only on COMPLETED**, keyed on the exact jobIds the workflow analyzed
   (FR-007); FAILED advances nothing.
4. **Expected-vs-analyzed counts + gap flag** stored on `InsightsReport` and surfaced in the
   report-view metadata header (FR-011/FR-012); pre-flight estimate switches to **sessions**
   from the same predicate as enumeration (FR-015/FR-016).

Technical approach and the patterns to follow are in [research.md](./research.md); the
schema delta in [data-model.md](./data-model.md); API/workflow deltas in
[contracts/admin-insights-api.md](./contracts/admin-insights-api.md) and
[workflows/insights-analyze-workflow.md](./workflows/insights-analyze-workflow.md).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, TanStack Query v5,
`@octokit/rest`, `zod`, `@vercel/blob`; GitHub Actions for the analysis workflow
**Storage**: PostgreSQL 14+ via Prisma; agent transcripts in Vercel Blob
(`raw-logs/<projectId>/<ticketId>/<jobId>.{tar,jsonl}.gz`)
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Linux server (Vercel) + GitHub Actions runner
**Project Type**: Web application (Next.js full-stack, single repo)
**Performance Goals**: Selection queries run at trigger (admin, interactive) and once per
workflow enumeration — bounded by the number of terminal Claude jobs in the corpus; expect
≤ low-thousands rows; no special perf target beyond responsive admin UI.
**Constraints**: No project-scope filter on selection (FR-003 guardrail); coverage write
must be transactional with the COMPLETED flip (FR-007); no `--no-verify`; Zod constraints
must match DB column constraints (constitution §IV).
**Scale/Scope**: Platform-wide corpus across all projects; multi-session tickets common.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. TypeScript-First** | All new code typed; new enum `InsightsCoverageGapReason` and `analyzedJobIds: number[]` Zod-validated. No `any`. PASS |
| **II. Component-Driven** | No new UI primitives; extends existing `insights-report-view.tsx` (header copy + gap badge via existing shadcn `Badge`). Server logic stays in `app/lib/insights/*` + `app/api/admin/insights/*`. PASS |
| **III. TDD (NON-NEGOTIABLE)** | Extends existing test files (predicate, status-patch, preflight, trigger, jobs-raw-native, report-view); one **new** integration file `coverage.test.ts` (no existing file covers cross-run exactly-once). Behavior-focused, mocks target the imported module (P8). PASS |
| **IV. Security-First** | Workflow-token routes keep `validateWorkflowAuth`; raw-native keeps Claude-agent + key-canonicalization checks (only the SHIP gate is relaxed per FR-008); `analyzedJobIds`/counts Zod-validated; admin routes keep 404-parity. PASS |
| **V. Database Integrity** | New table + columns via a Prisma migration; `jobId @unique` + cascades enforced at schema level; coverage write inside the COMPLETED `$transaction` with `WHERE status='RUNNING'` guard; `bunx prisma generate` after schema change. PASS |
| **V (clarification guardrails)** | The single medium-confidence decision (non-shipped inclusion) is documented in the spec's Auto-Resolved Decisions with a one-switch reversal note (FR-017). PASS |

**Result**: PASS. No violations -> Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)
```
specs/AIB-852-insights-analyser-toutes/
|- plan.md              # This file
|- research.md          # Phase 0: decisions, existing-files inventory, patterns
|- data-model.md        # Phase 1: InsightsSessionCoverage + InsightsReport delta
|- contracts/
|  \- admin-insights-api.md   # Phase 1: API deltas
|- workflows/
|  \- insights-analyze-workflow.md  # Phase 1: workflow delta
|- checklists/
|  \- requirements.md  # (existing, from /specify)
\- tasks.md             # Phase 2 output (/ai-board.tasks - NOT created here)
```

### Source Code (repository root) - real paths from Phase 0 discovery
```
prisma/
|- schema.prisma                                   # + InsightsSessionCoverage, InsightsReport delta, enum
\- migrations/<ts>_insights_session_coverage/      # NEW migration

app/lib/insights/
|- predicate.ts            # REWRITE: all-sessions selection, coverage filter, session counts
|- preflight.ts            # EDIT: session-based snapshot + new refusal codes
\- repository.ts           # EDIT: coverage-advance helper, derivePeriodStart, ReportListEntry fields

app/api/admin/insights/
|- trigger/route.ts                    # EDIT: session pre-flight, derived periodStart
|- preflight/route.ts                  # EDIT: new snapshot shape passthrough
|- jobs/route.ts                       # EDIT: return all analyzable jobs + expectedCount
|- jobs/[jobId]/raw-native/route.ts    # EDIT: drop unshipped 404 gate (keep Claude + key checks)
\- reports/[id]/status/route.ts        # EDIT: analyzedJobIds + expected; advance coverage in-txn
                                       #       (+ reports/route.ts, reports/[id]/route.ts serialization)

components/admin/insights/insights-report-view.tsx   # EDIT: analyzed-vs-expected header + gap flag
app/lib/hooks/queries/use-insights-preflight.ts      # EDIT: InsightsPreflight type fields

.github/workflows/insights-analyze.yml               # EDIT: enumerate expectedCount; send analyzedJobIds

tests/unit/lib/insights/predicate.test.ts            # REWRITE/EXTEND
tests/integration/api/admin/insights/preflight.test.ts        # EXTEND
tests/integration/api/admin/insights/trigger.test.ts          # EXTEND
tests/integration/api/admin/insights/jobs-raw-native.test.ts  # EXTEND (unshipped -> 200)
tests/integration/api/admin/insights/status-patch.test.ts     # EXTEND (coverage write/skip)
tests/integration/api/admin/insights/effective-agent.test.ts  # EXTEND (count/enum parity)
tests/integration/api/admin/insights/reports-list.test.ts     # EXTEND (new fields)
tests/unit/components/admin/insights/insights-report-view.test.tsx  # EXTEND (header + gap)
tests/integration/api/admin/insights/coverage.test.ts         # NEW (cross-run exactly-once)
```

**Structure Decision**: Existing Next.js full-stack layout. The feature is concentrated in
`app/lib/insights/` (selection/coverage logic), `app/api/admin/insights/` (route deltas),
one Prisma migration, one UI component, and the workflow YAML. No new directories beyond
the migration folder and the one new test file.

## Implementation Phases

Ordered by the spec's user-story priority; each phase is independently testable.

### Phase A - Schema & coverage foundation (P1 prerequisite; US1/US2)
1. Add `InsightsSessionCoverage` model, `InsightsReport.expectedSessionsCount` +
   `coverageGapReason`, enum `InsightsCoverageGapReason`, and `Job`/`InsightsReport`
   back-relations to `schema.prisma` (data-model.md). Generate the migration; run
   `bunx prisma generate`.
2. Add repository helpers in `repository.ts`: `advanceCoverage(tx, reportId, jobIds)`
   (uses `createMany skipDuplicates`), `derivePeriodStart()` (max covered completion ??
   oldest available ?? now). Follow the `$transaction` + `WHERE status='RUNNING'` pattern
   (P3, `repository.ts:79-138`).

### Phase B - Selection predicate rewrite (US1, US3, US5, FR-001/002/003/008/009)
3. Rewrite `predicate.ts` around a new private inner query joining `Job -> Ticket -> Project`
   (no `TicketOutcome`, no project filter), applying effective-agent (P2), terminal status,
   `JobLog` presence, completion timestamp (D3), and coverage exclusion. Export:
   `countAnalyzableClaudeSessions()`, `listAnalyzableClaudeSessions(window, {ignoreCoverage})`,
   `countExpectedClaudeSessions(window)`, `getEarliestClaudeSessionCompletion()`.
   Keep the **single-inner-query** discipline so count == enumeration (P1, FR-016).

### Phase C - API wiring (US1/US2/US3/US4)
4. `jobs/route.ts`: return all analyzable sessions + `expectedCount`.
5. `jobs/[jobId]/raw-native/route.ts`: remove the `!job.ticket.outcome` 404 gate; keep
   Claude-agent + `canonicalizeRawArtifactKey` (P7).
6. `reports/[id]/status/route.ts`: extend Zod schema (`analyzedJobIds`,
   `expectedSessionsCount`), compute `coverageGapReason`, and call `advanceCoverage` inside
   the existing COMPLETED `$transaction` (FR-007/D5/P3/P6). FAILED branch unchanged.
7. `trigger/route.ts` + `preflight.ts` + `preflight/route.ts`: switch pre-flight to
   `countAnalyzableClaudeSessions`, new refusal codes (`NO_CLAUDE_SESSIONS`/
   `NO_NEW_SESSIONS`), derived `periodStart` (P5 dispatch-then-rollback preserved).
8. `repository.ts` serialization: add `expectedSessionsCount` + `coverageGapReason` to
   `ReportListEntry` / `toListEntry`.

### Phase D - Workflow (US1/US4, FR-011/016)
9. `insights-analyze.yml`: capture `expected_count`; compute `analyzed_job_ids`; extend the
   COMPLETED PATCH payload (workflows/insights-analyze-workflow.md). FAILED PATCH unchanged.

### Phase E - UI surface (US4, FR-011/012/013)
10. `insights-report-view.tsx`: rework `formatMetadataPhrasing` to "Analyzed N of M Claude
    Code sessions..." with a gap badge when `coverageGapReason` is set; update the header
    "since previous run" line to sessions. Update `use-insights-preflight.ts` types.

## Testing Strategy

Follows constitution §III (Testing Trophy: prefer integration; extend existing files).
Test-type decisions per the decision tree:

- **Unit (Vitest)** - `predicate.test.ts` (rewrite): all-sessions selection, multi-session
  per ticket (US1 AC1/AC2), non-shipped inclusion (US3), no project filter (US5), coverage
  exclusion, completion-timestamp boundary placement (US2), count==enumeration parity
  (FR-016). Mock `@/lib/db/client` (P8).
- **Integration (Vitest)** - the API-touching behavior:
  - `status-patch.test.ts`: COMPLETED writes coverage rows for `analyzedJobIds`; FAILED
    writes none (FR-007/US2 AC3); idempotent re-PATCH writes no duplicates; gap reason set
    when expected>analyzed (FR-012).
  - `coverage.test.ts` (**NEW**): run A then run B over consecutive windows - a boundary
    session appears in exactly one (US2 AC1/SC-002); a covered session is not re-selected
    (US2 AC2); after a FAILED run the intended sessions are picked up next run (US2 AC3/SC-003).
  - `jobs-raw-native.test.ts`: unshipped Claude ticket now 200 (US3); non-Claude still 404.
  - `preflight.test.ts` / `trigger.test.ts`: session counts, new refusals, derived period,
    first-run bound (FR-014), retry ignores coverage (FR-006/D8).
  - `effective-agent.test.ts`: session count == enumeration for one window (SC-006).
  - `reports-list.test.ts`: new fields serialized.
- **Component (Vitest + RTL)** - `insights-report-view.test.tsx`: header renders
  analyzed-vs-expected; gap badge shown iff `coverageGapReason` set; full-coverage wording
  when equal (US4 AC1/AC2/AC3). Use `getByRole`/`getByText`, `renderWithProviders`.
- **E2E (Playwright)** - `insights-flow.spec.ts`: touch only if header copy assertions
  change; no new E2E (expensive - none of the new behavior requires a browser).

Each new/changed test maps to a Success Criterion (SC-001..SC-007) and is named to make the
mapping obvious.

## Risks & mitigations

- **Existing COMPLETED reports have no coverage rows** -> their sessions become eligible on
  the first post-migration run (one-time re-coverage of already-shipped sessions). *Accepted*:
  the legacy runs only ever analyzed one-per-ticket, so re-analysis is the intended fix, not
  a regression; documented in data-model.md (no backfill).
- **`completedAt` null on legacy terminal jobs** -> fallback chain `completedAt ?? updatedAt
  ?? startedAt` (D3) keeps them selectable and boundary-placeable.
- **Expected vs `JobLog`-not-yet-written race** -> the rare just-completed/log-pending session
  is picked up next run (FR-010 self-healing); documented in research.md D4.
- **Drift between pre-flight count and enumeration** -> mitigated by the single-inner-query
  discipline (P1) and the `effective-agent.test.ts` parity test (SC-006).

## Complexity Tracking

*No constitution violations - section intentionally empty.*
