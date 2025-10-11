# Research: Test Suite Cleanup and Reorganization

**Date**: 2025-10-10
**Feature**: Test Suite Cleanup (021-clean-test-clean)
**Purpose**: Document research findings for test organization, duplicate detection, and reorganization strategy

## Test Inventory Analysis

### Current State
- **Total Test Files**: 51 files
- **Total Test Scenarios**: 412 test cases
- **Current Organization**: Mixed (10 directories + root files)
- **Estimated Duplicates**: 8-12 files based on naming patterns

### Test Distribution by Category

**Root Level** (16 files - to be reorganized):
- `018-transition-api.spec.ts` → api/
- `api-tickets-post.contract.spec.ts` → contracts/
- `drag-drop.spec.ts` → e2e/
- `foundation.spec.ts` → e2e/
- `project-cascade.spec.ts` → database/
- `project-uniqueness.spec.ts` → database/
- `seed-env-validation.spec.ts` → e2e/
- `seed-idempotency.spec.ts` → e2e/
- `ticket-creation-form-validation.spec.ts` → e2e/
- `ticket-creation-modal-open.spec.ts` → e2e/
- `ticket-creation-success.spec.ts` → e2e/
- `ticket-detail-modal.spec.ts` → e2e/

**Already Organized**:
- api/ (6 files) - API endpoint tests
- e2e/ (19 files) - End-to-end user flows
- integration/ (8 files) - Multi-component integration
- unit/ (2 files) - Isolated unit tests
- contracts/ (6 files) - API contract validation
- database/ (1 file) - Schema constraint tests
- helpers/ (3 files) - Test utilities (preserve in root)

## Duplicate Detection Analysis

### Decision: Scenario Overlap Methodology

**Rationale**: Manual code review combined with test description analysis
- Compare test descriptions and assertions between files
- Calculate overlap based on endpoint/functionality coverage
- >50% overlap threshold triggers consolidation

### Identified Duplicate Candidates

#### High Confidence Duplicates (>70% overlap):

1. **Ticket POST Endpoints** (4 files testing same functionality):
   - `tests/api/tickets-post.spec.ts` (9.1KB, 412 tests total)
   - `tests/api-tickets-post.contract.spec.ts` (13KB, contract focus)
   - `tests/contracts/tickets-create.spec.ts` (3.2KB, basic contract)
   - `tests/api/projects-tickets-post.spec.ts` (7.7KB, with projectId)

   **Consolidation Strategy**: Merge into `tests/api/projects-tickets-post.spec.ts`
   - Preserve all unique test scenarios
   - Remove duplicates: `api-tickets-post.contract.spec.ts`, `contracts/tickets-create.spec.ts`
   - Keep `api/tickets-post.spec.ts` if it tests deprecated endpoint

2. **Ticket Creation E2E Tests** (3 files with overlapping flows):
   - `tests/ticket-creation-success.spec.ts` - Full creation workflow
   - `tests/ticket-creation-form-validation.spec.ts` - Form validation
   - `tests/e2e/ticket-create.spec.ts` - E2E creation flow

   **Overlap Assessment**: ~60% overlap (all test ticket creation modal)
   **Consolidation Strategy**: Merge into `tests/e2e/ticket-create.spec.ts`
   - Combine validation scenarios from form-validation file
   - Merge success scenarios from creation-success file

3. **Board Display Tests** (potential overlap):
   - `tests/foundation.spec.ts` - Basic board rendering
   - `tests/e2e/project-board.spec.ts` - Board functionality
   - `tests/e2e/board-empty.spec.ts` - Empty state

   **Overlap Assessment**: ~55% overlap (board rendering concerns)
   **Consolidation Strategy**: Analyze scenarios, merge if overlap confirmed

### Medium Confidence Candidates (50-70% overlap):

4. **Ticket Card Tests**:
   - `tests/e2e/ticket-card.spec.ts`
   - `tests/e2e/ticket-card-clean.spec.ts`

   **Assessment Needed**: Review test scenarios to determine overlap

5. **Project Validation Tests**:
   - `tests/e2e/project-validation-404.spec.ts`
   - `tests/e2e/project-validation-format.spec.ts`

   **Assessment Needed**: May be complementary rather than overlapping

## Test Organization Best Practices

### Decision: Category-Based Folder Structure

