# Research: Activity Heatmap on Projects Page

**Branch**: `AIB-701-activity-heatmap-on`  
**Created**: 2026-04-20

## Resolved Unknowns

### 1. API surface for background refresh

- Decision: Use a dedicated `GET /api/projects/activity-heatmap` route backed by a shared server aggregation helper instead of extending `GET /api/projects`.
- Rationale: The projects list already returns project-card data, and the heatmap needs independent 15-second refresh plus filter-specific payloads. A dedicated route keeps polling focused and avoids coupling heatmap refresh to project-card serialization.
- Alternatives considered:
  - Extend `GET /api/projects` with heatmap data. Rejected because it would bloat the list response and force the page to refetch unrelated card data on every heatmap refresh.
  - Fetch directly inside the client component without a route. Rejected because the app already uses server-rendered initial data with route-backed refresh for interactive dashboards.

### 2. Cross-project aggregation source

- Decision: Aggregate directly from `Job`, `Ticket`, `Project`, and `User` data rather than deriving the heatmap from the existing project activity feed.
- Rationale: The spec’s shipped-ticket rule depends on successful `ship` job completions, and the heatmap needs effective-agent filtering plus optional cost totals. Direct aggregation from jobs and related ticket/project fields is simpler and more accurate than reconstructing from generic activity events.
- Alternatives considered:
  - Reuse `app/api/projects/[projectId]/activity/route.ts` event output. Rejected because it is project-scoped, cursor-paginated, and not shaped for daily cross-project totals.
  - Derive shipped totals from `Ticket.stage === SHIP`. Rejected because FR-009 and FR-010 explicitly forbid stage-only counting.

### 3. Period and URL encoding

- Decision: Persist heatmap state in the projects page URL using `activityPeriod` and `activityAgent`, with `activityPeriod` accepting `last-12-months` or a calendar year string such as `2026`.
- Rationale: Dedicated parameter names avoid collisions with future page filters. Encoding the chosen calendar year directly in the value keeps parsing simple and supports shareable URLs.
- Alternatives considered:
  - Generic `period` and `agent` params. Rejected because the projects page may gain unrelated filters later.
  - Separate `mode=year&year=2026` params. Rejected because one domain-specific param is easier to validate and copy.

### 4. First-render and refresh strategy

- Decision: Server-render the default heatmap payload in `app/projects/page.tsx`, then hydrate a client component that refreshes in the background via TanStack Query without clearing the visible view first.
- Rationale: This matches the existing analytics page architecture and satisfies FR-025 and FR-026 without inventing a second data-loading pattern.
- Alternatives considered:
  - Client-only fetch on mount. Rejected because the spec forbids a first-render loading flash.
  - Full-page route refresh on filter changes. Rejected because it would produce more layout churn than the existing client-filter pattern.

### 5. Mobile scrolling and pinned labels

- Decision: Use `ScrollArea` for horizontal overflow and CSS sticky positioning for the left-side day labels while keeping the heatmap cells at a fixed practical size.
- Rationale: The repo already uses Radix `ScrollArea` plus sticky headers/columns in similar dense data UIs. Reusing those primitives reduces layout risk and supports the mobile pinned-label requirement without custom gesture code.
- Alternatives considered:
  - Plain `overflow-x-auto` on the entire card. Rejected because sticky/pinned labels become harder to preserve reliably.
  - Shrink cells to fit the viewport. Rejected because the spec forbids impractically small tap targets.

### 6. Calendar basis

- Decision: Aggregate by UTC completion date.
- Rationale: Existing analytics helpers use ISO/UTC-derived date bucketing (`toISOString()` and ISO week helpers), and the spec asks for one consistent calendar basis for the whole view.
- Alternatives considered:
  - Viewer-local timezone bucketing. Rejected because the current codebase does not have a user-timezone preference source for server-rendered aggregation.

## Existing Files

### Projects page and layout domain

