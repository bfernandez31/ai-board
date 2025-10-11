# Data Model: Test Suite Reorganization Mapping

**Date**: 2025-10-10
**Feature**: Test Suite Cleanup (021-clean-test-clean)
**Purpose**: Document the complete reorganization mapping for test files

## Entity: Test File Reorganization Map

This document provides the authoritative mapping for test file movements, consolidations, and deletions.

### Test File Entity Structure

```typescript
interface TestFileMapping {
  currentPath: string;           // Current file location
  action: 'MOVE' | 'CONSOLIDATE' | 'DELETE' | 'PRESERVE';
  targetPath?: string;            // Destination (if MOVE)
  consolidateInto?: string;       // Target file (if CONSOLIDATE)
  importPathChanges: string[];    // Import path updates needed
  scenarioCount?: number;         // Number of test scenarios
  overlapPercentage?: number;     // Overlap with target (if CONSOLIDATE)
}
```

## Phase 1: Duplicate Consolidation

### Group 1: Ticket POST API Tests (CONSOLIDATE)

**Target File**: `tests/api/projects-tickets-post.spec.ts` (comprehensive version)

| Current File | Action | Overlap % | Scenarios to Merge |
|-------------|--------|-----------|-------------------|
| `tests/api-tickets-post.contract.spec.ts` | DELETE | 75% | 5 unique contract validation scenarios |
| `tests/contracts/tickets-create.spec.ts` | DELETE | 80% | 2 unique basic contract scenarios |
| `tests/api/tickets-post.spec.ts` | ANALYZE | 60% | May test deprecated endpoint - preserve if unique |

**Consolidation Steps**:
1. Review `tests/api/projects-tickets-post.spec.ts` for completeness
2. Extract unique scenarios from `api-tickets-post.contract.spec.ts` (contract-specific assertions)
3. Extract unique scenarios from `contracts/tickets-create.spec.ts` (basic validation)
4. Merge unique scenarios into `tests/api/projects-tickets-post.spec.ts`
5. Verify consolidated file has comprehensive coverage
6. Delete `tests/api-tickets-post.contract.spec.ts` (permanently)
7. Delete `tests/contracts/tickets-create.spec.ts` (permanently)

### Group 2: Ticket Creation E2E Tests (CONSOLIDATE)

**Target File**: `tests/e2e/ticket-create.spec.ts` (comprehensive version)

| Current File | Action | Overlap % | Scenarios to Merge |
|-------------|--------|-----------|-------------------|
| `tests/ticket-creation-success.spec.ts` | DELETE | 70% | Success workflow scenarios |
| `tests/ticket-creation-form-validation.spec.ts` | DELETE | 65% | Form validation edge cases |

**Consolidation Steps**:
1. Analyze `tests/e2e/ticket-create.spec.ts` current coverage
2. Extract unique success scenarios from `ticket-creation-success.spec.ts`
3. Extract unique validation scenarios from `ticket-creation-form-validation.spec.ts`
4. Organize into logical test.describe() groups in target file
5. Delete root-level files after merge verification

### Group 3: Ticket Card Tests (EVALUATE)

**Candidate Files**:
- `tests/e2e/ticket-card.spec.ts`
- `tests/e2e/ticket-card-clean.spec.ts`

**Action**: ANALYZE overlap percentage
- If >50%: CONSOLIDATE into `tests/e2e/ticket-card.spec.ts`
- If <50%: PRESERVE both (complementary tests)

## Phase 2: Legacy Root File Migration

### Files to MOVE (git mv)

| Current Path | Target Path | Import Updates |
|-------------|-------------|----------------|
| `tests/018-transition-api.spec.ts` | `tests/api/ticket-transition.spec.ts` | `'./helpers/*'` → `'../helpers/*'` |
| `tests/drag-drop.spec.ts` | `tests/e2e/drag-drop.spec.ts` | `'./helpers/*'` → `'../helpers/*'` |
| `tests/foundation.spec.ts` | ANALYZE: may consolidate with `tests/e2e/project-board.spec.ts` | - |
| `tests/project-cascade.spec.ts` | `tests/database/project-cascade.spec.ts` | `'./helpers/*'` → `'../helpers/*'` |
| `tests/project-uniqueness.spec.ts` | `tests/database/project-uniqueness.spec.ts` | `'./helpers/*'` → `'../helpers/*'` |
| `tests/seed-env-validation.spec.ts` | `tests/e2e/seed-env-validation.spec.ts` | `'./helpers/*'` → `'../helpers/*'` |
| `tests/seed-idempotency.spec.ts` | `tests/e2e/seed-idempotency.spec.ts` | `'./helpers/*'` → `'../helpers/*'` |
| `tests/ticket-creation-modal-open.spec.ts` | `tests/e2e/ticket-creation-modal.spec.ts` | `'./helpers/*'` → `'../helpers/*'` |
| `tests/ticket-detail-modal.spec.ts` | `tests/e2e/ticket-detail-modal.spec.ts` | `'./helpers/*'` → `'../helpers/*'` |

