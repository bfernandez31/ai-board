# Quick Implementation: [Compliance] Fix 2 violations - TypeScript-First

**Feature Branch**: `AIB-633-compliance-fix-2`
**Created**: 2026-04-14
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Fix 2 TypeScript-First compliance violations found by health scan:

1. `app/lib/hooks/useJobPolling.ts:101` — Removed redundant `error as Error | null` cast. TanStack Query v5 already types the `error` field as `Error | null`, making the assertion unnecessary.
2. `app/api/projects/[projectId]/tickets/route.ts:228` — Replaced unsafe `(error as { code?: number }).code` casts with proper type narrowing (`typeof` + `'code' in error`), eliminating ad-hoc type assertions on caught `unknown` errors.

## Changes

- `app/lib/hooks/useJobPolling.ts` — Removed redundant type assertion on line 101
- `app/api/projects/[projectId]/tickets/route.ts` — Replaced 2 unsafe casts with idiomatic TypeScript narrowing
