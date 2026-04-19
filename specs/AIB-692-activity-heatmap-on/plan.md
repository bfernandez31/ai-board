# Implementation Plan: Activity Heatmap on Projects Page

**Ticket**: AIB-692
**Branch**: `AIB-692-activity-heatmap-on`
**Spec**: `specs/AIB-692-activity-heatmap-on/spec.md`

## Technical Context

| Aspect | Details |
|--------|---------|
| **UI Framework** | Next.js 16 App Router, React 18, TailwindCSS 3.4, shadcn/ui |
| **Data Layer** | Prisma 6.x → PostgreSQL 14+, TanStack Query v5 |
| **Rendering** | Server Component for initial data, Client Component for interactivity |
| **Styling** | Aurora B+ theme (violet gradient), Catppuccin Mocha dark palette |
| **Charts** | No Recharts needed — pure CSS Grid for heatmap cells |
| **Auth** | NextAuth.js session-based, `requireAuth()` for API routes |
| **Polling** | 60-second background refresh (daily-granular data) |
| **URL State** | `useSearchParams` + `router.push()` for filter persistence |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new files in strict TypeScript with explicit types |
| II. Component-Driven | PASS | shadcn/ui components (Select, Tooltip, Card), feature folder `components/activity-heatmap/` |
| III. Test-Driven | PASS | Unit tests for grid logic, component tests for rendering, integration tests for API |
| IV. Security-First | PASS | Zod validation on query params, `requireAuth()` on API route, no raw SQL |
| V. Database Integrity | PASS | Read-only queries, no schema changes (FR-024), existing models only |
| V. Spec Guardrails | PASS | All auto-resolved decisions documented with trade-offs in spec |

## Gate Evaluation

| Gate | Result | Justification |
|------|--------|---------------|
| No new DB models | PASS | FR-024 compliant — computed from Job, Ticket, Project, User |
| No forbidden dependencies | PASS | Uses only shadcn/ui, Radix Tooltip, TanStack Query |
| WCAG AA contrast | ADDRESSED | Violet scale on dark background needs verification; plan includes contrast check in implementation |
| No dynamic Tailwind classes | PASS | All intensity levels use static class strings |
| Server-first rendering | PASS | Initial data fetched in server component, passed via `initialData` |

## Implementation Phases

### Phase 1: API Layer & Data Aggregation

**Files to create**:
- `lib/heatmap/types.ts` — Shared TypeScript types for request/response
- `lib/heatmap/queries.ts` — Server-side data aggregation
- `app/api/projects/activity-heatmap/route.ts` — GET endpoint

**Implementation details**:

1. **`lib/heatmap/types.ts`**: Define `ActivityHeatmapResponse`, `ActivityDayData`, `IntensityThresholds`, `HeatmapFilters`, and `AgentOption` types. See `specs/AIB-692-activity-heatmap-on/contracts/activity-heatmap-api.md` for full schema.

2. **`lib/heatmap/queries.ts`**: Main aggregation function `getActivityHeatmapData(userId, filters)`:
   - Build date range from `filters.year` (`'rolling'` → last 12 months, `'YYYY'` → calendar year)
   - Query `prisma.job.findMany()` with:
     - `status: COMPLETED`
     - `completedAt: { gte: startDate, lt: endDate }`
     - `ticket.project` ownership: `OR: [{ userId }, { members: { some: { userId } } }]`
     - Agent filter via `buildEffectiveAgentWhere()` pattern from `lib/analytics/queries.ts:51-69`
   - Group by `DATE(completedAt)` to produce `Record<string, ActivityDayData>`
   - Compute shipped tickets: distinct tickets with a COMPLETED `ship` job in the period
   - Compute quantile thresholds from non-zero daily job counts
   - Derive `availableYears` from `user.createdAt` year through current year
   - Derive `availableAgents` from distinct effective agents across user's jobs

