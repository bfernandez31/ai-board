# Implementation Plan: Enrich Comparison Dialog with Operational Metrics and Quality Data

**Branch**: `AIB-344-enrich-comparison-dialog` | **Date**: 2026-03-24 | **Spec**: `specs/AIB-344-enrich-comparison-dialog/spec.md`
**Input**: Feature specification from `/specs/AIB-344-enrich-comparison-dialog/spec.md`

## Summary

Enrich the existing comparison dialog to display operational metrics (tokens, duration, cost, AI model, job count, quality score) in a new grid section positioned between Implementation Metrics and Decision Points. Additionally, enhance ranking cards with workflow type, agent, and quality score badges, and add a clickable quality score breakdown popover for FULL workflow tickets that passed VERIFY. The feature is read-only UI enrichment — no new data models or API endpoints are needed, only frontend components and minor backend query changes.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, shadcn/ui, TanStack Query v5
**Storage**: PostgreSQL 14+ via Prisma 6.x (existing Job telemetry fields: `inputTokens`, `outputTokens`, `costUsd`, `durationMs`, `model`, `qualityScore`, `qualityScoreDetails`)
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web (desktop + mobile responsive)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Quality breakdown popover renders within 1 second of click (SC-004)
**Constraints**: Max 6 compared tickets with horizontal scroll; WCAG AA 4.5:1 contrast; no hardcoded colors
**Scale/Scope**: Read-only enrichment of existing dialog — no new DB tables, no new API routes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new types will have explicit annotations; extends existing `ComparisonEnrichmentValue<T>` pattern |
| II. Component-Driven Architecture | PASS | New components follow `components/comparison/` feature folder; uses shadcn/ui exclusively (Card, Badge, Popover, Progress) |
| III. Test-Driven Development | PASS | Component tests for new UI elements; integration tests for aggregated telemetry query; no E2E needed (no browser-required features) |
| IV. Security-First | PASS | Read-only feature; no user input to validate; data fetched via existing authenticated API routes |
| V. Database Integrity | PASS | No schema changes; read-only queries on existing fields |
| V. Specification Clarification Guardrails | PASS | Auto-resolved decisions documented in spec with trade-offs |
| VI. AI-First Development | PASS | No README/GUIDE files; all artifacts in `specs/AIB-344-enrich-comparison-dialog/` |

**Gate result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-344-enrich-comparison-dialog/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-changes.md   # Backend query changes (no new endpoints)
└── tasks.md             # Phase 2 output (created by /ai-board.tasks)
```

### Source Code (repository root)

```
components/comparison/
├── comparison-viewer.tsx                # MODIFY: Insert OperationalMetricsGrid between MetricsGrid and DecisionPoints
├── comparison-ranking.tsx               # MODIFY: Add workflow type, agent, and quality score badges
├── comparison-metrics-grid.tsx          # EXISTING: No changes
├── comparison-operational-metrics.tsx   # NEW: Operational metrics grid with 7 rows
├── comparison-quality-popover.tsx       # NEW: Quality score breakdown popover
├── types.ts                             # MODIFY: Add new component prop interfaces

lib/comparison/
├── comparison-detail.ts                 # MODIFY: Aggregate telemetry across ALL completed jobs (not just latest)
├── comparison-record.ts                 # EXISTING: Enrichment factory functions already exist
├── telemetry-extractor.ts              # EXISTING: aggregateJobTelemetry already aggregates correctly
├── format-duration.ts                   # EXISTING: formatDurationMs already exists
├── operational-metrics.ts               # NEW: Best-value calculation and formatting for 7 metric rows

lib/quality-score.ts                     # EXISTING: getScoreThreshold, getScoreColor, parseQualityScoreDetails

tests/unit/components/
├── comparison-operational-metrics.test.tsx  # NEW: Component tests for operational metrics grid
├── comparison-quality-popover.test.tsx      # NEW: Component tests for quality breakdown popover
├── comparison-ranking-badges.test.tsx       # NEW: Component tests for ranking card badges

tests/unit/
├── operational-metrics.test.ts              # NEW: Unit tests for best-value calculation logic

