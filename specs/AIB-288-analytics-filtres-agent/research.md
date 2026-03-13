# Phase 0 Research: Analytics Filters by Agent and Status

## Decision 1: Represent analytics scope as explicit API query parameters and response metadata

- **Decision**: Extend `GET /api/projects/{projectId}/analytics` with `statusScope` and `agentScope` query parameters, and return the resolved filter state plus available agent options in the response.
- **Rationale**: The existing dashboard already treats time range as URL-driven state and caches by query key. Adding the new filters to the same API contract keeps server and client calculations aligned, allows React Query to cache distinct scopes correctly, and gives the UI one authoritative source for labels and stable filter options.
- **Alternatives considered**:
  - Derive filters entirely on the client from an unfiltered payload. Rejected because it would duplicate aggregation logic in the browser and risk cross-component drift.
  - Add separate endpoints for filter metadata and filtered analytics. Rejected because it adds latency and creates synchronization problems between agent options and metric payloads.

## Decision 2: Derive the agent dimension from jobs joined through tickets and project default agent

- **Decision**: Build analytics filtering around an effective agent value computed from each job's related ticket: `ticket.agent` when explicitly set, otherwise `project.defaultAgent`.
- **Rationale**: `Job` records do not persist agent directly, but the current schema links every job to a ticket and every ticket to a project with a default agent. This read-only derivation satisfies the feature without a migration and supports the required stable project-wide agent list by scanning project jobs rather than period-scoped results.
- **Alternatives considered**:
  - Add an `agent` column to `Job`. Rejected for this feature because the existing schema and spec assumptions are sufficient for planning, and a migration would broaden scope unnecessarily.
  - Filter only by `ticket.agent` and ignore project defaults. Rejected because tickets without an explicit override would disappear from agent analytics.

## Decision 3: Treat ticket status scope as a shared inclusion rule across job-derived and ticket-derived metrics

- **Decision**: Map the new status filter to ticket stages with three allowed scopes: `shipped` -> `SHIP`, `closed` -> `CLOSED`, `shipped+closed` -> both.
- **Rationale**: The analytics dashboard mixes job-derived metrics and ticket-derived summaries. Using a single stage inclusion rule across all underlying queries is the simplest way to guarantee FR-003 and FR-012, including empty states for combinations with no matches.
- **Alternatives considered**:
  - Filter ticket summary cards only and leave job metrics unchanged. Rejected because it violates the requirement that all summaries and visualizations stay in sync.
  - Introduce independent stage rules per chart. Rejected because it makes the dashboard inconsistent and hard to test.

## Decision 4: Make shipped and closed counts period-aware summary cards with server-provided labels

- **Decision**: Replace the fixed "Tickets Shipped this month" behavior with two ticket-status summary cards whose counts and subtitle labels are calculated on the server from the active time range.
- **Rationale**: The current implementation hard-codes shipped counts to the calendar month in `lib/analytics/queries.ts` and labels them as "this month" in `components/analytics/overview-cards.tsx`. Moving both counts and the human-readable period label into the response avoids UI-only date logic and guarantees consistent empty/zero states.
- **Alternatives considered**:
  - Keep the shipped card client-labeled and add only a closed count. Rejected because it would leave the existing period mismatch unresolved.
  - Merge shipped and closed into one composite card. Rejected because the spec explicitly prefers a separate adjacent closed-ticket card.

## Decision 5: Validate and test the feature at the integration boundary first

- **Decision**: Prioritize Vitest integration coverage for the analytics API, backed by unit coverage for any new filter/label helpers and optional component tests for filter interactions.
- **Rationale**: The constitution requires Vitest-first testing and prefers integration tests for API/database behavior. Most risk sits in server-side filtering, query composition, and response coherence rather than browser-only behavior.
- **Alternatives considered**:
  - Use Playwright to verify the full dashboard. Rejected because the feature does not require browser-only capabilities and Playwright would be slower and less focused.
  - Limit coverage to unit tests. Rejected because the core behavior spans route validation, Prisma queries, and payload composition.