3. **`app/api/projects/activity-heatmap/route.ts`**:
   - `requireAuth()` for authentication
   - Zod validation for `year` and `agent` query params
   - Call `getActivityHeatmapData(userId, filters)`
   - Return `NextResponse.json(data)`
   - Error handling: 401 for auth, 400 for invalid params, 500 for server errors
   - Follow error handling pattern from existing analytics route

### Phase 2: Client Components

**Files to create**:
- `components/activity-heatmap/types.ts` — Client-side prop types
- `components/activity-heatmap/activity-heatmap.tsx` — Main client component

**Files to modify**:
- `app/lib/query-keys.ts` — Add `heatmap` query key

**Implementation details**:

1. **`app/lib/query-keys.ts`**: Add under `projects`:
   ```typescript
   heatmap: (year: string, agent: string) =>
     ['projects', 'heatmap', year, agent] as const,
   ```

2. **`components/activity-heatmap/activity-heatmap.tsx`** (client component):
   - Props: `initialData: ActivityHeatmapResponse`
   - State: `filters` initialized from `useSearchParams()` (follow pattern from `analytics-dashboard.tsx:60-72`)
   - Data: `useQuery` with `queryKeys.projects.heatmap(year, agent)`, `refetchInterval: 60000`, `staleTime: 30000`, `initialData` when filters match
   - URL sync: `updateFilters()` using `router.push('?...', { scroll: false })` (follow `analytics-dashboard.tsx:105-109`)
   - Layout structure:
     ```
     <Card className="border-ctp-mauve/15 aurora-bg-subtle">
       <CardHeader>
         Summary counters + Year selector + Agent filter
       </CardHeader>
       <CardContent>
         Heatmap grid (or empty state)
         Intensity legend
       </CardContent>
     </Card>
     ```
   - **Filters**: Use shadcn `Select` for year and agent dropdowns
     - Year selector: Show `availableYears` options, hide when only "Last 12 months" available (FR-008)
     - Agent filter: Show `availableAgents` options, hide when ≤1 agent (FR-010)
   - **Summary header**: "X jobs + Y tickets shipped in the last year"
   - **Grid rendering** (inline or sub-component if >300 lines):
     - CSS Grid: `grid-template-rows: repeat(7, 1fr)`, `grid-auto-flow: column`
     - 7 rows = Sun–Sat, columns = weeks in period
     - Cell size: `w-[13px] h-[13px]` desktop, `w-[16px] h-[16px]` mobile (min tappable size)
     - Gap: `gap-[3px]`
     - Chipped corners: Skip cells outside `period.startDate`/`period.endDate` (render transparent placeholder)
     - Month labels: Positioned along the top, spanning the correct number of week columns
     - Day-of-week labels: Mon, Wed, Fri on the left side, sticky for mobile scroll
   - **Cell coloring**: 5 static violet intensity classes (never dynamic):
     - Level 0 (empty): `bg-ctp-surface0/50`
     - Level 1 (low): `bg-violet-900/60`
     - Level 2 (medium): `bg-violet-700/70`
     - Level 3 (high): `bg-violet-500/80`
     - Level 4 (max): `bg-violet-400`
   - **Tooltips**: shadcn `Tooltip` on each cell (follow pattern from `comparison-compliance-heatmap.tsx:102-114`)
     - Active day: formatted date, "N jobs", "N tickets shipped" (if any), "$X.XX" cost (if non-null)
     - Empty day: formatted date, "No activity"
     - Mobile: tap to show, tap outside to dismiss (Radix Tooltip handles this)
   - **Empty state**: Centered "No activity to show yet — your AI work will appear here" when `summary.totalJobs === 0`, with legend and filters still visible (FR-022)
   - **Mobile**: `overflow-x-auto` on grid container, day labels `sticky left-0 z-10` (follow `comparison-compliance-heatmap.tsx:66,79`)

### Phase 3: Page Integration

