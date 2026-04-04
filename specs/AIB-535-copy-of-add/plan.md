# Implementation Plan: Add SKIPPED Status for Health Scans

**Branch**: `AIB-535-copy-of-add` | **Date**: 2026-04-04 | **Spec**: `specs/AIB-535-copy-of-add/spec.md`
**Input**: Feature specification from `/specs/AIB-535-copy-of-add/spec.md`

## Summary

Add a `SKIPPED` terminal status to the health scan lifecycle so that scan agents can signal "nothing to evaluate" (e.g., 0 PRs, 0 changed files, 0 spec files). The dashboard displays SKIPPED scans with a distinct visual treatment, and global scores/trends exclude them to prevent artificial inflation.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), Prisma 6.x, TanStack Query v5, Recharts 3.x, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Linux server (Next.js), Browser (React SPA)
**Project Type**: Web application (fullstack monolith)
**Performance Goals**: No regression — SKIPPED scans exit early (faster than full scans)
**Constraints**: Backward compatible — agents without `skipped` field behave identically
**Scale/Scope**: 5 scan types across multiple projects, nightly cron trigger

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new types explicitly typed, no `any` |
| II. Component-Driven | PASS | Extends existing shadcn/ui components, no new primitives |
| III. Test-Driven | PASS | Existing test files identified for extension (research.md) |
| IV. Security-First | PASS | Input validation via Zod schema, no new user inputs |
| V. Database Integrity | PASS | Enum migration via Prisma, no raw SQL, HealthScore not mutated on SKIPPED |
| V. Spec Clarification | PASS | Auto-resolved decisions documented in spec with CONSERVATIVE fallback |

**Post-Design Re-check**: All gates remain PASS. The design:
- Does not introduce `any` types
- Extends existing components (health-module-card.tsx)
- Extends existing test files (no duplicate test creation)
- Uses Zod for SKIPPED status validation
- Uses Prisma migration for enum change
- Preserves HealthScore integrity by NOT updating on SKIPPED

## Project Structure

### Documentation (this feature)

```
specs/AIB-535-copy-of-add/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output — existing files, design decisions
├── data-model.md        # Phase 1 output — entity changes
├── quickstart.md        # Phase 1 output — implementation order
├── contracts/
│   ├── scan-status-api.md    # PATCH status endpoint contract
│   ├── health-response.md    # GET health response contract
│   └── scan-result-file.md   # Agent result file contract
└── tasks.md             # Phase 2 output (NOT created by /plan)
```

### Source Code (repository root)

```
prisma/
└── schema.prisma                    # MODIFY: Add SKIPPED to HealthScanStatus enum

app/api/projects/[projectId]/health/
├── route.ts                         # MODIFY: Surface SKIPPED status + skipReason
├── scans/[scanId]/status/route.ts   # MODIFY: Accept SKIPPED, skip aggregate update
└── trends/route.ts                  # NO CHANGE: Already filters COMPLETED only

lib/health/
├── types.ts                         # MODIFY: Add skipReason to HealthModuleStatus
├── score-calculator.ts              # NO CHANGE: Already handles null scores
├── report-schemas.ts                # NO CHANGE: Report schema independent of status
└── ...                              # NO CHANGE: Other utils unaffected

components/health/
├── health-module-card.tsx           # MODIFY: Add 'skipped' card state, N/A badge
├── health-hero.tsx                  # MINOR: Handle SKIPPED in sub-score badges
└── health-sub-score-badge.tsx       # CHECK: May need SKIPPED handling

.github/workflows/
└── health-scan.yml                  # MODIFY: Check skipped field, defensive guards

.claude-plugin/commands/
├── ai-board.health-review-quality.md  # MODIFY: Early exit for 0 PRs
├── ai-board.health-security.md        # MODIFY: Early exit for 0 changed files
└── ai-board.health-spec-sync.md       # MODIFY: Early exit for 0 spec files
```

**Structure Decision**: No new directories or structural changes. All modifications extend existing files in their current locations.

## Implementation Phases

### Phase 1: Database & Types (Foundation)

**Goal**: Add SKIPPED enum value and update TypeScript types.

1. Add `SKIPPED` to `HealthScanStatus` enum in `prisma/schema.prisma`
2. Create Prisma migration
3. Run `bunx prisma generate` to regenerate client
4. Add `skipReason?: string | null` to `HealthModuleStatus` in `lib/health/types.ts`

**Files**: `prisma/schema.prisma`, `lib/health/types.ts`

### Phase 2: API — Status Update Endpoint

**Goal**: Accept SKIPPED status, validate constraints, skip aggregate update.

