# Research: Add Stats Tab to Ticket Detail Modal

**Feature Branch**: `AIB-98-add-stats-tab`
**Date**: 2025-12-06

## Research Tasks

### 1. Job Data Availability

**Question**: Are all required telemetry fields available in the Job model?

**Finding**: YES - All required fields already exist in the Prisma schema (`prisma/schema.prisma` lines 44-52):

```prisma
model Job {
  inputTokens         Int?      // Total input tokens consumed
  outputTokens        Int?      // Total output tokens generated
  cacheReadTokens     Int?      // Total cache read tokens
  cacheCreationTokens Int?      // Total cache creation tokens
  costUsd             Float?    // Total cost in USD
  durationMs          Int?      // Total Claude API duration in milliseconds
  model               String?   @db.VarChar(50) // Primary model used
  toolsUsed           String[]  @default([])    // List of tools used
}
```

**Decision**: No schema changes required. All telemetry data is persisted.

**Rationale**: The Job model was designed with comprehensive telemetry support.

**Alternatives Considered**: N/A - data already exists.

---

### 2. Data Fetching Strategy

**Question**: How should the Stats tab fetch job data - via polling endpoint or separate query?

**Finding**: The current polling endpoint (`/api/projects/[projectId]/jobs/status`) returns minimal data for performance (only `id`, `status`, `ticketId`, `command`, `updatedAt`). The existing ticket jobs endpoint (`/api/projects/[projectId]/tickets/[id]/jobs`) also returns minimal fields.

**Decision**: Extend the existing `/api/projects/[projectId]/tickets/[id]/jobs` endpoint to include telemetry fields when requested. Use a query parameter `?includeStats=true` to opt into full telemetry data.

