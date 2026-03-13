# Phase 0 Research: Analytics Filters and Dynamic Shipping Metrics

**Feature**: AIB-289 - Analytics Filters and Dynamic Shipping Metrics
**Date**: 2026-03-13
**Status**: Complete

## Research Summary

This document resolves the analytics semantics that were implicit in the existing implementation so Phase 1 can extend the dashboard without adding a second analytics API or a schema migration.

---

## 1. Effective Agent Attribution

### Decision
Use the effective ticket agent (`ticket.agent ?? project.defaultAgent`) as the analytics agent dimension, and derive available agent filter options only from tickets that actually have recorded job history in the current project.

### Rationale
- `Job` has telemetry fields but no `agent` column in `prisma/schema.prisma`.
- The workflow layer already resolves the effective agent with the same precedence in `lib/workflows/transition.ts`.
- `Project.defaultAgent` is non-null, so historical jobs tied to tickets without overrides still resolve to a stable agent label.
- Restricting options to agents with project job history prevents empty, misleading filter values.

### Alternatives Considered
- **Use `ticket.agent` only**: Rejected because tickets inheriting the project default would disappear from agent-specific analytics.
- **Use a fixed global enum list**: Rejected because it would surface agents with no data in the selected project.
- **Add `agent` to `Job` via schema change**: Rejected for this ticket because the spec can be satisfied with existing data and no migration.

---

## 2. Ticket Outcome Filter Semantics

### Decision
Implement one outcome filter with three values: `shipped`, `closed`, and `all-completed`, where job-backed analytics include only jobs whose parent tickets are currently in the selected terminal outcome set.

### Rationale
- The feature spec defines ticket outcome as the scoping dimension for all metrics and charts.
- Tickets already encode terminal outcomes via `stage = SHIP` and `stage = CLOSED`.
- Filtering jobs by parent ticket outcome keeps cost, tokens, tools, workflow, and success metrics aligned with the selected ticket set.

### Alternatives Considered
- **Filter charts only by job timestamps**: Rejected because outcome selection would not affect most charts.
- **Filter by tickets that ever touched SHIP/CLOSED historically**: Rejected because the current schema does not store full transition history.
- **Create separate endpoints per outcome**: Rejected because the current dashboard already centralizes analytics in one route and one response payload.

---

## 3. Period-Accurate Completion Counts

### Decision
Use outcome-specific timestamps for completion cards:
- shipped counts use tickets in `SHIP` filtered by `ticket.updatedAt`
- closed counts use tickets in `CLOSED` filtered by `ticket.closedAt`

### Rationale
- The current analytics query incorrectly counts shipped tickets from the current calendar month regardless of selected range.
- `closedAt` is explicitly set when a ticket is closed in `app/api/projects/[projectId]/tickets/[id]/close/route.ts`.
- `updatedAt` is the only durable timestamp available for when a ticket most recently reached and remains in `SHIP`.
- Separate cards keep shipped and closed independent, which matches the spec’s auto-resolved decision.

### Alternatives Considered
- **Continue using current month for shipped**: Rejected because it violates FR-008 and FR-009.
- **Use `updatedAt` for both shipped and closed**: Rejected because closed tickets already have a dedicated lifecycle timestamp.
- **Merge shipped and closed into one completion card**: Rejected because it obscures the comparison the spec explicitly wants users to make quickly.

---

## 4. Empty-State Behavior

### Decision
Remove the dashboard-level `hasData` bailout and keep overview cards visible while each chart or metric renders its own filter-aware empty state.

### Rationale
- The current `analytics-dashboard.tsx` hides the entire dashboard when no job telemetry is present for the selected range.
- The new shipped and closed cards must remain visible even when no matching jobs exist.
- Existing chart components already support local empty messages when their datasets are empty.

### Alternatives Considered
- **Keep the global empty state**: Rejected because it would hide valid completion-card data and conflict with FR-013.
- **Show stale prior chart data when filters empty out**: Rejected because it directly violates FR-013 and FR-014.
- **Add a second API call for completion cards only**: Rejected because one coherent payload is simpler and keeps filter transitions atomic.

---

## 5. API Shape for Filters and Metadata

### Decision
Extend the existing `GET /api/projects/:projectId/analytics` contract with `range`, `outcome`, and `agent` query params, and return both applied filters and available agent options in the response.

### Rationale
- The dashboard already depends on a single analytics payload for synchronized rendering.
- Returning available agents from the analytics endpoint avoids a second project-specific metadata fetch.
- Including applied filters in the response simplifies SSR hydration and client-side validation.

### Alternatives Considered
- **Create a dedicated `/analytics/filters` endpoint**: Rejected as unnecessary network and cache complexity.
- **Keep filter state client-only with no server echo**: Rejected because SSR and URL hydration become harder to validate.
- **Infer agent options from enum constants in the browser**: Rejected because the spec requires project-scoped options only.

---

## 6. Test Layer Selection

### Decision
Use Vitest integration tests for API/query semantics and lightweight unit/component tests for dashboard state synchronization and query keys.

### Rationale
- The core risk is cross-table filtering correctness, which is best covered at the integration layer.
- The UI behavior is selector-driven and does not require a real browser environment.
- This matches the constitution’s “default to integration tests when unsure” rule.

### Alternatives Considered
- **Playwright E2E**: Rejected because the feature does not require browser-only behavior.
- **Unit tests only**: Rejected because filter correctness depends on Prisma queries across `Ticket`, `Project`, and `Job`.

---

## Final Outcome

All Technical Context unknowns are resolved. No open clarifications remain for Phase 1 design.
