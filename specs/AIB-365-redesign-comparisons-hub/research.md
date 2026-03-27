# Research: Redesign Comparisons Hub

**Feature Branch**: `AIB-365-redesign-comparisons-hub`
**Date**: 2026-03-27

## R1: Accordion Component Strategy

**Decision**: Use Radix `Collapsible` (already in project) for expand/collapse behavior, with manual single-expand state management in the parent.

**Rationale**: The project already uses `@radix-ui/react-collapsible` exported from `components/ui/collapsible.tsx`. It's used in the pricing FAQ and comparison decision points. Radix Collapsible supports `open`/`onOpenChange` props for controlled mode, which is exactly what we need for single-expand accordion behavior (parent tracks `expandedId`, passes `open={id === expandedId}`).

**Alternatives considered**:
- Radix Accordion: Not installed in the project. Would require adding a new dependency for marginal benefit over controlled Collapsible.
- Custom CSS `max-height` transition: Fragile with dynamic content heights. Radix handles animation lifecycle properly via `data-[state]` attributes.
- No component library: Manual open/close logic would duplicate what Collapsible already provides (accessibility, animation hooks).

## R2: Expand/Collapse Animation

**Decision**: Use Radix `data-[state=open/closed]` attributes with Tailwind's `animate-in`/`animate-out` utilities plus `grid-rows` animation for smooth height transition.

**Rationale**: The project already uses `data-[state]` animation patterns in sheets, dialogs, and collapsibles. CSS `grid-template-rows: 0fr → 1fr` is the modern approach for smooth height animation without needing to know content height. This avoids the performance issues of animating `max-height` with large values.

**Alternatives considered**:
- `max-height` with large arbitrary value: Causes animation timing mismatch (collapse is instant, expand is slow) and feels laggy.
- JavaScript-measured height: Complex, requires ResizeObserver, and is unnecessary when CSS grid animation works natively.
- No animation: Spec requires smooth visual transition (SC-007).

## R3: Load More Pagination Strategy

**Decision**: Convert from page-based `useProjectComparisonList` to cursor-based accumulation using TanStack Query's `useInfiniteQuery`, following the existing activity feed pattern.

**Rationale**: The activity feed (`hooks/queries/use-project-activity.ts`, `components/activity/activity-feed.tsx`) already implements exactly this pattern — `useInfiniteQuery` with `fetchNextPage`, `hasNextPage`, and a "Load More" button. The API already returns `page`, `pageSize`, `total`, `totalPages` which can drive `getNextPageParam`. Using `useInfiniteQuery` gives us:
- Automatic page accumulation (no manual state for loaded pages)
- `hasNextPage` boolean for button visibility
- `isFetchingNextPage` for loading state
- Preserved scroll position (appends, doesn't replace)

**Alternatives considered**:
- Manual page accumulation with `useState`: Would work but duplicates logic that `useInfiniteQuery` handles natively. The activity feed already proves this pattern in the codebase.
- Virtual scrolling / infinite scroll on intersection: Overkill for comparison cards (each is small). Load More button is simpler and gives users explicit control.

## R4: Score Display in Compact Cards

**Decision**: Display the winner's `score` field from `ComparisonParticipantDetail` by including it in the `ProjectComparisonSummary` API response, OR fetch it separately. Since the spec says "comparison score" and the summary doesn't include it, we'll add a `winnerScore` field to the API response.

**Rationale**: `ProjectComparisonSummary` currently lacks a score field. The score lives on `ComparisonParticipant` (the winner's `score` column). Adding `winnerScore: number | null` to the summary API response is a minimal change — the query already joins `ComparisonParticipant` to get `winnerTicketId`. This avoids fetching full detail just to show a number on the compact card.

**Alternatives considered**:
- Fetch `ComparisonDetail` for each card: Extremely wasteful — each detail includes participants, decision points, compliance rows. Would multiply API payload by ~10x.
- Show score only when expanded: Doesn't meet FR-002 ("Each compact card MUST show ... comparison score").
- Client-side computation from summary data: No score data available in summary to compute from.

## R5: Deep Link Auto-Expand

**Decision**: On page load, if `?comparisonId=X` is present, set `expandedId = X`. If the comparison is not in the initial page, use `useInfiniteQuery.fetchNextPage()` in a loop until found or all pages exhausted.

**Rationale**: The server component already parses `comparisonId` from search params and passes it as `initialComparisonId`. The client component can set this as the initial `expandedId`. For comparisons beyond the first page, TanStack Query's `fetchNextPage` returns the new data, so we can check if the target ID appeared and stop fetching. A `useEffect` with a ref to prevent re-runs handles the initial load sequence.

**Alternatives considered**:
- Server-side redirect to the page containing the comparison: Requires knowing which page the comparison falls on, adding server round-trips.
- Separate API call for the deep-linked comparison, inserted into the list: Complex merge logic and potential duplicates when the user loads more.
- Ignore deep links to non-first-page comparisons: Doesn't meet acceptance scenario US4.2.

## R6: ScrollArea Removal from ComparisonDashboard

**Decision**: Remove the `ScrollArea` wrapper (`h-[68vh]`) from `ComparisonDashboard` so detail content participates in the page's natural scroll.

**Rationale**: FR-009 requires a single scroll context. The current `ComparisonDashboard` wraps content in `<ScrollArea className="h-[68vh]">` which creates a nested scroll container. In the new layout, expanded detail is inline in the page flow, so it must use the page scroll. The `ScrollArea` removal affects `ComparisonDashboard` which is also used in `ComparisonViewer` (the ticket-level dialog). The dialog already constrains height via `max-h-[90vh]` on `DialogContent`, so removing `ScrollArea` from the dashboard and letting the dialog handle overflow is acceptable.

**Alternatives considered**:
- Keep ScrollArea and pass a prop to toggle it: Adds complexity for a case that's easy to handle with CSS overflow on the parent.
- Create a separate dashboard component without ScrollArea: Violates DRY — the dashboard layout is identical in both contexts.
- Fork ComparisonDashboard: Same DRY concern.

The cleanest approach: remove `ScrollArea` from `ComparisonDashboard`, and in `ComparisonViewer` (dialog), add overflow-y-auto to the dialog's content wrapper instead.
