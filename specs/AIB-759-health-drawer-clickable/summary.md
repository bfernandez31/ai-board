# Implementation Summary: Health drawer — clickable scan history + visible issue counts

**Branch**: `AIB-759-health-drawer-clickable` | **Date**: 2026-04-29
**Spec**: [spec.md](spec.md)

## Changes Summary

Made every Scan History row clickable: clicking, Enter, or Space swaps the report area to the selected historic scan while the Score Trend chart stays pinned. Added a "Latest" affordance, friction-colored issue counts (low/med/high via the unified Badge), and removed the cost ($) and token columns (data preserved in DB and API). Selection resets when the active module changes. New `GET /api/projects/:projectId/health/scans/:scanId` endpoint with cross-project guard. All 38 impacted tests pass; lint and type-check clean.

## Key Decisions

- Lifted `selectedScanId` state into `ScanDetailDrawer` (parent of issues and history) per D-002 — minimum-change controlled-component handshake.
- Endpoint returns 404 (not 403) on cross-project mismatch to avoid leaking existence.
- Used React's "adjust state during render when prop changes" pattern instead of `useEffect` to reset on `moduleType` change (avoids cascading-render lint warning).
- Native `<button>` for rows — Enter/Space/focus-ring for free; `aria-pressed` for AT.
- No schema migration; cost/token data and `formatCost`/`formatTokens` helpers untouched.

## Files Modified

New: `lib/health/issue-friction.ts`, `app/api/projects/[projectId]/health/scans/[scanId]/route.ts`, `app/lib/hooks/useScanById.ts`, `tests/unit/lib/health/issue-friction.test.ts`, `tests/unit/components/drawer-history.test.tsx`, `tests/integration/health/scan-by-id.test.ts`. Modified: `app/lib/query-keys.ts`, `components/health/scan-detail-drawer.tsx`, `components/health/drawer/drawer-history.tsx`, `tests/unit/components/scan-detail-drawer.test.tsx`.

## ⚠️ Manual Requirements

None — fully automated. Reviewer note: confirm "Latest" button styling on the drawer header passes visual review across the five active modules (FR-012).
