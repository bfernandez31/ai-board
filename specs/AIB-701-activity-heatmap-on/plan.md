# Implementation Plan: Activity Heatmap on Projects Page

**Branch**: `AIB-701-activity-heatmap-on` | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-701-activity-heatmap-on/spec.md`

## Summary

Add a GitHub-style activity heatmap below the projects grid on `app/projects/page.tsx`, backed by a dedicated cross-project aggregation query and API route. The page will server-render the default "Last 12 months" view, then let a client heatmap component update period and effective-agent filters via URL state and 15-second background refresh without blanking the visible grid.

## Technical Context

**Language/Version**: TypeScript 5.9 strict, Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 App Router, React 18, Prisma 6.x, TanStack Query v5.95.2, shadcn/ui, Radix Tooltip/ScrollArea, lucide-react, Zod  
**Storage**: PostgreSQL 14+ via Prisma; derive from existing `User`, `Project`, `Ticket`, and `Job` tables only  
**Testing**: Vitest unit + integration tests; Playwright only if browser-only behavior cannot be covered elsewhere  
**Target Platform**: Authenticated web app on desktop and mobile viewports  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: First render shows populated heatmap or empty state immediately; background refresh every 15s without clearing current data; mobile horizontal scroll remains responsive with pinned day labels  
**Constraints**: No new Prisma models; shipped totals come only from successful `ship` job completions; accessible-project aggregation must include owner and member access; URL must preserve `activityPeriod` and `activityAgent` state; avoid hardcoded hex/rgb colors  
**Scale/Scope**: One cross-project yearly heatmap for a single signed-in user, aggregating up to 366 daily cells and a bounded set of accessible projects

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First Development | PASS | New route, server query helper, shared types, and client component stay in strict TypeScript with explicit interfaces. |
| II. Component-Driven Architecture | PASS | The page remains a Server Component; the interactive heatmap is isolated in `components/projects/` and uses shadcn/Radix primitives. |
| III. Test-Driven Development | PASS | Existing query-key and projects/analytics test homes were inspected first; new test files are justified only where no current file covers the new cross-project heatmap domain. |
| IV. Security-First Design | PASS | Aggregation uses authenticated accessible-project filtering and Zod-validated query params; no secrets or new credential paths are introduced. |
| V. Database Integrity | PASS | The feature is read-only against existing models and follows the spec rule that no new database models are added. |
| V. Specification Clarification Guardrails | PASS | The spec already records auto-resolved decisions; this plan preserves the conservative shipped-counting, filter, and first-render guarantees. |

**Gate Result**: PASS. Proceed with research and design.

### Post-Design Check

| Gate | Status | Evidence |
|------|--------|----------|
| Existing tests extended first | PASS | `tests/unit/query-keys.test.ts` is extended; new route/component test files are limited to the new heatmap domain because no current test file covers it without mixing unrelated concerns. |
| Auth before data disclosure | PASS | Dedicated route follows `app/api/projects/route.ts` auth-first pattern and filters by owner/member access before aggregation. |
| No weaker data attribution | PASS | Daily metrics are tied to `job.completedAt`, and shipped totals count only successful `ship` jobs, matching the spec and avoiding stage-based overcounting. |
| Server-rendered initial state preserved | PASS | `app/projects/page.tsx` fetches the default payload server-side before handing off to the client refresher, mirroring the analytics page pattern. |
| Mobile scroll/accessibility handled with existing primitives | PASS | Horizontal scrolling and pinned labels reuse `ScrollArea`/sticky layout patterns rather than custom ad hoc overflow behavior. |

**Gate Result**: PASS. No blocking constitutional violations after design.

## Project Structure

### Documentation (this feature)

```
specs/AIB-701-activity-heatmap-on/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   └── activity-heatmap-api.md
└── tasks.md
```

### Source Code (repository root)

```
app/
├── api/projects/activity-heatmap/
│   └── route.ts
├── lib/
│   └── query-keys.ts
└── projects/
    └── page.tsx

components/
└── projects/
    └── project-activity-heatmap.tsx

lib/
├── db/
│   └── users.ts
└── projects/
    └── activity-heatmap.ts

tests/
├── integration/projects/
│   └── activity-heatmap-route.test.ts
└── unit/
    ├── components/projects/
    │   └── project-activity-heatmap.test.tsx
    ├── lib/projects/
    │   └── activity-heatmap.test.ts
    └── query-keys.test.ts
