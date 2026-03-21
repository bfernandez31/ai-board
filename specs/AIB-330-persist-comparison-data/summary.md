# Implementation Summary: Persist comparison data to database via workflow

**Branch**: `AIB-330-persist-comparison-data` | **Date**: 2026-03-21
**Spec**: [spec.md](spec.md)

## Changes Summary

Added a workflow-driven comparison persistence bridge: compare artifacts now emit transient `comparison-data.json`, a workflow-authenticated `POST /comparisons` endpoint validates and persists durable records with compare-run idempotency, and the assist workflow submits then deletes the JSON sidecar without risking markdown success.

## Key Decisions

Used a nullable `compareRunKey` on `ComparisonRecord` plus scoped uniqueness for retry-safe writes without breaking existing records. Kept the comparisons route public at the proxy layer so workflow POSTs can reach route-level token validation while GET remains protected inside the handler. Added a separate server health URL for integration setup to avoid an unrelated homepage CSS failure blocking API verification.

## Files Modified

`lib/comparison/comparison-payload.ts`, `lib/comparison/comparison-generator.ts`, `lib/comparison/comparison-record.ts`, `app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts`, `.github/workflows/ai-board-assist.yml`, `proxy.ts`, `prisma/schema.prisma`, `prisma/migrations/20260321093000_comparison_compare_run_key/migration.sql`, comparison tests and fixtures, `specs/AIB-330-persist-comparison-data/tasks.md`.

## ⚠️ Manual Requirements

None
