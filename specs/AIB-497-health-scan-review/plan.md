# Implementation Plan: Health Scan — Review Quality Analysis

**Ticket**: AIB-497
**Branch**: `AIB-497-health-scan-review`
**Date**: 2026-04-03
**Status**: Ready for implementation

---

## Technical Context

| Dimension | Value |
|-----------|-------|
| **Feature** | New health scan module analyzing review quality across merged FULL-workflow PRs |
| **Dependencies** | Prisma (schema migration), Octokit (GitHub API), existing health scan infra |
| **Integrations** | GitHub PR comments API (3 sources), nightly health workflow, health dashboard |
| **Risk** | Medium — extends well-established patterns; no new infrastructure required |
| **Unknowns** | None — all resolved in research.md |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new types explicitly typed; `ReviewQualityReport`, `MissedFinding`, `RecurringPattern` interfaces |
| II. Component-Driven | PASS | Follows existing health dashboard component patterns; shadcn/ui only |
| III. Test-Driven | PASS | Integration tests for API endpoints; component tests for UI card/drawer |
| IV. Security-First | PASS | Zod validation on report JSON; parameterized DB queries; no secrets exposed |
| V. Database Integrity | PASS | Prisma migration for schema changes; nullable new fields with no backfill needed |
| V. Spec Clarification | PASS | All auto-resolved decisions documented with CONSERVATIVE policy |

**Gate**: All principles satisfied. No violations.

---

## Phase 1: Data Layer (Schema + Types)

### Task 1.1: Prisma Schema Migration

**Files**:
- `prisma/schema.prisma`

**Changes**:
1. Add `REVIEW_QUALITY` to `HealthScanType` enum
2. Add `reviewQualityScore Int?` and `lastReviewQualityScan DateTime?` to `HealthScore` model

**Post-change**: `bunx prisma migrate dev --name add-review-quality-scan-type && bunx prisma generate`

### Task 1.2: TypeScript Types and Report Schema

**Files**:
- `lib/health/types.ts`
- `lib/health/report-schemas.ts`

**Changes to `types.ts`**:
1. Add `REVIEW_QUALITY` to `ACTIVE_SCAN_TYPES` array
2. Add `REVIEW_QUALITY` to `ALL_MODULE_TYPES` array
3. Add `REVIEW_QUALITY` entry to `MODULE_METADATA`
4. Add interfaces: `MissedFinding`, `RecurringPattern`, `ReviewQualityReport`
5. Add `ReviewQualityReport` to `ScanReport` discriminated union
6. Add `reviewQuality` to `HealthResponse.modules`

**Changes to `report-schemas.ts`**:
1. Add `missedFindingSchema` Zod object
2. Add `recurringPatternSchema` Zod object
3. Add `reviewQualityReportSchema` Zod object with `type: z.literal('REVIEW_QUALITY')`
4. Add to `scanReportSchema` discriminated union

---

## Phase 2: Backend Infrastructure

### Task 2.1: Scan Command Registration

**Files**:
- `lib/health/scan-commands.ts`

**Changes**:
1. Add `REVIEW_QUALITY: 'health-review-quality'` to `SCAN_COMMAND_MAP`

### Task 2.2: Score Calculator Update

**Files**:
- `lib/health/score-calculator.ts`

**Changes**:
1. Add `reviewQualityScore` to `ModuleScores` interface
2. Include in the `scores` array for global score calculation (now 6 modules with proportional weighting)

### Task 2.3: Ticket Creation for Review Gaps

**Files**:
- `lib/health/ticket-creation.ts`

**Changes**:
1. Add `REVIEW_QUALITY` case to `groupIssuesIntoTickets()` switch
2. Implement `groupReviewQualityIssues()`:
   - One ticket per recurring pattern (not per individual finding)
   - Title: `[Review Gap] Add rule for {category}`
   - Description includes: PR numbers, evidence, suggested rule, target
   - Only creates tickets for patterns where `alreadyTicketed === false`

### Task 2.4: Health API Response Extension

**Files**:
- `app/api/projects/[projectId]/health/route.ts`