**Files to modify**:
- `app/projects/page.tsx` — Add server-side heatmap data fetch and render `ActivityHeatmap`
- `components/projects/projects-container.tsx` — Remove scroll constraint

**Implementation details**:

1. **`app/projects/page.tsx`**:
   - Import and call `getActivityHeatmapData(userId, defaultFilters)` alongside `getProjects()`
   - Pass `heatmapData` as `initialData` prop to `<ActivityHeatmap />`
   - Render `<ActivityHeatmap />` after `<ProjectsContainer />` in the layout:
     ```tsx
     <div className="mt-6">
       <ProjectsContainer projects={projects} />
     </div>
     <div className="mt-8">
       <ActivityHeatmap initialData={heatmapData} />
     </div>
     ```

2. **`components/projects/projects-container.tsx`**:
   - Remove `overflow-y-auto max-h-[calc(100vh-200px)]` from the outer div (FR-023)
   - The page itself scrolls naturally; no viewport constraint needed

### Phase 4: Testing

**Files to create**:
- `tests/unit/components/activity-heatmap.test.tsx` — Component tests
- `tests/unit/heatmap-queries.test.ts` — Unit tests for pure logic (threshold calculation, date grouping)
- `tests/integration/activity-heatmap/api.test.ts` — API integration tests

**Test strategy** (per constitution §III):

1. **Unit tests** (`tests/unit/heatmap-queries.test.ts`):
   - Pure function: quantile threshold calculation
   - Pure function: intensity level mapping from count + thresholds
   - Pure function: period date range computation (rolling, calendar year)
   - Pure function: grid date generation with chipped corners
   - Edge case: all days same count → mid-intensity
   - Edge case: single active day → max intensity

2. **Component tests** (`tests/unit/components/activity-heatmap.test.tsx`):
   - Renders heatmap grid with correct number of cells
   - Displays summary counters (jobs + shipped tickets)
   - Shows month labels and day-of-week labels
   - Applies correct intensity classes based on thresholds
   - Shows tooltip on hover with correct content
   - Tooltip for empty cell shows "No activity" and date only
   - Tooltip omits cost line when all costs are null
   - Shows empty state message when no activity
   - Hides year selector when only one option (FR-008)
   - Hides agent filter when ≤1 agent (FR-010)
   - Year/agent filter selection updates URL query params
   - Restores filters from URL query params on load
   - Uses `renderWithProviders()` from `tests/utils/component-test-utils.tsx`

3. **Integration tests** (`tests/integration/activity-heatmap/api.test.ts`):
   - Returns 401 when unauthenticated
   - Returns 400 for invalid `year` parameter
   - Returns correct daily job counts for authenticated user
   - Filters by agent correctly (explicit and inherited)
   - Returns correct shipped ticket count (only `ship` command COMPLETED jobs)
   - Returns correct `availableYears` from user creation date
   - Returns correct `availableAgents` from user's job data
   - Cost aggregation: sums non-null costs, returns null when all null
   - Rolling period returns ~365 days of data
   - Calendar year returns Jan 1 – Dec 31 data

## Dependency Order

```
Phase 1 (API Layer)
  └─→ Phase 2 (Client Components)
        └─→ Phase 3 (Page Integration)
              └─→ Phase 4 (Testing)
```

Phase 4 tests can be partially written in parallel with implementation (test-first for pure functions in Phase 1).

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Large query for 365 days of job data | Single aggregation query with GROUP BY, not N+1. Index on `Job.completedAt` + `Job.status` exists. |
| Violet color contrast on dark theme | Use Tailwind violet palette classes (already theme-adaptive). Verify WCAG AA during implementation. |
| Scroll constraint removal breaks projects page | Only removes `max-h`/`overflow-y-auto` from projects container. Page naturally scrolls via `container mx-auto`. |
| Mobile tooltip behavior | Radix Tooltip handles touch events natively. Verify tap-outside dismiss during manual testing. |
| URL params conflict with existing projects page | Projects page currently has no query params. No conflict. |
