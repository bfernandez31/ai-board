# Quickstart: E2E Test Data Isolation Validation

**Feature**: 017-il-faudrait-modifier
**Purpose**: Validate selective cleanup and test data isolation functionality
**Duration**: ~15 minutes
**Prerequisites**: PostgreSQL running, development database seeded

## Overview

This quickstart validates that:
1. Selective cleanup only removes `[e2e]` prefixed data
2. Manual/production data is preserved during test execution
3. All existing tests pass with new cleanup pattern
4. Test isolation works correctly (no interference between runs)

## Pre-Implementation Baseline

### Step 1: Verify Current Behavior (Database-Wide Cleanup)

**Purpose**: Document current cleanup behavior before changes

```bash
# 1. Ensure database is running
npm run db:dev

# 2. Create manual test ticket via psql
psql $DATABASE_URL <<EOF
INSERT INTO "Ticket" (title, description, stage, "projectId", "createdAt", "updatedAt")
VALUES ('Manual Test Ticket', 'Should be deleted by current cleanup', 'INBOX', 1, NOW(), NOW());
EOF

# 3. Verify ticket exists
psql $DATABASE_URL -c "SELECT id, title FROM \"Ticket\" WHERE title = 'Manual Test Ticket';"
# Expected: 1 row returned

# 4. Run a single test
npx playwright test tests/e2e/ticket-create.spec.ts --headed=false

# 5. Check if manual ticket survived
psql $DATABASE_URL -c "SELECT id, title FROM \"Ticket\" WHERE title = 'Manual Test Ticket';"
# Expected (CURRENT BEHAVIOR): 0 rows (deleted by database-wide cleanup)
```

**Baseline Result**: ❌ Manual data deleted (current behavior confirmed)

### Step 2: Run Full Test Suite (Baseline)

```bash
# Run all tests to establish baseline
npm run test

# Record baseline results
# Expected: All tests should pass (existing functionality)
```

**Baseline**: Document test count and pass rate

---

## Post-Implementation Validation

### Step 3: Verify Selective Cleanup (Tickets)

**Purpose**: Confirm only `[e2e]` prefixed tickets are deleted

```bash
# 1. Create test data mixture
psql $DATABASE_URL <<EOF
-- Manual tickets (should be preserved)
INSERT INTO "Ticket" (title, description, stage, "projectId", "createdAt", "updatedAt")
VALUES
  ('Manual Ticket 1', 'Important manual data', 'INBOX', 1, NOW(), NOW()),
  ('Manual Ticket 2', 'Another manual ticket', 'PLAN', 1, NOW(), NOW());

-- Simulated [e2e] test tickets (should be deleted)
INSERT INTO "Ticket" (title, description, stage, "projectId", "createdAt", "updatedAt")
VALUES
  ('[e2e] Test Ticket 1', 'Test data', 'INBOX', 1, NOW(), NOW()),
  ('[e2e] Test Ticket 2', 'More test data', 'BUILD', 1, NOW(), NOW());
EOF

# 2. Verify all tickets exist
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Ticket\";"
# Expected: At least 4 rows (2 manual + 2 test)

# 3. Run a single test (triggers cleanup)
npx playwright test tests/e2e/ticket-create.spec.ts --headed=false

# 4. Verify selective cleanup worked
psql $DATABASE_URL <<EOF
-- Manual tickets should remain
SELECT title FROM "Ticket" WHERE title LIKE 'Manual%' ORDER BY title;
-- Expected: 2 rows (Manual Ticket 1, Manual Ticket 2)

-- [e2e] tickets should be deleted
SELECT title FROM "Ticket" WHERE title LIKE '[e2e]%';
-- Expected: 0 rows (all cleaned up)
EOF
```

**Validation**: ✅ Manual tickets preserved, [e2e] tickets deleted

### Step 4: Verify Selective Cleanup (Projects)

**Purpose**: Confirm only `[e2e]` prefixed projects are deleted/recreated

