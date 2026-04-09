# Data Model: Generic Health Tests — AIB-586

## No Database Changes

This feature does not modify the Prisma schema or any database models. All changes are in shell scripts, workflow YAML, and config.yml structure.

## Config.yml Schema Extensions

### New `testing` Section

```yaml
testing:
  framework: vitest          # string: vitest | jest | pytest | cargo-test | go-test | rspec | phpunit
  e2e: true                  # boolean: whether E2E framework detected
  e2e_framework: playwright  # string (optional): playwright | cypress | selenium
```

### Extended `commands` Section

```yaml
commands:
  # Existing keys (unchanged)
  install: "bun install --frozen-lockfile"
  build: "bun run build"

  # New keys
  test: "bun run test"            # Primary test command (runs all tests)
  type_check: "bun run type-check"  # Already supported, now auto-detected
  lint: "bun run lint"              # Already supported, now auto-detected
  dev_server: "bun run dev"         # Dev server command for integration/E2E (optional)

  # Existing granular keys (unchanged, override test when present)
  test_unit: "bun run test:unit"
  test_integration: "bun run test:integration"
  test_e2e: "bun run test:e2e"
```

### Field Semantics

| Field | Required | Default | Written By |
|-------|----------|---------|------------|
| `testing.framework` | No | (omitted) | detect-stack.sh |
| `testing.e2e` | No | false | detect-stack.sh |
| `testing.e2e_framework` | No | (omitted) | detect-stack.sh |
| `commands.test` | No | (omitted) | detect-stack.sh |
| `commands.type_check` | No | (omitted) | detect-stack.sh |
| `commands.lint` | No | (omitted) | detect-stack.sh |
| `commands.dev_server` | No | (omitted) | detect-stack.sh or manual |

### Priority Rules

1. If `commands.test_unit` / `test_integration` / `test_e2e` exist → run granular commands
2. Else if `commands.test` exists → run single test command
3. Else → SKIPPED result

## Test Report Summary Schema (unchanged)

```json
{
  "totalPassed": 0,
  "totalFailed": 0,
  "totalTests": 0,
  "hasErrors": false,
  "unit": { "passed": 0, "failed": 0, "total": 0, "ran": false, "error": null },
  "integration": { "passed": 0, "failed": 0, "total": 0, "ran": false, "error": null },
  "e2e": { "passed": 0, "failed": 0, "total": 0, "ran": false, "error": null }
}
```

When a project uses only `commands.test` (no granular commands), results populate the `unit` field (as the "general" test bucket) and `integration`/`e2e` remain `ran: false`.

## Health Scan Result Schema (unchanged)

```json
{
  "score": 100,
  "issuesFound": 0,
  "issuesFixed": 0,
  "report": {
    "type": "TESTS",
    "autoFixed": [],
    "nonFixable": [],
    "generatedTickets": []
  },
  "tokensUsed": 0,
  "costUsd": 0
}
```

## SKIPPED Result Schema (new for TESTS)

```json
{
  "score": 0,
  "issuesFound": 0,
  "issuesFixed": 0,
  "skipped": true,
  "skipReason": "No test command configured in .ai-board/config.yml",
  "report": {
    "type": "TESTS",
    "autoFixed": [],
    "nonFixable": [],
    "generatedTickets": []
  },
  "tokensUsed": 0,
  "costUsd": 0
}
```

Note: The health-scan.yml workflow (line 347-349) currently overrides `skipped=true` for TESTS scans. This guard should be removed once generic SKIPPED support is implemented.
