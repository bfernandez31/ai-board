# Implementation Plan: Analytics Filters and Dynamic Shipping Metrics

**Branch**: `AIB-289-copy-of-analytics` | **Date**: 2026-03-13 | **Spec**: `specs/AIB-289-copy-of-analytics/spec.md`
**Input**: Feature specification from `/specs/AIB-289-copy-of-analytics/spec.md`

## Summary

Extend the existing project analytics dashboard so every metric and visualization can be filtered by ticket outcome (`shipped`, `closed`, or both) and by effective AI agent (`all`, `CLAUDE`, `CODEX`). Replace the month-based shipped card with period-accurate shipped and closed cards, keep overview data visible even when job-backed charts are empty, and preserve the current single-endpoint analytics architecture by expanding the existing query layer and response contract.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, TanStack Query v5.90.5, TailwindCSS 3.4, shadcn/ui, Recharts 2.x, Zod  
**Storage**: PostgreSQL 14+ via Prisma; no schema migration required  
**Testing**: Vitest unit + integration tests; no new Playwright coverage expected  
**Target Platform**: Web application on Vercel  
**Project Type**: Next.js App Router monolith  
**Performance Goals**: Keep analytics response within current dashboard expectations by reusing one aggregated API call and parallel Prisma reads; filter changes should remain coherent within a single React Query refresh cycle  
**Constraints**: No new dependencies, no hex/rgb color classes, protected analytics access unchanged, filters must not leave stale data on screen, empty states must remain filter-aware  
**Scale/Scope**: One existing page, one existing API route, shared analytics query/types layer, multiple chart components, and analytics-focused tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | Feature is an extension of existing strict TypeScript analytics types and Prisma-backed query helpers. |
| II. Component-Driven Architecture | PASS | Work stays within `components/analytics/`, `app/api/projects/[projectId]/analytics/route.ts`, and `lib/analytics/` with shadcn/ui controls. |
| III. Test-Driven Development | PASS | Plan targets Vitest integration tests for API/query behavior and unit/component tests for filter state and query keys; no browser-only flow introduced. |
| IV. Security-First | PASS | Existing `verifyProjectAccess()` authorization remains in place; query params are validated with Zod enums before reaching Prisma. |
| V. Database Integrity | PASS | No schema changes; analytics remain read-only Prisma queries over `Project`, `Ticket`, and `Job`. |
| V. Spec Clarification Guardrails | PASS | Spec already records auto-resolved decisions; plan resolves remaining semantics explicitly in `research.md`. |
| VI. AI-First Development | PASS | All artifacts remain inside `specs/AIB-289-copy-of-analytics/`; no root-level human documentation added. |

**Gate Result**: ALL PASS - proceed with design.

## Project Structure

### Documentation (this feature)

```
specs/AIB-289-copy-of-analytics/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── analytics-api.yaml
└── tasks.md
```

### Source Code (repository root)

```
app/
├── api/
│   └── projects/
│       └── [projectId]/
│           └── analytics/
│               └── route.ts                  # MODIFY: validate outcome + agent query params
├── lib/
│   └── query-keys.ts                         # MODIFY: include filter dimensions in analytics query key
└── projects/
    └── [projectId]/
        └── analytics/
            └── page.tsx                     # MODIFY: read filter params and hydrate initial analytics state

components/
└── analytics/
    ├── analytics-dashboard.tsx             # MODIFY: manage multi-filter state and remove full-page empty bailout
    ├── overview-cards.tsx                  # MODIFY: add shipped + closed completion cards with range labels
    ├── time-range-selector.tsx             # REUSE: existing range selector
    ├── empty-state.tsx                     # POSSIBLE REUSE/REFINE: filter-aware empty copy
    └── *.tsx                               # MODIFY AS NEEDED: keep per-chart empty states aligned with filters

lib/
└── analytics/
    ├── aggregations.ts                     # MODIFY: add range labels and shared filter helpers
    ├── queries.ts                          # MODIFY: apply outcome + agent filters consistently
    └── types.ts                            # MODIFY: extend analytics response and filter types

tests/
├── integration/
│   └── analytics/
│       └── analytics-route.test.ts         # CREATE or extend: filtered API response coverage
└── unit/
    ├── query-keys.test.ts                  # MODIFY: query-key coverage for extra filter dimensions
    └── components/
        └── analytics-dashboard.test.tsx    # CREATE or extend: filter interaction and empty-state behavior
```

