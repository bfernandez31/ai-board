# Research: Comparisons Hub Page

**Date**: 2026-03-27 | **Branch**: `AIB-358-comparisons-hub-page`

## R-001: Project-Level Comparisons Data Source

**Context**: The existing `GET /api/projects/:projectId/comparisons` endpoint reads comparison data from markdown files on the filesystem (`specs/{branch}/comparisons/*.md`). However, the project also has a fully structured `ComparisonRecord` model in the database with rich relational data.

**Decision**: Rewrite the project-level comparisons endpoint to query from the database (`ComparisonRecord` via Prisma) instead of scanning the filesystem.

**Rationale**:
- DB queries are faster and more reliable than filesystem scanning across multiple branch directories
- `ComparisonRecord` contains structured data (winner, participants with ranks/scores, decision points, compliance assessments) that the filesystem approach must parse from markdown
- The existing `toComparisonHistorySummary()` function already transforms DB records into the `ComparisonSummary` type
- All comparisons triggered via the workflow are persisted to the DB via the `POST /api/projects/:projectId/tickets/:id/comparisons` endpoint
- The `ComparisonRecord` table has an index on `(projectId, generatedAt DESC)` optimized for this exact query

**Alternatives considered**:
- Keep filesystem scanning: Rejected — slower, fragile (depends on file naming conventions), provides less structured data
- Hybrid approach (DB + filesystem): Rejected — adds complexity with no benefit since all workflow comparisons are DB-persisted

## R-002: New Comparison Launch Mechanism

**Context**: The spec requires a "New Comparison" button that selects VERIFY-stage tickets and triggers the comparison workflow. Currently, comparisons are triggered via `@ai-board /compare` comments on individual tickets.

**Decision**: Create a new API endpoint `POST /api/projects/:projectId/comparisons/launch` that creates a Job record and dispatches the `ai-board-assist.yml` workflow with the comparison context.

**Rationale**:
- The existing comment-based flow creates a Job with `command: "comment-{stage}"` and dispatches via `dispatchAIBoardWorkflow()` — the hub page needs the same Job + dispatch pattern but without requiring a comment
- The workflow receives the full `comment` text including `/compare` — the hub endpoint can construct this programmatically (e.g., `@ai-board /compare AIB-101 AIB-102`)
- A dedicated endpoint allows proper authorization (user session) vs the existing POST comparison endpoint (workflow token only)
- The Job record provides tracking for the pending/loading state in the UI

**Alternatives considered**:
- Auto-post a comment via API: Rejected — creates phantom comments, confuses activity feed
- Direct workflow dispatch without Job: Rejected — no tracking mechanism for pending state
- Client-side GitHub API call: Rejected — exposes GitHub token to client

## R-003: Inline Detail Expansion Pattern

**Context**: The spec requires clicking a comparison to expand the full dashboard inline. The existing `ComparisonViewer` is a modal dialog wrapping the sub-components.

**Decision**: Create a `ComparisonInlineDetail` wrapper that renders the same sub-components (HeroCard, ParticipantGrid, StatCards, UnifiedMetrics, DecisionPoints, ComplianceHeatmap) without the modal dialog wrapper.

**Rationale**:
- The existing `ComparisonViewer` bundles history sidebar + detail + modal — we only need the detail portion
- All sub-components (`ComparisonHeroCard`, `ComparisonParticipantGrid`, etc.) are already standalone components that accept props
- The existing `useComparisonDetail` hook fetches enriched data for a single comparison — reusable as-is but needs to be adapted for project-level context (comparison ID without ticket ID)
- SC-005 requires 100% component reuse — wrapping existing sub-components achieves this

**Alternatives considered**:
- Refactor ComparisonViewer to support both modal and inline modes: Rejected — adds complexity to working component; separate wrapper is simpler
- Navigate to a separate detail page: Rejected — spec explicitly requires inline expansion

## R-004: Comparison Detail API Adaptation

**Context**: The existing `getComparisonDetailForTicket(ticketId, comparisonId)` requires a `ticketId` to verify access. From the hub page, we have `projectId` and `comparisonId` but not necessarily a specific `ticketId`.

**Decision**: Create a new function `getComparisonDetailForProject(projectId, comparisonId)` that verifies access via project ownership instead of ticket ownership.

**Rationale**:
- The existing function checks `ticketId` to ensure the comparison belongs to the user's ticket — project-level access (`verifyProjectAccess`) is equivalent
- The enrichment logic (telemetry, quality scores, compliance) is the same regardless of access path
- The `ComparisonRecord` model has `projectId` as a direct field, making project-level queries natural

**Alternatives considered**:
- Extract sourceTicketId from comparison and delegate to existing function: Rejected — unnecessary indirection
- Make ticketId optional in existing function: Rejected — changes existing API contract

## R-005: Sidebar Navigation Extension

**Context**: The sidebar navigation is defined in `components/navigation/nav-items.ts` as a static array of `NavigationItem` objects.

**Decision**: Add a new entry `{ id: 'comparisons', label: 'Comparisons', icon: GitCompare, href: '/comparisons', group: 'views' }` to the `NAVIGATION_ITEMS` array.

**Rationale**:
- `GitCompare` from lucide-react is semantically appropriate and already used for the Compare button in the ticket detail modal
- The `views` group places it alongside Board, Activity, Analytics in the top section
- Position after Analytics (index 3) keeps functional views together before Settings

**Alternatives considered**:
- Scale icon: Rejected — less intuitive than GitCompare for comparison functionality
- Place in `bottom` group: Rejected — Comparisons is a primary view, not a utility

## R-006: Pagination Strategy

**Context**: The spec requires cursor-based pagination with "Load More" per the auto-resolved decision.

**Decision**: Use offset-based pagination with "Load More" button, leveraging the existing `limit`/`offset` query params already supported by the comparisons API.

**Rationale**:
- The existing API already supports `limit` and `offset` query parameters with Zod validation
- ComparisonRecords are sorted by `generatedAt DESC` — offset pagination is stable here since new records are prepended
- "Load More" simply increments offset by the page size and appends results
- True cursor-based pagination adds complexity without benefit for this scale (most projects will have <100 comparisons)

**Alternatives considered**:
- Cursor-based pagination with `lastId`: Rejected — overengineered for the expected data volume
- Infinite scroll: Rejected per spec auto-resolved decision (accessibility/back-navigation concerns)

## R-007: VERIFY-Stage Ticket Fetching

**Context**: The "New Comparison" launcher needs to show all tickets currently in VERIFY stage for the project.

**Decision**: Fetch VERIFY-stage tickets from the existing tickets data already available in the project context, or add a lightweight query in the launch dialog.

**Rationale**:
- Tickets have a `stage` field that can be filtered with `where: { projectId, stage: 'VERIFY' }`
- Quality scores are available from the latest verify job for each ticket (same enrichment pattern used in comparison detail)
- The selection UI only needs `ticketKey`, `title`, and optionally `qualityScore` — a lightweight query

**Alternatives considered**:
- Add a dedicated API endpoint for VERIFY tickets: Viable but unnecessary — can use existing ticket listing with stage filter
- Fetch from board state: Rejected — board may not be loaded when user is on comparisons page
