# Implementation Summary: Health Drawer — Clickable Scan History + Visible Issue Counts

**Branch**: `AIB-760-health-drawer-clickable` | **Date**: 2026-04-29
**Spec**: [spec.md](spec.md)

## Changes Summary

Added `scanId` query param to health scans API for single-scan lookup. Extended `useScanReport` hook with optional `scanId`. Made scan history rows interactive (click/keyboard) with `selectedScanId` state in `ScanDetailDrawer`. Added friction badge for issue count coloring (0=green, 1-2=yellow, 3+=red). Removed cost/token display. Full keyboard accessibility (Enter/Space/focus ring).

## Key Decisions

Used two `useScanReport` calls (null + selectedScanId) so `latestScanId` stays stable when viewing historical scans — TanStack Query cache makes the extra call free. Added `scanId` param to existing GET endpoint rather than a new route to avoid auth duplication. Implemented all drawer-history changes in one pass (T006/T008/T010/T012) since they all modify the same file.

## Files Modified

- `app/api/projects/[projectId]/health/scans/route.ts` — scanId param + single-scan fetch path
- `app/lib/hooks/useScanReport.ts` — optional scanId param, updated query key
- `components/health/scan-detail-drawer.tsx` — selectedScanId state, latestScanId, wiring
- `components/health/drawer/drawer-history.tsx` — interactive rows, friction badge, no cost/tokens, keyboard a11y
- `tests/unit/components/drawer-history.test.tsx` — new (26 tests across all 4 user stories)
- `tests/unit/components/scan-detail-drawer.test.tsx` — extended with 2 selectedScanId tests

## ⚠️ Manual Requirements

None
