# Implementation Plan: Activity Heatmap on Projects Page

**Ticket**: AIB-654
**Branch**: `AIB-654-copy-of-activity`
**Spec**: `specs/AIB-654-copy-of-activity/spec.md`

## Technical Context

| Aspect | Detail |
|--------|--------|
| **Data source** | Existing `Job`, `Ticket`, `Project`, `User` tables — no schema changes (FR-027) |
| **Rendering** | Pure HTML/CSS div grid with Tailwind — no SVG or canvas |
| **SSR** | Server component fetches initial data, passes to client via `initialData` prop (matches analytics dashboard pattern) |
| **State** | TanStack Query v5 with 60s `refetchInterval` (cross-project aggregate is expensive) |
| **Filters** | URL query params `?year=rolling&agent=all` via `useSearchParams` |
| **Tooltip** | shadcn/ui `<Tooltip>` (Radix) with custom content |
| **Styling** | Aurora violet gradient (`--primary-violet` + `ctp-mauve`) for cell intensity; `aurora-bg-section` for container |
| **Mobile** | Horizontal scroll with sticky day-of-week labels via CSS `position: sticky` |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new files will be `.ts`/`.tsx` with strict typing, explicit return types, no `any` |
| II. Component-Driven | PASS | Using shadcn/ui Tooltip + Select; Server Component default; client only for interactivity; feature folder `components/heatmap/` |
| III. Test-Driven | PASS | Unit tests for query helpers, RTL component tests for grid rendering, integration tests for API route |
| IV. Security-First | PASS | Auth check in API route, Zod validation for query params, Prisma parameterized queries only |
| V. Database Integrity | PASS | Read-only queries, no schema changes, no mutations |
| V. Spec Clarification | PASS | All 5 auto-resolved decisions documented in spec with trade-offs |

**Gate violations**: None.

## Implementation Phases

### Phase 1: Data Layer (Backend)

**Goal**: Heatmap API endpoint returning aggregated job data across all user projects.

#### Task 1.1: Create heatmap types
- **File**: `lib/heatmap/types.ts` (new)
- **What**: Define `HeatmapDay`, `ShippedTicketInfo`, `HeatmapData`, `HeatmapFilters` interfaces
- **Pattern**: Follow `lib/analytics/types.ts` structure; reuse existing `AgentOption` type

#### Task 1.2: Create heatmap query functions
- **File**: `lib/heatmap/queries.ts` (new)
- **What**: Implement `getHeatmapData(userId: string, filters: HeatmapFilters)`:
  1. Fetch all project IDs where user is owner OR member (reuse pattern from `lib/db/projects.ts:getUserProjects`)
  2. Query jobs grouped by `DATE(startedAt)` within the date range, filtered by user's projects
  3. For each day: aggregate `jobCount`, sum non-null `costUsd` (null if all null)
  4. Query shipped tickets: `command='ship'`, `status='COMPLETED'`, deduplicate by ticket ID (first completed ship job only)
  5. Build agent options using `buildEffectiveAgentWhere` pattern from `lib/analytics/queries.ts:190-245`
  6. Fetch `user.createdAt` for year selector range
- **Patterns to follow**:
  - `buildEffectiveAgentWhere` from `lib/analytics/queries.ts` for agent filtering
  - `getAvailableAgents` from `lib/analytics/queries.ts:190-245` for agent option building
  - Cost null handling from `lib/analytics/queries.ts:313-328`
- **Edge cases**:
  - User with zero projects → empty response
  - Rolling period: 365 days back from today UTC
  - Calendar year: Jan 1 00:00:00 to Dec 31 23:59:59 UTC
  - Multiple completed ship jobs per ticket → count ticket once, attribute to first `completedAt`

#### Task 1.3: Create API route
- **File**: `app/api/heatmap/route.ts` (new)
- **What**: `GET` handler with:
  1. Auth check (session required, 401 if missing)
  2. Zod validation for `year` and `agent` query params
  3. Call `getHeatmapData(userId, filters)`
  4. Return JSON response
- **Contract**: See `contracts/heatmap-api.md`
- **Error handling**: Try-catch with structured `{ error }` responses per constitution §IV

#### Task 1.4: Add query key
- **File**: `app/lib/query-keys.ts` (modify)
- **What**: Add `heatmap: { data: (year: string, agent: string) => ['heatmap', year, agent] as const }`

### Phase 2: Client Hook & Server Integration