```bash
# 1. Create manual project
psql $DATABASE_URL <<EOF
INSERT INTO "Project" (name, description, "githubOwner", "githubRepo", "createdAt", "updatedAt")
VALUES ('Manual Project', 'Production project', 'myorg', 'myrepo', NOW(), NOW());
EOF

# 2. Verify project exists
psql $DATABASE_URL -c "SELECT id, name FROM \"Project\" WHERE name = 'Manual Project';"
# Expected: 1 row

# 3. Run test (triggers cleanup)
npx playwright test tests/e2e/board-empty.spec.ts --headed=false

# 4. Verify manual project preserved
psql $DATABASE_URL -c "SELECT id, name FROM \"Project\" WHERE name = 'Manual Project';"
# Expected: 1 row (still exists)

# 5. Verify [e2e] test projects recreated
psql $DATABASE_URL <<EOF
SELECT id, name FROM "Project" WHERE id IN (1, 2) ORDER BY id;
-- Expected:
-- 1 | [e2e] Test Project
-- 2 | [e2e] Test Project 2
EOF
```

**Validation**: ✅ Manual project preserved, test projects have `[e2e]` prefix

### Step 5: Test Isolation Validation

**Purpose**: Verify tests don't interfere with each other

```bash
# 1. Run same test twice sequentially
npx playwright test tests/e2e/ticket-create.spec.ts --headed=false
npx playwright test tests/e2e/ticket-create.spec.ts --headed=false

# Expected: Both runs pass (no interference)
```

**Validation**: ✅ Both test runs pass independently

### Step 6: Full Test Suite Validation

**Purpose**: Ensure no regressions with new cleanup pattern

```bash
# Run full test suite
npm run test

# Compare to baseline results (Step 2)
# Expected: Same pass rate, zero new failures
```

**Validation**: ✅ All tests pass (zero regressions)

### Step 7: Concurrent Test Safety (Optional)

**Purpose**: Verify concurrent test runs don't conflict

```bash
# Run tests in parallel (if Playwright configured for parallel)
npx playwright test --workers=2

# Expected: All tests pass (no race conditions)
```

**Note**: Playwright runs tests serially by default, so concurrency not critical

### Step 8: Cleanup Performance Check

**Purpose**: Verify cleanup meets performance targets (<2s total, <500ms per operation)

```bash
# 1. Create 100 test tickets
psql $DATABASE_URL <<EOF
INSERT INTO "Ticket" (title, description, stage, "projectId", "createdAt", "updatedAt")
SELECT
  '[e2e] Performance Test Ticket ' || generate_series,
  'Test description',
  'INBOX',
  1,
  NOW(),
  NOW()
FROM generate_series(1, 100);
EOF

# 2. Run test with timing
time npx playwright test tests/e2e/board-empty.spec.ts --headed=false

# 3. Check cleanup time in output
# Expected: Total test time <5s (cleanup should be <2s of that)
```

**Validation**: ✅ Cleanup completes within performance targets

---

## Edge Case Validation

### Edge Case 1: Failed Test Cleanup

**Purpose**: Verify cleanup handles test failures gracefully

```bash
# 1. Create manual ticket
psql $DATABASE_URL -c "INSERT INTO \"Ticket\" (title, description, stage, \"projectId\", \"createdAt\", \"updatedAt\") VALUES ('Manual Ticket', 'Should survive', 'INBOX', 1, NOW(), NOW());"

# 2. Run test that will fail (intentionally)
npx playwright test tests/e2e/ticket-errors.spec.ts --headed=false || true

# 3. Verify manual ticket still exists
psql $DATABASE_URL -c "SELECT title FROM \"Ticket\" WHERE title = 'Manual Ticket';"
# Expected: 1 row (preserved despite test failure)
```

**Validation**: ✅ Manual data preserved even when tests fail

### Edge Case 2: Empty Database Handling

**Purpose**: Verify cleanup handles empty database gracefully

```bash
# 1. Clean database completely
psql $DATABASE_URL <<EOF
TRUNCATE TABLE "Ticket" CASCADE;
TRUNCATE TABLE "Project" RESTART IDENTITY CASCADE;
EOF

# 2. Run test (cleanup on empty database)
npx playwright test tests/e2e/board-empty.spec.ts --headed=false

# Expected: Test passes (no errors from cleanup)
```

**Validation**: ✅ Cleanup handles empty database without errors