1. Add `'SKIPPED'` to Zod status enum in `statusUpdateSchema`
2. Add RUNNING→SKIPPED to `VALID_TRANSITIONS`
3. Add SKIPPED terminal state (empty transitions array)
4. Add validation: SKIPPED must NOT have a score
5. Skip HealthScore aggregate update for SKIPPED (only update on COMPLETED)
6. Set `completedAt` for SKIPPED (terminal state)

**File**: `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`

### Phase 3: API — Health GET Endpoint

**Goal**: Surface SKIPPED status and skip reason in module status.

1. Query latest scan per module type including SKIPPED status
2. Update `buildModuleStatus` to accept and surface `scanStatus: 'SKIPPED'`
3. When latest scan is SKIPPED, set `summary: "Skipped: {reason}"` and `skipReason`
4. Score remains from HealthScore aggregate (last COMPLETED value)

**File**: `app/api/projects/[projectId]/health/route.ts`

### Phase 4: Dashboard UI

**Goal**: Display SKIPPED scans with distinct visual treatment.

1. Add `'skipped'` to `CardState` type in `health-module-card.tsx`
2. Update `getCardState` to detect SKIPPED status
3. Add `ScoreBadge` case for SKIPPED: show "N/A" in muted style
4. Display skip reason text below summary
5. Show "Re-run" button for SKIPPED modules (not "Run scan")
6. Update `health-sub-score-badge.tsx` if needed for SKIPPED display

**Files**: `components/health/health-module-card.tsx`, `components/health/health-sub-score-badge.tsx`

### Phase 5: Workflow

**Goal**: Detect skipped result from agent and send SKIPPED status.

1. After reading result file, check `skipped` field: `jq -r '.skipped // false'`
2. Defensive guard: if scan type is COMPLIANCE or TESTS, ignore `skipped: true`
3. If skipped and type is allowed: send SKIPPED status with null score and skipReason
4. If skipped and type is allowed: skip remediation ticket creation step
5. Update both result parsing blocks (TESTS orchestrator and agent executor)

**File**: `.github/workflows/health-scan.yml`

### Phase 6: Agent Commands

**Goal**: Add early exit logic to scan agents for "nothing to evaluate" conditions.

1. **REVIEW_QUALITY**: Add instruction to check PR count first. If 0 qualifying PRs, write result with `skipped: true, skipReason: "No qualifying PRs since last scan"`
2. **SECURITY**: Add instruction to check changed files count. If 0 changed files (incremental mode), write result with `skipped: true, skipReason: "No changed files to scan"`
3. **SPEC_SYNC**: Add instruction to check spec file count. If 0 spec files in `specs/specifications/`, write result with `skipped: true, skipReason: "No spec files found"`

**Files**: `.claude-plugin/commands/ai-board.health-review-quality.md`, `.claude-plugin/commands/ai-board.health-security.md`, `.claude-plugin/commands/ai-board.health-spec-sync.md`

## Testing Strategy

Following constitution §III (Test-Driven Development) and the Testing Trophy:

### Integration Tests (extend existing files)

| Test File | New Test Cases |
|-----------|---------------|
| `tests/integration/health/scan-status.test.ts` | RUNNING→SKIPPED transition valid; SKIPPED requires null score; SKIPPED does NOT update HealthScore aggregate; PENDING→SKIPPED invalid |
| `tests/integration/health/health-score.test.ts` | Module with SKIPPED latest scan shows skipReason; Global score excludes SKIPPED modules; SKIPPED scan preserves previous COMPLETED score |
| `tests/integration/health/trends.test.ts` | SKIPPED scans excluded from trend data (verify existing filter) |

### Unit Tests (extend existing files)

| Test File | New Test Cases |
|-----------|---------------|
| `tests/unit/components/health-module-card.test.tsx` | Renders "N/A" badge for SKIPPED state; Shows skip reason text; Shows "Re-run" button |
| `tests/unit/components/health-hero.test.tsx` | Sub-score badge handles SKIPPED module |

### No New Test Files Needed

All test cases fit naturally into existing test files. No new test files required per constitution rule "Search existing tests FIRST — extend, don't duplicate."

## Complexity Tracking

No constitution violations. No complexity exceptions needed.

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| COMPLIANCE/TESTS agents emit `skipped: true` | Defensive guard in workflow ignores it for these types |
| Old agents don't emit `skipped` field | Backward compatible — `jq '.skipped // false'` defaults to false |
| SKIPPED overwrites last good score | HealthScore aggregate NOT updated on SKIPPED |
| Migration fails on existing data | Enum ADD VALUE is non-destructive, no existing rows affected |
