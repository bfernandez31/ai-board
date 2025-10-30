# Verify Workflow E2E Test Failure Reporting Fix

## Problem Identified

The verify workflow was **failing to capture E2E test failures** for Claude analysis due to JSON parsing issues.

### Root Cause Chain

1. **Playwright crashes or times out** → Invalid/incomplete JSON output
2. **Workflow suppresses stderr** (`2>/dev/null`) → Error messages lost
3. **JSON validation fails** → Empty report generated (`{"suites":[]}`)
4. **Claude receives empty report** → Cannot analyze or fix failures
5. **Tests remain broken** → No automated recovery

### Symptoms in GitHub Actions Logs

```bash
🧪 Running E2E tests with optimized CI configuration...
❌ E2E tests failed
⚠️  Invalid JSON in e2e-results-full.json, using empty results

📊 Generating test failure report...
✅ Report generated: test-failures.json
   Total failures: 0    # ← WRONG! Tests actually failed
   E2E failures: 0      # ← Empty because JSON was invalid
   Root causes: 0

🤖 Executing /verify command...
# Claude receives empty report, cannot fix anything
```

## Solution Implemented

### Changes to `.github/workflows/verify.yml`

#### 1. **Capture stderr with stdout** (Line 213)

**Before:**
```bash
if CI=true npx playwright test --config=playwright.ci.config.ts --reporter=json 2>/dev/null > e2e-results-full.json; then
```

**After:**
```bash
if CI=true npx playwright test --config=playwright.ci.config.ts --reporter=json > e2e-results-full.json 2>&1; then
```

**Why:** Keeps stderr visible in logs AND captures it in JSON file for fallback error extraction.

#### 2. **Add debug output** (Lines 221-227)

```bash
# Debug: Show file size and first few lines
if [ -f "e2e-results-full.json" ]; then
  echo "📋 E2E results file size: $(wc -c < e2e-results-full.json) bytes"
  echo "📋 First 200 chars: $(head -c 200 e2e-results-full.json)"
else
  echo "⚠️  E2E results file not created"
fi
```

**Why:** Provides immediate visibility into JSON generation issues.

#### 3. **Intelligent fallback report** (Lines 254-290)

When JSON is invalid, the workflow now:

1. Extracts error preview from corrupted output:
   ```bash
   ERROR_PREVIEW=$(grep -o "Error:.*" e2e-results-full.json 2>/dev/null | head -1 || echo "Playwright crashed without error message")
   ```

2. Generates structured fallback report that Claude can parse:
   ```javascript
   {
     suites: [{
       title: 'E2E Test Execution',
       file: 'playwright.ci.config.ts',
       specs: [{
         title: 'Playwright Runner Failed',
         file: 'verify workflow',
         tests: [{
           status: 'unexpected',
           results: [{
             error: {
               message: 'Playwright failed to generate valid JSON output. Error preview: <extracted>',
               stack: 'Check GitHub Actions logs for full output. Common causes: timeout, OOM, config error.'
             },
             duration: 0
           }]
         }]
       }]
     }]
   }
   ```

3. Claude receives actionable report with:
   - Clear failure indicator (`status: 'unexpected'`)
   - Error context (extracted preview)
   - Debugging guidance (check logs, common causes)
   - Parseable format (valid JSON structure)

### Test Coverage

**New test file:** `tests/unit/generate-test-report-fallback.test.ts`

Tests verify:
- ✅ Invalid JSON files are handled gracefully
- ✅ Missing test result files generate empty reports (no crash)
- ✅ Valid JSON with failures generates correct reports
- ✅ Script exits successfully even with corrupted input

## Expected Workflow Behavior After Fix

### Scenario 1: Playwright Crashes

**Previous behavior:**
```
❌ E2E tests failed
⚠️  Invalid JSON, using empty results
✅ Report generated: 0 failures  # ← WRONG
🤖 Claude: "No failures detected"  # ← CANNOT FIX
```

**New behavior:**
```
❌ E2E tests failed (exit code: 1)
📋 E2E results file size: 543 bytes
📋 First 200 chars: Error: Timeout 15000ms exceeded...
⚠️  Invalid JSON detected
   Creating fallback error report for Claude...
✅ Report generated: 1 E2E failure  # ← CORRECT
🤖 Claude: "Playwright runner failed. Analyzing logs..."  # ← CAN INVESTIGATE
```

### Scenario 2: Valid Test Failures

```
❌ E2E tests failed
✅ Valid JSON detected, filtering results...
   Filtered: 8 suites → 3 suites with failures
✅ Report generated: 12 E2E failures
🤖 Claude: "Found 3 root causes. Fixing systematically..."
```

### Scenario 3: All Tests Pass

```
✅ E2E tests passed
✅ All tests passed on first run - no fixes needed!
```

## Benefits

1. **Visibility:** Stderr visible in logs for debugging
2. **Resilience:** Fallback report when JSON corrupted
3. **Actionability:** Claude receives error context
4. **Debugging:** File size + preview helps diagnose issues
5. **Reliability:** Tests validate all scenarios

## Verification

Run verification tests:
```bash
bun test tests/unit/generate-test-report-fallback.test.ts
```

Expected output:
```
✅ 3 pass
   - Invalid JSON → graceful fallback
   - Missing files → empty report
   - Valid failures → correct report
```

## Related Files

- `.github/workflows/verify.yml` (main fix)
- `.specify/scripts/generate-test-report.js` (parsing logic)
- `tests/unit/generate-test-report-fallback.test.ts` (test coverage)
- `VERIFY_WORKFLOW_FIX.md` (this document)

## Next Steps

1. Commit changes with descriptive message
2. Push to branch
3. Test on real workflow failure scenario
4. Monitor GitHub Actions logs for improved error visibility