```

**Structure Decision**: Keep the projects page as the server entry point, place the new interactive UI under `components/projects/`, and isolate cross-project aggregation in a dedicated `lib/projects/activity-heatmap.ts` helper plus a dedicated `/api/projects/activity-heatmap` route so 15-second refreshes do not refetch the full project-card payload.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Design Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Research | `specs/AIB-701-activity-heatmap-on/research.md` | Resolved technical decisions, existing file inventory, and implementation patterns |
| Data model | `specs/AIB-701-activity-heatmap-on/data-model.md` | Derived entities and validation rules for periods, agents, cells, and payloads |
| API contract | `specs/AIB-701-activity-heatmap-on/contracts/activity-heatmap-api.md` | Dedicated route schema for the cross-project heatmap payload |

## Implementation Phases

### Phase 1: Cross-Project Aggregation Foundation

**Goal**: Create the server-side source of truth for period options, effective-agent options, daily cells, and shipped-job counting across all accessible projects.

**Files to modify**:
1. `lib/projects/activity-heatmap.ts` (new)
2. `lib/db/users.ts`
3. `app/lib/query-keys.ts`
4. `tests/unit/lib/projects/activity-heatmap.test.ts` (new)
5. `tests/unit/query-keys.test.ts`

**Pattern requirements**:
- Follow accessible-project membership filtering from `lib/db/projects.ts:28-78`.
- Follow effective-agent resolution from `app/lib/utils/agent-resolution.ts:41-46` and `lib/analytics/queries.ts:51-68`.
- Follow daily bucketing/date-label helper style from `lib/analytics/aggregations.ts:57-145`.

**Design notes**:
- Attribute all daily activity to `job.completedAt` in UTC for consistency with existing analytics/date formatting.
- Count shipped tickets only from successful `ship` jobs, deduped per ticket per completion day.
- Derive year options from `User.createdAt` through the current year, while always including `last-12-months`.

### Phase 2: Dedicated Route and Server-Rendered Projects Page

**Goal**: Expose the aggregation through a focused API route and preload the default view in the projects page without a loading flash.

**Files to modify**:
1. `app/api/projects/activity-heatmap/route.ts` (new)
2. `app/projects/page.tsx`
3. `tests/integration/projects/activity-heatmap-route.test.ts` (new)

**Pattern requirements**:
- Follow Zod query validation and structured error handling from `app/api/projects/[projectId]/analytics/route.ts:7-50` and `app/api/projects/route.ts:23-45`.
- Follow server-rendered initial-data loading from `app/projects/[projectId]/analytics/page.tsx:49-99`.

**Design notes**:
- Parse `activityPeriod` and `activityAgent` from `searchParams` in the page so copied URLs restore the same view.
- Keep the route independent from `/api/projects` to avoid coupling heatmap polling to the project-card list payload.

### Phase 3: Interactive Heatmap UI and Filter Persistence

**Goal**: Render the projects-page heatmap with horizontal scrolling, pinned labels, hover/tap detail, and background refresh.

**Files to modify**:
1. `components/projects/project-activity-heatmap.tsx` (new)
2. `components/projects/projects-container.tsx`
3. `tests/unit/components/projects/project-activity-heatmap.test.tsx` (new)

**Pattern requirements**:
- Follow client hydration/query refresh behavior from `components/analytics/analytics-dashboard.tsx:43-109`.
- Follow sticky-label and scroll-area usage from `components/comparison/comparison-compliance-heatmap.tsx:61-122` and `components/ui/scroll-area.tsx:8-29`.
- Follow scroll viewport state handling from `components/board/stage-column.tsx:165-217`.

**Design notes**:
- Remove the card-grid vertical trap in `components/projects/projects-container.tsx` so the page scrolls naturally to the heatmap.
- Keep day labels pinned while the heatmap grid scrolls horizontally on mobile.
- Preserve the currently visible heatmap while polling or filter changes are in flight; replace only once new data arrives.

### Phase 4: Regression and Empty-State Coverage

**Goal**: Prove URL persistence, zero-activity behavior, filter visibility rules, and shipped-ticket counting.

**Files to modify**:
1. `tests/integration/projects/activity-heatmap-route.test.ts`
2. `tests/unit/components/projects/project-activity-heatmap.test.tsx`
3. `tests/unit/lib/projects/activity-heatmap.test.ts`
4. `tests/unit/query-keys.test.ts`

**Test intent**:
- Validate rolling-year and calendar-year ranges, including chipped first/last weeks.
- Validate agent option suppression when zero or one effective agent exists.
- Validate tooltip cost omission when daily jobs lack cost data.
- Validate empty-state replacement when the selected period has zero activity.

## Testing Strategy

- Prefer Vitest integration coverage for the dedicated route because it owns auth, validation, aggregation semantics, and shipped-count correctness.
- Add pure unit coverage for daily bucketing, period construction, and shipped deduping in `tests/unit/lib/projects/activity-heatmap.test.ts` because no existing file covers this new aggregation domain.
- Add a focused component test for `components/projects/project-activity-heatmap.tsx` because there is no existing projects-page component test file to extend without mixing unrelated repo-picker/import flows.
- Extend `tests/unit/query-keys.test.ts` instead of creating a duplicate query-key suite.
- Do not default to Playwright; touch/hover and pinned-label rendering should be covered with component tests unless a browser-only defect appears during implementation.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Cross-project aggregation becomes too expensive when scanning all historical jobs | Medium | High | Limit the query to the selected range, select only required fields, and aggregate in a dedicated helper rather than refetching project cards. |
| Shipped totals overcount repeated ship jobs for the same ticket/day | Medium | High | Deduplicate shipped contributions by `(ticketId, completionDate)` in the aggregation helper and cover with unit/integration tests. |
| URL params collide with future projects-page filters | Low | Medium | Use dedicated names `activityPeriod` and `activityAgent` rather than generic `period` or `agent`. |
| Mobile horizontal scrolling regresses pinned labels or tap targets | Medium | Medium | Reuse `ScrollArea` plus sticky-label patterns and cover with component tests for rendered classes and interaction states. |
| Users with no meaningful agent diversity see noisy filtering UI | Medium | Medium | Suppress the selector when distinct effective-agent count is `<= 1` and validate in route/component tests. |
