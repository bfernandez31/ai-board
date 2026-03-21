# Implementation Plan: AIB-333 Enrich Comparison Dialog

**Branch**: `AIB-333-enrich-comparison-dialog`
**Created**: 2026-03-21
**Status**: Ready for BUILD

## Technical Context

| Aspect | Details |
|--------|---------|
| Feature type | UI enrichment + backend query extension |
| Schema changes | None — all telemetry fields exist on Job model |
| New endpoints | None — extends existing GET comparison detail |
| New components | 2 (ComparisonOperationalMetrics, ComparisonQualityPopover) |
| Modified components | 2 (ComparisonRanking, ComparisonViewer) |
| Modified backend | 3 files (types, comparison-detail, comparison-record) |
| Dependencies | shadcn/ui (Badge, Popover, Table) — already available |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new types explicitly defined, no `any` |
| II. Component-Driven | PASS | Uses shadcn/ui primitives (Badge, Popover, Card, Table); feature-based folder structure |
| III. Test-Driven | PASS | Integration tests for API enrichment; component tests for new UI |
| IV. Security-First | PASS | No new user input paths; uses existing auth middleware |
| V. Database Integrity | PASS | No schema changes; read-only queries |
| VI. AI-First | PASS | No documentation files created outside specs/ |

## Architecture Decisions

### AD-1: Aggregated Telemetry via Prisma groupBy
Replace the current `distinct: ['ticketId']` single-job query with `prisma.job.groupBy()` to sum tokens, cost, and duration across ALL completed jobs per ticket. See `research.md#R1`.

### AD-2: Client-Side Best-Value Computation
Compute best-value flags for operational metrics client-side (not stored), since telemetry data is enriched at query time and may change between views. See `research.md#R6`.

### AD-3: Quality Details in Existing Response
Include `qualityScoreDetails` JSON in the existing comparison detail response rather than requiring a separate API call. Minimal payload increase (~500 bytes per participant). See `research.md#R4`.

### AD-4: CSS Sticky Column (No JS)
Use native CSS `position: sticky` for the metric labels column in the operational grid. See `research.md#R5`.

---

## Implementation Tasks

### Task 1: Extend TypeScript Types
**Priority**: P0 (dependency for all other tasks)
**Files**: `lib/types/comparison.ts`

1. Add `totalTokens: ComparisonEnrichmentValue<number>` to `ComparisonTelemetryEnrichment`
2. Add `jobCount: ComparisonEnrichmentValue<number>` to `ComparisonTelemetryEnrichment`
3. Add `hasPartialData: boolean` to `ComparisonTelemetryEnrichment`
4. Add `qualityScoreDetails: QualityScoreDetails | null` to `ComparisonParticipantDetail`
5. Add `model: string | null` to `ComparisonParticipantDetail`
6. Import `QualityScoreDetails` from `lib/quality-score`

### Task 2: Update Backend Enrichment Queries
**Priority**: P0 (dependency for UI tasks)
**Files**: `lib/comparison/comparison-detail.ts`, `lib/comparison/comparison-record.ts`

1. Replace `prisma.job.findMany({ distinct: ['ticketId'] })` with `prisma.job.groupBy()` aggregation:
   - Group by `ticketId` where `status: 'COMPLETED'`
   - Sum: `inputTokens`, `outputTokens`, `durationMs`, `costUsd`
   - Count: `_count: { id: true }`
2. Add primary model resolution query:
   - Group by `[ticketId, model]` where `model` is not null
   - Order by count desc to get most-used model per ticket
3. Add `qualityScoreDetails` to verify job select clause
4. Add check for in-progress jobs per ticket (for `hasPartialData` flag)
5. Update `normalizeTelemetryEnrichment()` to:
   - Accept aggregated data instead of single job
   - Compute `totalTokens` = `inputTokens` + `outputTokens`
   - Set `jobCount` from `_count`
   - Set `hasPartialData` based on in-progress job check
