# Quickstart: Test Suite Cleanup Validation

**Feature**: Test Suite Cleanup and Reorganization (021-clean-test-clean)
**Purpose**: Manual validation steps to verify successful test reorganization

## Prerequisites

- [ ] Git repository is clean (no uncommitted changes)
- [ ] Current branch: `021-clean-test-clean`
- [ ] Node.js 22.20.0 LTS installed
- [ ] All dependencies installed (`npm install`)
- [ ] Database running and migrated
- [ ] Test environment variables configured

## Step 1: Capture Performance Baseline

**Before any changes**, capture current test performance metrics:

```bash
# Run full test suite and capture timing
npx playwright test --reporter=line > baseline-results.txt 2>&1

# Count current test files
find tests -name "*.spec.ts" -o -name "*.test.ts" | wc -l

# Count test scenarios
npx playwright test --list | wc -l
```

**Expected Output**:
- Test files: 51
- Test scenarios: ~412
- Execution time: 2-5 minutes (varies by hardware)

**Save these numbers** for comparison after cleanup.

## Step 2: Verify Test Organization (Before Cleanup)

Check current folder structure:

```bash
# List test distribution
tree tests -L 2 -I 'node_modules'

# Identify root-level test files (should have 12-16 files)
ls tests/*.spec.ts | wc -l
```

**Expected Issues to Observe**:
- ✗ Multiple ticket POST test files
- ✗ Duplicate ticket creation tests
- ✗ Legacy test files in root directory
- ✗ Inconsistent test organization

## Step 3: Execute Test Cleanup (Implementation Phase)

**Note**: This section will be populated by tasks.md execution.

After implementing all cleanup tasks:

```bash
# Verify file moves used git mv (history preserved)
git log --oneline --name-status | grep "^R" | head -10

# Check that files were renamed (R) not added/deleted (A/D)
```

## Step 4: Verify Reorganization Results

### Check Folder Structure

```bash
# Verify new organization
tree tests -L 2 -I 'node_modules'

# Count files in each category
echo "API tests:" && ls tests/api/*.spec.ts 2>/dev/null | wc -l
echo "E2E tests:" && ls tests/e2e/*.spec.ts 2>/dev/null | wc -l
echo "Integration tests:" && ls tests/integration/*.spec.ts 2>/dev/null | wc -l
echo "Unit tests:" && find tests/unit -name "*.test.ts" 2>/dev/null | wc -l
echo "Contract tests:" && ls tests/contracts/*.spec.ts 2>/dev/null | wc -l
echo "Database tests:" && ls tests/database/*.spec.ts 2>/dev/null | wc -l

# Verify no legacy files in root (except global-setup, global-teardown, helpers)
ls tests/*.spec.ts 2>/dev/null || echo "✓ No test files in root"
```

**Expected Structure**:
```
tests/
├── api/                 # ~3-4 files
├── e2e/                 # ~20-25 files
├── integration/         # ~7-8 files
├── unit/                # ~2-3 files
├── contracts/           # ~4-5 files
├── database/            # ~2-3 files
├── helpers/             # 3 files (preserved)
├── global-setup.ts      # preserved
└── global-teardown.ts   # preserved
```

### Verify Git History Preservation

```bash
# Test history for moved files (sample)
git log --follow tests/e2e/drag-drop.spec.ts -- | head -20
git log --follow tests/database/project-cascade.spec.ts -- | head -20

# Verify history shows original path
git log --follow --name-status tests/e2e/ticket-creation-modal.spec.ts | grep "^R"
```

**Expected Output**: Should see rename (R) entries showing old → new paths

### Verify Import Paths

```bash
# Check for broken imports (should be empty)
npx tsc --noEmit 2>&1 | grep "Cannot find module" || echo "✓ No import errors"

# Sample file import verification
grep -n "from.*helpers" tests/e2e/drag-drop.spec.ts
```

**Expected**: All imports should use `'../helpers/*'` pattern

## Step 5: Run Test Suite Validation

### Full Test Suite

```bash
# Run all tests
npx playwright test --reporter=line

# Capture results
npx playwright test --reporter=line > cleanup-results.txt 2>&1
```

**Success Criteria**:
- ✅ All tests pass (same pass rate as baseline)
- ✅ Test count: ~412 scenarios (maintained or improved)
- ✅ Execution time: ≤ baseline (no degradation allowed per NFR-001)
- ✅ No "Cannot find module" errors

### Test Coverage Verification

