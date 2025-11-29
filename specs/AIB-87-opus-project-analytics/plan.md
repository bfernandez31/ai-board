# Implementation Plan: Project Analytics Dashboard

**Branch**: `AIB-87-opus-project-analytics` | **Date**: 2025-11-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-87-opus-project-analytics/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a comprehensive analytics dashboard accessible from the project menu that visualizes AI workflow metrics including cost trends, token usage, tool patterns, cache efficiency, and velocity. The dashboard will aggregate existing Job telemetry data (inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd, durationMs, toolsUsed) into charts using Recharts, following the existing shadcn/ui component patterns.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 15 (App Router), React 18, shadcn/ui, TanStack Query v5.90.5, Recharts (new dependency)
**Storage**: PostgreSQL 14+ via Prisma 6.x (existing Job model contains all telemetry fields)
**Testing**: Vitest (unit tests for aggregation utilities), Playwright (E2E tests for dashboard)
**Target Platform**: Web (Vercel hosting), responsive design 768px-1920px+
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Dashboard loads and displays all charts within 3 seconds for projects with up to 1,000 jobs
**Constraints**: Polling interval 10-15 seconds (consistent with existing patterns), no real-time updates
**Scale/Scope**: Single new route, 8-10 chart components, 1 new API endpoint for aggregated data

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gates (Phase 0)

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All code will use strict mode, explicit types for API responses and aggregation functions |
| II. Component-Driven Architecture | ✅ PASS | Charts will compose shadcn/ui primitives (Card, Select, Tabs); feature folder at `/components/analytics/` |
| III. Test-Driven Development | ✅ PASS | Vitest for aggregation utilities, Playwright for dashboard E2E flows |
| IV. Security-First Design | ✅ PASS | Zod validation for time range params, access control via existing `verifyProjectAccess()` |
| V. Database Integrity | ✅ PASS | Read-only queries on existing Job model; no schema changes required |
| V. Specification Clarification | ✅ PASS | AUTO→CONSERVATIVE applied for time ranges and chart granularity decisions |

### Complexity Assessment

- **New Dependencies**: Recharts (1 library) - justified as the spec recommends it for lightweight React charting
- **New Routes**: 1 page route (`/projects/[projectId]/analytics`) + 1 API route (`/api/projects/[projectId]/analytics`)
- **Component Count**: ~10 chart components in `/components/analytics/` - appropriate for dashboard scope
- **No Constitution Violations**: No `any` types, no custom UI primitives, no new ORMs

## Project Structure

### Documentation (this feature)

```
specs/AIB-87-opus-project-analytics/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
app/
├── projects/
│   └── [projectId]/
│       └── analytics/
│           └── page.tsx           # Analytics dashboard page (Server Component)
└── api/
    └── projects/
        └── [projectId]/
            └── analytics/
                └── route.ts       # Aggregated analytics data endpoint

components/
└── analytics/
    ├── analytics-dashboard.tsx    # Main dashboard container (Client Component)
    ├── overview-cards.tsx         # Four metric cards (cost, success rate, duration, shipped)
    ├── cost-over-time-chart.tsx   # Area chart with time range selector
    ├── cost-by-stage-chart.tsx    # Horizontal bar chart by stage
    ├── token-usage-chart.tsx      # Stacked/grouped bar chart
    ├── cache-efficiency-chart.tsx # Ring/donut chart
    ├── top-tools-chart.tsx        # Horizontal bar chart
    ├── workflow-distribution-chart.tsx # Donut chart (FULL/QUICK/CLEAN)
    ├── velocity-chart.tsx         # Bar chart (tickets/week)
    └── time-range-selector.tsx    # Reusable time range component

lib/
└── analytics/
    ├── types.ts                   # TypeScript interfaces for analytics data
    ├── aggregations.ts            # Pure functions for data aggregation
    └── queries.ts                 # Prisma query helpers

tests/
├── unit/
│   └── analytics.test.ts          # Vitest tests for aggregation functions
└── e2e/
    └── analytics.spec.ts          # Playwright E2E tests for dashboard
```

**Structure Decision**: Next.js App Router web application structure. New route at `/projects/[projectId]/analytics` follows existing pattern from `/projects/[projectId]/settings`. Components follow feature folder pattern in `/components/analytics/`.

## Complexity Tracking

*No violations identified. All design decisions align with constitution principles.*

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Chart Library | Recharts | Lightweight, React-native, shadcn/ui compatible (spec recommendation) |
| Data Aggregation | Server-side in API | Reduces client bundle, enables caching, keeps complex queries on server |
| Polling | 15-second interval | Matches existing notification polling pattern in codebase |
| Time Ranges | Preset options only | CONSERVATIVE approach per spec (7d, 30d, 90d, all time) |

### Post-Design Gates (Phase 1 Complete)

| Principle | Status | Verification |
|-----------|--------|--------------|
| I. TypeScript-First | ✅ PASS | All types defined in `lib/analytics/types.ts`; API contract in OpenAPI spec |
| II. Component-Driven Architecture | ✅ PASS | 10 chart components compose shadcn/ui Card, Select; follows `/components/analytics/` pattern |
| III. Test-Driven Development | ✅ PASS | Test files specified: `tests/unit/analytics.test.ts`, `tests/e2e/analytics.spec.ts` |
| IV. Security-First Design | ✅ PASS | Zod schema for range param; `verifyProjectAccess()` in API route |
| V. Database Integrity | ✅ PASS | Read-only queries; no migrations; uses existing indexed fields |
| V. Specification Clarification | ✅ PASS | All NEEDS CLARIFICATION items resolved in research.md |

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | `specs/AIB-87-opus-project-analytics/research.md` | ✅ Complete |
| Data Model | `specs/AIB-87-opus-project-analytics/data-model.md` | ✅ Complete |
| API Contract | `specs/AIB-87-opus-project-analytics/contracts/analytics-api.yaml` | ✅ Complete |
| Quickstart | `specs/AIB-87-opus-project-analytics/quickstart.md` | ✅ Complete |
| Agent Context | `CLAUDE.md` updated with Recharts dependency | ✅ Complete |

## Implementation Notes

### Key Design Decisions

1. **No Schema Changes**: All analytics data derives from existing `Job` and `Ticket` models
2. **Command-to-Stage Mapping**: Implemented as pure function in `lib/analytics/aggregations.ts`
3. **Server-Side Aggregation**: Complex queries run on server; client receives pre-aggregated data
4. **CSS Variables for Theming**: Chart colors use `hsl(var(--chart-N))` for dark mode support

### Dependencies to Add

```json
{
  "dependencies": {
    "recharts": "^2.x"
  }
}
```

### Query Keys Extension

Add to `app/lib/query-keys.ts`:

```typescript
analytics: {
  all: (projectId: number) => ['analytics', projectId] as const,
  data: (projectId: number, range: string) => ['analytics', projectId, range] as const,
}
```

## Next Steps

Run `/speckit.tasks` to generate the implementation task list from this plan.