6. Update `normalizeParticipantDetail()` to include `model` and `qualityScoreDetails`

### Task 3: Add Ranking Card Badges
**Priority**: P1 (User Story 1)
**Files**: `components/comparison/comparison-ranking.tsx`

1. Add workflow type badge (FULL/QUICK/CLEAN) to each participant card
   - Use `Badge` with `variant="outline"`
   - Color-code: FULL=default, QUICK=secondary, CLEAN=secondary
2. Add agent badge when `agent` is not null
   - Use `Badge` with `variant="secondary"`
3. Add quality score badge when `quality.state === 'available'`
   - Show numeric score + threshold label (e.g., "87 Good")
   - Use color from `getScoreColor()` utility
   - Render null when quality unavailable (graceful absence per spec)

### Task 4: Create Operational Metrics Grid Component
**Priority**: P1 (User Story 2 — core feature)
**Files**: `components/comparison/comparison-operational-metrics.tsx` (NEW), `components/comparison/types.ts`

1. Create `ComparisonOperationalMetrics` component accepting `participants: ComparisonParticipantDetail[]`
2. Render a `Card` with `CardHeader` ("Operational Metrics") and `CardContent`
3. Build table structure:
   - First column: metric labels (sticky left)
   - One column per participant: ticket key + workflow badge + agent + model as header
   - 7 metric rows: Total tokens, Input tokens, Output tokens, Duration, Cost, Job count, Quality
4. Format values:
   - Tokens: `Intl.NumberFormat` with compact notation (e.g., "1.2M")
   - Duration: convert ms to human-readable (e.g., "2m 34s")
   - Cost: `$X.XX` format
   - Quality: numeric score with threshold label
5. Handle enrichment states:
   - `available`: show formatted value
   - `pending`: show "Pending" text with muted styling
   - `unavailable`: show "N/A" with muted styling
6. Compute and apply best-value highlighting:
   - Compare across all participants per row
   - Lowest wins: tokens, cost, duration, job count
   - Highest wins: quality
   - Highlight with a "Best" badge or accent border
   - Ties: highlight all tied values
7. Implement horizontal scroll:
   - Wrap table in `div` with `overflow-x-auto`
   - Apply `sticky left-0 z-10 bg-card` to label column cells
   - Ensure readable layout for 2-6 participants

### Task 5: Create Quality Score Popover Component
**Priority**: P2 (User Story 3)
**Files**: `components/comparison/comparison-quality-popover.tsx` (NEW)

1. Create `ComparisonQualityPopover` component accepting:
   - `score: number`
   - `details: QualityScoreDetails | null`
   - `workflowType: WorkflowType`
2. Render trigger element: clickable quality score value
3. Only enable popover for FULL workflow with available details
4. Popover content:
   - Overall score with threshold label and color
   - 5 dimension rows, each with:
     - Dimension name
     - Score value
     - Progress bar (colored by score threshold)
     - Weight percentage
   - Reuse `getScoreColor()` and `getScoreThreshold()` from `lib/quality-score`
5. Close on outside click and Escape (shadcn Popover default behavior)

### Task 6: Update Section Ordering in Viewer
**Priority**: P3 (User Story 5)
**Files**: `components/comparison/comparison-viewer.tsx`

1. Import `ComparisonOperationalMetrics`
2. Insert between `ComparisonMetricsGrid` and `ComparisonDecisionPoints`
3. Final order: Ranking → Implementation Metrics → Operational Metrics → Decision Points → Compliance Grid

### Task 7: Integration in Operational Metrics Grid
**Priority**: P1
**Files**: `components/comparison/comparison-operational-metrics.tsx`

1. Wire `ComparisonQualityPopover` into the quality row of the operational metrics grid
2. Quality cell renders as clickable (with popover) for FULL workflow tickets, plain text otherwise

---

## Testing Strategy

