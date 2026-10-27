# Implementation Summary: Infinite scroll on the SHIP column (replaces Load more)

**Branch**: `AIB-894-infinite-scroll-sur` | **Date**: 2026-10-27
**Spec**: [spec.md](spec.md)

## Changes Summary

Replaced the SHIP "Load more" button with an IntersectionObserver sentinel inside the column's scroll viewport (300px pre-load), a spinner and an error + Retry state. Load-more hook: single request in flight, id dedupe, empty batch stops loading. Server: id DESC tie-breaker on SHIP order, optional `shipLimit` so refetches keep loaded batches. Loading pauses during drag.

## Key Decisions

Kept the flat `projects.tickets` cache and offset API (no useInfiniteQuery refactor). The in-flight guard is a sync ref because isPending lags a render. Recreating the observer when gates or ticket count change fills tall columns without timers. Refetch requests shipLimit = loaded SHIP count (capped at 1000), so the server stays the source of truth.

## Files Modified

New: lib/tickets/ship-pagination.ts, components/board/ship-infinite-scroll-footer.tsx, 3 unit test files. Modified: lib/db/tickets.ts, app/api/projects/[projectId]/tickets/route.ts, app/lib/hooks/queries/useTickets.ts, components/board/{stage-column,board-grid,board}.tsx, tests/integration/tickets/ship-pagination.test.ts

## ⚠️ Manual Requirements

Check on a real device per quickstart.md (iOS Safari/Chrome Android touch scroll, no jump on append, screen reader announcements). It was not possible in CI, so RTL tests with an IO stub cover the logic instead.
