# Research: Add Stats Tab to Ticket Detail Modal

**Feature Branch**: `AIB-99-add-stats-tab`
**Date**: 2025-12-06

## Research Tasks Completed

All technical context items were resolved through codebase exploration. No external research required.

---

## Decision 1: Tab Structure Pattern

**Question**: How are tabs structured in the existing ticket detail modal?

**Finding**: The modal uses shadcn/ui `Tabs` component with a 3-column grid layout.

**Location**: `components/board/ticket-detail-modal.tsx:846-867`

```typescript
<Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'details' | 'comments' | 'files')}>
  <TabsList className="grid w-full grid-cols-3">
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="comments">Conversation {badge}</TabsTrigger>
    <TabsTrigger value="files">Files {badge}</TabsTrigger>
  </TabsList>
  <TabsContent value="details">...</TabsContent>
  <TabsContent value="comments">...</TabsContent>
  <TabsContent value="files">...</TabsContent>
</Tabs>
```

**Decision**: Add Stats as 4th tab, update grid to `grid-cols-4`, add keyboard shortcut `Cmd+4`.

**Rationale**: Follows existing pattern exactly. Tabs support dynamic badge counts.

**Alternatives Rejected**:
- Separate modal: Would break navigation flow and increase complexity
- Drawer/sidebar: Inconsistent with existing UI patterns

---

## Decision 2: Job Data Access Pattern

**Question**: How to access job telemetry data for a ticket?

**Finding**: Jobs are already passed to the modal via `jobs` prop from parent polling.

**Location**: `components/board/ticket-detail-modal.tsx:97-98`

```typescript
/** Jobs for this ticket, passed from parent for real-time polling updates */
jobs?: TicketJob[];
```

**Current TicketJob type**: `{ id: number; command: string; status: string; }`

**Decision**: Extend job data in parent's fetch to include telemetry fields (costUsd, durationMs, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, toolsUsed, model).

**Rationale**:
- Reuses existing 2-second polling infrastructure
- No new API endpoint required
- Real-time updates work automatically

**Alternatives Rejected**:
- Separate API call: Would add latency and duplicate fetching
- New polling hook: Unnecessary when data already flows through existing channel

---

## Decision 3: Formatting Utilities

**Question**: How to format cost, duration, and token numbers?

**Finding**: Existing utilities in `lib/analytics/aggregations.ts`:

| Function | Output Example | Use Case |
|----------|----------------|----------|
| `formatCost(value)` | "$1.50", "$1.5K" | Total cost card |
| `formatDuration(ms)` | "45s", "2m", "1.5h" | Duration card, job rows |
| `formatAbbreviatedNumber(value)` | "125K", "1.2M" | Token counts |
| `formatPercentage(value)` | "28.6%" | Cache efficiency |

**Decision**: Import and reuse these utilities directly.

**Rationale**: DRY principle, consistent formatting with analytics dashboard.

**Alternatives Rejected**: None - existing utilities are perfect fit.

---

## Decision 4: Stats Tab Visibility Logic

**Question**: When should the Stats tab be visible?

**Finding**: Per spec FR-002, Stats tab only visible when ticket has at least one job.

**Pattern Reference**: Files tab shows badge count when attachments > 0 (lines 859-866).

**Decision**:
- Hide entire tab when `jobs.length === 0`
- Use same conditional rendering pattern as Files badge

**Rationale**: Matches spec requirement, reduces noise for new tickets.

**Alternatives Rejected**:
- Show empty state in tab: Adds unnecessary tab that serves no purpose
- Always show with "No jobs yet" message: Clutters navigation

---

## Decision 5: Cache Efficiency Calculation

**Question**: How to calculate cache efficiency percentage?

**Finding**: Per spec auto-resolved decision, formula is:
```
cacheEfficiency = cacheReadTokens / (inputTokens + cacheReadTokens) * 100
```

Edge case: Return 0% when denominator is 0.

**Pattern Reference**: Analytics dashboard uses same formula.

**Decision**: Implement as pure function in stats hook, handle division by zero.

**Rationale**: Standard cache hit rate calculation, consistent with analytics.

---

## Decision 6: Component Architecture

**Question**: How to structure the Stats tab components?

**Finding**: Existing tab contents use dedicated components (`ConversationTimeline`, `ImageGallery`).

**Decision**: Create component hierarchy:
```
TicketStats (main container)
├── StatsSummaryCards (4 summary cards)
├── JobsTimeline (chronological list)
│   └── JobRow (expandable row with details)
└── ToolsUsageSection (aggregated tools)
```

**Rationale**:
- Follows existing component patterns
- Enables lazy loading of heavy sections
- Makes testing easier with isolated units

**Alternatives Rejected**:
- Single monolithic component: Harder to test, harder to maintain
- Too many small components: Over-engineering for this scope

---

## Decision 7: Expandable Job Rows

**Question**: How to implement expandable job rows for token breakdown?

**Finding**: shadcn/ui provides `Collapsible` component that matches the design system.

**Pattern Reference**: `ImageGallery` uses collapsible pattern for expand/collapse.

**Decision**: Use `Collapsible` with `CollapsibleTrigger` and `CollapsibleContent`.

**Rationale**: Consistent with design system, accessible by default.

---

## Decision 8: Testing Strategy

**Question**: What testing approach for the Stats tab?

**Finding**: Per constitution (hybrid testing strategy):
- **Vitest**: Pure functions (stats aggregation, formatting)
- **Playwright**: Component behavior, E2E user flows

**Decision**:
- Unit tests: `aggregateJobStats()`, `calculateCacheEfficiency()`
- E2E tests: Tab visibility, summary card values, job row expansion, real-time updates

**Rationale**: Follows constitution's hybrid testing mandate.

---

## Summary

All research questions resolved. No external dependencies or blockers identified.

| Area | Decision | Confidence |
|------|----------|------------|
| Tab structure | Extend existing 3-tab to 4-tab | High |
| Data access | Extend existing job polling | High |
| Formatting | Reuse analytics utilities | High |
| Visibility | Hide tab when no jobs | High |
| Cache calc | Standard hit rate formula | High |
| Components | 3-level hierarchy | High |
| Expand/collapse | shadcn/ui Collapsible | High |
| Testing | Vitest + Playwright hybrid | High |
