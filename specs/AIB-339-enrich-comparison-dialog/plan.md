# Implementation Plan: Enrich comparison dialog with operational metrics and quality data

**Branch**: `AIB-339-enrich-comparison-dialog` | **Date**: 2026-03-24 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-339-enrich-comparison-dialog/spec.md`
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-339-enrich-comparison-dialog/spec.md`

## Summary

Expand the existing saved-comparison dialog so the current comparison detail endpoint returns aggregated operational telemetry and inline quality-breakdown metadata for each participant, then add a new Operational Metrics section and richer ranking cards in the dialog UI. The feature stays read-time only: implementation metrics and compliance remain persisted in comparison tables, while tokens, duration, cost, model, job count, and quality-breakdown eligibility are derived from related `Job` rows when the dialog is opened.

**Technical Approach**:
1. Extend the comparison detail read model to aggregate all related jobs per compared ticket, compute primary model and best-value flags, and distinguish `available`, `pending`, and `unavailable` states per metric.
2. Expand `ComparisonDetail` / `ComparisonParticipantDetail` types to carry ranking-card metadata, operational rows, and inline quality-breakdown payloads without changing the route path.
3. Add a dedicated operational metrics component after the existing implementation metrics section, with horizontal scrolling and a sticky metric-label column for 2-6 compared tickets.
4. Reuse `lib/quality-score.ts` dimension config and parsing helpers, but enforce a stricter comparison-dialog eligibility rule: FULL workflow, completed verify result, and all five configured dimensions present.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 App Router, React 18, Prisma 6.x, TanStack Query v5, Zod, shadcn/ui, lucide-react  
**Storage**: PostgreSQL 14+ via Prisma; existing `ComparisonRecord*` tables for persisted comparison snapshots plus live `Job` telemetry / quality data for read-time enrichment  
**Testing**: Vitest unit tests for aggregation and quality-eligibility helpers, Vitest component tests for ranking/operational grid UI, Vitest integration tests for comparison detail API behavior; no new Playwright coverage required  
**Target Platform**: Next.js web app comparison dialog on desktop and mobile browsers  
**Project Type**: Next.js monolith with App Router API routes and client-side comparison dialog  
**Performance Goals**: Comparison detail response remains under 1 s for 2-6 participants with typical ticket job counts; client render stays readable without layout collapse at six columns; mobile horizontal scrolling remains native and smooth  
**Constraints**: No schema migration unless repo inspection proves persisted operational snapshots are required; no dynamic Tailwind classes; metric-label column must remain visible while ticket columns scroll; `Pending` and `N/A` must be distinct states; existing section order and comparison history behavior must remain intact  
**Scale/Scope**: One existing detail endpoint response expansion, 5-7 comparison UI files touched, one new operational grid component, targeted comparison tests, and no workflow changes  
**NEEDS CLARIFICATION**: None after Phase 0 research

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | Plan expands typed comparison contracts and helper outputs in strict TypeScript with explicit enrichment shapes and no `any`. |
| II. Component-Driven Architecture | PASS | Changes stay within `components/comparison/`, `lib/comparison/`, `lib/types/`, and the existing ticket-scoped comparison route. |
| III. Test-Driven Development | PASS | Pure aggregation logic maps to unit tests, UI interactions map to component tests, and API/data behavior maps to integration tests. |
| IV. Security-First Design | PASS | Existing session/PAT ticket access checks remain unchanged; route shape expands read data only and keeps Zod param validation. |
| V. Database Integrity | PASS | Design is read-time enrichment against existing Prisma models, with no raw SQL and no schema mutation required. |
| VI. AI-First Development Model | PASS | All generated design artifacts remain in `specs/AIB-339-enrich-comparison-dialog/`; no root docs are introduced. |

**Initial Gate Status**: PASS

## Project Structure

### Documentation

```text
/home/runner/work/ai-board/ai-board/target/specs/AIB-339-enrich-comparison-dialog/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── comparison-detail.openapi.yaml
```

### Planned Source Changes

```text
/home/runner/work/ai-board/ai-board/target/components/comparison/
├── comparison-viewer.tsx                    # preserve section order, insert operational metrics section
├── comparison-ranking.tsx                   # richer ticket metadata and quality summary in ranking cards
├── comparison-metrics-grid.tsx              # existing implementation metrics grid retained or lightly aligned
└── comparison-operational-metrics-grid.tsx  # NEW operational metrics table with sticky label column

/home/runner/work/ai-board/ai-board/target/lib/comparison/
├── comparison-detail.ts                     # aggregate jobs, derive states, primary model, quality breakdown eligibility
└── comparison-record.ts                     # normalize richer participant enrichment into API detail shape

/home/runner/work/ai-board/ai-board/target/lib/types/
└── comparison.ts                            # expanded comparison detail contracts for operational metrics and quality details

/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/[comparisonId]/
└── route.ts                                 # same GET endpoint, response shape expanded

/home/runner/work/ai-board/ai-board/target/tests/
├── unit/comparison/                         # aggregation / primary-model / eligibility helpers
├── unit/components/                         # ranking and operational metrics component tests
└── integration/comparisons/                 # expanded comparison detail route coverage
```