| File | What it covers | Extend or create |
|------|----------------|------------------|
| `app/projects/page.tsx` | Server-rendered projects page shell, project fetch, header, quota gate, and `ProjectsContainer` composition | Extend |
| `components/projects/projects-container.tsx` | Projects grid container and current vertical overflow behavior | Extend |
| `components/projects/project-card.tsx` | Individual project card UI, navigation, health score, and shipped-ticket summary | Reuse as-is |
| `app/lib/types/project.ts` | Shared project-list response mapping for cards | Reuse as-is unless `/api/projects` changes |

### Analytics and aggregation references

| File | What it covers | Extend or create |
|------|----------------|------------------|
| `app/projects/[projectId]/analytics/page.tsx` | Server-rendered initial analytics payload with validated URL filters | Reuse as pattern reference |
| `components/analytics/analytics-dashboard.tsx` | Client filter state, URL synchronization, React Query hydration, and background refresh | Reuse as pattern reference |
| `lib/analytics/aggregations.ts` | Date-range helpers, labels, daily/weekly bucketing utilities | Reuse as pattern reference |
| `lib/analytics/queries.ts` | Effective-agent filtering and server aggregation patterns | Reuse as pattern reference |
| `app/lib/utils/agent-resolution.ts` | Shared agent labels and effective-agent resolution | Reuse as pattern reference |

### Route and auth references

| File | What it covers | Extend or create |
|------|----------------|------------------|
| `app/api/projects/route.ts` | Authenticated user-level projects route with structured error handling | Reuse as pattern reference |
| `app/api/projects/[projectId]/analytics/route.ts` | Zod query validation for analytics filters and route response handling | Reuse as pattern reference |
| `lib/db/projects.ts` | Owner/member project access query pattern | Reuse as pattern reference |
| `lib/db/users.ts` | Current-user lookup/auth helpers; needed to derive account creation year | Extend if a helper is added |

### UI pattern references

| File | What it covers | Extend or create |
|------|----------------|------------------|
| `components/comparison/comparison-compliance-heatmap.tsx` | Heatmap-like table with sticky first column and tooltips | Reuse as pattern reference |
| `components/ui/scroll-area.tsx` | Shared Radix scroll-area primitive with viewport refs | Reuse as pattern reference |
| `components/board/stage-column.tsx` | Scroll viewport state handling and nontrivial mobile scrolling behavior | Reuse as pattern reference |

### Existing test files to extend first

| File | Coverage today | Extend or create |
|------|----------------|------------------|
| `tests/unit/query-keys.test.ts` | Query-key shapes for existing dashboard fetches | Extend |
| `tests/integration/projects/projects-with-health.test.ts` | `GET /api/projects` response-shape coverage | Reuse only if `/api/projects` is changed |
| `tests/integration/analytics/analytics-route.test.ts` | Aggregation/filter route coverage patterns | Reuse as reference; do not extend for a separate heatmap route |
| `tests/unit/components/analytics-dashboard.test.tsx` | Client filter hydration and URL-sync testing pattern | Reuse as reference |
| `tests/unit/components/comparison-compliance-heatmap.test.tsx` | Heatmap rendering/sticky-column component test pattern | Reuse as reference |

### New files justified by missing coverage

| File | Why new is justified |
|------|----------------------|
| `lib/projects/activity-heatmap.ts` | No existing cross-project daily aggregation helper covers this responsibility. |
| `app/api/projects/activity-heatmap/route.ts` | No current user-level projects route handles heatmap-specific filters and payload shape. |
| `components/projects/project-activity-heatmap.tsx` | No existing projects-page component owns this interactive visualization. |
| `tests/unit/lib/projects/activity-heatmap.test.ts` | No existing unit file covers this new aggregation helper without mixing unrelated analytics semantics. |
| `tests/unit/components/projects/project-activity-heatmap.test.tsx` | There is no current projects heatmap/component test file to extend. |
| `tests/integration/projects/activity-heatmap-route.test.ts` | No existing integration file covers a dedicated cross-project heatmap route. |

