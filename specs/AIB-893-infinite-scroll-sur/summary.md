# Implementation Summary: Infinite scroll sur la colonne SHIP - remplace Load more

**Branch**: `AIB-893-infinite-scroll-sur` | **Date**: 2026-10-27
**Spec**: [spec.md](spec.md)

## Changes Summary

SHIP column now loads batches of 50 automatically via an IntersectionObserver sentinel (300px prefetch, column viewport root). Load more button removed; spinner (role=status), inline error + Retry (role=alert). Single in-flight request, id dedupe across stages, exhaustion handling, auto-fill on tall screens, paused while dragging. Polling refetch keeps already-loaded SHIP tickets. Header always shows loaded/total.

## Key Decisions

Trigger hook manages its own IntersectionObserver (re-checks refs after each commit) instead of reusing useIntersectionObserver, which never re-attaches when the sentinel mounts later. Exhaustion is derived from shipTotal (no effect). Polling merge caps kept extras at shipTotal - fresh count. Mutation retry=0; retry() resets then refetches.

## Files Modified

- app/lib/hooks/queries/useTickets.ts
- components/board/hooks/use-infinite-scroll-trigger.ts (new)
- components/board/stage-column.tsx, board-grid.tsx, board.tsx
- tests/unit/use-load-more-ship-tickets.test.ts (new)
- tests/unit/components/board/stage-column-infinite-scroll.test.tsx (new)
- tests/integration/tickets/ship-pagination.test.ts, tickets route (comments)

## ⚠️ Manual Requirements

T032: manual browser check (desktop scroll, blocked request → Retry, tall window auto-fill, mobile touch + floating ↓ button, polling + drag to SHIP). Optional E2E T029 skipped.
