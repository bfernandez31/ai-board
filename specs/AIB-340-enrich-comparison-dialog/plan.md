# Implementation Plan: Enrich Comparison Dialog with Operational Metrics and Quality Data

**Branch**: `AIB-340-enrich-comparison-dialog` | **Date**: 2026-03-24 | **Spec**: `specs/AIB-340-enrich-comparison-dialog/spec.md`
**Input**: Feature specification from `/specs/AIB-340-enrich-comparison-dialog/spec.md`

## Summary

Enrich the existing comparison dialog with an Operational Metrics section (tokens, cost, duration, job count, primary model, quality score) aggregated across all completed jobs per ticket, plus workflow/agent/quality badges on ranking cards and a quality score breakdown popover. Primary changes span the service layer (aggregation query), type extensions, and new/modified UI components.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, shadcn/ui, Radix UI, TanStack Query v5, Prisma 6.x
**Storage**: PostgreSQL 14+ via Prisma ORM (existing Job, ComparisonRecord, ComparisonParticipant models)
**Testing**: Vitest (unit + integration), Playwright (E2E — only if browser-required)
**Target Platform**: Web (desktop + mobile responsive)
**Project Type**: Web application (Next.js monolith)
**Performance Goals**: Comparison detail API response < 500ms, UI renders operational metrics without visible jank
**Constraints**: Max 6 compared tickets, horizontal scroll with sticky label column, WCAG AA 4.5:1 contrast
**Scale/Scope**: Extends existing comparison dialog — no new database tables, no new API routes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new types explicitly defined, no `any` usage |
| II. Component-Driven | PASS | Uses shadcn/ui Card, Badge, Popover; feature-scoped components in `components/comparison/` |
| III. Test-Driven | PASS | Integration tests for aggregation service; component tests for new UI sections |
| IV. Security-First | PASS | No new user input; read-only enrichment from existing authorized data |
| V. Database Integrity | PASS | No schema changes; read-only aggregation queries |
| V. Spec Clarification | PASS | AUTO → CONSERVATIVE decisions documented in spec |
| VI. AI-First | PASS | No documentation files; all artifacts in `specs/` |

**Gate Result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```
specs/AIB-340-enrich-comparison-dialog/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── comparison-detail-enriched.ts
└── tasks.md             # Phase 2 output (via /ai-board.tasks)
```

### Source Code (repository root)

```
lib/
├── types/
│   └── comparison.ts                    # Extended types (AggregatedTelemetry, QualityBreakdown)
├── comparison/
│   └── comparison-detail.ts             # Modified aggregation query + new helpers
└── quality-score.ts                     # Existing (read-only for this feature)

components/comparison/
├── comparison-viewer.tsx                # Modified: insert OperationalMetricsGrid between sections
├── comparison-ranking.tsx               # Modified: add workflow/agent/quality badges
├── comparison-operational-metrics.tsx   # NEW: Operational Metrics grid component
├── comparison-quality-popover.tsx       # NEW: Quality score breakdown popover
└── types.ts                             # Extended props interfaces

tests/
├── unit/components/
│   ├── comparison-operational-metrics.test.tsx  # Component test
│   └── comparison-quality-popover.test.tsx      # Component test
└── integration/comparisons/
    └── comparison-detail-aggregation.test.ts    # Aggregation service test
```

**Structure Decision**: Extends existing comparison feature folder. Two new components (OperationalMetricsGrid, QualityPopover) follow the established pattern of one-component-per-file in `components/comparison/`. No new API routes needed — the existing detail endpoint is modified to return enriched data.

## Implementation Design

### Layer 1: Service — Aggregated Telemetry Query

**File**: `lib/comparison/comparison-detail.ts`
**Change**: Replace single-job `distinct` query with grouped aggregation across all COMPLETED jobs per participant.

Current approach fetches latest job per ticket:
```typescript
prisma.job.findMany({ distinct: ['ticketId'], orderBy: [{ completedAt: 'desc' }] })
```

New approach aggregates across ALL completed jobs:
```typescript
// 1. Fetch all completed jobs for participant tickets
prisma.job.findMany({
  where: {
    ticketId: { in: participantIds },
    status: 'COMPLETED',
  },
  select: {
    ticketId: true,
    inputTokens: true,
    outputTokens: true,
    durationMs: true,
    costUsd: true,
    model: true,
  },
})
// 2. Group by ticketId, sum numeric fields, count jobs
// 3. Determine primary model per ticket (job with highest total tokens)
```

**New helper**: `aggregateJobTelemetry(jobs)` — groups by ticketId, sums tokens/cost/duration, counts jobs, identifies primary model.

**New enrichment function**: `normalizeAggregatedTelemetryEnrichment(aggregated)` — produces enrichment values including totalTokens, jobCount, primaryModel fields.

