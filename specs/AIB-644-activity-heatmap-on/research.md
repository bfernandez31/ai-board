# Research: Activity Heatmap on Projects Page

**Branch**: `AIB-644-activity-heatmap-on` | **Date**: 2026-04-14

## Research Task 1: Workspace Aggregation Endpoint

**Question**: How should the projects page fetch filterable heatmap data without overloading the existing `/api/projects` response?

**Decision**: Add a dedicated workspace endpoint at `GET /api/projects/activity` backed by a new read-only query helper, and keep `GET /api/projects` focused on the project-card payload.

**Rationale**: [app/projects/page.tsx](../../app/projects/page.tsx) already renders the projects list by calling `getUserProjects()` directly at lines 17-25, and [app/api/projects/route.ts](../../app/api/projects/route.ts) keeps the list response limited to card fields at lines 22-44. A separate endpoint lets the client update year and agent filters without refetching the project list or expanding the stable `ProjectsListResponse` contract in [app/lib/types/project.ts](../../app/lib/types/project.ts#L5).

**Alternatives considered**:
- Extend `GET /api/projects` with optional heatmap data: rejected because it couples two unrelated payloads and complicates caching.
- Compute everything in a client component from `/api/projects`: rejected because jobs and shipped-ticket aggregates are not exposed there.

## Research Task 2: Access Scope for Workspace Heatmap

**Question**: Which projects should contribute to the heatmap totals?

**Decision**: Reuse the existing workspace visibility rule: owned projects plus projects where the user is a member.

**Rationale**: [lib/db/projects.ts](../../lib/db/projects.ts#L27) defines `getUserProjects()` using the owner-or-member predicate at lines 30-36, which matches FR-002 and the spec’s auto-resolved decision. The new workspace query should first resolve the authorized project set with the same predicate, then aggregate only `Job` and `Ticket` rows belonging to those project IDs.

**Alternatives considered**:
- Owner-only aggregation: rejected because it would diverge from the visible workspace on `/projects`.
- Per-project subqueries from the client: rejected because it would duplicate authorization and increase request volume.

## Research Task 3: Date Source for Jobs and Shipped Tickets

**Question**: Which timestamps should drive daily job and shipped-ticket buckets?

**Decision**: Bucket jobs by `Job.startedAt` and shipped tickets by `Ticket.updatedAt` when `stage = 'SHIP'`.

**Rationale**: The schema defines `Job.startedAt` as the canonical execution start at [prisma/schema.prisma](../../prisma/schema.prisma#L29) lines 29-68, which matches FR-013. There is no dedicated `shippedAt` column on `Ticket`; the closest existing shipped-date pattern is the analytics route’s `buildTicketStageRangeWhere('SHIP', ...)`, which uses `updatedAt` for shipped tickets at [lib/analytics/queries.ts](../../lib/analytics/queries.ts#L82) lines 82-97. Reusing that convention avoids inventing a new lifecycle timestamp.

**Alternatives considered**:
- Bucket jobs by `completedAt`: rejected because the spec explicitly chose started jobs for intensity.
- Add a new `shippedAt` column: rejected because FR-019 forbids new persisted entities solely for this view and the existing schema already supports shipped-date inference.

## Research Task 4: Agent Filter Semantics

**Question**: How should agent filtering behave for tickets whose `ticket.agent` is null?

**Decision**: Reuse the analytics “effective agent” rule: a ticket counts for a named agent when `ticket.agent = agent` or when `ticket.agent IS NULL` and `project.defaultAgent = agent`.

**Rationale**: [lib/analytics/queries.ts](../../lib/analytics/queries.ts#L51) implements `buildEffectiveAgentWhere()` at lines 51-68 and uses the same predicate for membership and completion metrics at lines 99-145 and 247-281. Reusing that logic keeps the workspace heatmap aligned with existing analytics filters and preserves shipped-ticket counts for the filtered agent scope.

**Alternatives considered**:
- Filter only explicit `ticket.agent` values: rejected because it would hide legacy/default-agent tickets.
- Filter jobs directly on a job-level agent field: rejected because `Job` has no agent column.

## Research Task 5: Year Selector Shape

**Question**: How should the selector represent the rolling default view plus historical calendar years?

**Decision**: Model the selector as a discriminated union of `rolling-12m` plus explicit calendar-year options derived from the user’s accessible data range.

**Rationale**: The spec requires a default rolling 12-month view plus prior calendar years while always rendering a full-year grid. A discriminated union keeps the API and UI type-safe and avoids ambiguous numeric values. It also makes date-range generation explicit for the query helper and tooltip/header copy.

**Alternatives considered**:
- Numeric year only with a special `0`/`current` sentinel: rejected because it obscures the rolling view semantics.
- “All time” option: rejected because the spec requires one full year at a time.

## Existing Files

### Reuse / Extend

- `app/projects/page.tsx`
  Covers the `/projects` server page shell and direct data loading via `getUserProjects()`. Extend to fetch initial heatmap data server-side and render the new section below the grid.
- `components/projects/projects-container.tsx`
  Covers the project-card grid. Extend or refactor because its internal `overflow-y-auto max-h-[calc(100vh-200px)]` wrapper at lines 15-21 currently prevents natural page scrolling once a below-the-grid heatmap is added.
- `lib/db/projects.ts`
  Covers workspace authorization and project list selection. Reuse the owner-or-member access predicate from `getUserProjects()` when building the new aggregate query.
- `app/api/projects/route.ts`
  Covers workspace-level authenticated routes and structured error handling. Use as the pattern reference for a new sibling `app/api/projects/activity/route.ts`.
- `app/lib/query-keys.ts`
  Covers TanStack query key definitions. Extend with a workspace heatmap key so filter changes stay isolated from project-card queries.
- `components/analytics/analytics-dashboard.tsx`
  Covers client-side filter state, URL search-param syncing, server-provided agent options, and 15-second refetch patterns. Reuse those interaction patterns for the heatmap section.
- `components/analytics/time-range-selector.tsx`
  Covers `Select`-based filter controls with static literal option values. Reuse the same shadcn/ui select pattern for the year selector.
- `lib/analytics/queries.ts`
  Covers agent filtering, ticket date conventions, no-data handling, and server-side aggregation against existing `Job` and `Ticket` rows. Reuse these query patterns for the workspace aggregate helper.
- `components/comparison/comparison-compliance-heatmap.tsx`
  Covers a heatmap-like table with `Tooltip`, horizontal overflow containment, and testable cells. Reuse the tooltip/cell composition pattern for the project activity heatmap.
- `tests/integration/analytics/analytics-route.test.ts`
  Covers seeded aggregate fixtures and route-level assertions for filters, empty states, and agent options. Extend these patterns for the new workspace aggregate endpoint.
- `tests/integration/projects/crud.test.ts`
  Covers `GET /api/projects` integration coverage. Extend if the page bootstrap path changes; otherwise keep separate route tests focused on `/api/projects/activity`.
- `tests/unit/components/analytics-dashboard.test.tsx`
  Covers client filter interactions, URL updates, and empty-state behavior with mocked shadcn selects. Reuse the same component-test approach for the heatmap section.
- `tests/unit/components/comparison-compliance-heatmap.test.tsx`
  Covers heatmap-cell rendering assertions and tooltip-ready cell markup. Reuse for day-cell intensity/empty-state tests.
- `tests/e2e/auth/test-user-header-redirect.spec.ts`
  Already exercises `/projects` navigation/auth. Keep as-is for auth; add a new dedicated `/projects` heatmap E2E only for browser-specific mobile/scroll behavior because no existing E2E covers that domain.

### Create New

- `app/api/projects/activity/route.ts`
  Needed because no existing workspace endpoint exposes day-level activity aggregates.
- `lib/projects/activity-heatmap.ts`
  Needed for a focused read-only aggregation helper; no current file covers workspace-wide day buckets.
- `lib/projects/activity-heatmap-types.ts`
  Needed for the new API/component contract; existing project and analytics types do not model year-view day cells.
- `components/projects/projects-activity-heatmap.tsx`
  Needed because no current projects component renders a filterable year heatmap section.
- `tests/integration/projects/activity-heatmap.test.ts`
  Needed because no existing integration file covers a workspace aggregate endpoint; adding it to `crud.test.ts` would mix unrelated CRUD and analytics concerns.
- `tests/unit/components/projects/projects-activity-heatmap.test.tsx`
  Needed because no existing projects-page component test covers interactive workspace analytics UI.
- `tests/e2e/projects-activity-heatmap.spec.ts`
  Needed only for browser-specific mobile overflow and tooltip inspection; no existing E2E covers the `/projects` page content itself.

## Patterns to Follow

### Authorization and Data Scope

- Follow the owner-or-member workspace filter from [lib/db/projects.ts](../../lib/db/projects.ts#L27) lines 27-77. New workspace aggregation must derive authorized project IDs first, rather than trusting client-supplied project scope.
- Follow project access error handling from [lib/db/auth-helpers.ts](../../lib/db/auth-helpers.ts#L30) lines 30-56 when validating project-scoped requests. For the workspace endpoint, the equivalent pattern is to fail on `Unauthorized` and never leak inaccessible data.

### API Validation and Error Handling

- Follow the route shape in [app/api/projects/[projectId]/analytics/route.ts](../../app/api/projects/[projectId]/analytics/route.ts#L7) lines 7-50: Zod-parse query params, validate route params early, return structured 400/403/404/500 responses, and log unexpected errors.
- Follow the broader try/catch guard from [app/api/projects/[projectId]/activity/route.ts](../../app/api/projects/[projectId]/activity/route.ts#L47) lines 47-194. New aggregation routes should not let auth or validation exceptions fall through to a generic 500 without classification.

### Security and Agent Filtering

- Follow `buildEffectiveAgentWhere()` in [lib/analytics/queries.ts](../../lib/analytics/queries.ts#L51) lines 51-68 so null `ticket.agent` values inherit `project.defaultAgent`.
- Follow `getAvailableAgents()` in [lib/analytics/queries.ts](../../lib/analytics/queries.ts#L190) lines 190-245: server-generated agent options should only include agents with matching history, plus `All agents`.

### State Management and Empty-State Behavior

- Follow the filter/update loop from [components/analytics/analytics-dashboard.tsx](../../components/analytics/analytics-dashboard.tsx#L85) lines 85-109 and 117-168: keep local filter state, push updated query params with `scroll: false`, and refetch through TanStack Query keyed by the active filters.
- Follow the “keep structure visible while empty” pattern from [components/analytics/analytics-dashboard.tsx](../../components/analytics/analytics-dashboard.tsx#L171) lines 171-249. The heatmap must preserve totals/filter controls and show a no-activity message instead of conditionally hiding the section.

### Heatmap UI Composition

- Follow the tooltip cell composition in [components/comparison/comparison-compliance-heatmap.tsx](../../components/comparison/comparison-compliance-heatmap.tsx#L61) lines 61-123: wrap each cell in `TooltipTrigger asChild`, keep cell visuals separate from tooltip content, and contain horizontal overflow at the card/content boundary rather than the whole page.
- Follow the corresponding test strategy in [tests/unit/components/comparison-compliance-heatmap.test.tsx](../../tests/unit/components/comparison-compliance-heatmap.test.tsx#L62) lines 62-149: assert cell counts/status markers and empty-state rendering without relying on implementation details.

### Scroll and Layout Safety

- Correct the internal scroll trap in [components/projects/projects-container.tsx](../../components/projects/projects-container.tsx#L14) lines 14-21. The heatmap should rely on normal document flow, not a fixed-height grid wrapper, so the page remains naturally scrollable on desktop and mobile.

### Test Seeding and Aggregate Assertions

- Follow the fixture seeding and route assertions in [tests/integration/analytics/analytics-route.test.ts](../../tests/integration/analytics/analytics-route.test.ts#L21) lines 21-175 and 285-533: seed explicit `Ticket`/`Job` dates, assert filter-aware totals, and cover empty-agent scopes.

## Consolidated Decisions

### API Contract

**Decision**: Expose the feature through `GET /api/projects/activity` with `view` and `agent` query params.

**Rationale**: The page needs filterable workspace aggregates without mutating the stable projects list contract.

**Alternatives considered**:
- Extend `GET /api/projects`
- Project-scoped endpoints fan-out from the client

### Data Access Layer

**Decision**: Implement a new `lib/projects/activity-heatmap.ts` helper that aggregates existing `Job` and `Ticket` rows only.

**Rationale**: The feature is read-only and FR-019 forbids adding persistence just for the view.

**Alternatives considered**:
- New materialized/cached table
- UI-only composition of many project APIs

### UI Composition

**Decision**: Add a dedicated `components/projects/projects-activity-heatmap.tsx` section rendered below the project grid, with a client-side filter bar and server-provided initial data.

**Rationale**: This matches the existing Server Component page plus interactive client section pattern already used by analytics.

**Alternatives considered**:
- Inline the entire section in `app/projects/page.tsx`
- Reuse analytics dashboard components directly