tests/integration/
├── comparison-detail-telemetry.test.ts      # NEW: Integration test for aggregated telemetry query
```

**Structure Decision**: Follows existing `components/comparison/` feature folder pattern. New components are co-located with existing ones. Library logic in `lib/comparison/`. Tests follow Testing Trophy: unit for pure functions, component for React rendering, integration for DB query changes.

## Complexity Tracking

*No constitution violations — no entries needed.*

## Implementation Approach

### Phase 1: Backend Query Changes (comparison-detail.ts)

The current `getComparisonDetailForTicket` fetches only the **latest job** per ticket for telemetry. FR-007 requires aggregation across **all completed jobs**. Changes:

1. Replace the single-latest-job query with `aggregateJobTelemetry()` (already exists in `telemetry-extractor.ts`)
2. Fetch `qualityScoreDetails` JSON alongside `qualityScore` from the latest VERIFY job
3. Include `jobCount` in the participant detail response

The `ComparisonParticipantDetail` type already has `telemetry: ComparisonTelemetryEnrichment` and `quality: ComparisonEnrichmentValue<number>`. These need to be extended to carry aggregated totals and quality breakdown data.

### Phase 2: New Types and Utilities

**New types** (in `lib/types/comparison.ts`):
- `OperationalMetricRow`: metric key, label, values per participant, best-value flags, formatting
- `ComparisonQualityBreakdown`: 5-dimension breakdown with scores, weights, progress bars
- Extend `ComparisonParticipantDetail` with `totalTokens`, `jobCount`, `qualityDetails`

**New utility** (`lib/comparison/operational-metrics.ts`):
- `buildOperationalMetricRows(participants)`: Computes 7 rows with best-value highlighting
- Best-value logic: lowest wins for tokens/duration/cost/job count; highest wins for quality
- Tie handling: all tied participants get "best" flag (FR-009)
- Formatting: tokens with locale separators, cost as `$X.XX`, duration via `formatDurationMs`

### Phase 3: Ranking Card Badges (comparison-ranking.tsx)

Add three badges per ranking card:
1. **Workflow type badge** — always visible, uses `participant.workflowType` (already in data model)
2. **Agent badge** — shown when `participant.agent` is non-null
3. **Quality score badge** — shown when `participant.quality.state === 'available'`, displays score + threshold label using `getScoreThreshold()`

### Phase 4: Operational Metrics Grid (new component)

New `ComparisonOperationalMetricsGrid` component:
- Card with "Operational Metrics" header
- 7 rows: Total Tokens, Input Tokens, Output Tokens, Duration, Cost, Job Count, Quality Score
- Column headers: ticket key, workflow type, agent
- Fixed left column (metric labels) with horizontally scrollable data columns
- States: value (formatted), "Pending" (spinner), "N/A" (grey)
- "Best" badge on best-value cells
- Mobile-friendly: CSS `overflow-x-auto` with `position: sticky` on label column

### Phase 5: Quality Breakdown Popover (new component)

New `ComparisonQualityPopover` component (using shadcn Popover):
- Trigger: clickable quality score cell in operational metrics grid
- Only enabled for FULL workflow tickets with quality details
- Content: 5 dimension rows with name, score, visual progress bar (`Progress` component), weight
- Footer: overall score with threshold label and color
- Closes on outside click (default Popover behavior)

### Phase 6: Dialog Section Ordering (comparison-viewer.tsx)

Update section order to: Ranking → Implementation Metrics → **Operational Metrics** → Decision Points → Compliance Grid (FR-016).

## Testing Strategy

| Test | Type | Location | Rationale |
|------|------|----------|-----------|
| Best-value calculation with ties | Unit | `tests/unit/operational-metrics.test.ts` | Pure function, no dependencies |
| Metric formatting (tokens, cost, duration) | Unit | `tests/unit/operational-metrics.test.ts` | Pure function, reuses existing formatters |
| Operational metrics grid renders 7 rows | Component | `tests/unit/components/comparison-operational-metrics.test.tsx` | React component with mock data |
| Grid shows N/A for missing telemetry | Component | `tests/unit/components/comparison-operational-metrics.test.tsx` | Edge case rendering |
| Grid shows Pending for in-progress jobs | Component | `tests/unit/components/comparison-operational-metrics.test.tsx` | Edge case rendering |
| Ranking card shows workflow/agent/quality badges | Component | `tests/unit/components/comparison-ranking-badges.test.tsx` | Extends existing component |
| Quality popover shows 5 dimensions | Component | `tests/unit/components/comparison-quality-popover.test.tsx` | Popover interaction |
| Quality popover disabled for non-FULL tickets | Component | `tests/unit/components/comparison-quality-popover.test.tsx` | Conditional rendering |
| Aggregated telemetry across all completed jobs | Integration | `tests/integration/comparison-detail-telemetry.test.ts` | DB query change (FR-007) |
| Horizontal scroll with 6 participants | Component | `tests/unit/components/comparison-operational-metrics.test.tsx` | CSS layout verification |

**No E2E tests needed**: All features are testable via component tests (no OAuth, drag-drop, or viewport-specific browser behavior required).

## Post-Design Constitution Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new types explicitly typed; extends `ComparisonEnrichmentValue<T>` generic pattern |
| II. Component-Driven Architecture | PASS | shadcn/ui Popover, Badge, Card, Progress; feature folder maintained |
| III. Test-Driven Development | PASS | 10 test cases across unit/component/integration layers; no E2E (correct per decision tree) |
| IV. Security-First | PASS | No new user inputs; read-only display of existing data |
| V. Database Integrity | PASS | No schema changes; query changes use existing Prisma parameterized queries |
| VI. AI-First Development | PASS | No documentation files outside specs/ |

**Gate result**: ALL PASS — design is constitution-compliant.