**Structure Decision**: Keep the feature on the existing comparison-detail read path so [`/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-detail.ts`](/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-detail.ts) remains the single server seam for enrichment, add the new presentation surface under [`/home/runner/work/ai-board/ai-board/target/components/comparison/`](/home/runner/work/ai-board/ai-board/target/components/comparison/), and avoid new persistence layers because operational telemetry already lives on [`/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`](/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma).

## Complexity Tracking

| Design Decision | Justification | Alternative Considered |
|-----------------|---------------|------------------------|
| Keep operational metrics as read-time enrichment instead of persisting snapshots | Current comparison records intentionally snapshot implementation/compliance data only, while `Job` already holds telemetry and quality details needed for the dialog | Adding new comparison snapshot tables/columns rejected because it increases schema surface for data that can be derived cheaply at read time |
| Add a dedicated operational metrics component instead of overloading `comparison-metrics-grid.tsx` | The new table needs different rows, sticky-label behavior, pending/N/A states, and an inline quality interaction that would make the existing implementation grid harder to reason about | A single mixed grid rejected because it couples unrelated metric families and complicates responsive behavior |
| Expand the existing GET detail route rather than introducing a new endpoint | The dialog already fetches one detail payload per comparison selection, so extending that resource keeps caching and authorization simple | Separate operational-metrics endpoint rejected because it adds client orchestration and doubles failure states for one dialog |

## Phase 0: Outline & Research

Phase 0 resolved the initial unknowns from repo inspection and targeted research:

1. **Read-model seam**
   - Decision: Implement all operational aggregation in `lib/comparison/comparison-detail.ts` and keep `GET /api/projects/{projectId}/tickets/{ticketId}/comparisons/{comparisonId}` as the single dialog data source.
   - Rationale: The current endpoint already enriches participants at read time, and comparison tables do not persist operational snapshots.
   - Alternatives considered: New endpoint rejected because it would fragment one dialog into multiple data dependencies.

2. **Telemetry aggregation rule**
   - Decision: Aggregate telemetry across all jobs for each comparison participant, derive `Pending` when at least one relevant job exists but a required metric is still null or non-terminal, and derive `N/A` when no applicable job data exists.
   - Rationale: This matches FR-007, FR-012, and FR-013 while preserving trust in incomplete data.
   - Alternatives considered: Using only the latest job rejected because current code already does that and the spec explicitly requires all jobs.

3. **Primary model summary**
   - Decision: Choose the model with the largest share of total token consumption across included jobs, breaking ties by most recent completed contributing job.
   - Rationale: This follows the spec’s conservative rule and can be derived from existing `Job.model`, `inputTokens`, and `outputTokens` fields.
   - Alternatives considered: Latest-job model rejected because it can misrepresent mixed-model tickets.

4. **Quality-breakdown eligibility**
   - Decision: Offer inline quality breakdown only when the participant is `FULL`, has a completed verify job with `qualityScore`, and `qualityScoreDetails` parses into all five configured dimensions from `DIMENSION_CONFIG`.
   - Rationale: Existing ticket UI is more permissive, but the spec for comparison explicitly requires a complete five-dimension result.
   - Alternatives considered: Reusing the ticket page’s looser `dimensions.length > 0` rule rejected because it would expose incomplete breakdowns.

5. **Responsive table behavior**
   - Decision: Add a new operational metrics table with `overflow-x-auto`, `min-w-max`, and a sticky first column for metric labels.
   - Rationale: Existing comparison tables already use horizontal overflow, but no repo pattern provides the required sticky label column, so this becomes a localized new UI pattern.
   - Alternatives considered: Converting to stacked cards rejected because it weakens side-by-side comparison for up to six tickets.

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-339-enrich-comparison-dialog/research.md`

## Phase 1: Design & Contracts

### Data Model

Phase 1 keeps durable comparison storage unchanged and expands the read model:

- **ComparisonParticipantOperationalMetrics**: per-ticket aggregate of total tokens, input tokens, output tokens, duration, cost, job count, primary model, and per-metric state.
- **ComparisonQualitySummary**: per-ticket quality score, threshold label, best-value flag, and eligibility for detail interaction.
- **ComparisonQualityBreakdown**: the five configured dimensions with score and weight, present only when the participant is eligible.
- **ComparisonOperationalMetricRow**: UI/API row contract carrying a metric key, label, comparison direction, and best-value flags by participant.

Durable tables remain:
- `ComparisonRecord`
- `ComparisonParticipant`
- `TicketMetricSnapshot`
- `DecisionPointEvaluation`
- `ComplianceAssessment`

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-339-enrich-comparison-dialog/data-model.md`

