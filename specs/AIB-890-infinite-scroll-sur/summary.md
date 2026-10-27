# Implementation Summary: Infinite scroll sur la colonne SHIP - remplace Load more

**Branch**: `AIB-890-infinite-scroll-sur` | **Date**: 2026-10-27
**Spec**: [spec.md](spec.md)

## Changes Summary

Replaced the SHIP "Load more" button with infinite scroll: a bottom sentinel observed against the column viewport (300px pre-load) fetches the next 50-ticket batch, with spinner, error alert + Retry, id dedupe, single in-flight request, stop on empty/duplicate batch, drag pause, and background refresh retaining scrolled-in SHIP tickets. Other columns untouched.

## Key Decisions

New pure helpers in lib/tickets/ship-pagination.ts. useShipInfiniteLoad reads the offset from the query cache (not the render prop) so a load fired before re-render never reuses a stale offset. Exhaustion keyed to shipTotal so a changed total re-enables loading. Sentinel tracked via state so the observer re-attaches after error/retry.

## Files Modified

lib/tickets/ship-pagination.ts (new), app/lib/hooks/queries/useTickets.ts, components/board/{stage-column,board-grid,board}.tsx, specs/specifications/technical/api/endpoints/tickets.md, tests: unit/tickets/ship-pagination, unit/components/board/stage-column-infinite-scroll, integration/tickets/ship-pagination, e2e/board/responsive.

## ⚠️ Manual Requirements

None