### Integration Tests (API layer)
**File**: `tests/integration/comparisons/comparison-detail-route.test.ts` (extend existing)

| Test | Type | What it validates |
|------|------|-------------------|
| Returns aggregated telemetry across multiple jobs | Integration | FR-005: Token/cost/duration summed across all jobs |
| Returns totalTokens as computed sum | Integration | FR-004: Total tokens row in grid |
| Returns jobCount per participant | Integration | FR-004: Job count row |
| Returns primary model per participant | Integration | FR-009: Model in column header |
| Returns qualityScoreDetails for FULL+VERIFY tickets | Integration | FR-010: Popover data availability |
| Returns null qualityScoreDetails for QUICK tickets | Integration | FR-011: Popover only for FULL |
| Marks hasPartialData when jobs in progress | Integration | Edge case: mixed job states |
| Returns unavailable telemetry when no jobs | Integration | FR-008: N/A handling |

### Component Tests (UI layer)
**File**: `tests/unit/components/comparison-operational-metrics.test.tsx` (NEW)

| Test | Type | What it validates |
|------|------|-------------------|
| Renders 7 metric rows with correct labels | Component | FR-004: All metric rows present |
| Displays formatted token values | Component | Value formatting |
| Highlights best value per row | Component | FR-006: Best-value visual indicator |
| Shows "Pending" for pending telemetry | Component | FR-007: Pending state |
| Shows "N/A" for unavailable telemetry | Component | FR-008: N/A state |
| Renders column headers with ticket key + badges | Component | FR-015: Column headers |
| Handles 6 participants without truncation | Component | FR-013: Scalability |

**File**: `tests/unit/components/comparison-ranking-badges.test.tsx` (NEW)

| Test | Type | What it validates |
|------|------|-------------------|
| Renders workflow type badge on each card | Component | FR-001 |
| Renders agent badge when agent is present | Component | FR-002 |
| Does not render agent badge when agent is null | Component | FR-002 (graceful absence) |
| Renders quality badge with score and threshold | Component | FR-003 |
| Does not render quality badge when unavailable | Component | FR-003 (graceful absence) |

**File**: `tests/unit/components/comparison-quality-popover.test.tsx` (NEW)

| Test | Type | What it validates |
|------|------|-------------------|
| Opens popover on click showing 5 dimensions | Component | FR-010 |
| Shows dimension name, score, weight, progress bar | Component | FR-010 detail |
| Shows overall score with threshold label | Component | FR-010 summary |
| Not clickable for non-FULL workflow tickets | Component | FR-011 |
| Closes on Escape key | Component | Acceptance scenario 5 |

### Test Decision Rationale
- **No E2E tests**: All features are testable via integration + component tests. No browser-specific behavior (no OAuth, drag-drop, viewport-dependent logic beyond CSS).
- **Integration over unit**: API enrichment changes involve Prisma queries → integration tests provide highest confidence.
- **Component over E2E**: UI rendering with mocked data validates correctness without browser overhead.

---

## Artifacts Generated

| Artifact | Path |
|----------|------|
| Research | `specs/AIB-333-enrich-comparison-dialog/research.md` |
| Data Model | `specs/AIB-333-enrich-comparison-dialog/data-model.md` |
| API Contract | `specs/AIB-333-enrich-comparison-dialog/contracts/comparison-detail-enrichment.yaml` |
| Quickstart | `specs/AIB-333-enrich-comparison-dialog/quickstart.md` |
| Plan | `specs/AIB-333-enrich-comparison-dialog/plan.md` |

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| `groupBy` query performance with many jobs | Jobs per ticket are bounded (~5-10); index on `ticketId` + `status` exists |
| Breaking existing comparison detail consumers | Type extensions are additive only — no field removals or renames |
| Quality popover for tickets without details JSON | Graceful null handling — popover disabled when `qualityScoreDetails` is null |
| Horizontal scroll on mobile | Native `overflow-x-auto` with sticky column; tested in component tests |
