# Research: Add SKIPPED Status for Health Scans

**Branch**: `AIB-535-copy-of-add` | **Date**: 2026-04-04

## Resolved Unknowns

### 1. How does the workflow currently parse scan results?

- **Decision**: The workflow reads `/tmp/health-scan-result.json` and extracts `score`, `issuesFound`, `issuesFixed`, `report` fields. It then POSTs a COMPLETED status with these values to the API.
- **Rationale**: The result file schema must be extended with a `skipped` boolean. The workflow must check this field and send `SKIPPED` status instead of `COMPLETED` when `skipped: true`.
- **Alternatives considered**: Having the workflow detect "nothing to evaluate" itself — rejected because the agent has domain knowledge about what constitutes "empty" for each scan type.

### 2. How does the status update API validate transitions?

- **Decision**: `VALID_TRANSITIONS` map in `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` controls allowed transitions. Currently: PENDING→RUNNING/FAILED, RUNNING→COMPLETED/FAILED. SKIPPED must be added as a valid transition from RUNNING (agent runs briefly, detects nothing, exits).
- **Rationale**: SKIPPED is terminal like COMPLETED/FAILED. The agent starts (RUNNING), detects nothing to evaluate, then reports SKIPPED.
- **Alternatives considered**: Allowing PENDING→SKIPPED directly — rejected because the agent must at least start to determine there's nothing to evaluate.

### 3. How does the HealthScore aggregate handle null scores?

- **Decision**: When a scan is SKIPPED (score: null), the HealthScore aggregate field for that module should be set to null. The `calculateGlobalScore` function already excludes null scores from the average.
- **Rationale**: Setting the module score to null on SKIPPED ensures it's excluded from global score. However, we need a nuance: if a module had a previous COMPLETED score, a SKIPPED scan should NOT overwrite it. The spec says "the module card shows the last COMPLETED score alongside the Skipped indicator."
- **Alternatives considered**: Keeping the old score in HealthScore and only tracking SKIPPED status on the individual scan — this is actually the better approach. The HealthScore aggregate should NOT be updated on SKIPPED, preserving the last meaningful score.

### 4. Dashboard rendering of SKIPPED state

- **Decision**: The `health-module-card.tsx` component needs a new `'skipped'` card state. When the latest scan is SKIPPED, show muted/grayed-out appearance with "Skipped" label and reason text. Score badge shows "N/A".
- **Rationale**: Follows spec Decision 1 — clear visual distinction prevents misinterpreting SKIPPED as a perfect score.
- **Alternatives considered**: Reusing the `never_scanned` state — rejected because SKIPPED should show the last known score (if any) alongside the skip indicator.

### 5. Trends API filtering

- **Decision**: The trends API already filters by `status: 'COMPLETED'` and `score: { not: null }`. SKIPPED scans will naturally be excluded without code changes to the query.
- **Rationale**: The existing filter is sufficient because SKIPPED scans have null scores and non-COMPLETED status.
- **Alternatives considered**: None needed — existing behavior is correct.

### 6. Which scan types can be SKIPPED?

- **Decision**: Per spec:
  - REVIEW_QUALITY: SKIPPED when 0 qualifying PRs
  - SECURITY: SKIPPED when 0 changed files (incremental mode only)
  - SPEC_SYNC: SKIPPED when 0 spec files
  - COMPLIANCE: NEVER skipped (always evaluates constitution)
  - TESTS: NEVER skipped (0 failures = score 100, legitimate result)
- **Rationale**: Each agent command must be updated to detect its "nothing to evaluate" condition and write a result with `skipped: true`.
- **Alternatives considered**: Having the workflow enforce which types can skip — rejected per spec Decision 3 (agent has domain knowledge).

## Existing Files

### Source Files (to modify)

| File | What it covers | Action |
|------|---------------|--------|
| `prisma/schema.prisma` (lines 492-497) | `HealthScanStatus` enum | **Extend**: Add `SKIPPED` value |
| `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` | Scan status update API | **Modify**: Accept SKIPPED status, skip HealthScore update for SKIPPED, allow null score for SKIPPED |
| `app/api/projects/[projectId]/health/route.ts` | Main health GET endpoint | **Modify**: Include SKIPPED in `buildModuleStatus`, add skip reason to module status |
| `app/api/projects/[projectId]/health/trends/route.ts` | Trend data API | **No change**: Already filters `status: 'COMPLETED'` |
| `lib/health/types.ts` | TypeScript interfaces | **Modify**: Add `skipReason` to `HealthModuleStatus`, update `ActiveScanInfo` |
| `lib/health/score-calculator.ts` | Global score calculation | **No change**: Already handles null scores |
| `lib/health/report-schemas.ts` | Zod report validation | **No change**: Report schema is independent of status |
| `components/health/health-module-card.tsx` | Module card UI | **Modify**: Add `'skipped'` card state, N/A badge, skip reason display |
| `components/health/health-hero.tsx` | Hero section with sub-scores | **Minor**: Handle SKIPPED display in sub-score badges |
| `components/health/health-sub-score-badge.tsx` | Sub-score badge | **Check**: May need SKIPPED handling |
| `.github/workflows/health-scan.yml` | Scan execution workflow | **Modify**: Check `skipped` field in result, send SKIPPED status |
| `.claude-plugin/commands/ai-board.health-review-quality.md` | Review quality agent | **Modify**: Add early exit for 0 PRs |
| `.claude-plugin/commands/ai-board.health-security.md` | Security agent | **Modify**: Add early exit for 0 changed files |
| `.claude-plugin/commands/ai-board.health-spec-sync.md` | Spec sync agent | **Modify**: Add early exit for 0 spec files |

### Test Files (to extend)

| File | What it covers | Action |
|------|---------------|--------|
| `tests/integration/health/health-score.test.ts` | GET /health endpoint | **Extend**: Add test for SKIPPED module display |
| `tests/integration/health/scan-status.test.ts` | PATCH status endpoint | **Extend**: Add tests for SKIPPED transitions, null score acceptance |
| `tests/integration/health/trends.test.ts` | Trends endpoint | **Extend**: Add test verifying SKIPPED excluded |
| `tests/unit/health/score-calculator.test.ts` | Score calculation | **No change**: Already tests null handling |
| `tests/unit/components/health-module-card.test.tsx` | Module card component | **Extend**: Add test for SKIPPED card state |
| `tests/unit/components/health-hero.test.tsx` | Hero component | **Extend**: Add test for SKIPPED sub-score |

### Files NOT to modify

| File | Reason |
|------|--------|
| `lib/health/quality-gate.ts` | Quality Gate is passive, unaffected by SKIPPED |
| `lib/health/scan-dispatch.ts` | Dispatch is unchanged — SKIPPED is detected after agent runs |
| `lib/health/scan-commands.ts` | Command mapping unchanged |
| `lib/health/ticket-creation.ts` | SKIPPED scans have no issues to create tickets for |
| `lib/health/format.ts` | Display formatting unaffected |
| `.github/workflows/nightly-health.yml` | Trigger logic unchanged |
| `components/health/scan-detail-drawer.tsx` | May need SKIPPED state, but low priority |
