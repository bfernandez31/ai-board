# Testing & Quality

## Overview

This domain covers test infrastructure and quality assurance practices. The system maintains a comprehensive test suite with data isolation patterns and organized test structure.

**Current Capabilities**:
- E2E test data isolation with prefix patterns
- Selective test data cleanup
- Organized test suite by category
- Comprehensive test coverage

---

## Test Data Isolation

**Purpose**: Tests need to run safely alongside development and production data. The `[e2e]` prefix pattern enables selective cleanup while preserving non-test data.

### What It Does

The system isolates test data using a prefix convention:

**Prefix Pattern**:
- All test-generated tickets use `[e2e]` prefix in title
- All test-generated projects use `[e2e]` prefix in name
- Example: `[e2e] Fix login bug`, `[e2e] Test Project`

**Selective Cleanup**:
- **Before Tests**: Deletes all `[e2e]` prefixed data (ensures clean start)
- **After Tests**: Deletes all `[e2e]` prefixed data (prevents pollution)
- **Preserved**: All data without `[e2e]` prefix remains untouched

**Safe Testing**:
- Tests can run against development databases
- Manual test data persists across test runs
- Production-like data unaffected by test execution
- Clear identification of test vs. real data

### Requirements

**Test Data Convention**:
- All E2E test tickets must have `[e2e]` prefix in title
- All E2E test projects must have `[e2e]` prefix in name
- Prefix format consistent across all test-generated entities

**Cleanup Behavior**:
- Delete ONLY tickets with `[e2e]` prefix in title
- Delete ONLY projects with `[e2e]` prefix in name
- No database-wide deletion operations
- Preserve all non-prefixed data

**Cleanup Timing**:
- Run before test execution (clean starting state)
- Run after test execution (prevent data pollution)

**Backward Compatibility**:
- All existing tests updated to use prefix convention
- All existing tests continue to pass

### Data Model

**Test Ticket Example**:
```typescript
{
  title: '[e2e] Fix login bug',  // ← [e2e] prefix required
  description: 'Test description',
  stage: 'INBOX',
  projectId: 1
}
```

**Test Project Example**:
```typescript
{
  name: '[e2e] Test Project',  // ← [e2e] prefix required
  description: 'Project for E2E tests',
  githubOwner: 'test',
  githubRepo: 'test'
}
```

**Cleanup Pattern**:
```sql
-- Delete test tickets
DELETE FROM tickets WHERE title LIKE '[e2e]%';

-- Delete test projects
DELETE FROM projects WHERE name LIKE '[e2e]%';
```

---

## Test Suite Organization

**Purpose**: Tests need clear categorization for easy navigation and maintenance. Organized folder structure helps developers find and update tests efficiently.

### What It Does

The system organizes tests into logical category folders:

**Test Categories**:
- **api/**: API endpoint tests (request/response validation, error handling)
- **e2e/**: End-to-end user workflow tests (browser interactions, full system integration)
- **contracts/**: API contract tests (schema validation, data structure contracts)
- **integration/**: Integration tests (multi-component interactions, service integration)
- **unit/**: Unit tests (isolated component tests, pure function tests)
- **database/**: Database tests (migration tests, seed data tests, query optimization)

**Root Files**:
- `global-setup.ts`: Test environment setup
- `global-teardown.ts`: Test environment cleanup
- `helpers/`: Shared test utilities

**Organization Benefits**:
- Easy navigation by test type
- No duplicate test execution
- Maintained or improved coverage
- No performance regression
- Clean test artifacts

### Requirements

**Folder Structure**:
- All tests organized into 6 category folders
- No test files in root (except global setup/teardown and helpers)
- Each category contains related tests only

**Duplicate Removal**:
- Tests with >50% scenario overlap considered duplicates
- Duplicate test coverage consolidated into single comprehensive files
- All unique test scenarios preserved
- Duplicate files permanently deleted after merging

**Quality Maintenance**:
- Test coverage percentage maintained or improved
- Test execution time maintained (no performance degradation)
- All import paths correct after reorganization
- Associated test artifacts cleaned up (snapshots, fixtures)

**Git History**:
- Use `git mv` to preserve file history when moving tests
- Git history maintained for all reorganized files

**Validation**:
- Developer runs tests manually after reorganization
- All tests pass with new structure
- Import paths validated

### Data Model

**Test Categories**:
```
tests/
├── global-setup.ts
├── global-teardown.ts
├── helpers/
│   └── [shared test utilities]
├── api/
│   └── [API endpoint tests]
├── e2e/
│   └── [end-to-end workflow tests]
├── contracts/
│   └── [API contract tests]
├── integration/
│   └── [multi-component integration tests]
├── unit/
│   └── [isolated unit tests]
└── database/
    └── [database-specific tests]
```

**Duplicate Detection Criteria**:
- >50% test scenario overlap between files
- Similar test descriptions
- Overlapping functionality coverage

---

## Current State Summary

### Available Features

**Data Isolation**:
- ✅ `[e2e]` prefix pattern for test data
- ✅ Selective cleanup (preserves non-test data)
- ✅ Before and after test cleanup
- ✅ Safe to run against development databases
- ✅ Clear test vs. real data identification

**Test Organization**:
- ✅ 6 category folders (api, e2e, contracts, integration, unit, database)
- ✅ No duplicates (consolidated test coverage)
- ✅ Preserved Git history
- ✅ Maintained test performance
- ✅ Maintained or improved coverage

**Quality Standards**:
- ✅ All tests pass with new structure
- ✅ Correct import paths
- ✅ Clean test artifacts
- ✅ Comprehensive coverage

### Test Workflows

**Running E2E Tests**:
1. Test runner calls cleanup function
2. Cleanup deletes all `[e2e]` prefixed data
3. Tests create new test data with `[e2e]` prefix
4. Tests execute and pass
5. Cleanup deletes all `[e2e]` prefixed data
6. Manual/development data remains intact

**Finding Tests**:
1. Developer identifies test type (e.g., API endpoint test)
2. Developer navigates to appropriate folder (e.g., `tests/api/`)
3. Developer finds relevant test file
4. Developer updates or runs test

### Business Rules

**Data Isolation**:
- All test data must use `[e2e]` prefix
- Cleanup targets only `[e2e]` prefixed data
- Non-test data always preserved
- Cleanup runs before and after tests

**Test Organization**:
- Tests categorized by type
- No root-level test files (except global setup/teardown)
- No duplicate test files
- Git history preserved for all moves

**Quality**:
- Coverage maintained or improved
- Performance maintained (no regression)
- All tests pass after reorganization
- Import paths validated

### Technical Details

**Cleanup Implementation**:
- Location: `tests/helpers/db-cleanup.ts`
- Runs via `beforeEach` in test files
- Selective deletion using LIKE '[e2e]%' pattern
- PostgreSQL via Prisma

**Test Runner**:
- Playwright for E2E tests
- Supports parallel execution
- Test isolation per category

**Validation**:
- Character validation updated to allow `[e2e]` prefix
- Zod schemas updated
- Client and server validation aligned