### Layer 2: Types — Extended Telemetry

**File**: `lib/types/comparison.ts`

New/extended interfaces:
- `ComparisonAggregatedTelemetry` — extends current telemetry with `totalTokens`, `jobCount`, `primaryModel`
- `ComparisonQualityBreakdown` — wraps `QualityScoreDetails` for display
- Updated `ComparisonParticipantDetail.telemetry` type to include new fields
- Updated `ComparisonTelemetryEnrichment` to add `totalTokens: ComparisonEnrichmentValue<number>`, `jobCount: ComparisonEnrichmentValue<number>`, `primaryModel: ComparisonEnrichmentValue<string>`

### Layer 3: UI — Operational Metrics Grid

**File**: `components/comparison/comparison-operational-metrics.tsx` (NEW)

- Table with sticky first column (metric labels) and scrollable ticket columns
- Rows: Total Tokens, Input Tokens, Output Tokens, Duration, Cost, Job Count, Quality Score
- Column headers: ticket key + workflow type + agent
- Best value badges (lowest for tokens/duration/cost/jobs, highest for quality)
- Pending/N/A states for unavailable data
- Quality score cell is clickable when breakdown available (triggers popover)

Formatting:
- Tokens: `toLocaleString()` (e.g., "12,345")
- Duration: human-readable (e.g., "2m 34s")
- Cost: currency format (e.g., "$1.23")
- Quality: "87 Good" with threshold label

### Layer 4: UI — Ranking Card Badges

**File**: `components/comparison/comparison-ranking.tsx` (MODIFIED)

Add badges to each participant card:
- Workflow type: `<Badge variant="outline">{workflowType}</Badge>` (FULL/QUICK/CLEAN)
- Agent: `<Badge variant="outline">{agent}</Badge>` (only when agent is non-null)
- Quality: `<Badge variant="secondary">{score} {label}</Badge>` (only when quality.state === 'available')

### Layer 5: UI — Quality Score Breakdown Popover

**File**: `components/comparison/comparison-quality-popover.tsx` (NEW)

- Uses shadcn/ui `Popover` + `PopoverTrigger` + `PopoverContent`
- Triggered by clicking quality score cell in Operational Metrics grid
- Content: 5 dimension rows with name, score, weight, progress bar (proportional to score/100)
- Overall score with threshold label at bottom
- Dimension data sourced from `qualityScoreDetails` JSON on the latest verify job
- Only rendered when quality breakdown is available (FULL workflow + VERIFY completed)

### Layer 6: UI — Section Ordering

**File**: `components/comparison/comparison-viewer.tsx` (MODIFIED)

Insert `<ComparisonOperationalMetrics>` between `<ComparisonMetricsGrid>` and `<ComparisonDecisionPoints>`:
```
Ranking → Implementation Metrics → Operational Metrics → Decision Points → Compliance Grid
```

### Layer 7: Responsive Scrolling (FR-014, FR-015)

The Operational Metrics grid uses:
- `overflow-x-auto` on the table container
- `sticky left-0` on the metric label column (`<td>` and `<th>`)
- `bg-card` on sticky cells to prevent content bleeding through
- Native horizontal scroll on mobile (no custom scroll handlers)

## Testing Strategy

| Test | Type | Location | Covers |
|------|------|----------|--------|
| Aggregation across completed jobs | Integration | `tests/integration/comparisons/comparison-detail-aggregation.test.ts` | FR-006, FR-007, FR-011, edge cases |
| Operational Metrics grid rendering | Component | `tests/unit/components/comparison-operational-metrics.test.tsx` | FR-004, FR-005, FR-008, FR-009, FR-010 |
| Quality popover rendering | Component | `tests/unit/components/comparison-quality-popover.test.tsx` | FR-012, FR-013 |
| Ranking card badges | Component | `tests/unit/components/comparison-ranking.test.tsx` | FR-001, FR-002, FR-003 |
| Best value highlighting | Component (within operational metrics test) | Same as grid | FR-007 |
| Horizontal scroll with sticky column | Visual (manual) | N/A | FR-014, FR-015 |

**Decision tree applied**:
- Aggregation query → Integration test (DB operation)
- React components → Component tests (RTL + mocked data)
- Horizontal scroll → Manual verification (viewport-dependent behavior)

## Complexity Tracking

*No constitution violations — table not applicable.*

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Aggregation query performance with many jobs | Use Prisma `groupBy` or single `findMany` + in-memory grouping (bounded by max 6 tickets × ~50 jobs each) |
| `qualityScoreDetails` JSON inconsistency | Defensive parsing with fallback to unavailable state |
| Sticky column z-index conflicts in dialog ScrollArea | Test with 6 participants; use explicit z-index on sticky cells |
| Tied best values visual clutter | Spec explicitly allows all ties to receive badge — no mitigation needed |
