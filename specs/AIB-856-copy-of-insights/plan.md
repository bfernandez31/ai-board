# Implementation Plan: Insights Analysis Covers All Agent Sessions of Every Ticket

**Branch**: `AIB-856-copy-of-insights` | **Date**: 2026-06-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-856-copy-of-insights/spec.md`

## Summary

The platform-wide Insights analysis currently keeps **one** agent session per
**shipped** ticket (the earliest, typically SPECIFY) and selects by a single
global time-cursor (`InsightsReport.periodEnd`). This makes every report
unrepresentative and silently loses non-shipped, plan/implement/iterate/verify
sessions.

This change makes the analysis cover **all** Claude agent sessions of **every**
ticket across **all** projects, regardless of ticket outcome, tracked by a
durable **per-session "analyzed" marker** (new `InsightsAnalyzedSession` table)
instead of a time-cursor. Two consecutive runs neither overlap nor skip a
session (insert-only marker + DB unique constraint + single-RUNNING guard).
Reports surface **analyzed vs expected** session counts and signal any coverage
gap from pruned transcripts. The technical approach is a targeted brownfield
edit of the existing AIB-791 Insights subsystem — see [research.md](./research.md)
for the full design (decisions D-1…D-8, patterns P-1…P-7).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, Zod, TanStack Query v5, `@octokit/rest`, `@vercel/blob`, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma; Vercel Blob for transcript/report artifacts
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Vercel (Next.js server) + GitHub Actions (`insights-analyze.yml`)
**Project Type**: Web application (Next.js App Router, single repo)
**Performance Goals**: Eligibility query is a single indexed `findMany` (marker anti-join); steady-state per-run corpus = sessions since last completed run; first post-migration run bounded by `LOG_RETENTION_DAYS` (default 30)
**Constraints**: At-most-one RUNNING analysis (partial unique index, FR-013); once-and-only-once session coverage (FR-003/FR-005); markers written only on COMPLETED (FR-006); no hardcoded colors; shadcn/ui only
**Scale/Scope**: ~11 source files modified + 1 new model/migration; tests extended in 6 files + 1 new integration file. Global across all projects (no per-project filter, FR-001)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. TypeScript-First (strict, explicit types, no `any`) | PASS | New predicate fns, Zod schemas, `ReportListEntry`/`PreflightSnapshot` types fully typed; no `any` introduced |
| II. Component-Driven (shadcn/ui, feature folders) | PASS | UI changes compose existing `Badge`/`Card` in `components/admin/insights/`; no new primitives |
| III. TDD (extend existing tests first) | PASS | research §Existing Files maps each change to an existing test file to extend; one new integration file justified (distinct per-session-coverage concern) |
| IV. Security-First (Zod, no secret leakage, structured errors) | PASS | P-6 Zod validation on new PATCH fields; marker-poisoning defense (P-4); raw-native widening documented within existing workflow-token trust boundary; `503/502` structured errors retained |
| V. Database Integrity (migrations, transactions, atomic guards) | PASS | New table via `prisma migrate`; marker write + status transition + job cascade in one `$transaction` (P-1); `@unique(jobId)` once-only (P-3); FK `onDelete: Cascade`; nullable new column with explicit null handling |
| V. Clarification Guardrails | PASS | Three documented CONSERVATIVE fallbacks in spec resolved by D-2/D-3/D-4; `Auto-Resolved Decisions` present in spec |

**Initial gate: PASS.** No violations → Complexity Tracking is empty.

**Post-design re-check: PASS.** The Phase 1 design adds exactly one entity
(`InsightsAnalyzedSession`) and one nullable column; it reuses every existing
concurrency/atomicity pattern rather than inventing new ones. No new project, no
new dependency, no `any`, no raw SQL beyond the standard migration DDL.

## Project Structure

### Documentation (this feature)

```
specs/AIB-856-copy-of-insights/
├── plan.md                                  # This file
├── research.md                              # Phase 0: decisions, existing files, patterns
├── data-model.md                            # Phase 1: schema deltas
├── contracts/
│   └── admin-api.md                         # Phase 1: API contract deltas
├── workflows/
│   └── insights-analyze-workflow.md         # Phase 1: workflow step deltas
├── checklists/
│   └── requirements.md                      # (existing) spec quality checklist
└── tasks.md                                 # Phase 2 (/ai-board.tasks — NOT created here)
```

### Source Code (repository root)

```
prisma/
├── schema.prisma                                          # + model InsightsAnalyzedSession; + InsightsReport.expectedSessionsCount; + back-relations
└── migrations/<ts>_insights_analyzed_session/migration.sql# NEW: table + unique(jobId) + index(reportId) + column

