# Health Scan: Tests

You are executing a **test health scan** on this repository. Run the project's test suite, identify failures, attempt automatic fixes, and produce a structured report.

## Inputs

Arguments may include:
- `--base-commit <SHA>`: Provided for context, but tests ALWAYS run the full suite regardless
- `--head-commit <SHA>`: The target commit to scan up to

**IMPORTANT**: Tests ALWAYS run the full test suite regardless of whether `--base-commit` is provided. Test failures can originate from unchanged files affected by changed code, so incremental testing is unreliable.

## Auto-Fix Workflow

### Step 1: Detect Test Command

Detect the project's test command from `package.json` scripts:
- Look for `test`, `test:unit`, `test:ci` scripts
- Common commands: `vitest run`, `jest`, `mocha`, `bun test`, `npm test`
- If no test command is found, output a report with score 0 and a single HIGH severity issue explaining no test command was detected

### Step 2: Run Full Test Suite

Execute the detected test command and capture output. Parse the output to identify:
- Total number of tests
- Number of passing tests
- Number of failing tests
- For each failure: test name, file path, line number, error message

### Step 3: Auto-Fix Loop

For each failing test:

1. **Read** the test file and understand the failure (assertion error, import error, type error, etc.)
2. **Attempt fix** if the fix is obvious and isolated:
   - Outdated assertion values (expected value changed)
   - Import path changes (file moved/renamed)
   - Renamed function/variable references
   - Simple type annotation fixes
3. **Re-run** the specific test to verify the fix works
4. **If fix succeeds**: Stage and commit the change with a descriptive message:
   ```
   fix(tests): update assertion in [test name]
   ```
   Add the issue to the `autoFixed` array
5. **If fix fails** or requires architectural changes: Add the issue to the `nonFixable` array with the reason

### What NOT to Auto-Fix
- Tests requiring new infrastructure (database seeds, external services)
- Tests requiring architectural refactoring
- Tests with ambiguous failures (multiple possible causes)
- Tests that need new dependencies or configuration

## Score Calculation

- **100**: All tests pass (no failures)
- **Proportional reduction**: For each failure, reduce score proportionally
  - Formula: `score = Math.max(0, Math.round(100 * (1 - (autoFixed.length + nonFixable.length) / totalTests)))`
  - If totalTests is 0, score is 100

## Output Format

You MUST output valid JSON to stdout with this exact structure. Output ONLY the JSON object, no other text.

```json
{
  "score": 85,
  "issuesFound": 3,
  "issuesFixed": 2,
  "report": {
    "type": "TESTS",
    "autoFixed": [
      {
        "id": "test-fix-001",
        "severity": "medium",
        "description": "Fixed outdated assertion in calculateTotal test — expected 42, was 40",
        "file": "tests/unit/calc.test.ts",
        "line": 25
      },
      {
        "id": "test-fix-002",
        "severity": "medium",
        "description": "Fixed import path after file rename: utils.ts → helpers.ts",
        "file": "tests/unit/helpers.test.ts",
        "line": 1
      }
    ],
    "nonFixable": [
      {
        "id": "test-fail-001",
        "severity": "high",
        "description": "Integration test requires database seed data not present in CI",
        "file": "tests/integration/api.test.ts",
        "line": 10
      }
    ],
    "generatedTickets": []
  },
  "tokensUsed": 0,
  "costUsd": 0
}
```

**Field rules**:
- `id`: Unique identifier — `test-fix-NNN` for auto-fixed, `test-fail-NNN` for non-fixable
- `severity`: MUST be lowercase: `high` (blocking failures), `medium` (fixable issues), `low` (warnings)
- `description`: What failed and what was done (for autoFixed) or why it can't be fixed (for nonFixable)
- `file`: Relative path from repo root to the test file
- `line`: Line number of the failing test/assertion
- `autoFixed`: Array of tests that were successfully auto-fixed and committed (uses ReportIssue schema)
- `nonFixable`: Array of tests that could not be auto-fixed (uses ReportIssue schema)
- `generatedTickets`: Always `[]` (tickets are created by the workflow after the scan)
- `issuesFound`: `autoFixed.length + nonFixable.length`
- `issuesFixed`: `autoFixed.length`
