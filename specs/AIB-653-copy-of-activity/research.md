# Research: Copy of Activity Heatmap on Projects Page

## Technical Context Resolution

No `NEEDS CLARIFICATION` placeholders remained in the feature spec after setup. Phase 0 research focused on implementation choices, existing-file discovery, and reuse patterns required by the constitution.

## Decisions

### Decision: Server-render the initial heatmap state from the projects page

- Rationale: FR-022 requires the final heatmap content or final empty state on first render with no spinner-only gap. `app/projects/page.tsx` already fetches projects directly on the server and can do the same for the initial heatmap payload.
- Alternatives considered:
  - Client-only fetch on mount: rejected because it risks a visible loading flash before the heatmap appears.
  - Embedding heatmap fields into `GET /api/projects`: rejected because the current list response serves the cards and should remain stable.

### Decision: Add a dedicated authenticated aggregate endpoint at `GET /api/projects/activity`

- Rationale: period and agent changes need lightweight refetches after initial render, but the aggregation is cross-project rather than per-project. A dedicated route isolates the contract and avoids bloating `GET /api/projects`.
- Alternatives considered:
  - Reusing `GET /api/projects`: rejected because it would overload a list contract with expensive derived analytics.
  - No API route, server navigation only on every filter change: rejected because background refreshes and smooth filter changes would be awkward.

### Decision: Centralize aggregation logic in a shared authenticated query helper

- Rationale: both the server page and API route need the same owner/member scoping, shipped-count rules, period boundaries, and agent-resolution semantics. A shared helper prevents drift.
- Alternatives considered:
  - Duplicate Prisma queries in page and route: rejected because the two code paths would diverge quickly.
  - Compute everything entirely in the client: rejected because raw job/ticket data should not be exposed to the browser just to derive aggregates.

### Decision: Remove the fixed-height scrolling container from the projects grid wrapper

- Rationale: `components/projects/projects-container.tsx` currently traps the project cards inside a max-height scroll region, which conflicts with FR-030 requiring the page itself to scroll naturally to the new heatmap section.
- Alternatives considered:
  - Keep the inner scroller and place the heatmap outside it: rejected because it creates two competing vertical scroll regions on the same page.
  - Shrink the heatmap into the existing scroll container: rejected because the feature is specified as a full-width section below the cards.

### Decision: Reuse analytics URL-sync and polling semantics for filter state

- Rationale: the analytics dashboard already restores filters from search params, seeds initial server data, and performs 15-second background refreshes without resetting the page.
- Alternatives considered:
  - Store filters in local state only: rejected because FR-018 requires copied URLs to restore the same view.
  - Full page reload on every filter change: rejected because it adds unnecessary navigation churn for an in-page control.

## Existing Files

### Core page and data access

- `app/projects/page.tsx`
  - Covers: server-rendered projects page, direct data access via `getUserProjects()`.
  - Action: extend.
  - Why: this is the correct place to parse heatmap search params and fetch initial heatmap data for first render.
- `components/projects/projects-container.tsx`
  - Covers: project cards grid and current scroll wrapper.
  - Action: extend.
  - Why: the heatmap sits directly below the grid and this file currently enforces the scroll behavior that must change.
- `components/projects/project-card.tsx`
  - Covers: individual project cards and existing visual style.
  - Action: reuse as-is.
  - Why: heatmap should append below cards without changing card responsibilities.
- `lib/db/projects.ts`
  - Covers: authenticated owner/member project access and list queries.
  - Action: extend or add a sibling shared query helper alongside it.
  - Why: cross-project aggregation must use the same authorization scope as the rest of the projects surface.
- `app/lib/types/project.ts`
  - Covers: shared projects page response/view model types.
  - Action: extend.
  - Why: initial heatmap payload and filter option types belong with the page-level project types.

### API and filter/reference patterns

- `app/api/projects/route.ts`
  - Covers: authenticated `GET /api/projects` and structured API error handling.
  - Action: pattern reference.
  - Why: the new aggregate route should match its auth and response style.
- `app/api/projects/[projectId]/activity/route.ts`
  - Covers: protected aggregation endpoint with query validation and parallel Prisma reads.
  - Action: pattern reference.
  - Why: heatmap aggregation is different in scope but should follow the same validate-then-query route structure.
- `app/projects/[projectId]/analytics/page.tsx`
  - Covers: search-param parsing, validation, server-fetched initial data.
  - Action: pattern reference.
  - Why: the projects page heatmap needs the same initial URL restoration behavior.
- `components/analytics/analytics-dashboard.tsx`
  - Covers: URL-synced filters, `initialData`, background refresh, and `router.push(..., { scroll: false })`.
  - Action: pattern reference.
  - Why: the heatmap client component needs equivalent behavior for period and agent filters.
- `app/lib/hooks/queries/use-project-activity.ts`
  - Covers: TanStack Query polling configuration and background refresh semantics.
  - Action: pattern reference.
  - Why: the heatmap should preserve visible content while refetching.
