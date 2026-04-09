# Command Specification: run-health-tests.sh

## File

`scripts/run-health-tests.sh`

## Arguments

| Argument | Required | Description |
|---------|----------|-------------|
| `<agent_type>` | No | `CLAUDE` or `CODEX`, default `CLAUDE` |
| `<target_repo_dir>` | Yes | Explicit target repository directory |

## Functional Phases

1. Read target config and determine whether a test command is runnable.
2. If not runnable, write skipped result envelope and exit `0`.
3. Run shared test execution helper against the target repo.
4. Score the first run.
5. Invoke existing fix-and-retest loop when failures exist.
6. Apply degradation guard and target-scoped rollback if retries worsen the result.
7. Write the final result envelope.

## Output Format

- Always writes `/tmp/health-scan-result.json` on success or intentional skip
- Exit code `0` for completed or skipped scans
- Non-zero exit only for orchestration/setup failures before a valid result can be written

## Reporting Contract

- `skipped: true` requires `skipReason`
- `report.type` remains `TESTS`
- `autoFixed` and `nonFixable` remain the report body for executed scans
