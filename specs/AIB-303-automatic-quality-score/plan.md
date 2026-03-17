# Implementation Plan: Automatic Quality Score via Code Review

**Feature Branch**: `AIB-303-automatic-quality-score`
**Created**: 2026-03-17
**Status**: Ready for BUILD

## Technical Context

| Aspect | Detail |
|--------|--------|
| **Data layer** | Prisma 6.x, PostgreSQL 14+. Job model holds telemetry fields (nullable pattern). |
| **API layer** | Next.js App Router. `PATCH /api/jobs/:id/status` for workflow updates (Bearer token auth). `GET /api/projects/:id/tickets/:id/jobs` for telemetry fetch. |
| **UI layer** | React 18, TailwindCSS, shadcn/ui. Ticket cards (`ticket-card.tsx`), Stats tab (`ticket-stats.tsx`), Analytics dashboard (`analytics-dashboard.tsx`). |
| **Workflow layer** | `verify.yml` orchestrates tests, PR creation, code review. Code review command runs 5 parallel Sonnet agents. |
| **State management** | TanStack Query v5 with polling (2s jobs, 15s analytics). |
| **Charts** | Recharts 2.x for analytics. |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new types explicitly defined, no `any` |
| II. Component-Driven | PASS | New components use shadcn/ui, feature-based folders |
| III. Test-Driven | PASS | Testing strategy defined per user story below |
| IV. Security-First | PASS | Zod validation on API input, Bearer token auth unchanged |
| V. Database Integrity | PASS | Prisma migration, nullable fields, no raw SQL |
| V. Clarification Guardrails | PASS | Auto-resolved decisions documented in spec |
| VI. AI-First Development | PASS | No README/guide files created |

## Gate Evaluation

- **No new dependencies**: PASS (uses existing Recharts, Zod, Prisma, shadcn/ui)
- **No forbidden libs**: PASS
- **No hardcoded colors**: PASS (uses Tailwind semantic tokens with dark mode support)
- **Backwards compatible API**: PASS (new fields are optional)
- **Immutable scores**: PASS (no update/delete endpoints for quality scores)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    VERIFY WORKFLOW                        │
│                                                          │
│  Code Review Command                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ Agent #1  │ │ Agent #2  │ │ Agent #3  │ ...           │
│  │ Compliance│ │Bug Detect │ │ History   │               │
│  │ score: 80 │ │ score: 90 │ │ score: 85 │               │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘                │
│       └─────────────┼───────────┘                        │
│                     ▼                                    │
│           quality-score.json                             │
│                     │                                    │
│                     ▼                                    │
│  PATCH /api/jobs/:id/status                              │
│  { status: "COMPLETED", qualityScore: 83, details: ... } │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    DATABASE                               │
│  Job { qualityScore: 83, qualityScoreDetails: "{...}" }  │
└─────────────────────────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    Ticket Card   Stats Tab   Analytics
    [83] badge    Breakdown   Trend charts
