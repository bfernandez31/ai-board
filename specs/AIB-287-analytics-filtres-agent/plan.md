# Implementation Plan: Analytics Filters (Agent/Status) & Dynamic Shipped Card

**Ticket**: AIB-287
**Branch**: `AIB-287-analytics-filtres-agent`
**Spec**: `specs/AIB-287-analytics-filtres-agent/spec.md`
**Created**: 2026-03-13

---

## Technical Context

### Existing Architecture
- **API**: Single GET endpoint at `/api/projects/[projectId]/analytics` accepting `range` query param
- **Query Layer**: `lib/analytics/queries.ts` — 8 parallel Prisma queries orchestrated by `getAnalyticsData()`
- **Types**: `lib/analytics/types.ts` — `AnalyticsData`, `OverviewMetrics`, `TimeRange`, etc.
- **Aggregations**: `lib/analytics/aggregations.ts` — Pure date/format/calculation utilities
- **Dashboard**: `components/analytics/analytics-dashboard.tsx` — Client component with TanStack Query (15s polling)
- **Overview Cards**: `components/analytics/overview-cards.tsx` — 4-card grid (Total Cost, Success Rate, Avg Duration, Tickets Shipped)
- **Time Range Selector**: `components/analytics/time-range-selector.tsx` — shadcn Select dropdown
- **Page**: `app/projects/[projectId]/analytics/page.tsx` — Server component with initial data hydration
- **Query Keys**: `app/lib/query-keys.ts` — `queryKeys.analytics.data(projectId, range)`

### Key Findings
1. **Tickets Shipped BUG**: `getOverviewMetrics()` hardcodes `monthStart = new Date(now.getFullYear(), now.getMonth(), 1)` for ticket count — ignores selected time range (lines 94-101 of queries.ts)
2. **No stage filtering**: All job queries filter only by `projectId`, `status`, and `completedAt` — no ticket stage awareness
3. **No model filtering**: No queries filter by `Job.model` field
4. **Velocity hardcoded**: `getVelocityData()` only queries `stage: 'SHIP'` with no configurability
5. **URL state**: Only `?range=` param exists; no status or agent params
6. **No analytics tests exist**: Zero test files covering analytics queries, types, or components

### Database Schema (Relevant Fields)
- `Job.model`: `String @db.VarChar(50)` — AI model identifier (e.g., "claude-opus-4")
- `Job.completedAt`: `DateTime?` — Used for time range filtering
- `Job.ticketId`: `Int` — Foreign key to Ticket
- `Ticket.stage`: `Stage` enum — INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP, CLOSED
- `Ticket.updatedAt`: `DateTime` — Used for shipped/closed time-based counting
- **Indices**: `[projectId, startedAt]`, `[projectId, stage]`, `[updatedAt]`

### Dependencies
- shadcn/ui Select component (already in use for time range)
- TanStack Query v5 (already in use for polling)
- Recharts 2.x (already in use for charts)
- No new dependencies required

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new types explicitly defined; no `any` usage |
| II. Component-Driven | PASS | New filters use shadcn/ui Select; feature folder structure preserved |
| III. Test-Driven | PASS | Unit tests for aggregation utils, integration tests for API, component tests for filters |
| IV. Security-First | PASS | Zod validation on new query params; Prisma parameterized queries only |
| V. Database Integrity | PASS | Read-only queries; no schema changes required |
| VI. AI-First | PASS | No tutorial/documentation files; all design in specs/ |
| Colors | PASS | All styling via Tailwind semantic tokens |
| State Management | PASS | URL query params + TanStack Query; no new state libs |

**Gate**: ALL PASS — no violations.

---

## Phase 0: Research

### Decision 1: Filter Parameter Design
- **Decision**: Add `status` and `agent` as URL query parameters alongside existing `range`
- **Rationale**: Consistent with existing `range` param pattern; enables URL sharing and refresh persistence (FR-011)
- **Alternatives**: React state only (loses URL persistence), localStorage (not shareable)

### Decision 2: Query-Level vs Client-Level Filtering
- **Decision**: Filter at the Prisma query level (server-side) for all metrics
- **Rationale**: Reduces data transfer; avoids client-side recomputation of aggregations; consistent with existing query pattern where each metric function receives filter params
- **Alternatives**: Fetch all data and filter client-side (simpler but wasteful for large datasets)

### Decision 3: Ticket-to-Job Relationship for Stage Filtering
- **Decision**: Use Prisma's relational filtering `{ ticket: { stage: { in: stages } } }` on job queries to filter by ticket stage
- **Rationale**: Prisma natively supports relation-based filtering; the `Job.ticketId` foreign key exists; avoids manual joins
- **Alternatives**: Two-step query (fetch ticket IDs then filter jobs) — more code, worse performance

### Decision 4: Agent Display Names
- **Decision**: Display raw `model` values as-is (e.g., "claude-opus-4", "codex") without transformation
- **Rationale**: Consistent with spec's CONSERVATIVE decision; avoids maintaining a mapping table; model values are already human-readable slugs
- **Alternatives**: Mapping table (e.g., "claude-opus-4" → "Claude Opus 4") — adds maintenance overhead for marginal UX gain

