# Health Scan: Tests

You are executing a **test health scan** on this repository. Run the full test suite, auto-fix failing tests where possible, commit fixes, and produce a structured JSON report.

## Arguments

Arguments are passed inline after the command name:
- `--base-commit <SHA>`: Optional. **This parameter is ignored** — health-tests always runs the complete test suite regardless of what changed (FR-011). Full test runs guarantee complete regression coverage.
- `--head-commit <SHA>`: Optional. The target commit reference.

## Test Command Detection

Detect the project's test command by inspecting `package.json` scripts in this priority order:

1. `test` — if present, use `bun run test` (runs the **complete** test suite per FR-011)
2. `vitest` — if present, use `bunx vitest run`
3. `jest` — if present, use `bunx jest`
4. **Fallback**: If none of the above are found, use `bun run test`

**Important**: Do NOT use `test:unit` — it runs only unit tests. health-tests MUST always run the complete test suite (FR-011).

For non-JavaScript/TypeScript projects, detect the appropriate test runner from project files (e.g., `pytest` for Python, `cargo test` for Rust, `go test` for Go).

**Edge case — no test command detected**: If no test command can be found in package.json or project conventions, report an error issue in the output:
- Set `issuesFound` to 1, `issuesFixed` to 0
- Add to the `nonFixable` array: `{ "file": "package.json", "description": "No test command detected in package.json scripts", "reason": "No test runner configured" }`
- Keep `issues` array empty (nothing was fixed)
- Set score to 0
- Summary: "No test command found in project configuration"

## Auto-Fix Workflow

For each failing test:

1. **Analyze** the test error output to understand the failure
2. **Attempt a fix** if the failure is obvious and isolated (e.g., missing import, wrong assertion value, stale snapshot, updated API response shape)
3. **Re-run the specific test** to verify the fix works
4. **Commit the fix** individually to the branch with a descriptive commit message (e.g., `fix(tests): update assertion in user.test.ts to match new API response`)
5. If the fix **succeeds**: add to `report.issues[]` with `status: "fixed"`
6. If the fix **fails or is not possible**: add to `report.nonFixable[]` with `reason` explaining why auto-fix was not possible (e.g., "Requires database schema changes", "Architectural mismatch between test and implementation")

**Do NOT attempt fixes** that require:
- Architectural changes
- New dependencies
- Database migrations
- Changes to production code (only test code should be modified)

## Score Calculation

Calculate the score using this formula:

```
score = (passed / total) * 100
```

Where:
- `passed` = tests that passed on first run + tests that were auto-fixed and now pass
- `total` = total number of tests executed
- Round to nearest integer

**Edge case — all tests pass**: Return score 100, `issuesFound: 0`, `issuesFixed: 0`, empty `issues` and `nonFixable` arrays, summary: "All tests pass".

## Output Format

You **MUST** output **ONLY** valid JSON to stdout. No other text, logs, markdown formatting, or code fences.

The JSON object must have this **exact** structure:

```json
{
  "score": 75,
  "issuesFound": 4,
  "issuesFixed": 2,
  "report": {
    "issues": [
      {
        "file": "tests/unit/example.test.ts",
        "description": "Test 'should validate input' had wrong expected value — updated assertion from 'foo' to 'bar'",
        "status": "fixed"
      }
    ],
    "nonFixable": [
      {
        "file": "tests/integration/api.test.ts",
        "description": "Integration test 'should create user' fails with database connection error",
        "reason": "Requires database infrastructure changes"
      }
    ],
    "summary": "Ran 40 tests: 36 passed, 2 auto-fixed, 2 non-fixable. Score: 95/100."
  },
  "tokensUsed": 0,
  "costUsd": 0
}
```

### Field Requirements

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `score` | `number` | Yes | 0-100 integer, calculated per formula above |
| `issuesFound` | `number` | Yes | Must equal `report.issues.length + report.nonFixable.length` |
| `issuesFixed` | `number` | Yes | Must equal `report.issues.length` (auto-fixed count) |
| `report.issues` | `array` | Yes | Tests that were auto-fixed |
| `report.issues[].file` | `string` | Yes | Test file path relative to repository root |
| `report.issues[].description` | `string` | Yes | What was wrong and how it was fixed |
| `report.issues[].status` | `string` | Yes | Always `"fixed"` |
| `report.nonFixable` | `array` | Yes | Tests that could not be auto-fixed |
| `report.nonFixable[].file` | `string` | Yes | Test file path relative to repository root |
| `report.nonFixable[].description` | `string` | Yes | What the failure is |
| `report.nonFixable[].reason` | `string` | Yes | Why auto-fix was not possible |
| `report.summary` | `string` | Yes | Brief summary with test counts |
| `tokensUsed` | `number` | Yes | Tokens consumed (0 if unknown) |
| `costUsd` | `number` | Yes | Cost in USD (0 if unknown) |

**CRITICAL**: Output ONLY the JSON object. No explanatory text before or after.
