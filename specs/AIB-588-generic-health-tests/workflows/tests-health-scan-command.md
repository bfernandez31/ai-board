# Command Specification: run-health-tests.sh

## File

`scripts/run-health-tests.sh`

## Arguments

| Argument | Required | Description |
|---------|----------|-------------|
| `<agent_type>` | No | `CLAUDE` or `CODEX`, default `CLAUDE` |
| `<target_repo_dir>` | Yes | Explicit target repository directory |

## Functional Phases

1. Resolve the target repo path from the second argument.
2. Use `.github/scripts/run-command.sh <target_repo_dir> test_primary` to determine whether a runnable automated test command exists.
3. If not runnable, write a skipped result envelope with `skipReason` and exit `0`.
4. Run `scripts/run-tests-with-reports.sh <target_repo_dir>`.
5. Score the first run only.
6. Invoke the fix-and-retest loop when failures exist, re-running the shared helper against the same target repo each time.
7. Apply target-scoped rollback if retries worsen the result.
8. Write the final result envelope.

## Output Format

- Always writes `/tmp/health-scan-result.json` on success or intentional skip
- Exit code `0` for completed or skipped scans
- Non-zero exit only for orchestration/setup failures before a valid result can be written
- Accepts `AI_BOARD_RUN_TESTS_WITH_REPORTS`, `AI_BOARD_RUN_COMMAND_SCRIPT`, and `AI_BOARD_RUN_AGENT` overrides for testability

## Reporting Contract

- `skipped: true` requires `skipReason`
- `report.type` remains `TESTS`
- `autoFixed` and `nonFixable` remain the report body for executed scans