**Changes**:
1. Add `reviewQuality` to the modules response object
2. Read `reviewQualityScore` and `lastReviewQualityScan` from `HealthScore`
3. Query active scans for `REVIEW_QUALITY` type

### Task 2.5: Health Score Update on Scan Completion

**Files**:
- `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` (or related score update logic)

**Changes**:
1. When a `REVIEW_QUALITY` scan completes, update `HealthScore.reviewQualityScore` and `HealthScore.lastReviewQualityScan`
2. Recalculate `globalScore` including the new module

---

## Phase 3: Scan Execution Logic

### Task 3.1: Claude Command — Review Quality Scanner

**Files** (new):
- `.claude-plugin/commands/ai-board.health-review-quality.md`

**Logic** (executed by Claude agent during workflow):

1. **PR Discovery**:
   - Query ai-board API for FULL workflow tickets in SHIP stage
   - For each ticket's branch, use GitHub API to find the merged PR
   - Filter to PRs merged after the last scan timestamp
   - Skip if no qualifying PRs found (report empty, score not updated)

2. **Comment Collection** (per PR):
   - Fetch issue comments → filter for `### Code review` → parse into findings
   - Fetch review comments → filter by `chatgpt-codex-connector[bot]` → Codex findings
   - Fetch review comments → filter by `Copilot` → Copilot findings

3. **Cross-Referencing**:
   - For each Codex/Copilot finding with file+line, check if ai-board has a finding on the same file within ±5 lines
   - Unmatched = missed finding
   - Filter out: doc/spec staleness, TypeScript/ESLint-catchable issues

4. **Classification**:
   - Assign each missed finding a category from the 9 defined categories
   - Assess severity (high/medium/low) based on runtime impact

5. **Scoring**:
   - `coverageScore = max(0, 100 - (high×15) - (medium×8) - (low×3))`

6. **Cumulative Analysis**:
   - Fetch last 30 days of REVIEW_QUALITY scan reports from API
   - Aggregate missed findings by category across distinct PRs
   - Flag categories with 3+ distinct PR occurrences as recurring patterns
   - For each pattern: generate suggested rule and target
   - Check for existing `[Review Gap]` tickets to avoid duplicates

7. **Output**: Write structured JSON report to `/tmp/health-scan-result.json`

### Task 3.2: Workflow Integration

**Files**:
- `.github/workflows/health-scan.yml`
- `.github/workflows/nightly-health.yml`

**Changes to `health-scan.yml`**:
1. Add `REVIEW_QUALITY` case in the scan type routing (alongside SECURITY/COMPLIANCE/SPEC_SYNC for LLM agent execution)
2. Map to `ai-board.health-review-quality` command

**Changes to `nightly-health.yml`**:
1. Add `REVIEW_QUALITY` to the scan type loop:
   ```bash
   for TYPE in SECURITY COMPLIANCE TESTS SPEC_SYNC REVIEW_QUALITY; do
   ```

---

## Phase 4: Dashboard UI

### Task 4.1: Module Card Integration

**Files**:
- `components/health/health-dashboard.tsx`
- `components/health/health-module-card.tsx`

**Changes to `health-dashboard.tsx`**:
1. Add `{ type: 'REVIEW_QUALITY', key: 'reviewQuality' }` to `MODULE_GRID`

**Changes to `health-module-card.tsx`**:
1. Add `ClipboardCheck` icon import from lucide-react
2. Add `REVIEW_QUALITY` case in icon selection

### Task 4.2: Detail Drawer — Review Quality Findings

**Files**:
- `components/health/drawer/drawer-issues.tsx`

**Changes**:
1. Add `REVIEW_QUALITY` case to the drawer issue rendering
2. Render missed findings grouped by category with severity badges
3. Add "Cumulative Patterns" section:
   - Show each recurring pattern with occurrence count
   - Display suggested rule in a blockquote
   - Show target (constitution vs review prompt)
   - Link to generated tickets if any
4. For "Never scanned" state: follow existing pattern in `drawer-states.tsx`

