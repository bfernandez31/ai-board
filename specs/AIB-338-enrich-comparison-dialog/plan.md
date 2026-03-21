# Implementation Plan: AIB-338 Enrich Comparison Dialog

**Branch**: `AIB-338-enrich-comparison-dialog` | **Date**: 2026-03-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-338-enrich-comparison-dialog/spec.md`

## Summary

Enrich the existing comparison dialog by extending the comparison detail API and UI with ticket-level aggregated operational metrics, workflow and agent context in ranking cards, dominant-model attribution, and an inline quality-detail tray. The design reuses existing `Job` telemetry and quality data, keeps the current section order intact, and avoids Prisma schema changes by computing the new read model on demand.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 App Router, React 18, TanStack Query v5, Prisma 6.x, shadcn/ui, lucide-react, Zod  
**Storage**: PostgreSQL 14+ via Prisma; existing `Job`, `ComparisonRecord`, `ComparisonParticipant`, and `TicketMetricSnapshot` models  
**Testing**: Vitest unit tests, RTL component tests, Vitest integration tests, Playwright for viewport/scroll verification  
**Target Platform**: Web application (desktop and mobile browsers)  
**Project Type**: web  
**Performance Goals**: Comparison detail endpoint remains suitable for interactive dialog use with 2-6 participants and bounded per-ticket job aggregation  
**Constraints**: Preserve existing comparison sections and order; no hardcoded colors; distinguish pending vs unavailable; avoid nested modal UX; no Prisma schema changes unless design becomes blocked  
**Scale/Scope**: One existing comparison detail endpoint, 4-6 comparison UI/type files, 1-2 aggregation helpers, and focused unit/component/integration/E2E coverage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | New comparison read models and helpers will be strictly typed in `lib/types/comparison.ts` and `lib/comparison/` with no `any` usage. |
| II. Component-Driven Architecture | PASS | UI changes stay inside `components/comparison/` and reuse shadcn/ui primitives for badges, cards, scrollable containers, and inline detail affordances. |
| III. Test-Driven Development | PASS | Plan includes unit tests for aggregation logic, component tests for ranking and operational metrics UI, integration tests for the enriched API payload, and one targeted E2E for horizontal scrolling behavior. |
| IV. Security-First Design | PASS | No new mutation routes; existing access control remains on the comparison detail endpoint and no new sensitive data is exposed beyond already available ticket job telemetry. |
| V. Database Integrity | PASS | Existing schema already stores telemetry and quality details on `Job`; design intentionally avoids schema changes and migrations. |
| VI. AI-First Development Model | PASS | All artifacts stay inside the ticket spec directory and no root documentation files are introduced. |

**Gate Status**: ✅ ALL GATES PASS

### Post-Design Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | Design introduces typed operational and quality DTOs instead of ad hoc client parsing. |
| II. Component-Driven Architecture | PASS | Phase 1 keeps the work split between comparison data normalization and dedicated comparison UI components. |
| III. Test-Driven Development | PASS | Testing plan remains aligned with the project decision tree and avoids overusing E2E. |
| IV. Security-First Design | PASS | The existing auth and ticket-project ownership checks remain the only access gate needed for the enriched response. |
| V. Database Integrity | PASS | No schema mutation or backfill is required by the design artifacts. |
| VI. AI-First Development Model | PASS | Generated artifacts remain limited to `specs/AIB-338-enrich-comparison-dialog/`. |

**Post-Design Gate Status**: ✅ ALL GATES PASS

## Project Structure

### Documentation (this feature)

```text
specs/AIB-338-enrich-comparison-dialog/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── GET-comparison-detail.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
└── api/projects/[projectId]/tickets/[id]/comparisons/[comparisonId]/route.ts

components/
└── comparison/
    ├── comparison-viewer.tsx
    ├── comparison-ranking.tsx
    ├── comparison-metrics-grid.tsx
    ├── comparison-operational-metrics.tsx        # planned
    └── types.ts

hooks/
└── use-comparisons.ts

