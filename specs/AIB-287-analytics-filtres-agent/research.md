# Research: Analytics Filters (Agent/Status) & Dynamic Shipped Card

**Ticket**: AIB-287
**Date**: 2026-03-13

---

## Research Area 1: Ticket Stage Filtering on Job Queries

**Question**: How to efficiently filter job-level metrics by ticket stage (SHIP/CLOSED)?

**Findings**:
- Prisma supports relational filtering: `{ ticket: { stage: { in: ['SHIP'] } } }` in job `where` clauses
- The `Job` model has `ticketId` FK with a `ticket` relation defined in schema
- Existing index `@@index([projectId, stage])` on Ticket table supports efficient stage lookups
- Prisma generates an INNER JOIN under the hood, which is performant with indexed FKs

**Decision**: Use Prisma relational filtering `{ ticket: { stage: { in: stages } } }` on all job queries
**Alternatives Considered**:
1. Two-step query (fetch ticket IDs, then filter jobs by ticketId IN) — More code, no performance benefit
2. Add `stage` denormalized field to Job — Schema change, data sync complexity, overkill

---

## Research Area 2: Agent/Model Filtering

**Question**: How are model values stored and what distinct values exist?

**Findings**:
- `Job.model` is `String @db.VarChar(50)` — stores the raw model identifier
- Values are consistent slugs like `claude-opus-4`, `claude-sonnet-4` (set by workflow dispatch)
- Some jobs may have null/empty model (older jobs before the field was added)
- Distinct model query: `prisma.job.findMany({ where: { projectId }, select: { model: true }, distinct: ['model'] })`

**Decision**: Query distinct non-null model values per project; display raw values; null-model jobs included in "All Agents" but excluded from specific agent filters
**Alternatives Considered**:
1. Maintain a lookup table mapping model slugs to display names — Over-engineering for current needs
2. Use regex to humanize slugs (replace dashes, capitalize) — Fragile, may produce incorrect names

---

## Research Area 3: URL State Persistence for Filters

**Question**: Best pattern for syncing multiple filter states with URL query parameters?

**Findings**:
- Current implementation uses `useSearchParams()` + `router.push()` for `range` param
- Next.js App Router supports multiple query params natively
- Pattern: Read initial values from `searchParams` in server component, pass to client; client uses `useSearchParams` + `router.push` to sync changes

**Decision**: Extend existing URL pattern to include `status` and `agent` params alongside `range`
**Alternatives Considered**:
1. Use `nuqs` library for type-safe URL state — New dependency, overkill for 3 params
2. React state only — Loses URL persistence (violates FR-011)

---

## Research Area 4: Tickets Shipped Card Time Range Fix

**Question**: How to make the shipped card respect the selected time range?

**Findings**:
- Current bug: `getOverviewMetrics()` uses `monthStart = new Date(now.getFullYear(), now.getMonth(), 1)` for the ticket count query (line 94-101 of queries.ts)
- Fix: Replace `monthStart` with `rangeStart` (already computed from the `range` param)
- The `Ticket.updatedAt` field records when the ticket last changed stage, so `updatedAt >= rangeStart` correctly captures tickets that reached SHIP within the time range

**Decision**: Replace `monthStart` with `rangeStart` from `getDateRangeStart(range, now)` for both shipped and closed counts
**Alternatives Considered**:
1. Add a dedicated `shippedAt` field — Schema change, migration overhead, `updatedAt` is sufficient
2. Use `createdAt` — Wrong semantics; tickets are created before they ship

---

## Research Area 5: Dashboard Performance Impact

**Question**: Will adding relation-based filtering degrade query performance?

**Findings**:
- All 8 query functions already execute in parallel via `Promise.all`
- Adding `{ ticket: { stage: { in: [...] } } }` adds a JOIN on an indexed column
- The `availableAgents` query (distinct models) is a lightweight SELECT DISTINCT
- With default `status=shipped`, behavior is equivalent to current hardcoded SHIP filtering in velocity
- Net effect: Most queries ADD a WHERE clause they didn't have before (minor overhead), but filtered result sets are smaller (reduces processing)

**Decision**: Accept minor query overhead; existing parallel execution and indices keep performance within acceptable bounds (SC-006)
**Alternatives Considered**:
1. Cache available agents separately with longer TTL — Premature optimization; adds cache invalidation complexity
2. Client-side filtering — Transfers more data, worse for large projects