### Task 4.3: Summary Text Generation

**Files**:
- `app/api/projects/[projectId]/health/route.ts` (or wherever summary is generated)

**Changes**:
1. Generate summary text for review quality module:
   - With findings: `"{count} missed findings across {prCount} PRs"`
   - No findings: `"No review gaps detected"`
   - Never scanned: `"No scan yet"`

---

## Phase 5: Testing

### Task 5.1: Integration Tests — API Endpoints

**Location**: `tests/integration/health/`
**Type**: Vitest integration test (API + DB)

**Test cases**:
1. `POST /health/scans` with `scanType: REVIEW_QUALITY` creates a PENDING scan
2. `PATCH /health/scans/{id}/status` with REVIEW_QUALITY report updates score and HealthScore
3. `GET /health` returns `reviewQuality` module in response
4. `GET /health/scans?type=REVIEW_QUALITY` filters correctly
5. `GET /health/trends` includes REVIEW_QUALITY data points
6. Concurrent scan prevention (409) works for REVIEW_QUALITY

### Task 5.2: Unit Tests — Score Calculation and Ticket Grouping

**Location**: `tests/unit/`
**Type**: Vitest unit test

**Test cases**:
1. `calculateGlobalScore` includes reviewQualityScore (6-module average)
2. `groupIssuesIntoTickets` for REVIEW_QUALITY creates correct ticket format
3. Coverage score formula: 100 base, penalties applied, floor at 0
4. Zod schema validates valid REVIEW_QUALITY report
5. Zod schema rejects malformed REVIEW_QUALITY report

### Task 5.3: Component Tests — Dashboard UI

**Location**: `tests/unit/components/`
**Type**: Vitest + RTL component test

**Test cases**:
1. Review Quality card renders score, findings count, and trend
2. Review Quality card shows "Never scanned" when no data
3. Detail drawer shows findings grouped by category
4. Detail drawer shows cumulative patterns section
5. Scan trigger button works for REVIEW_QUALITY

---

## Testing Strategy Summary

| Story | Test Type | Location | Rationale |
|-------|-----------|----------|-----------|
| US1 - Nightly scan execution | Integration | `tests/integration/health/` | API + DB operations |
| US2 - Pattern detection & tickets | Unit + Integration | `tests/unit/` + `tests/integration/` | Pure logic (scoring/grouping) + API (ticket creation) |
| US3 - Dashboard card & drawer | Component | `tests/unit/components/` | React component with user interactions |

**No E2E tests**: All features testable via integration + component tests. No browser-required features (no OAuth, drag-drop, or viewport dependencies).

---

## Implementation Order (dependency chain)

```
Task 1.1 (Schema) ──→ Task 1.2 (Types) ──→ Task 2.1-2.5 (Backend) ──→ Task 3.1-3.2 (Scan Logic)
                                                                    ──→ Task 4.1-4.3 (Dashboard UI)
                                                                    ──→ Task 5.1-5.3 (Testing)
```

- Phase 1 is sequential (schema before types)
- Phase 2 tasks are independent of each other (can parallelize)
- Phase 3, 4, 5 depend on Phase 2 but are independent of each other (can parallelize)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| GitHub API rate limiting during scan | Sequential PR processing with spacing; partial results on rate limit |
| Ambiguous external comments (no file/line) | Exclude from cross-referencing; log for diagnostics |
| Malformed historical reports in cumulative analysis | Skip and log; proceed with available reports |
| Score calculation edge case (7+ high = negative) | Floor at 0 per spec |
| Global score redistribution with 6 modules | Proportional weighting already handles N modules |

---

## Artifacts Generated

| Artifact | Path |
|----------|------|
| Research | `specs/AIB-497-health-scan-review/research.md` |
| Data Model | `specs/AIB-497-health-scan-review/data-model.md` |
| API Contracts | `specs/AIB-497-health-scan-review/contracts/api-contracts.md` |
| Quickstart | `specs/AIB-497-health-scan-review/quickstart.md` |
| Plan | `specs/AIB-497-health-scan-review/plan.md` (this file) |
