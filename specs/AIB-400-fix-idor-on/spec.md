# Quick Implementation: Fix IDOR on documentation diff and history endpoints

**Feature Branch**: `AIB-400-fix-idor-on`
**Created**: 2026-03-30
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Fix IDOR on documentation diff and history endpoints. The docs diff and history
endpoints were inaccessible (404) due to a Next.js App Router conflict where a
parent `docs/route.ts` prevented child `docs/diff/route.ts` and
`docs/history/route.ts` from being resolved.

## Root Cause

In Next.js 16 (App Router with Turbopack), having a `route.ts` at
`app/api/projects/[projectId]/docs/route.ts` prevented the child routes at
`docs/diff/route.ts` and `docs/history/route.ts` from being discovered. All
requests to `/api/projects/:id/docs/diff` and `/api/projects/:id/docs/history`
returned HTML 404 pages instead of reaching the route handlers.

## Fix

Moved the parent `docs/route.ts` (POST handler for editing documentation) to
`docs/edit/route.ts`, eliminating the routing conflict. Updated the single
client-side reference in `useEditDocumentation.ts`.

Both diff and history route handlers already used `verifyProjectAccess()` for
proper authorization — the fix was enabling the routes to be reachable. Fixed
the integration tests which were also broken by this routing issue.

## Implementation

Implementation done directly by Claude Code based on the description above.
