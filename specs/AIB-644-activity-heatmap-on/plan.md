# Implementation Plan: Activity Heatmap on Projects Page

**Branch**: `AIB-644-activity-heatmap-on` | **Date**: 2026-04-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-644-activity-heatmap-on/spec.md`

## Summary

Add a GitHub-style contribution heatmap to `/projects` below the project cards grid. The feature uses existing `Job` and `Ticket` records to aggregate one full year of workspace activity across all accessible projects, supports a rolling 12-month default plus historical calendar years, filters by effective agent, and exposes daily tooltip details for jobs, shipped tickets, and recorded cost.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 App Router, React 18, TanStack Query v5.95.2, Prisma 6.x, shadcn/ui, Radix Tooltip/Select, lucide-react
**Storage**: PostgreSQL 14+ via Prisma ORM using existing `Project`, `ProjectMember`, `Ticket`, and `Job` tables only
**Testing**: Vitest unit/component/integration, Playwright E2E for `/projects` mobile scroll + tooltip behavior
**Target Platform**: Web application, desktop and mobile `/projects` page
**Project Type**: Next.js monolith with server-rendered pages and client-side filtered sections
**Performance Goals**: Initial section render piggybacks on `/projects`; filter changes should return within normal dashboard latency and render a fixed 366/365-cell year grid without blocking page scroll
**Constraints**:
- No new persisted entities for this view (FR-019)
- Semantic Tailwind tokens only; no hardcoded hex/rgb
- Full-year grid must remain visible for empty scopes
- Natural document scrolling must replace the current internal grid scroll trap
**Scale/Scope**: Workspace-wide aggregation across all accessible projects for up to one rolling year or one calendar year at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | New route, aggregate helper, and UI contract will use explicit TypeScript types and Zod-validated query params |
| II. Component-Driven Architecture | PASS | Uses a server-rendered `/projects` page plus a dedicated client heatmap component built from shadcn/ui primitives |
| III. Test-Driven Development | PASS | Existing analytics/heatmap tests provide extension patterns; new route/component/browser coverage is planned before implementation |
| IV. Security-First Design | PASS | Data comes only from authorized workspace projects; no user-supplied project scope or raw SQL |
| V. Database Integrity | PASS | Read-only aggregation against existing schema; no migrations or derived persistence required |
| V. Specification Clarification Guardrails | PASS | Spec already documents auto-resolved decisions; plan keeps conservative empty-state and filter semantics |

**Gate Result**: PASS

### Post-Design Check

| Principle | Status | Verification |
|-----------|--------|--------------|
| I. TypeScript-First Development | PASS | `data-model.md` defines typed year-view, day-cell, and API response contracts; OpenAPI contract matches route payload |
| II. Component-Driven Architecture | PASS | Design introduces `components/projects/projects-activity-heatmap.tsx` and keeps page/data helpers single-purpose |
| III. Test-Driven Development | PASS | Testing strategy extends existing aggregate and select-control test patterns; new files are only added where no current file covers the domain |
| IV. Security-First Design | PASS | `GET /api/projects/activity` reuses authenticated workspace scoping and structured error handling |
| V. Database Integrity | PASS | The design uses `Job.startedAt` and `Ticket.updatedAt`/`stage='SHIP'` from existing records; no inconsistent write path is introduced |
| V. Specification Clarification Guardrails | PASS | Research resolved all clarifications without weakening accessibility, empty-state handling, or filter behavior |

**Gate Result**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/AIB-644-activity-heatmap-on/
├── plan.md
├── research.md
├── data-model.md
└── contracts/
    └── projects-activity-heatmap.yaml
```

### Source Code (repository root)

```text
app/
├── projects/page.tsx                           # Extend server page bootstrap
├── api/projects/activity/route.ts             # New workspace heatmap endpoint
└── lib/query-keys.ts                          # Extend workspace query keys

components/projects/
├── projects-container.tsx                     # Remove internal scroll trap / host grid only
└── projects-activity-heatmap.tsx             # New interactive heatmap section

lib/
├── db/projects.ts                             # Reuse workspace access predicate
└── projects/
    ├── activity-heatmap.ts                    # New aggregate query helper
    └── activity-heatmap-types.ts              # New shared types

tests/
├── integration/projects/
│   └── activity-heatmap.test.ts              # New route-level aggregate coverage
├── unit/components/projects/
│   └── projects-activity-heatmap.test.tsx    # New UI/filter/empty-state coverage
└── e2e/
    └── projects-activity-heatmap.spec.ts     # New mobile scroll + tooltip browser test
```