lib/
├── comparison/
│   ├── comparison-detail.ts
│   ├── comparison-record.ts
│   ├── telemetry-extractor.ts
│   └── comparison-operational-metrics.ts        # planned
├── quality-score.ts
└── types/comparison.ts

tests/
├── unit/comparison/
├── unit/components/
├── integration/comparisons/
└── e2e/
```

**Structure Decision**: Keep the existing Next.js web-app structure. Server-side aggregation belongs in `lib/comparison/`, the API contract remains the existing comparison detail route, and UI changes stay inside `components/comparison/` so the comparison dialog remains isolated from the board and ticket-detail flows.

## Phase 0: Outline & Research ✅ COMPLETE

### Resolved Unknowns

- No unresolved `NEEDS CLARIFICATION` items remain in the technical context.
- Existing raw telemetry and quality data in `Job` are sufficient for the feature.
- The comparison detail route, not a new endpoint, should carry the enriched payload.
- A separate Operational Metrics section is the correct fit for the existing UI structure.

### Research Outputs

- `research.md` documents seven design decisions covering live aggregation, server-computed best flags, pending/unavailable classification, dominant-model rules, quality detail parsing, inline detail UX, and test mix.

## Phase 1: Design & Contracts ✅ COMPLETE

### 1. Data Model

`data-model.md` defines the new comparison read models:

- `ComparisonOperationalMetricValue`
- `ComparisonModelSummary`
- `ComparisonQualitySummary`
- `ComparisonQualityDetail`
- `ComparisonOperationalAggregate`

It also documents that the feature reuses the existing `Job` and `ComparisonParticipant` persistence models without schema changes.

### 2. API Contract

`contracts/GET-comparison-detail.yaml` defines the enriched `GET /api/projects/{projectId}/tickets/{ticketId}/comparisons/{comparisonId}` response, including:

- ranking context fields already used by the dialog
- operational aggregates for tokens, duration, cost, job count, and model
- quality summary threshold and optional detail payload
- unchanged decision points and compliance rows

### 3. UI and Server Design

Planned implementation split:

1. Server aggregation
   - Add a comparison aggregation helper in `lib/comparison/`
   - Query all jobs for comparison participants in one request
   - Compute metric states, best-value flags, model summary, and quality detail eligibility
2. API normalization
   - Extend `ComparisonParticipantDetail` / `ComparisonDetail` DTOs
   - Return enriched participant payload from `getComparisonDetailForTicket()`
3. UI updates
   - Enrich ranking cards with workflow type, agent, and quality threshold context
   - Preserve `ComparisonMetricsGrid` for implementation metrics
   - Insert a new `ComparisonOperationalMetrics` card after implementation metrics
   - Add an inline quality-detail tray inside the operational metrics card

### 4. Testing Strategy

Tests are assigned by the project decision tree:

- Unit: aggregation helper, dominant-model logic, best-value ties, pending/unavailable classification
- Component: ranking card badges/context and operational metrics interactions
- Integration: enriched comparison detail endpoint payload and eligibility states
- E2E: one targeted comparison-dialog horizontal overflow scenario for desktop/mobile viewports

### 5. Agent Context Update

Phase 1 requires running:

```bash
/home/runner/work/ai-board/ai-board/target/.claude-plugin/scripts/bash/update-agent-context.sh claude
```

## Phase 2: Task Planning Approach

The `/tasks` command should generate work in TDD order:

1. Add failing unit tests for aggregation and dominance rules.
2. Add failing integration expectations for the enriched comparison detail response.
3. Add failing component tests for ranking-card context and Operational Metrics interactions.
4. Implement server aggregation and type updates.
5. Implement the new Operational Metrics card and inline quality-detail tray.
6. Add the targeted Playwright scenario for responsive horizontal scrolling.
7. Run `bun run test:unit`, `bun run test:integration`, `bun run test:e2e` as needed, then `bun run type-check` and `bun run lint`.

Expected task themes:

- data aggregation and DTO expansion
- API contract alignment
- comparison UI rendering
- regression coverage for pending, unavailable, tie, and mixed-model cases

## Complexity Tracking

No constitutional violations or complexity exceptions are required for this design.