```bash
# Run with coverage (if configured)
npx playwright test --reporter=html

# Open HTML report
npx playwright show-report
```

**Verify**:
- [ ] Test coverage percentage ≥ baseline
- [ ] All critical user flows still covered
- [ ] No missing test scenarios

## Step 6: Verify Snapshot Cleanup

```bash
# Find snapshot directories
find tests -name "*-snapshots" -type d

# Verify orphaned snapshots removed
ls tests/*-snapshots 2>/dev/null && echo "⚠ Orphaned snapshots exist" || echo "✓ No orphaned snapshots"
```

**Expected**: Only snapshots for existing test files should remain

## Step 7: Compare Before/After Metrics

### File Count Comparison

```bash
# Compare file counts
echo "Before: 51 files"
echo "After: $(find tests -name '*.spec.ts' -o -name '*.test.ts' | wc -l) files"

# Expected reduction: ~20% (40-43 files)
```

### Performance Comparison

```bash
# Compare execution times
echo "=== Baseline ===" && cat baseline-results.txt | grep "tests passed"
echo "=== After Cleanup ===" && cat cleanup-results.txt | grep "tests passed"
```

**Success Criteria** (NFR-001):
- Execution time MUST NOT increase
- Slight improvement acceptable due to reduced file I/O

## Step 8: Final Validation Checklist

### Functional Requirements Validation

- [ ] **FR-001**: Duplicate files identified (>50% overlap detected)
- [ ] **FR-002**: Duplicates consolidated into comprehensive files
- [ ] **FR-003**: All tests in category folders (api, e2e, integration, unit, contracts, database)
- [ ] **FR-004**: Legacy root files moved to subdirectories
- [ ] **FR-005**: All unique test scenarios preserved
- [ ] **FR-006**: Snapshot artifacts cleaned up for deleted files
- [ ] **FR-007**: Import paths validated (no broken imports)
- [ ] **FR-008**: Test coverage maintained or improved
- [ ] **FR-009**: Contract tests consolidated appropriately
- [ ] **FR-010**: Global setup/teardown and helpers/ preserved in root
- [ ] **FR-011**: Duplicate files permanently deleted
- [ ] **FR-012**: Test execution time maintained (no degradation)

### Non-Functional Requirements Validation

- [ ] **NFR-001**: Test execution time ≤ baseline
- [ ] **NFR-002**: Test coverage % ≥ baseline
- [ ] **NFR-003**: Git history preserved (`git log --follow` works)

## Troubleshooting

### Issue: Broken Imports After Migration

**Symptom**: `Cannot find module '../helpers/db-cleanup'`

**Fix**:
```bash
# Check relative path depth
pwd  # Should be in tests/e2e/ or tests/api/, etc.

# Correct import path (from subdirectory → root helpers)
# Use: '../helpers/db-cleanup'
```

### Issue: Test Count Decreased

**Symptom**: Fewer than 412 test scenarios after cleanup

**Diagnosis**:
```bash
# Find missing tests
npx playwright test --list > after-cleanup-list.txt
# Compare with baseline list
diff baseline-list.txt after-cleanup-list.txt
```

**Fix**: Review consolidated files, ensure all unique scenarios were merged

### Issue: Performance Degradation

**Symptom**: Test execution time increased after consolidation

**Diagnosis**:
```bash
# Check parallel workers
grep "workers:" playwright.config.ts

# Run with more workers
npx playwright test --workers=8
```

**Fix**: Increase worker count or split large consolidated files

## Success Confirmation

After all steps complete, confirm:

✅ **Folder Organization**:
- Zero test files in tests root (except global-*.ts, helpers/)
- All tests in appropriate category folders
- Clear separation of test types

✅ **Git History**:
- `git log --follow` works for moved files
- Rename commits visible in history

✅ **Test Suite Health**:
- All tests pass
- Test count maintained (412 scenarios)
- Execution time ≤ baseline
- No broken imports

✅ **Cleanup Complete**:
- Duplicate files deleted
- Snapshot artifacts cleaned up
- Code organization improved

## Next Steps

After successful validation:

1. **Commit Changes**:
   ```bash
   git add -A
   git commit -m "feat: reorganize test suite and remove duplicates

   - Consolidate duplicate test files (>50% overlap)
   - Move legacy root tests to category folders
   - Preserve Git history via git mv
   - Maintain test coverage and performance

   🤖 Generated with Claude Code

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

2. **Push and Create PR** (if using GitHub workflow)

3. **Document Changes** in project README or testing documentation

4. **Update Team** on new test organization structure
