# Contract: Admin Page Routes

**Feature**: AIB-791
**Date**: 2026-05-11

All admin **page** routes (HTML responses, not API) are gated by `requireAdminOrNotFound`. Any
non-admin request — unauthenticated OR authenticated-but-not-allowlisted — produces a Not Found
response byte-equivalent to Next.js's default 404 (D-10, FR-003, SC-002).

## `GET /admin`

| Concern | Specification |
|---------|---------------|
| Component | `app/admin/page.tsx` — Server Component |
| Auth | `await requireAdminOrNotFound(request)` at top |
| Success behavior | `redirect('/admin/insights')` (Next.js 307) |
| Non-admin | `notFound()` — renders Next.js default 404 |
| Caching | `'force-dynamic'` segment config |
| Top-level headers | `X-Frame-Options: DENY`, `Cache-Control: private, no-store` (set globally for `/admin/*` via `next.config.ts` `headers()`) |

## `GET /admin/insights`

| Concern | Specification |
|---------|---------------|
| Component | `app/admin/insights/page.tsx` — Server Component |
| Auth | `await requireAdminOrNotFound(request)` at top of layout AND page (layout catches admin folder; page is defense-in-depth in case of layout regression) |
| Data fetched (server-side) | (a) `getLatestCompletedReport()`; (b) `listReports({ limit: 200 })`; (c) `countShippedClaudeTicketsSince(prevEnd)` for the initial UI state of the trigger button. (d) `reconcileOrphanedRunningReports(new Date())` before any read. |
| Client islands | `<InsightsReportView reports={...} latestId={...} preflight={...} />` |
| Empty state | When `listReports().length === 0`: render the "No analysis has been run yet" panel plus the "Run new analysis" button (subject to pre-flight). |
| Running state | When the most-recent row is RUNNING: render "Running since {createdAt}" placeholder, trigger button DISABLED, polling enabled (15s) until the row reaches a terminal status. |
| Non-admin | `notFound()` |
| Caching | `'force-dynamic'` |
| Headers | Same as `/admin`. |

## `GET /admin/*` (catch-all)

Any other `/admin/...` path that does not resolve to a defined page route falls through to
Next.js's default 404 handler. Admin layout's auth check runs FIRST and returns 404 for
non-admins, so the byte equality holds for both "non-admin requesting a real admin path" and
"non-admin requesting a fake admin path".

## Global navigation

| Concern | Specification |
|---------|---------------|
| Where | `components/layout/header.tsx`, `components/navigation/nav-items.ts` |
| Required change | **None**. No link, no badge, no hint of `/admin`. |
| Test | Snapshot test: render header as an admin AND as a non-admin → assert no `/admin` link appears in either case (FR-001). |
