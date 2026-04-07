# Quick Implementation: Fix globalScore excluding Quality Gate module

**Feature Branch**: `AIB-550-fix-globalscore-excluding`
**Created**: 2026-04-07
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Fix globalScore excluding Quality Gate module. When a health scan completes, the Quality Gate score was not computed or persisted, causing `globalScore` in the DB to reflect only 5 modules instead of 6. The Health Dashboard recalculated with all 6, leading to inconsistent scores.

## Changes

1. **Scan status handler** (`app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`): On scan completion, compute Quality Gate score via `getQualityGateData()` and persist it to `healthScore.qualityGate`. The `globalScore` now includes all 6 modules.

2. **Health GET endpoint** (`app/api/projects/[projectId]/health/route.ts`): Use persisted `globalScore` from DB instead of recalculating, ensuring consistency with project cards and other consumers.

3. **Tests**: Added 2 new integration tests verifying QG persistence and null handling. Updated existing tests to seed `globalScore` since the endpoint now reads it from DB.