**Structure Decision**: Keep the feature inside the existing analytics slice instead of introducing a new route or store. Server-side filtering lives in `lib/analytics/queries.ts`; UI state and URL synchronization stay in `components/analytics/analytics-dashboard.tsx` and the analytics page.

## Complexity Tracking

No constitution violations. No complexity exceptions required.

## Phase 0 Research Summary

Phase 0 resolves the previously implicit semantics around effective agent attribution, outcome scoping, and no-data handling. See `research.md` for the decision log that drives the design below.

## Phase 1 Design Summary

1. Extend analytics request state with two new filters:
   - `outcome`: `shipped` | `closed` | `all-completed`
   - `agent`: `all` | `CLAUDE` | `CODEX`
2. Keep a single `GET /api/projects/:projectId/analytics` endpoint and return:
   - applied filters
   - available agent options for the current project
   - overview metrics containing both shipped and closed completion cards with period labels
3. Split time semantics by data type:
   - Job-backed charts and job overview metrics use `job.completedAt` within the selected range.
   - Shipped counts and velocity use shipped tickets (`stage = SHIP`) constrained by `ticket.updatedAt`.
   - Closed counts use closed tickets (`stage = CLOSED`) constrained by `ticket.closedAt`.
4. Apply outcome filters by ticket outcome membership:
   - `shipped`: jobs for tickets currently in `SHIP`
   - `closed`: jobs for tickets currently in `CLOSED`
   - `all-completed`: jobs for tickets in either terminal stage
5. Replace the page-level `!hasData` short-circuit with filter-aware rendering:
   - overview cards always render
   - each chart/card keeps its own empty state
   - no stale values survive a filter change

## Implementation Notes

### Query Layer

- Introduce a shared analytics filter object consumed by all query helpers so the route, page loader, and React Query fetch use the same semantics.
- Use effective-agent matching based on `ticket.agent ?? project.defaultAgent`; because `Project.defaultAgent` is non-null in schema, historical jobs without ticket overrides still resolve to a stable agent.
- Derive available agents from tickets with recorded jobs in the project, not from a hardcoded enum-only dropdown.

### API Contract

- Expand `route.ts` validation from `range` only to `range`, `outcome`, and `agent`.
- Preserve the current authorization and error model.
- Return filter metadata needed by the UI so the dashboard does not need a second request for agent options.

### UI State

- Persist all three filters in the analytics URL query string for reload/share consistency.
- Update the React Query key to include every filter dimension; otherwise cached responses will bleed across filter states.
- Keep filter updates as one coherent state change so overview and charts always redraw from the same payload.

### Testing Strategy

- Integration tests: seeded tickets/jobs with mixed terminal outcomes and mixed agents, validating endpoint filtering, completion-card counts, and empty combinations.
- Unit/component tests: query-key stability, default filter selection, URL param synchronization, and no-data rendering without stale values.
- No E2E tests planned because the feature is selector-driven dashboard logic, not browser-only behavior.

## Post-Design Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | Design introduces explicit unions/interfaces for filters, completion metrics, and response metadata. |
| II. Component-Driven Architecture | PASS | Design keeps UI changes inside existing analytics components and shadcn/ui `Select` controls. |
| III. Test-Driven Development | PASS | Coverage remains in Vitest integration/unit layers, matching the Testing Trophy decision tree. |
| IV. Security-First | PASS | Filter inputs are enum-constrained and project access checks remain unchanged. |
| V. Database Integrity | PASS | Design is read-only and uses existing `closedAt`, `updatedAt`, `agent`, and job telemetry fields. |
| V. Spec Clarification Guardrails | PASS | Outcome timestamp semantics and empty-state rules are documented, removing ambiguity. |
| VI. AI-First Development | PASS | Generated design artifacts remain confined to the ticket spec directory and agent context file. |

**Post-Design Gate Result**: ALL PASS - ready for task breakdown.