- `app/lib/utils/agent-resolution.ts`
  - Covers: effective agent resolution and agent labels.
  - Action: reuse/extend minimally.
  - Why: FR-015 requires ticket override > project default.

### UI reference files

- `components/comparison/comparison-compliance-heatmap.tsx`
  - Covers: heatmap-style cell rendering, sticky axis labels, overflow-x scrolling, tooltip wrapping.
  - Action: pattern reference.
  - Why: the projects heatmap can reuse its table/grid interaction approach without copying its domain model.

### Tests to extend first

- `tests/integration/projects/crud.test.ts`
  - Covers: current `/api/projects` integration behavior and project API conventions.
  - Action: extend if the new aggregate route is kept under the projects API family and the added assertions remain cohesive.
  - Why: constitution requires extending existing projects-domain integration tests before creating duplicates.
- `tests/integration/projects/projects-with-health.test.ts`
  - Covers: enriching the projects API family with additional derived data.
  - Action: pattern reference, or extend if aggregate assertions fit better here.
  - Why: it already verifies derived project payload fields through integration tests.
- `tests/integration/activity/api.test.ts`
  - Covers: aggregation route testing, pagination semantics, and protected access assertions.
  - Action: pattern reference.
  - Why: the new route should mirror its auth/validation test style.
- `tests/unit/agent-resolution.test.ts`
  - Covers: shared effective-agent helper behavior.
  - Action: extend only if helper logic or labels change.
  - Why: avoid creating another agent-resolution test file.
- `tests/unit/components/comparison-compliance-heatmap.test.tsx`
  - Covers: sticky labels, heatmap cells, empty states.
  - Action: pattern reference for a new projects heatmap component test.
  - Why: closest existing UI test for a heatmap-like surface.

## Patterns to Follow

### Error handling patterns

- `app/api/projects/route.ts:22-44`
  - Pattern: authenticate inside the route, map known auth failures to structured 401 JSON, log unexpected failures, and return a structured 500 body.
  - Apply to this feature: `GET /api/projects/activity` should return explicit 400/401/500 responses instead of silently collapsing to an empty heatmap.
- `app/api/projects/[projectId]/activity/route.ts:62-82`
  - Pattern: validate query params with Zod before querying, reject invalid cursors/IDs early, and avoid partial execution on bad input.
  - Apply to this feature: validate `period` and `agent` before aggregation; unsupported values should never fall through to Prisma.
- `app/projects/[projectId]/analytics/page.tsx:23-47`
  - Pattern: parse route/search params through local helpers and fallback to safe defaults rather than trusting raw query strings.
  - Apply to this feature: period/year search params should be normalized server-side before initial render.

### Security patterns

- `lib/db/projects.ts:27-36`
  - Pattern: scope project queries to owner-or-member access at the database layer via `requireAuth()`.
  - Apply to this feature: the shared aggregation query must use the same owner/member restriction and never aggregate across projects outside the caller’s access.
- `app/api/projects/[projectId]/activity/route.ts:59-60`
  - Pattern: verify access before issuing data queries.
  - Apply to this feature: the cross-project route should authenticate before reading user/account/project history.
- `app/api/projects/route.ts:13-20`
  - Pattern: put Zod input constraints next to the route for consistent validation.
  - Apply to this feature: filter schema should be explicit and typed, especially for year selection and agent values.

### State management patterns

- `components/analytics/analytics-dashboard.tsx:60-109`
  - Pattern: derive initial filter state from `useSearchParams` plus server `initialData`, then push updated params with `router.push(..., { scroll: false })`.
  - Apply to this feature: period and agent controls should use the same URL-sync approach so copied URLs restore the same view.
- `components/analytics/analytics-dashboard.tsx:92-103`
  - Pattern: prefer `initialData` when filters still match, so the UI has stable content immediately and refetches in the background.
  - Apply to this feature: the heatmap must preserve first-render content and avoid blanking during refetch.
- `app/lib/hooks/queries/use-project-activity.ts:56-85`
  - Pattern: use TanStack Query polling with `staleTime` and `refetchInterval` rather than manual intervals.
  - Apply to this feature: heatmap refresh should use the established 15-second polling model.
- `components/comparison/comparison-compliance-heatmap.tsx:61-121`
  - Pattern: wrap wide heatmap content in `overflow-x-auto` and pin the left axis using `sticky left-0`.
  - Apply to this feature: mobile horizontal scroll with pinned weekday labels should follow the same sticky-axis structure.

## Testing Strategy Notes

- Default to Vitest integration coverage for the new aggregate route because the feature depends on authenticated database reads and shipped-job semantics.
- Keep E2E narrowly focused on URL restoration and mobile scrolling because those are the two browser-dependent behaviors that integration tests cannot validate well.
- Avoid duplicating project-domain integration files unless adding the route assertions would make an existing file incoherent.