**Structure Decision**: Keep the `/projects` page server-rendered for initial load, then hand filter changes to a dedicated client heatmap section backed by a sibling workspace API route. This matches the existing analytics architecture without polluting the project-card API shape.

## Phase 0: Research Output

Research is complete in [research.md](./research.md). All initial unknowns were resolved:

- Workspace scope uses the existing owner-or-member predicate from `getUserProjects()`.
- Jobs are bucketed by `Job.startedAt`; shipped tickets use `Ticket.updatedAt` while `stage = 'SHIP'`.
- Agent filtering reuses the existing effective-agent rule (`ticket.agent ?? project.defaultAgent`).
- The feature should use a dedicated `GET /api/projects/activity` endpoint rather than extending `GET /api/projects`.
- The projects grid wrapper must lose its internal fixed-height scroll behavior so the page scrolls naturally.

## Phase 1: Design and Contracts

### Data Model

Create [data-model.md](./data-model.md) defining:

- `ProjectsActivityHeatmapResponse`
- `HeatmapDay`
- `HeatmapLegendBucket`
- `YearViewOption`
- `AgentScopeOption`

No Prisma schema changes are required.

### Interface Contracts

Create `contracts/projects-activity-heatmap.yaml` for:

- `GET /api/projects/activity`
- Query params: `view`, `agent`
- Structured 200/400/401/500 responses
- Full-year day-cell payload, totals, selector options, and empty-state metadata

### Workflow / Agent Artifacts

None. The spec defines an application feature, not a new internal workflow or agent command.

## Phase 2: Implementation Planning

### Implementation Steps

1. Extend `app/projects/page.tsx` to load initial heatmap data alongside the project list and render the new section below the grid.
2. Refactor `components/projects/projects-container.tsx` so the project cards no longer live inside a fixed-height `overflow-y-auto` container.
3. Implement `lib/projects/activity-heatmap.ts` to:
   - Resolve authorized workspace project IDs.
   - Generate the requested year range (`rolling-12m` or `year-YYYY`).
   - Aggregate daily job counts from `Job.startedAt`.
   - Aggregate shipped-ticket counts from `Ticket.updatedAt` where `stage = 'SHIP'`.
   - Sum recorded `Job.costUsd` without excluding jobs whose cost is null.
   - Derive filter-aware available-agent options and intensity buckets.
4. Add `app/api/projects/activity/route.ts` with Zod query validation and structured auth/error handling matching existing analytics routes.
5. Add `components/projects/projects-activity-heatmap.tsx` with:
   - shadcn `Select` controls for year and agent
   - TanStack Query refetch keyed by selected filters
   - accessible tooltip/focus interactions for each day cell
   - legend, totals header, and explicit no-activity messaging
6. Extend `app/lib/query-keys.ts` with a dedicated workspace activity key to avoid collisions with project-specific activity queries.

### Testing Strategy

Follow the constitution rule to extend existing tests before creating new ones. Based on the Existing Files inventory in `research.md`, the implementation should use:

| Coverage | File | Plan |
|----------|------|------|
| Workspace aggregate endpoint | `tests/integration/projects/activity-heatmap.test.ts` | New file because no current integration test covers a workspace aggregate route |
| Existing projects list contract safety | `tests/integration/projects/crud.test.ts` | Extend only if bootstrap changes affect `GET /api/projects`; otherwise leave focused |
| Aggregate/filter logic pattern reference | `tests/integration/analytics/analytics-route.test.ts` | Reuse fixture seeding style and empty-scope assertions |
| Heatmap component interactions | `tests/unit/components/projects/projects-activity-heatmap.test.tsx` | New file because no current projects-page UI test covers this domain |
| Heatmap rendering pattern reference | `tests/unit/components/comparison-compliance-heatmap.test.tsx` | Reuse cell and empty-state assertion style |
| Filter control pattern reference | `tests/unit/components/analytics-dashboard.test.tsx` | Reuse mocked `Select` and URL search-param assertions |
| Browser-only mobile/scroll behavior | `tests/e2e/projects-activity-heatmap.spec.ts` | New file because no existing E2E covers `/projects` content, mobile overflow, or tooltip inspection |

### Task Ordering

1. Route contract and aggregate helper
2. Server page bootstrap and grid-scroll refactor
3. Client heatmap section and filter wiring
4. Integration tests
5. Component tests
6. Single focused Playwright test for mobile/tooltip behavior

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