### Files to PRESERVE (no changes)

| File Path | Reason |
|-----------|--------|
| `tests/global-setup.ts` | Playwright global configuration |
| `tests/global-teardown.ts` | Playwright global configuration |
| `tests/helpers/db-cleanup.ts` | Test utility (root location required) |
| `tests/helpers/db-setup.ts` | Test utility (root location required) |
| `tests/helpers/transition-helpers.ts` | Test utility (root location required) |

## Phase 3: Contract Test Consolidation

### Contracts Folder Analysis

**Current State**:
- `tests/contracts/cleanup-projects.spec.ts` - KEEP (unique functionality)
- `tests/contracts/cleanup-tickets.spec.ts` - KEEP (unique functionality)
- `tests/contracts/test-prefix.spec.ts` - KEEP (unique functionality)
- `tests/contracts/tickets-branch.spec.ts` - KEEP (unique functionality)
- `tests/contracts/tickets-create.spec.ts` - DELETE (duplicates api tests)
- `tests/contracts/tickets-update.spec.ts` - ANALYZE overlap with `tests/api/projects-tickets-patch.spec.ts`

**Action Items**:
1. Compare `tickets-update.spec.ts` with `tests/api/projects-tickets-patch.spec.ts`
2. If overlap >50%: Merge into api/ folder, delete from contracts/
3. If overlap <50%: Preserve both (contract focus vs. API focus)

## Phase 4: Snapshot Cleanup

### Snapshot Directories

| Snapshot Directory | Associated File | Action |
|-------------------|----------------|--------|
| `tests/e2e/ticket-card-clean.spec.ts-snapshots/` | `ticket-card-clean.spec.ts` | DELETE if file consolidated |

**Cleanup Strategy**:
1. After file consolidation/deletion, remove associated snapshot directories
2. Run tests to regenerate snapshots for consolidated files
3. Commit new snapshots with consolidated test files

## Import Path Migration Rules

### Pattern 1: Root → Subdirectory

**Before** (tests/example.spec.ts):
```typescript
import { cleanupDatabase } from './helpers/db-cleanup';
```

**After** (tests/e2e/example.spec.ts):
```typescript
import { cleanupDatabase } from '../helpers/db-cleanup';
```

### Pattern 2: Subdirectory → Subdirectory (no change)

**Stays the same** (tests/e2e/example.spec.ts):
```typescript
import { cleanupDatabase } from '../helpers/db-cleanup';
```

### Pattern 3: Subdirectory → Different Subdirectory

**Before** (tests/contracts/example.spec.ts):
```typescript
import { cleanupDatabase } from '../helpers/db-cleanup';
```

**After** (tests/api/example.spec.ts):
```typescript
import { cleanupDatabase } from '../helpers/db-cleanup';
```
*(No change - both at same depth)*

## Validation Checklist

### Post-Consolidation Validation

- [ ] All unique test scenarios from source files merged into target
- [ ] Consolidated file organized with clear test.describe() groups
- [ ] No duplicate test names or assertions in consolidated file
- [ ] Import paths updated in consolidated file
- [ ] Source files deleted after successful merge

### Post-Migration Validation

- [ ] `git log --follow <new-path>` shows full history
- [ ] All helper imports updated with correct relative paths
- [ ] No broken imports in moved files
- [ ] All moved files use `git mv` command (history preserved)
- [ ] Snapshot directories cleaned up for deleted files

### Final Test Suite Validation

- [ ] `npx playwright test` passes all tests
- [ ] Test count matches baseline: 412 scenarios (or improved)
- [ ] Test execution time ≤ baseline (no degradation)
- [ ] All test categories populated correctly
- [ ] No test files remain in tests root (except global-*.ts, helpers/)

## Summary Statistics

**Expected Outcome**:
- **Starting Files**: 51 test files
- **Files to Consolidate/Delete**: 6-8 files
- **Files to Move**: 9-12 files
- **Files to Preserve**: 30-35 files
- **Final File Count**: ~40-43 test files (20% reduction)
- **Test Scenarios**: 412 (maintained or improved)
- **Folders with Tests**: 6 categories (api, e2e, integration, unit, contracts, database)
