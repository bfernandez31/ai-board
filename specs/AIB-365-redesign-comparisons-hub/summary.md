# Implementation Summary: Redesign Comparisons Hub as Vertical List with Inline Expand

**Branch**: `AIB-365-redesign-comparisons-hub` | **Date**: 2026-03-27
**Spec**: [spec.md](spec.md)

## Changes Summary

Replaced 2-column sidebar+detail layout with single-column vertical list of compact ComparisonCard components. Each card shows winner key, title, summary, score badge, and date. Clicking expands full dashboard inline (accordion-style, single expand). Replaced page-based pagination with Load More button using useInfiniteQuery. Added deep link support via ?comparisonId=X with auto-expand and scrollIntoView.

## Key Decisions

Used Radix Collapsible (already in project) for expand/collapse instead of adding Radix Accordion dependency. Used CSS grid-template-rows animation for smooth height transitions. Removed ScrollArea from ComparisonDashboard and added overflow-y-auto to ComparisonViewer dialog wrapper instead. Used TanStack Query useInfiniteQuery with select transform to flatten pages.

## Files Modified

- `lib/types/comparison.ts` — added winnerScore to ProjectComparisonSummary
- `lib/comparison/project-comparison-summary.ts` — updated Prisma query + normalizer
- `hooks/use-comparisons.ts` — added useProjectComparisonListInfinite hook
- `components/comparison/comparison-card.tsx` — NEW compact card with inline expand
- `components/comparison/comparison-viewer.tsx` — removed ScrollArea, added overflow
- `components/comparison/project-comparisons-page.tsx` — full rewrite: vertical list
- `components/comparison/types.ts` — added ComparisonCardProps
- `tests/unit/components/comparison-card.test.tsx` — NEW 16 component tests
- `tests/integration/comparisons/comparisons-hub.test.ts` — NEW integration tests

## ⚠️ Manual Requirements

None