```

## Implementation Phases

### Phase 1: Data Foundation (FR-001, FR-006)

**Files to modify**:
- `prisma/schema.prisma` — Add `qualityScore Int?` and `qualityScoreDetails String?` to Job
- `app/lib/job-update-validator.ts` — Extend Zod schema with optional quality score fields
- `app/api/jobs/[id]/status/route.ts` — Accept and persist quality score on COMPLETED transitions
- `lib/types/job-types.ts` — Extend `TicketJobWithTelemetry` interface
- `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` — Add fields to select clause

**New files**:
- `lib/quality-score.ts` — Shared utilities: `getScoreThreshold()`, `getScoreColor()`, `parseQualityScoreDetails()`, type definitions

**Tests**: Integration test for PATCH endpoint accepting quality score (extend `tests/integration/jobs/status.test.ts`)

### Phase 2: Ticket Card Badge (FR-008, FR-010)

**New files**:
- `components/ticket/quality-score-badge.tsx` — Small colored badge showing score with threshold color

**Files to modify**:
- `components/board/ticket-card.tsx` — Render `QualityScoreBadge` for tickets with quality score from latest COMPLETED verify job

**Tests**: Component test for `QualityScoreBadge` rendering all threshold colors and null/missing states

### Phase 3: Stats Tab Display (FR-009, FR-010)

**New files**:
- `components/ticket/quality-score-section.tsx` — Overall score, threshold label, dimension breakdown with weights

**Files to modify**:
- `components/ticket/ticket-stats.tsx` — Add `QualityScoreSection` above existing summary cards (conditional on score existence)

**Tests**: Component test for `QualityScoreSection` with dimension breakdown rendering

### Phase 4: Workflow Integration (FR-002, FR-003, FR-004, FR-005, FR-007)

**Files to modify**:
- `.claude-plugin/commands/ai-board.code-review.md` — Add scoring instructions to each of the 5 agents; add consolidation step writing `quality-score.json`
- `.github/workflows/verify.yml` — After code review step, read `quality-score.json` and include `qualityScore` + `qualityScoreDetails` in the COMPLETED status PATCH request; skip for QUICK/CLEAN workflows

**Tests**: Unit test for score computation logic (weighted sum, rounding, threshold derivation)

### Phase 5: Analytics Dashboard (FR-011, FR-012)

**New files**:
- `components/analytics/quality-score-trend-chart.tsx` — Recharts line chart for score trend over time
- `components/analytics/dimension-comparison-chart.tsx` — Recharts bar chart for per-dimension averages

**Files to modify**:
- `lib/analytics/types.ts` — Add `QualityScoreAnalytics`, `QualityScoreDataPoint`, `DimensionComparison` types
- `lib/analytics/queries.ts` — Add quality score aggregation queries
- `app/api/projects/[projectId]/analytics/route.ts` — Include quality score analytics in response
- `components/analytics/analytics-dashboard.tsx` — Add quality score charts section (Team plan gated)

**Tests**: Integration test for analytics endpoint returning quality score aggregations

## Testing Strategy

| User Story | Test Type | Location | What to Test |
|------------|-----------|----------|-------------|
| US-1: Card Badge | Component | `tests/unit/components/quality-score-badge.test.tsx` | All 4 threshold colors, null score, score boundaries (0, 49, 50, 69, 70, 89, 90, 100) |
| US-2: Stats Tab | Component | `tests/unit/components/quality-score-section.test.tsx` | Dimension breakdown, latest score selection from multiple verify jobs, null/missing state |
| US-3: Computation | Unit | `tests/unit/quality-score.test.ts` | Weighted sum formula, rounding (83.5→84), threshold derivation, boundary values |
| US-3: API Accept | Integration | `tests/integration/jobs/status.test.ts` | PATCH with qualityScore accepted on COMPLETED, rejected on RUNNING, null on QUICK workflow |
| US-4: Analytics | Integration | `tests/integration/analytics/quality-score.test.ts` | Score trend aggregation, dimension comparison, Team plan gating, empty state |

## Dependencies Between Phases

```
Phase 1 (Data) ──► Phase 2 (Card Badge)
     │          └─► Phase 3 (Stats Tab)
     │          └─► Phase 5 (Analytics)
     └──────────► Phase 4 (Workflow)
```

Phase 1 is prerequisite for all others. Phases 2, 3, 4, 5 can be parallelized after Phase 1.

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Code review agents produce inconsistent scores | Medium | Fixed scoring rubric in prompt; scores are advisory not blocking |
| `quality-score.json` not written (agent failure) | Low | Graceful handling: no file = no score = null fields |
| Analytics performance with JSON parsing | Low | Only parse `qualityScoreDetails` JSON for dimension comparison; `qualityScore` integer used for AVG aggregation |
| Score display for in-progress verify jobs | N/A | Score only stored on COMPLETED transition; no partial scores |

## Artifacts

| Artifact | Path |
|----------|------|
| Feature Spec | `specs/AIB-303-automatic-quality-score/spec.md` |
| Research | `specs/AIB-303-automatic-quality-score/research.md` |
| Data Model | `specs/AIB-303-automatic-quality-score/data-model.md` |
| Job Status Contract | `specs/AIB-303-automatic-quality-score/contracts/job-status-update.md` |
| Ticket Jobs Contract | `specs/AIB-303-automatic-quality-score/contracts/ticket-jobs-api.md` |
| Analytics Contract | `specs/AIB-303-automatic-quality-score/contracts/analytics-api.md` |
| Score Output Contract | `specs/AIB-303-automatic-quality-score/contracts/quality-score-output.md` |
| Quickstart | `specs/AIB-303-automatic-quality-score/quickstart.md` |