app/lib/insights/
├── predicate.ts                                           # REWRITE: eligible-session (marker-aware) queries, no dedup, no shipped join
├── repository.ts                                          # MODIFY: + expectedSessionsCount in serializer; marker-write helper; keep getLastCompletedRunEnd (display)
├── preflight.ts                                           # MODIFY: marker-based count; renamed refusal codes + field
└── reconcile.ts / output-validation.ts / blob-keys.ts     # REUSE as-is

app/api/admin/insights/
├── trigger/route.ts                                       # MODIFY: marker pre-flight; renamed refusals; periodStart from earliest eligible
├── jobs/route.ts                                          # MODIFY: marker-driven enumeration (all eligible-unanalyzed)
├── jobs/[jobId]/raw-native/route.ts                       # MODIFY: remove shipped-outcome gate (FR-007)
├── reports/[id]/status/route.ts                           # MODIFY: accept analyzedJobIds + expectedSessionsCount; mark sessions in-tx; derive counts
├── preflight/route.ts                                     # REUSE (delegates to preflight.ts)
└── reports/* (route.ts, [id], html, finalize)             # REUSE (serializer gains expectedSessionsCount)

components/admin/insights/
├── insights-report-view.tsx                               # MODIFY: analyzed-vs-expected phrasing, gap warning (FR-011), scope note (FR-008), header rewording
└── run-analysis-button.tsx                                # MODIFY: renamed refusal-code references

app/lib/hooks/queries/
├── use-insights-preflight.ts                              # MODIFY: renamed field + refusal-code enum
└── use-insights-reports.ts                                # MODIFY: type gains expectedSessionsCount

.github/workflows/
└── insights-analyze.yml                                   # MODIFY: marker-driven enumerate; 404-tolerant download; send analyzedJobIds + expectedSessionsCount
```

**Structure Decision**: Existing Next.js App Router web application. All work is
a brownfield edit of the established `app/lib/insights/`,
`app/api/admin/insights/`, `components/admin/insights/`, and the
`insights-analyze.yml` workflow. No new top-level directories.

## Implementation Phases

Ordered by dependency. Each phase references the concrete real paths above and
the patterns from research.md.

### Phase A — Schema & migration (foundation)
1. `prisma/schema.prisma`: add `model InsightsAnalyzedSession` (`jobId @unique`
   FK→Job Cascade, `reportId` FK→InsightsReport Cascade, `analyzedAt`,
   `@@index([reportId])`); add back-relations `Job.insightsAnalyzedSession?` and
   `InsightsReport.analyzedSessions[]`; add `InsightsReport.expectedSessionsCount Int?`.
2. Create migration `migrations/<ts>_insights_analyzed_session/migration.sql`
   (table + unique + index + nullable column). No backfill (D-6). Follow the
   existing partial-index migration as a DDL style reference.
3. `bunx prisma generate`.

### Phase B — Selection predicate (US1, US3) — depends on A
4. Rewrite `app/lib/insights/predicate.ts` per D-3/D-5/P-2:
   - One private `queryEligibleSessions(opts)` (COMPLETED + ticketId!=null +
     rawArtifactKey!=null + effective-agent CLAUDE; **no** TicketOutcome join;
     `unanalyzed?` toggles the `insightsAnalyzedSession: null` filter).
   - Export `countEligibleUnanalyzedSessions()`,
     `listEligibleUnanalyzedSessions()` (all jobs, **no dedup**, ascending
     `startedAt`), `getEarliestEligibleSessionTimestamp()`.
   - Keep `JobRef` shape. Update the file header doc.
5. Update importers: `repository.ts` re-export, `preflight.ts`, `trigger`,
   `jobs` route.

### Phase C — Coverage marking & counts (US2, US4) — depends on A, B
6. `reports/[id]/status/route.ts`: extend `StatusPatchSchema` (P-6) with
   `analyzedJobIds` + `expectedSessionsCount` (+ refinement); in
   `applyTerminalTransition`, on COMPLETED filter analyzedJobIds to eligible
   sessions (P-4), wrap guarded `updateMany` + `insightsAnalyzedSession.create
   Many({skipDuplicates})` + job cascade in one `$transaction` (P-1/P-3); derive
   `sessionsCount` from marked set; FAILED branch writes no markers. Keep blob
   re-validation + `503` path (P-4).
7. `jobs/route.ts`: switch to `listEligibleUnanalyzedSessions()`; make
   `periodStart/periodEnd` optional/ignored (D-5).
8. `jobs/[jobId]/raw-native/route.ts`: remove the shipped-outcome gate (D-8).

### Phase D — Trigger & pre-flight (US2, FR-012) — depends on B
9. `preflight.ts`: marker-based count; rename refusal codes
   (`NO_CLAUDE_SESSIONS`/`NO_NEW_SESSIONS`) and field
   (`eligibleSessionsSincePreviousRun`).
10. `trigger/route.ts`: marker pre-flight; renamed refusals; `periodStart =
    getEarliestEligibleSessionTimestamp() ?? now`. Preserve single-tx insert +
    dispatch-then-rollback + ALREADY_RUNNING (P-3/P-5) **unchanged**.

### Phase E — UI (US4, FR-008, FR-011) — depends on C, D
11. `repository.ts` `ReportListEntry`/`toListEntry` + both query hooks: add
    `expectedSessionsCount`.
12. `use-insights-preflight.ts`: renamed field + refusal-code enum.
13. `insights-report-view.tsx`: rewrite `formatMetadataPhrasing` to "Analyzed X
    of Y Claude Code sessions across Z tickets …"; render a gap warning Badge
    when `sessionsCount < expectedSessionsCount` (FR-011); add a static scope
    note ("all Claude sessions across all projects, regardless of ticket
    outcome", FR-008); reword the header counter.
14. `run-analysis-button.tsx`: update refusal-code references.

### Phase F — Workflow — depends on C
15. `.github/workflows/insights-analyze.yml` per
    [workflows/insights-analyze-workflow.md](./workflows/insights-analyze-workflow.md):
    marker-driven enumerate (`expected_count`); 404-tolerant per-job download
    collecting `analyzed_job_ids` (abort only if zero readable); counts step;
    COMPLETED PATCH sends `analyzedJobIds` + `expectedSessionsCount` +
    `ticketsCount`.

### Phase G — Verification
16. `bun run type-check` && `bun run lint` (fix all, including any pre-existing —
    CLAUDE.md commit rule). Run targeted test suites.

## Testing Strategy

Per Constitution §III (Testing Trophy; extend existing files first; assertions
never inside conditionals; mocks target the same import path). Map from
research §Existing Files:

| Test | File | Type | Covers |
|------|------|------|--------|
| All sessions per ticket, no dedup; non-shipped included; marker anti-join; ticketId-null excluded; rawArtifactKey gate | `tests/unit/lib/insights/predicate.test.ts` (rewrite) | Unit (Vitest) | US1, US3, FR-002/003/007/009 |
| Analyzed-vs-expected phrasing; gap warning when analyzed<expected; scope note | `tests/unit/components/admin/insights/insights-report-view.test.tsx` (extend) | Component (RTL) | US4, FR-008/010/011 |
| Renamed refusal codes/messages | `tests/unit/components/admin/insights/run-analysis-button.test.tsx` (extend) | Component (RTL) | FR-012 |
| Status PATCH marks sessions; derives sessionsCount; FAILED marks nothing; idempotent no-op | `tests/integration/admin/analysis-workflow.test.ts` (extend) | Integration | US2-AC1/AC3, FR-005/006 |
| Marker-based pre-flight + enumeration (all eligible-unanalyzed, all outcomes) | `tests/integration/admin/insights-api.test.ts` (extend) | Integration | FR-002/007/012 |
| effective-agent predicate under new eligibility | `tests/integration/api/admin/insights/effective-agent.test.ts` (verify/extend) | Integration | FR (agent gate) |
| count/list parity over eligible-session set | `tests/integration/outcomes/ship-transition-capture-resilience.test.ts` (modify) | Integration | P-2 no-drift |
| **No gap / no overlap across two runs; boundary session; pruned-transcript gap; expected vs analyzed** | `tests/integration/admin/insights-session-coverage.test.ts` (**NEW**) | Integration | US2-AC2, US4, SC-002/005/006, FR-009/011 |

E2E (`tests/e2e/admin/insights-flow.spec.ts`) extended **only** if the gap-badge
needs browser verification; default to the integration/component coverage above
(E2E is ~5s each; Constitution §III).

## Complexity Tracking

*No constitution violations — section intentionally empty.*
</content>