**Rationale**:
1. Avoids creating new API routes
2. Keeps polling lightweight (status updates don't need telemetry)
3. Allows backward compatibility
4. Full telemetry only fetched when Stats tab is active

**Alternatives Considered**:
- Create new `/api/projects/[projectId]/tickets/[id]/stats` endpoint - rejected as over-engineering
- Include telemetry in polling endpoint - rejected due to performance impact on 2s polling
- Fetch from analytics endpoint - rejected as it's project-level, not ticket-level

---

### 3. TicketJob Type Extension

**Question**: How should the TicketJob interface be extended to support stats?

**Finding**: Current interface (`components/board/ticket-detail-modal.tsx` lines 69-73):
```typescript
export interface TicketJob {
  id: number;
  command: string;
  status: string;
}
```

**Decision**: Create extended type `TicketJobWithStats` in `/lib/types/job-types.ts`:

```typescript
export interface TicketJobWithStats extends TicketJob {
  startedAt: string;
  completedAt: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  model: string | null;
  toolsUsed: string[];
}
```

**Rationale**: Extends existing type to maintain backward compatibility. Optional fields match Prisma nullability.

**Alternatives Considered**:
- Modify base TicketJob - rejected to avoid breaking existing usages
- Create completely new type - rejected as duplication

---

### 4. Aggregation Calculations

**Question**: How should stats be calculated from job data?

**Finding**: Existing analytics utilities in `/lib/analytics/aggregations.ts` provide:
- `formatDuration(ms: number)` - formats milliseconds to "Xm Xs"
- `formatCost(value: number)` - formats USD with $ prefix
- `formatPercentage(value: number)` - formats percentage
- `aggregateTools(toolArrays: string[][])` - counts tool usage frequency
- `getStageFromCommand(command: string)` - maps command to stage label

**Decision**: Reuse existing aggregation utilities. Create new ticket-specific aggregation functions:

```typescript
// lib/stats/ticket-stats.ts
export function calculateTicketStats(jobs: TicketJobWithStats[]): TicketStats {
  return {
    totalCost: jobs.reduce((sum, j) => sum + (j.costUsd ?? 0), 0),
    totalDuration: jobs.reduce((sum, j) => sum + (j.durationMs ?? 0), 0),
    totalInputTokens: jobs.reduce((sum, j) => sum + (j.inputTokens ?? 0), 0),
    totalOutputTokens: jobs.reduce((sum, j) => sum + (j.outputTokens ?? 0), 0),
    cacheReadTokens: jobs.reduce((sum, j) => sum + (j.cacheReadTokens ?? 0), 0),
    cacheEfficiency: calculateCacheEfficiency(jobs),
    toolUsage: aggregateTools(jobs.map(j => j.toolsUsed)),
  };
}
```

**Rationale**: Leverages proven patterns from analytics module. Pure functions enable unit testing.

**Alternatives Considered**:
- Server-side aggregation - rejected as data is already on client via polling
- React hook with useMemo - will be used, but core logic in pure functions

---

### 5. Component Architecture

**Question**: How should Stats tab components be structured?

**Finding**: Existing patterns in `/components/analytics/` show modular chart/card components. The ticket detail modal uses shadcn/ui Tabs component.

**Decision**: Component hierarchy:

```
<StatsTab>                          # Main container
├── <StatsSummaryCards>             # 4-column grid of metrics
│   ├── <Card> Total Cost           # shadcn/ui Card
│   ├── <Card> Total Duration
│   ├── <Card> Total Tokens
│   └── <Card> Cache Efficiency
├── <JobTimeline>                   # Scrollable job list
│   └── <JobTimelineRow>[]          # Individual expandable rows
│       └── <TokenBreakdown>        # Expansion content
└── <ToolsUsageSection>             # Tool frequency display
    └── <Badge>[]                   # Tool count badges
```

**Rationale**: Follows existing component patterns. Each component has single responsibility. Enables independent testing.

**Alternatives Considered**:
- Monolithic StatsTab - rejected for maintainability
- Separate tab per section - rejected as overcomplicated

---

### 6. Keyboard Navigation

**Question**: How should Cmd/Ctrl+4 shortcut be implemented?

**Finding**: Existing pattern in `ticket-detail-modal.tsx` (lines 225-249):
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '1') setActiveTab('details');
    if ((e.metaKey || e.ctrlKey) && e.key === '2') setActiveTab('comments');
    if ((e.metaKey || e.ctrlKey) && e.key === '3') setActiveTab('files');
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [open]);
```

**Decision**: Add matching handler for key '4':
```typescript
if ((e.metaKey || e.ctrlKey) && e.key === '4') {
  if (hasJobs) setActiveTab('stats');
}
```

**Rationale**: Consistent with existing pattern. Only activates if jobs exist.

**Alternatives Considered**: N/A - clear pattern to follow.

---

### 7. Tab Visibility Logic

**Question**: How should tab visibility be handled when no jobs exist?

**Finding**: Spec FR-002 states "System MUST show the Stats tab only when the ticket has at least one associated job."

**Decision**: Conditionally render the Stats TabsTrigger and TabsContent:
```typescript
{jobs.length > 0 && (
  <>
    <TabsTrigger value="stats">Stats</TabsTrigger>
    <TabsContent value="stats">...</TabsContent>
  </>
)}
```

Grid changes: `grid-cols-3` → `grid-cols-{jobs.length > 0 ? 4 : 3}`

**Rationale**: Clean UX for new tickets. Matches spec requirement.

**Alternatives Considered**:
- Show disabled tab - rejected as confusing
- Show tab with empty state - rejected per spec

---

### 8. Real-time Updates

**Question**: How should stats update in real-time during job execution?

**Finding**: Job polling runs at 2s intervals via `useJobPolling()` hook. The modal receives `jobs` prop that updates from polling.

**Decision**: Stats tab will reactively update via existing polling mechanism:
1. When job status changes (RUNNING → COMPLETED), new telemetry becomes available
2. Extend jobs endpoint to return telemetry fields
3. Stats recalculate via useMemo when jobs array changes

**Rationale**: Leverages existing infrastructure. No new WebSocket or polling needed.

**Alternatives Considered**:
- Separate stats polling - rejected as duplicate infrastructure
- SSE for real-time - over-engineering for this use case

---

### 9. Number Formatting

**Question**: How should large numbers be displayed?

**Finding**: Spec edge case: "Use number formatting with appropriate abbreviations (e.g., '1.2M')."

Existing analytics formatters don't handle abbreviations.

**Decision**: Add `formatNumber()` utility for token counts:
```typescript
export function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}
```

**Rationale**: Consistent display for varying token counts (100 to 10M+).

**Alternatives Considered**:
- Always show full numbers - rejected for readability with large values
- Use Intl.NumberFormat compact notation - could work but less control

---

### 10. Empty/Null Value Handling

**Question**: How should null/undefined telemetry values be displayed?

**Finding**: Spec states: "Display as '—' or '0' with graceful fallback."

Job telemetry fields are nullable (e.g., jobs still RUNNING have null values).

**Decision**: Display logic:
- `null` values: Show "—" in individual job rows
- Aggregations: Treat `null` as 0 (via `?? 0` operator)
- Cache efficiency with 0 input tokens: Show "—" (avoid division by zero)

**Rationale**: Clear visual distinction between "no data" and "zero value."

**Alternatives Considered**:
- Show 0 for all nulls - rejected as misleading
- Hide rows with null - rejected as confusing

---

## Summary of Decisions

| Topic | Decision |
|-------|----------|
| Data Source | Extend existing `/api/projects/[projectId]/tickets/[id]/jobs` with `?includeStats=true` |
| Type System | Create `TicketJobWithStats` extending `TicketJob` |
| Aggregation | Pure functions in `/lib/stats/ticket-stats.ts`, reuse formatters from analytics |
| Components | Modular hierarchy: StatsTab → SummaryCards + JobTimeline + ToolsUsage |
| Tab Visibility | Conditional render when `jobs.length > 0` |
| Keyboard | Add Ctrl/Cmd+4 following existing pattern |
| Updates | Reactive via existing 2s job polling |
| Formatting | Add `formatNumber()` for abbreviated large values |
| Null Handling | "—" for display, `?? 0` for aggregations |