### API Contracts

Phase 1 updates one existing read contract:

- `GET /api/projects/{projectId}/tickets/{ticketId}/comparisons/{comparisonId}`

The expanded response includes:
- richer participant header metadata for ranking cards and operational columns
- aggregated operational metrics with `available` / `pending` / `unavailable` states
- primary AI model summary
- quality threshold label and detail eligibility
- inline quality-breakdown payload when eligible

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-339-enrich-comparison-dialog/contracts/comparison-detail.openapi.yaml`

### Quickstart / Implementation Guide

Quickstart captures the implementation order, expected payload additions, and manual verification flow for desktop/mobile comparison scenarios.

**Output**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-339-enrich-comparison-dialog/quickstart.md`

## Testing Strategy

Search existing comparison and quality-score tests first and extend them rather than duplicating fixtures.

### User Story 1

- **Unit tests**: aggregation helpers compute total tokens, duration, cost, job count, best-value flags, and primary-model tie-breaking correctly.
- **Component tests**: ranking cards display workflow type, optional agent, quality score, and threshold label; operational grid renders all required rows and marks best values.
- **Integration tests**: comparison detail route returns aggregated operational metrics for multiple participants without regressing existing implementation metrics, decision points, or compliance rows.

### User Story 2

- **Unit tests**: quality-breakdown eligibility helper accepts only FULL-workflow completed verify results with all five configured dimensions.
- **Component tests**: eligible quality cells open an inline detail view showing overall score, threshold label, and five weighted dimensions; ineligible cells render without the interaction.
- **Integration tests**: comparison detail route returns breakdown payloads only for eligible participants and preserves `Pending` / `N/A` distinctions for other tickets.

### User Story 3

- **Component tests**: operational metrics section preserves the metric-label column and exposes horizontal overflow wrappers when six participants are rendered.
- **Integration tests**: detail payload supports 2-6 participants and includes enough header metadata for the client to render scrollable columns consistently.
- **Browser/E2E**: not required by default because the responsive work is a table/dialog layout evolution, not a browser-only capability; add only if component coverage cannot validate the sticky-column contract.

### Test Layer Decisions

- Pure aggregation, formatting, and eligibility helpers: `tests/unit/comparison/`
- React section and dialog rendering behavior: `tests/unit/components/`
- API route and Prisma-backed comparison enrichment: `tests/integration/comparisons/`
- Default fallback when uncertain: integration tests, per constitution and project guidance

## Post-Design Constitution Re-Evaluation

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | Expanded response contracts and helper outputs remain explicit and typed end to end. |
| II. Component-Driven Architecture | PASS | New UI is contained in `components/comparison/` and reuses existing dialog/query structure. |
| III. Test-Driven Development | PASS | Each user story maps cleanly to unit, component, and integration coverage without unnecessary E2E expansion. |
| IV. Security-First Design | PASS | No new write surface is introduced; existing access control and validation remain in place for the comparison route. |
| V. Database Integrity | PASS | No schema changes are required; Prisma read queries and existing persisted comparison tables remain the source of truth. |
| VI. AI-First Development Model | PASS | Generated artifacts stay inside the ticket spec directory only. |

**Post-Design Gate Status**: PASS

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Implementation Plan | `/home/runner/work/ai-board/ai-board/target/specs/AIB-339-enrich-comparison-dialog/plan.md` | Complete |
| Research | `/home/runner/work/ai-board/ai-board/target/specs/AIB-339-enrich-comparison-dialog/research.md` | Complete |
| Data Model | `/home/runner/work/ai-board/ai-board/target/specs/AIB-339-enrich-comparison-dialog/data-model.md` | Complete |
| API Contract | `/home/runner/work/ai-board/ai-board/target/specs/AIB-339-enrich-comparison-dialog/contracts/comparison-detail.openapi.yaml` | Complete |
| Quickstart | `/home/runner/work/ai-board/ai-board/target/specs/AIB-339-enrich-comparison-dialog/quickstart.md` | Complete |