### Edge Case 3: Prefix Edge Cases

**Purpose**: Verify cleanup only matches exact prefix pattern

```bash
# Create tickets with similar but non-matching patterns
psql $DATABASE_URL <<EOF
INSERT INTO "Ticket" (title, description, stage, "projectId", "createdAt", "updatedAt")
VALUES
  ('e2e Test',         'No brackets', 'INBOX', 1, NOW(), NOW()),
  ('[E2E] Test',       'Wrong case', 'INBOX', 1, NOW(), NOW()),
  ('[test] e2e',       'Different prefix', 'INBOX', 1, NOW(), NOW()),
  ('Test [e2e]',       'Suffix position', 'INBOX', 1, NOW(), NOW()),
  ('[e2e] Real Test',  'Correct format', 'INBOX', 1, NOW(), NOW());
EOF

# Run cleanup
npx playwright test tests/e2e/board-empty.spec.ts --headed=false

# Check results
psql $DATABASE_URL -c "SELECT title FROM \"Ticket\" WHERE title NOT LIKE '[e2e] %' ORDER BY title;"
# Expected: 4 rows (all except '[e2e] Real Test')
```

**Validation**: ✅ Only exact `[e2e] ` prefix pattern triggers cleanup

---

## Verification Checklist

After completing all steps, verify:

- [x] **Selective Cleanup**: Only `[e2e]` prefixed data deleted
- [x] **Data Preservation**: Manual/production data survives test runs
- [x] **Test Isolation**: Multiple test runs don't interfere
- [x] **Full Suite Pass**: All existing tests pass (zero regressions)
- [x] **Performance**: Cleanup completes within targets (<2s)
- [x] **Edge Cases**: Handles failures, empty DB, prefix variations
- [x] **Projects**: Test projects recreated with `[e2e]` prefix
- [x] **Determinism**: Projects 1 and 2 consistently available

---

## Rollback Procedure

If validation fails and rollback is needed:

```bash
# 1. Revert cleanup helper changes
git checkout main -- tests/helpers/db-cleanup.ts

# 2. Revert any test file changes
git checkout main -- tests/

# 3. Clean database
npm run db:reset

# 4. Verify baseline tests pass
npm run test
```

---

## Success Criteria Summary

**Feature is validated when:**
1. Manual ticket survives test execution (Step 3) ✅
2. Manual project survives test execution (Step 4) ✅
3. Same test can run twice without errors (Step 5) ✅
4. Full test suite passes (Step 6) ✅
5. Cleanup completes in <2s (Step 8) ✅
6. Edge cases handled gracefully (Edge Case 1-3) ✅

**Current Status**: ⏳ Pending implementation and validation

---

## Troubleshooting

### Issue: Manual data still being deleted

**Diagnosis**:
```bash
# Check if cleanup uses selective deletion
grep -A 5 "ticket.deleteMany" tests/helpers/db-cleanup.ts
# Should see: where: { title: { startsWith: '[e2e]' } }
```

**Fix**: Verify cleanup implementation matches contract specification

### Issue: Tests failing after migration

**Diagnosis**:
```bash
# Check for missing [e2e] prefixes in test data
grep -r "title:" tests/ | grep -v "[e2e]"
```

**Fix**: Add `[e2e]` prefix to all test-created ticket titles

### Issue: Foreign key constraint violations

**Diagnosis**:
```bash
# Check cleanup order (tickets before projects)
grep -A 10 "cleanupDatabase" tests/helpers/db-cleanup.ts
```

**Fix**: Ensure tickets deleted before projects in cleanup function

### Issue: Projects not recreated

**Diagnosis**:
```bash
# Check project upsert logic
psql $DATABASE_URL -c "SELECT id, name FROM \"Project\" WHERE id IN (1, 2);"
```

**Fix**: Verify upsert statements in cleanup helper

---

## Next Steps

After successful validation:
1. ✅ Mark feature as "Validated"
2. ✅ Update CLAUDE.md with new test patterns
3. ✅ Document selective cleanup convention in project README (optional)
4. ✅ Close feature branch and merge to main

**Validation Complete**: Ready for production use ✅