**Goal**: TanStack Query hook with server-provided initial data and background refetching.

#### Task 2.1: Create heatmap hook
- **File**: `app/lib/hooks/queries/use-heatmap.ts` (new)
- **What**: `useHeatmap(initialData, filters)` hook:
  ```typescript
  useQuery({
    queryKey: queryKeys.heatmap.data(filters.year, filters.agent),
    queryFn: () => fetch(`/api/heatmap?year=${filters.year}&agent=${filters.agent}`).then(r => r.json()),
    initialData,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  ```
- **Pattern**: Follow `hooks/use-usage.ts` and `components/analytics/analytics-dashboard.tsx` initialData pattern

#### Task 2.2: Integrate server-side fetch into projects page
- **File**: `app/projects/page.tsx` (modify)
- **What**:
  1. Parse `year` and `agent` from `searchParams`
  2. Call `getHeatmapData(userId, filters)` server-side alongside existing `getProjects()`
  3. Pass `heatmapData` as prop to new `<ActivityHeatmap>` component rendered below `<ProjectsContainer>`
- **Pattern**: Follow `app/projects/[projectId]/analytics/page.tsx:49-98` for server data + searchParams handling

### Phase 3: UI Components

**Goal**: Heatmap grid with header, tooltip, legend, and filters.

#### Task 3.1: Heatmap grid component
- **File**: `components/heatmap/heatmap-grid.tsx` (new)
- **What**: Renders the GitHub-style contribution grid:
  - 7 rows (Sun–Sat), columns = weeks in the period
  - Cells: `<div>` elements with Tailwind background classes for intensity levels
  - Month labels above columns, day-of-week labels (Mon, Wed, Fri) on left
  - "Chipped corners": don't render cells before start date or after end date in partial weeks
  - Intensity mapping: 0 jobs = empty (`bg-ctp-surface0`), then 4 quartile levels using violet scale
  - Cell size: 12px with 3px gap (desktop), minimum tappable size on mobile
- **Mobile**: Outer container `overflow-x-auto`, day labels `position: sticky; left: 0`
- **FR coverage**: FR-001, FR-003, FR-004, FR-005, FR-006, FR-007, FR-023, FR-024

#### Task 3.2: Heatmap tooltip component
- **File**: `components/heatmap/heatmap-tooltip.tsx` (new)
- **What**: Tooltip content showing:
  - Shipped tickets (ticket key + title) if any
  - Job count + cost (if at least one job has cost data)
  - Formatted date ("Tuesday, March 15, 2026")
- **Component**: Uses shadcn/ui `<Tooltip>` wrapping each cell
- **Edge cases**:
  - All costs null → omit cost line entirely (FR-014)
  - No shipped tickets → omit shipped section
  - Mobile: tap to show, tap outside to dismiss (FR-025)
- **FR coverage**: FR-013, FR-014, FR-025

#### Task 3.3: Main heatmap component with header and filters
- **File**: `components/heatmap/activity-heatmap.tsx` (new)
- **What**: `"use client"` component orchestrating:
  1. **Header**: "X jobs · Y tickets shipped {periodLabel}" counter (FR-008)
  2. **Year selector**: `<Select>` dropdown with "Last 12 months" + calendar years from `userCreatedYear` to current year (FR-011). Hidden when user created in current year (FR-012).
  3. **Agent filter**: `<Select>` dropdown when `agents.length > 2` (i.e., more than just "all"). Hidden when 0-1 distinct agents (FR-015).
  4. **Grid**: `<HeatmapGrid>` with day data
  5. **Legend**: "Less" → graduated color blocks → "More" at bottom-right (FR-006)
  6. **Empty state**: "No activity to show yet — your AI work will appear here" when `totalJobs === 0` (FR-022)
  7. **Filter state**: Read/write URL query params via `useSearchParams` + `useRouter` (FR-019)
- **Wrapper**: `<TooltipProvider>` around the grid
- **FR coverage**: FR-008, FR-011, FR-012, FR-015, FR-016, FR-018, FR-019, FR-020, FR-021, FR-022

#### Task 3.4: Modify projects page layout
- **File**: `components/projects/projects-container.tsx` (modify)
- **What**: Remove `overflow-y-auto max-h-[calc(100vh-200px)]` scroll constraint to allow natural page scrolling (FR-026)
- **Impact**: The project cards grid will flow naturally. If there are many projects, the page scrolls instead of the grid having an internal scrollbar. The heatmap renders below.