### Decision 5: Status Filter Default Behavior
- **Decision**: Default to "Shipped" (SHIP only) to maintain backward compatibility with existing dashboard behavior
- **Rationale**: Current dashboard only shows SHIP data; defaulting to SHIP ensures no behavior change for existing users
- **Alternatives**: Default to "Shipped + Closed" — would change existing dashboard data unexpectedly

### Decision 6: Workflow Distribution & Ticket-Count Queries
- **Decision**: Apply status filter to `workflowDistribution` and `velocity` queries (ticket-level), and use ticket stage relation for job-level queries
- **Rationale**: FR-002 requires global application; consistency across all widgets
- **Alternatives**: Only filter job-based metrics — would create data inconsistency between cards/charts

---

## Phase 1: Design & Contracts

### Data Model Changes

See `data-model.md` for full entity details.

**Type Changes** (`lib/analytics/types.ts`):
1. Add `StatusFilter = 'shipped' | 'closed' | 'all'` type
2. Add `ticketsClosed: number` to `OverviewMetrics`
3. Update `OverviewMetrics.ticketsShipped` JSDoc to reflect dynamic time range
4. Add `AnalyticsFilters` interface: `{ range: TimeRange; status: StatusFilter; agent: string | null }`
5. Add `availableAgents: string[]` to `AnalyticsData` response

**No Prisma Schema Changes**: All required fields (`Job.model`, `Ticket.stage`) already exist.

### API Contract Changes

See `contracts/analytics-api-v2.yaml` for full OpenAPI spec.

**Endpoint**: `GET /api/projects/{projectId}/analytics`

**New Query Parameters**:
| Param | Type | Default | Values |
|-------|------|---------|--------|
| `range` | string | `30d` | `7d`, `30d`, `90d`, `all` |
| `status` | string | `shipped` | `shipped`, `closed`, `all` |
| `agent` | string | (none) | Any valid model string from jobs |

**Response Changes**:
- `overview.ticketsShipped` — Now respects time range (was hardcoded to current month)
- `overview.ticketsClosed` — NEW: Count of CLOSED tickets in selected time period
- `availableAgents` — NEW: Array of distinct model strings with at least 1 job

### Component Architecture

**New Components**:
1. `components/analytics/status-filter.tsx` — shadcn Select with 3 options
2. `components/analytics/agent-filter.tsx` — shadcn Select with dynamic options

**Modified Components**:
1. `components/analytics/analytics-dashboard.tsx` — Add filter state, URL sync, pass filters to query
2. `components/analytics/overview-cards.tsx` — Add "Tickets Closed" card, update Shipped card label
3. `app/projects/[projectId]/analytics/page.tsx` — Parse new query params, pass to initial fetch
4. `app/api/projects/[projectId]/analytics/route.ts` — Parse & validate new query params

**Modified Library Files**:
1. `lib/analytics/types.ts` — New types/interfaces
2. `lib/analytics/queries.ts` — Add filter params to all query functions
3. `lib/analytics/aggregations.ts` — Add `getTimeRangeLabel()` utility
4. `app/lib/query-keys.ts` — Expand key to include status/agent

### Query Key Update

```typescript
// Current
queryKeys.analytics.data(projectId, range)
// ['analytics', projectId, range]

// New
queryKeys.analytics.data(projectId, range, status, agent)
// ['analytics', projectId, range, status, agent]
```

### Filter Flow

```
URL params (?range=30d&status=shipped&agent=claude-opus-4)
  → Page server component (parse + validate)
  → AnalyticsDashboard client component (state + TanStack Query)
  → GET /api/projects/{id}/analytics?range=30d&status=shipped&agent=claude-opus-4
  → getAnalyticsData(projectId, range, status, agent)
  → All 8 query functions receive filters
  → Prisma queries include stage/model WHERE clauses
```

---

## Phase 2: Implementation Strategy

### Execution Order (Dependency-Driven)

1. **Types first**: Update `lib/analytics/types.ts` with new types
2. **Aggregation utils**: Add `getTimeRangeLabel()` to `aggregations.ts`
3. **Query layer**: Modify all query functions in `queries.ts` to accept and apply filters
4. **API route**: Add Zod validation for new params, pass to `getAnalyticsData()`
5. **Query keys**: Update `query-keys.ts`
6. **Dashboard component**: Add filter state, URL sync, pass to query
7. **Filter components**: Create status-filter.tsx and agent-filter.tsx
8. **Overview cards**: Add Tickets Closed card, fix Shipped card label
9. **Page component**: Parse new URL params for SSR hydration
10. **Tests**: Unit (aggregation utils), integration (API with filters), component (filter UIs)

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Performance degradation from relation filtering | Low | Medium | Existing index on `[projectId, stage]` covers the WHERE clause |
| Empty states with narrow filter combos | Medium | Low | All charts already handle empty data gracefully |
| Inconsistent model strings in DB | Low | Low | "All Agents" default; raw values shown as-is |
| Breaking existing dashboard behavior | Low | High | Default status=shipped preserves current behavior |

---

## Generated Artifacts

- `specs/AIB-287-analytics-filtres-agent/plan.md` (this file)
- `specs/AIB-287-analytics-filtres-agent/research.md`
- `specs/AIB-287-analytics-filtres-agent/data-model.md`
- `specs/AIB-287-analytics-filtres-agent/contracts/analytics-api-v2.yaml`
- `specs/AIB-287-analytics-filtres-agent/quickstart.md`
