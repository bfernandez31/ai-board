# Implementation Plan: Activity Heatmap on Projects Page

**Ticket**: AIB-643
**Branch**: `AIB-643-activity-heatmap-on`
**Date**: 2026-04-14
**Status**: Ready for Implementation

---

## Technical Context

| Aspect | Detail |
|--------|--------|
| **Stack** | Next.js 16 (App Router), React 18, TanStack Query v5, Prisma 6, TailwindCSS 3.4, shadcn/ui |
| **Data source** | Existing `Job` and `Ticket` tables (no new DB models — SC-008) |
| **Auth** | NextAuth session + Bearer token via `requireAuth()` |
| **Styling** | Catppuccin Mocha theme, `ctp-mauve` violet palette, aurora utilities |
| **Charting** | Custom SVG/HTML grid (no Recharts — heatmap is a matrix, not a chart) |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new files will be strict TS with explicit types |
| II. Component-Driven | PASS | shadcn/ui primitives (Tooltip, Card, Select), feature folder pattern |
| III. Test-Driven | PASS | Integration test for API, component test for heatmap UI |
| IV. Security-First | PASS | Auth via `requireAuth()`, Zod validation for query params, Prisma parameterized queries |
| V. Database Integrity | PASS | Read-only queries, no schema changes |
| V. Spec Guardrails | PASS | Auto-resolved decisions documented in spec with policies and trade-offs |

## Gate Evaluation

- **No new dependencies**: No new packages required
- **No schema changes**: No Prisma migration needed
- **No workflow changes**: Pure frontend + API feature
- **WCAG AA**: Violet palette contrast verified against dark theme background

---

## Implementation Phases

### Phase 1: Types & Query Layer

**Goal**: Define TypeScript types and Prisma query functions for heatmap data aggregation.

**Files**:
- **Create** `lib/activity-heatmap/types.ts` — `HeatmapDayData`, `HeatmapResponse`, `HeatmapFilters`, `HeatmapCell` types (see `data-model.md`)
- **Create** `lib/activity-heatmap/queries.ts` — Prisma query functions:
  - `getHeatmapData(userId, filters)` — Aggregates jobs across all user projects
  - `getAvailableYears(userId)` — Distinct years from user's job history
  - `getAvailableAgents(userId)` — Distinct agents from user's tickets

**Patterns**:
- Cross-project access: Use owner+member OR pattern from `lib/db/projects.ts:30-34`
- Agent filtering: Use `buildEffectiveAgentWhere` pattern from `lib/analytics/queries.ts:51-69`
- Cost null handling: Include jobs with null `costUsd` in counts, exclude from cost totals (per spec decision)

### Phase 2: API Endpoint

**Goal**: Create the REST endpoint for heatmap data.

**Files**:
- **Create** `app/api/activity-heatmap/route.ts` — GET handler
  - Auth: `requireAuth(request)` from `lib/db/users.ts`
  - Validation: Zod schema for `year` and `agent` query params
  - Response: `HeatmapResponse` shape (see `contracts/activity-heatmap-api.md`)
  - Error handling: try-catch with structured `{ error }` responses

**Patterns**:
- Auth: `requireAuth()` directly (not project-scoped) per P6 in research
- Error handling: try-catch with structured errors per constitution §Error Handling

### Phase 3: Client Hook & Query Keys

**Goal**: TanStack Query hook for the heatmap data.

**Files**:
- **Modify** `app/lib/query-keys.ts` — Add `heatmap` key factory
- **Create** `hooks/use-activity-heatmap.ts` — `useActivityHeatmap(filters)` hook
  - 15s refetchInterval, 10s staleTime (matches analytics pattern from P3 in research)
  - Returns `{ data, isLoading, error }`

### Phase 4: Heatmap Component

**Goal**: Build the full heatmap UI with grid, controls, and tooltips.

**Files**:
- **Create** `components/projects/activity-heatmap.tsx` — Main `"use client"` component containing:
  - **Header**: "X jobs · Y tickets shipped in the last year" with aggregate metrics
  - **Controls**: Year selector (shadcn Select), Agent filter (shadcn Select)
  - **Grid**: 52 columns (weeks) × 7 rows (days), month labels top, day-of-week labels left
  - **Cells**: Colored divs with 5 violet intensity levels (static Tailwind classes)
  - **Tooltips**: shadcn Tooltip on hover showing tickets shipped, job count + cost, formatted date
  - **Legend**: "Less" → "More" intensity scale at bottom-right
  - **Empty state**: All cells transparent, "0 jobs · 0 tickets shipped"
  - **Mobile**: `overflow-x-auto` wrapper for horizontal scrolling (FR-011)

**Patterns**:
- Tooltip: shadcn `TooltipProvider` wrapper per P4 in research
- Aurora styling: `Card` with `border-ctp-mauve/15 aurora-bg-subtle` per P5
- Color levels: 5 static Tailwind classes (never dynamic construction per CLAUDE.md)
- Intensity: Percentile-based thresholds computed client-side from max daily count

**Intensity level mapping** (static classes):
```
Level 0: bg-ctp-surface0/50   (no activity)
Level 1: bg-ctp-mauve/25      (low)
Level 2: bg-ctp-mauve/40      (medium)
Level 3: bg-ctp-mauve/60      (high)
Level 4: bg-ctp-mauve         (max)
```

### Phase 5: Page Integration & Scroll Fix

**Goal**: Mount the heatmap on the projects page and fix the scroll constraint.

**Files**:
- **Modify** `components/projects/projects-container.tsx` — Remove `overflow-y-auto max-h-[calc(100vh-200px)]` from wrapper div (per D5 in research)
- **Modify** `app/projects/page.tsx` — Add `<ActivityHeatmap />` below `<ProjectsContainer />`

---

## Testing Strategy

### Integration Test (Phase 2)
- **Create** `tests/integration/activity-heatmap/route.test.ts`
- Uses `getTestContext()` + `ctx.api.get()` pattern from `tests/fixtures/vitest/setup.ts`
- Test scenarios:
  1. Returns heatmap data for user with jobs across multiple projects
  2. Filters by specific year correctly
  3. Filters by agent correctly
  4. Returns empty data for user with no jobs
  5. Returns 401 for unauthenticated requests
  6. Validates invalid year/agent params return 400
  7. Includes jobs from member projects (not just owned)

### Component Test (Phase 4)
- **Create** `tests/unit/components/activity-heatmap.test.tsx`
- Uses `renderWithProviders()` from `tests/utils/component-test-utils.tsx`
- Test scenarios:
  1. Renders 7 rows × 52 columns grid
  2. Shows correct header metrics
  3. Renders empty state with zero counts
  4. Tooltip displays on cell hover with correct data
  5. Year selector changes displayed period
  6. Agent filter changes displayed data
  7. Legend shows 5 intensity levels
  8. Mobile horizontal scroll container present

---

## Generated Artifacts

| Artifact | Path (repo-relative) |
|----------|---------------------|
| Research | `specs/AIB-643-activity-heatmap-on/research.md` |
| Data Model | `specs/AIB-643-activity-heatmap-on/data-model.md` |
| API Contract | `specs/AIB-643-activity-heatmap-on/contracts/activity-heatmap-api.md` |
| Plan | `specs/AIB-643-activity-heatmap-on/plan.md` |
