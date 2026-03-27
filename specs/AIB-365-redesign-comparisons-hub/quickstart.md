# Quickstart: Redesign Comparisons Hub

**Feature Branch**: `AIB-365-redesign-comparisons-hub`
**Date**: 2026-03-27

## Implementation Order

### Step 1: Add winnerScore to API response
1. Add `winnerScore: number | null` to `ProjectComparisonSummary` interface in `lib/types/comparison.ts`
2. Update Prisma query in `lib/comparison/project-comparison-summary.ts` to select `score` from participants
3. Map winner score in `normalizeProjectComparisonSummary`

### Step 2: Add infinite query hook
1. Add `useProjectComparisonListInfinite` to `hooks/use-comparisons.ts` using `useInfiniteQuery`
2. Follow existing activity feed pattern (`use-project-activity.ts`)
3. Keep existing `useProjectComparisonList` (used elsewhere or for backwards compat)

### Step 3: Remove ScrollArea from ComparisonDashboard
1. In `components/comparison/comparison-viewer.tsx`, remove `<ScrollArea className="h-[68vh]">` wrapper from `ComparisonDashboard`
2. Add overflow handling to `ComparisonViewer` dialog content instead

### Step 4: Create ComparisonCard component
1. New file: `components/comparison/comparison-card.tsx`
2. Compact header: winner key, title, summary snippet, score badge, date
3. Radix `Collapsible` for expand/collapse with CSS grid animation
4. When expanded, render `<ComparisonDashboard detail={detail} />` inline

### Step 5: Rewrite ProjectComparisonsPage
1. Replace 2-column grid with single-column vertical list
2. Replace pagination controls with "Load More" button
3. Use `useProjectComparisonListInfinite` for data
4. Track `expandedId` state for single-expand accordion
5. Fetch detail on demand via `useProjectComparisonDetail` when card is expanded
6. Handle deep link: set initial `expandedId` from `initialComparisonId` prop

### Step 6: Deep link auto-fetch
1. If `initialComparisonId` is set but not found in loaded pages, call `fetchNextPage` until found
2. Scroll target card into view with `scrollIntoView({ behavior: 'smooth' })`

### Step 7: Tests
1. Component test for ComparisonCard: renders compact info, expand/collapse on click
2. Integration test for Load More: accumulates pages, button visibility
3. Integration test for deep link: auto-expands target comparison

## Key Files to Modify

| File | Change |
|------|--------|
| `lib/types/comparison.ts` | Add `winnerScore` to `ProjectComparisonSummary` |
| `lib/comparison/project-comparison-summary.ts` | Select score, map to `winnerScore` |
| `hooks/use-comparisons.ts` | Add `useProjectComparisonListInfinite` hook |
| `components/comparison/comparison-viewer.tsx` | Remove `ScrollArea` from `ComparisonDashboard` |
| `components/comparison/comparison-card.tsx` | **NEW** — compact card with inline expand |
| `components/comparison/types.ts` | Add `ComparisonCardProps` |
| `components/comparison/project-comparisons-page.tsx` | Full rewrite: vertical list + accordion + Load More |

## Critical Constraints

- **FR-007**: All 6 sub-components reused without modification
- **FR-009**: No `ScrollArea` or nested scroll containers in the page layout
- **FR-005**: Only one card expanded at a time (single-expand accordion)
- No new database migrations
- No new API routes — only one field addition to existing response
