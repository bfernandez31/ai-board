# Workflow Specification: Shared TESTS Health Scan

## Purpose

Run a generic TESTS health scan from the ai-board checkout against any checked-out target repository using shared config and shared orchestration scripts.

## Inputs

| Input | Type | Description |
|------|------|-------------|
| `target_repo_dir` | path | Checked-out repository under test |
| `ai_board_checkout_dir` | path | Platform checkout containing shared TESTS scripts |
| `agent` | enum | `CLAUDE` or `CODEX` |
| `scan_id` | string | Health scan record id |
| `project_id` | string | Project id |

## Environment Requirements

- ai-board checkout containing `scripts/run-health-tests.sh`, `scripts/run-tests-with-reports.sh`, and `.github/scripts/run-command.sh`
- target repo checkout
- workflow token auth for status callbacks
- any provisioned DB/cache services derived from synced project config services

## Steps

1. Checkout ai-board tools and the target repo into sibling directories.
2. Run the shared orchestrator from the ai-board checkout and pass the target repo path explicitly.
3. Resolve `testCapabilities.primaryCommandKey` from `target_repo_dir/.ai-board/config.yml`.
4. If no runnable command exists, write `/tmp/health-scan-result.json` with `skipped: true` and `skipReason`, then stop successfully.
5. Run the shared target-aware test helper against the target repo and emit `/tmp/test-report-summary.json`.
6. Compute score from the first run only.
7. If failures exist, invoke the remediation loop up to the retry limit, re-running the shared helper against the same target repo each time.
8. Write `/tmp/health-scan-result.json`.
9. Update scan status as `COMPLETED`, `SKIPPED`, or `FAILED`.

## Callback / Reporting Contract

- Successful execution with runnable tests reports `COMPLETED`
- Successful execution without a runnable test command reports `SKIPPED`
- Orchestration failures report `FAILED`
- Remediation ticket generation continues unchanged for completed runs only