## Patterns to Follow

### 1. Owner/member access filtering before aggregation

- Reference: `lib/db/projects.ts:28-78`
- Error handling pattern:
  - Authenticate the user before querying accessible projects.
- Security pattern:
  - Treat owner and member access as equally valid visibility paths; do not expose projects outside that set.
- State-management pattern:
  - Filter in the database query, then project only the fields needed for downstream aggregation.

### 2. Server-rendered initial payload with client refresh

- Reference: `app/projects/[projectId]/analytics/page.tsx:49-99`
- Error handling pattern:
  - Validate and normalize URL filters before issuing the server query.
- Security pattern:
  - Keep the server helper authoritative for the initial payload; the client should not invent default data.
- State-management pattern:
  - Fetch the default view on the server and hand it to a client component as `initialData`.

### 3. Client filter state mirrors URL state

- Reference: `components/analytics/analytics-dashboard.tsx:43-109`
- Error handling pattern:
  - Keep prior data visible while new filters refetch.
- Security pattern:
  - Filter options come from server responses, not from a client-maintained fallback list.
- State-management pattern:
  - Use React Query keys that include every filter dimension, update local state first, then push query params without scrolling the page.

### 4. Effective-agent resolution stays server authoritative

- Reference: `app/lib/utils/agent-resolution.ts:41-46` and `lib/analytics/queries.ts:51-68`
- Error handling pattern:
  - Normalize unsupported or unavailable filters back to `all`.
- Security pattern:
  - Agent filtering is derived from persisted ticket/project values, not client-submitted labels.
- State-management pattern:
  - Resolve effective agent as `ticket.agent ?? project.defaultAgent` for both filtering and option generation.

### 5. Date bucketing should reuse existing ISO/UTC helper style

- Reference: `lib/analytics/aggregations.ts:57-145`
- Error handling pattern:
  - Use one explicit calendar basis across the feature rather than mixing local and UTC dates.
- Security pattern:
  - No user input directly controls raw date arithmetic without validation.
- State-management pattern:
  - Build normalized date keys first, then aggregate counts and labels from those keys.

### 6. Route validation and structured error responses

- Reference: `app/api/projects/route.ts:23-45` and `app/api/projects/[projectId]/analytics/route.ts:7-50`
- Error handling pattern:
  - Parse query params with Zod and return `400` for invalid filters, `401/403` for auth failures, and `500` only for unexpected errors.
- Security pattern:
  - Authenticate before data access and avoid leaking internal errors in the response body.
- State-management pattern:
  - Keep route handlers thin by delegating aggregation to a shared helper.

### 7. Heatmap UI should reuse sticky-column and tooltip structure

- Reference: `components/comparison/comparison-compliance-heatmap.tsx:61-122`
- Error handling pattern:
  - Provide a clear empty/unavailable state instead of rendering meaningless zeroed cells.
- Security pattern:
  - Tooltip content should display only user-visible aggregate data, not raw internal IDs.
- State-management pattern:
  - Keep sticky labels outside the horizontally scrolling cell region or apply sticky positioning on dedicated label cells.

### 8. Mobile scrolling should use the shared scroll-area primitive

- Reference: `components/ui/scroll-area.tsx:8-29` and `components/board/stage-column.tsx:165-217`
- Error handling pattern:
  - Track viewport scroll state through refs instead of direct DOM queries scattered across the tree.
- Security pattern:
  - No additional browser APIs or unsafe listeners are needed beyond the viewport element.
- State-management pattern:
  - Keep the scroll container explicit so labels remain pinned while the grid moves horizontally.

## Source Notes

- The current `components/projects/projects-container.tsx` uses `overflow-y-auto max-h-[calc(100vh-200px)]`, which conflicts with FR-030. The implementation should remove that vertical trap so the page itself scrolls naturally to the heatmap.
- The codebase has no existing cross-project heatmap or projects-page component tests, so the new helper/route/component test files above are constitution-compliant additions rather than duplication.