### Phase 4: Polish & Accessibility

#### Task 4.1: Color scale CSS
- **File**: `app/globals.css` (modify)
- **What**: Add heatmap intensity utility classes under `@layer utilities`:
  ```css
  .heatmap-level-0 { background-color: hsl(var(--ctp-surface0)); }
  .heatmap-level-1 { background-color: hsl(258 90% 66% / 0.2); }
  .heatmap-level-2 { background-color: hsl(258 90% 66% / 0.4); }
  .heatmap-level-3 { background-color: hsl(258 90% 66% / 0.6); }
  .heatmap-level-4 { background-color: hsl(258 90% 66% / 0.9); }
  ```
- **Rationale**: Static Tailwind classes avoid dynamic class construction (forbidden per CLAUDE.md)

#### Task 4.2: ARIA attributes
- **What**: Add accessibility attributes to heatmap grid:
  - Grid container: `role="grid"`, `aria-label="Activity heatmap"`
  - Each cell: `role="gridcell"`, `aria-label="{jobCount} jobs on {date}"`
  - Legend: `aria-hidden="true"` (decorative)

## Testing Strategy

### Unit Tests

**File**: `tests/unit/lib/heatmap-queries.test.ts` (new)
- **What**: Test pure helper functions from `lib/heatmap/queries.ts`:
  - Date range calculation (rolling vs calendar year)
  - Cost aggregation logic (null handling, partial nulls)
  - Shipped ticket deduplication (first completed ship job per ticket)
  - Intensity level mapping (quartile calculation from job counts)
- **Why new file**: Heatmap query logic is a distinct domain from existing analytics

**File**: `tests/unit/components/heatmap/activity-heatmap.test.tsx` (new)
- **What**: RTL component tests:
  - Grid renders correct number of cells for a given date range
  - Chipped corners: cells missing for partial weeks
  - Month labels appear in correct positions
  - Empty state message when `totalJobs === 0`
  - Year selector hidden when user created in current year
  - Agent filter hidden when <= 1 distinct agent
  - Tooltip content: shipped tickets, cost, date formatting
  - Tooltip cost omitted when all costs null
  - Legend renders with graduated color blocks
- **Pattern**: Follow `tests/unit/components/comparison-compliance-heatmap.test.tsx` for heatmap grid RTL patterns
- **Mocking**: Mock `useSearchParams`, `useRouter`, and the `useHeatmap` hook

### Integration Tests

**File**: `tests/integration/heatmap/heatmap-route.test.ts` (new)
- **What**: Test `GET /api/heatmap` endpoint:
  - Returns 401 when unauthenticated
  - Returns valid heatmap data structure with correct field types
  - Returns empty `days` array for user with no jobs
  - Filters by calendar year correctly
  - Filters by agent correctly (including effective agent resolution)
  - Returns correct `userCreatedYear` from user record
  - Validates `year` and `agent` params (returns 400 for invalid values)
  - Shipped ticket counting: only `command='ship'` + `status='COMPLETED'`
  - Shipped ticket deduplication: multiple completed ship jobs → counted once
  - Cost aggregation: null handling (all null → `costUsd: null`, partial null → sum of non-null)
- **Pattern**: Follow `tests/integration/projects/projects-with-health.test.ts` for auth and DB setup
- **Auth**: Use `x-test-user-id` header with seeded test users

### E2E Tests

**Not recommended** for this feature. The heatmap is a read-only visualization with no complex browser interactions (no OAuth, no drag-drop). RTL component tests + integration API tests provide sufficient coverage per the constitution's testing decision tree.

## Dependency Order

```
Phase 1 (Tasks 1.1 → 1.2 → 1.3, 1.4 parallel)
    ↓
Phase 2 (Tasks 2.1, 2.2)
    ↓
Phase 3 (Tasks 3.1, 3.2 parallel → 3.3 → 3.4)
    ↓
Phase 4 (Tasks 4.1, 4.2 parallel)
```

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Cross-project aggregate query too slow for large users | Medium | Use indexed `startedAt` column; pre-aggregate in SQL; 60s polling reduces frequency |
| Scroll constraint removal breaks existing UX | Low | Only removing `max-h` + `overflow-y-auto` from container; page naturally scrolls |
| Tooltip positioning on mobile edge cells | Low | Radix Tooltip handles collision detection and repositioning automatically |
| Color contrast insufficient in dark theme | Low | Use established `--primary-violet` tokens already WCAG-validated in the aurora theme |
