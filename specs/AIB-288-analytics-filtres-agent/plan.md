# Implementation Plan: Analytics Filters by Agent and Status, Period-Aware Shipped Card

**Branch**: `AIB-288-analytics-filtres-agent` | **Date**: 2026-03-13 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-288-analytics-filtres-agent/spec.md`
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-288-analytics-filtres-agent/spec.md`

## Summary

Extend the existing project analytics dashboard so every metric is driven by one shared filter state: time range, ticket status scope, and agent scope. The implementation keeps the current Next.js API route and React Query flow, adds agent and status query parameters plus filter metadata to the analytics contract, recalculates shipped and closed ticket summaries from the active period instead of the calendar month, and preserves constitution requirements by using typed Prisma queries, Zod validation, shadcn/ui controls, and Vitest-first testing.

## Technical Context

**Language/Version**: TypeScript 5.6 strict, React 18.3, Next.js 16 App Router  
**Primary Dependencies**: Next.js API routes, Prisma 6.x, Zod 4.x, TanStack Query v5, shadcn/ui, Recharts  
**Storage**: PostgreSQL 14+ via Prisma ORM  
**Testing**: Vitest 4 (unit, component, integration), Playwright 1.48 for browser-only coverage  
**Target Platform**: Web application on Vercel-compatible Next.js runtime  
**Project Type**: Web application (Next.js full-stack app)  
**Performance Goals**: Keep analytics refresh within a single client fetch cycle and preserve current dashboard polling cadence; avoid introducing additional round trips for filter metadata  
**Constraints**: No schema migration unless design proves current ticket/job/project relations cannot support effective-agent filtering; all filters must update charts and summaries coherently; empty states must render zeroed summaries instead of stale values  
**Scale/Scope**: One analytics dashboard route, one analytics API route, shared analytics query/types layer, and related Vitest coverage for filter-aware aggregation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **TypeScript-first**: Pass. The feature is implemented in existing TypeScript modules with explicit analytics response types and Zod query validation.
- **Component-driven architecture**: Pass. UI work stays in `components/analytics/` and uses shadcn/ui primitives for new selectors/cards.
- **Test-driven development**: Pass with planned coverage. Add Vitest integration tests for `/api/projects/[projectId]/analytics`, unit tests for new aggregation helpers, and component tests only if filter controls need isolated interaction coverage. No Playwright is required because the behavior is filter/state driven, not browser-exclusive.
- **Security-first design**: Pass. Filters are validated with Zod, project access remains enforced by `verifyProjectAccess`, and the API exposes aggregate analytics only.
- **Database integrity**: Pass. Current design is read-only against `Job`, `Ticket`, and `Project`; no migration is required in the planned approach.
- **Specification clarification guardrails**: Pass. Auto-resolved spec decisions are preserved and translated directly into filter defaults and card layout.
- **AI-first development model**: Pass. Artifacts stay within the spec directory and existing agent context file.

## Project Structure

### Documentation (this feature)

```
specs/AIB-288-analytics-filtres-agent/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── analytics-filters-api.yaml
└── tasks.md
```

### Source Code (repository root)

```
app/
├── api/projects/[projectId]/analytics/route.ts
└── projects/[projectId]/analytics/page.tsx

components/
└── analytics/
    ├── analytics-dashboard.tsx
    ├── overview-cards.tsx
    ├── time-range-selector.tsx
    └── [new filter controls/status cards as needed]

lib/
└── analytics/
    ├── aggregations.ts
    ├── queries.ts
    └── types.ts

app/lib/
└── query-keys.ts

tests/
├── integration/
│   └── [analytics API coverage to extend or add]
└── unit/
    ├── query-keys.test.ts
    └── [analytics aggregation/type coverage to extend or add]
```

**Structure Decision**: Use the existing Next.js web-app structure. The feature is centered on the current analytics route, dashboard components, and shared `lib/analytics` modules rather than introducing new top-level packages.

## Complexity Tracking

No constitution violations or justified exceptions are required for this design.
