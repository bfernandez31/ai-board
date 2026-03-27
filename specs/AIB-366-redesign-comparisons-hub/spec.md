# Quick Implementation: Redesign comparisons hub as vertical list with inline expand

**Feature Branch**: `AIB-366-redesign-comparisons-hub`
**Created**: 2026-03-27
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Redesign the comparisons hub page from a 2-column layout (sidebar + detail panel) to a vertical list with inline expand pattern. This eliminates double scroll contexts, replaces pagination with "Load More", and gives the detail content full width.

## Changes

### Layout: 2-column grid to single-column vertical list
- Removed the 2-column layout (340px sidebar + flexible detail)
- Comparisons now display as a vertical list of compact cards (reverse chronological)
- Each card shows: winner ticket key, winner title, summary, and date

### Interaction: Click-to-select to click-to-expand accordion
- Clicking a card expands the full comparison detail inline below it
- Clicking again (or clicking another card) collapses the detail
- Only one comparison can be expanded at a time

### Pagination: Previous/Next to Load More
- Replaced page-based Previous/Next navigation with "Load More" button
- Uses useInfiniteQuery from TanStack Query for efficient page accumulation
- Shows progress indicator (X of Y comparisons loaded)

### Scroll: Nested ScrollArea to single page scroll
- Removed ScrollArea with fixed h-[68vh] from ComparisonDashboard
- Detail content now flows naturally within the page scroll
- No nested scroll containers

### Deep linking
- comparisonId URL parameter still works
- Auto-expands and scrolls to the targeted comparison on load

## Files Modified

- `components/comparison/project-comparisons-page.tsx` — Complete rewrite to vertical list + inline expand
- `components/comparison/comparison-viewer.tsx` — Removed ScrollArea wrapper from ComparisonDashboard
- `components/comparison/types.ts` — Removed initialPage from ProjectComparisonsPageProps
- `hooks/use-comparisons.ts` — Added useProjectComparisonInfiniteList hook
- `app/projects/[projectId]/comparisons/page.tsx` — Removed page search param, kept comparisonId
