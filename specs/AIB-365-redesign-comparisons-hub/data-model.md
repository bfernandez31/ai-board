# Data Model: Redesign Comparisons Hub

**Feature Branch**: `AIB-365-redesign-comparisons-hub`
**Date**: 2026-03-27

## Overview

This feature is a **UI-only redesign** — no new database tables or columns are needed. The existing `ComparisonRecord`, `ComparisonParticipant`, and related models are unchanged. The only data change is adding `winnerScore` to the API summary response by including the winner participant's `score` field in the existing Prisma query.

## Entities (Existing — No Changes)

### ComparisonRecord (database)
Already contains all fields needed for compact card display:
- `id`, `generatedAt`, `summary`, `overallRecommendation`, `keyDifferentiators`
- `winnerTicketId` → joins to `Ticket` for `ticketKey`, `title`
- `projectId`, `sourceTicketId`

### ComparisonParticipant (database)
Contains the score field needed for compact cards:
- `score: Float` — the participant's comparison score
- `rank: Int` — ranking position
- `comparisonRecordId` → parent comparison

## API Response Changes

### ProjectComparisonSummary (TypeScript interface)

**Add one field** to `ProjectComparisonSummary` in `lib/types/comparison.ts`:

```typescript
export interface ProjectComparisonSummary extends ComparisonSummary {
  // ... existing fields ...
  winnerScore: number | null;  // NEW — winner participant's score
}
```

**Prisma query change** in `lib/comparison/project-comparison-summary.ts`:

Add `score` to the winner participant select in `listProjectComparisons`:
```typescript
participants: {
  select: {
    ticketId: true,
    score: true,  // NEW
    ticket: { select: { ticketKey: true } },
  },
},
```

Then in `normalizeProjectComparisonSummary`, extract winner score:
```typescript
winnerScore: record.participants.find(p => p.ticketId === record.winnerTicketId)?.score ?? null,
```

## Client-Side State

### New: ComparisonCardProps (TypeScript interface)

```typescript
export interface ComparisonCardProps {
  comparison: ProjectComparisonSummary;
  isExpanded: boolean;
  detail: ComparisonDetail | undefined;
  isDetailLoading: boolean;
  onToggle: () => void;
}
```

### Modified: ProjectComparisonsPage state

| State | Before | After |
|-------|--------|-------|
| `page` | `useState<number>` with prev/next | Removed — `useInfiniteQuery` manages pages internally |
| `selectedComparisonIdOverride` | Tracks which comparison detail to show in right panel | Renamed to `expandedId` — tracks which card is expanded |
| `expandedId` | N/A | `useState<number \| null>(initialComparisonId)` |
| Accumulated comparisons | N/A | `useInfiniteQuery` pages flattened via `.flatMap()` |

### Hook Change: useProjectComparisonListInfinite

New hook wrapping `useInfiniteQuery` to replace `useProjectComparisonList`:

```typescript
function useProjectComparisonListInfinite(projectId: number, pageSize: number) {
  return useInfiniteQuery({
    queryKey: comparisonKeys.projectList(projectId, 0, pageSize),
    queryFn: ({ pageParam }) => fetchProjectComparisons(projectId, pageParam, pageSize),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });
}
```

## Validation Rules

No new validation — all user inputs (projectId, comparisonId) are already validated by the existing server component and API routes. The `winnerScore` field is read-only from the database.

## State Transitions

No state transitions apply — comparisons are immutable records. The only UI state is the accordion expand/collapse, which is a simple `expandedId: number | null` toggle.