**Rationale**: Aligns with testing pyramid and Playwright conventions
- **api/**: Fast, isolated API endpoint tests
- **e2e/**: Full user flow tests (slower, high value)
- **integration/**: Multi-component interaction tests
- **unit/**: Isolated function/module tests
- **contracts/**: API schema validation tests
- **database/**: Schema and constraint tests

**Alternatives Considered**:
- Feature-based folders (e.g., tickets/, projects/, board/)
  - Rejected: Harder to identify test type, mixing speeds
- Flat structure with naming prefixes
  - Rejected: Doesn't scale, harder to filter by category

### Decision: Git History Preservation via `git mv`

**Rationale**: Maintains file history for future `git blame` and archeology
- `git mv` preserves history with -M flag detection
- Git automatically detects renames with >50% content similarity
- Commands: `git mv source dest` for each file move

**Alternatives Considered**:
- Delete and recreate files
  - Rejected: Loses valuable commit history
- Copy with history rewrite
  - Rejected: Unnecessarily complex, risk of errors

## Performance Baseline

### Current Test Execution Metrics

**Baseline Capture** (run before cleanup):
```bash
npx playwright test --reporter=line
```

**Expected Performance**:
- Total test count: 412 test scenarios
- Estimated execution time: 2-5 minutes (parallelized)
- Parallel workers: Default Playwright configuration

**Performance Constraints** (from NFR-001):
- Test execution time MUST NOT increase after cleanup
- Consolidation should reduce file I/O overhead slightly
- Fewer test files → potentially faster test discovery

### Mitigation Strategies if Performance Degrades:
1. Increase parallel workers in playwright.config.ts
2. Split large consolidated files into logical groupings
3. Use test.describe.parallel() for independent scenarios

## Import Dependency Mapping

### Critical Dependencies to Preserve:

**Helper Functions** (tests/helpers/):
- `db-cleanup.ts` - Database cleanup utility
- `db-setup.ts` - Test data setup
- `transition-helpers.ts` - Ticket transition helpers

**Import Path Patterns**:
- Root level imports: `from './helpers/db-cleanup'`
- Subdirectory imports: `from '../helpers/db-cleanup'`

**Migration Strategy**:
- Files moving from root → subdirectory: Add `../` to helper imports
- Files staying in subdirectories: No import changes needed
- Global setup/teardown: Remain in root, no changes

## Artifact Cleanup Strategy

### Test Snapshots and Fixtures

**Identified Artifacts**:
- `tests/e2e/ticket-card-clean.spec.ts-snapshots/` - Snapshot directory
- Fixture files in test directories (if any)

**Cleanup Approach**:
1. Identify snapshot directories associated with deleted files
2. Delete snapshot folders for removed test files
3. Preserve snapshots for consolidated files
4. Run tests after cleanup to regenerate missing snapshots if needed

## Implementation Recommendations

### Phase 1: Analysis & Mapping
1. Create detailed file-by-file reorganization map
2. Calculate exact scenario overlap for duplicate candidates
3. Document which tests to merge vs. move vs. delete

### Phase 2: Consolidation
1. Merge duplicate tests into comprehensive files
2. Verify all unique scenarios preserved
3. Delete redundant test files after successful merge

### Phase 3: Reorganization
1. Use `git mv` to move legacy root files to subdirectories
2. Update import paths in moved files
3. Clean up associated snapshot directories

### Phase 4: Validation
1. Run full test suite: `npx playwright test`
2. Verify all 412 test scenarios still pass
3. Compare execution time to baseline
4. Verify Git history preserved: `git log --follow <file>`

## Summary of Findings

**Key Decisions**:
- **Duplicate Definition**: >50% scenario overlap via manual code review
- **Folder Structure**: Category-based (api, e2e, integration, unit, contracts, database)
- **Git Strategy**: Use `git mv` for all file moves to preserve history
- **Performance**: Baseline 412 tests, maintain current execution time

**Identified Work**:
- **High Priority Duplicates**: 3 groups (8-9 files to consolidate)
- **Medium Priority**: 2 groups (4 files to analyze)
- **Files to Move**: 16 legacy root files → subdirectories
- **Files to Preserve**: 3 helpers, 2 global setup/teardown

**Next Steps**: Proceed to Phase 1 (Design & Contracts) to create detailed reorganization mapping
