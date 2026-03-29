# Health Scan: Tests

You are executing a **test health scan** on this repository. Analyze test coverage, test quality, and identify failing or missing tests.

## Inputs

Arguments may include:
- `--base-commit <SHA>`: If provided, only scan changes between this commit and head-commit (incremental scan)
- `--head-commit <SHA>`: The target commit to scan up to

If `--base-commit` is empty or not provided, perform a **full repository scan**.

## What to Scan

1. **Run existing tests** using the project's test commands (e.g., `bun run test:unit`)
2. **Identify failing tests** and attempt simple auto-fixes
3. **Check test coverage** for key modules
4. **Identify untested code** — files with no corresponding test files
5. **Assess test quality** — proper assertions, no empty tests, meaningful descriptions

For each failing test:
- Attempt to fix if the fix is obvious and isolated
- Mark as "nonFixable" if the fix requires architectural changes or is ambiguous

## Output Format

You MUST output valid JSON to stdout with this exact structure:

```json
{
  "score": 75,
  "issuesFound": 4,
  "issuesFixed": 2,
  "report": {
    "issues": [
      {
        "file": "tests/unit/example.test.ts",
        "description": "Test 'should validate input' fails with assertion error",
        "status": "fixed"
      }
    ],
    "nonFixable": [
      {
        "file": "tests/integration/api.test.ts",
        "description": "Integration test requires database seed data not present",
        "reason": "Requires infrastructure changes"
      }
    ],
    "summary": "Brief summary of test health findings"
  },
  "tokensUsed": 0,
  "costUsd": 0
}
```

- `score`: 0-100 (100 = all tests pass, good coverage)
- `nonFixable`: Tests that could not be auto-fixed (used for ticket creation)
- Output ONLY the JSON object, no other text
