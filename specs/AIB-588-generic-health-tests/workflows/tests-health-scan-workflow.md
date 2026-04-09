# Workflow Specification: Shared TESTS Health Scan

## Purpose

Run a generic TESTS health scan from the ai-board checkout against any checked-out target repository using shared config and shared orchestration scripts.

## Inputs

| Input | Type | Description |
|------|------|-------------|
| `target_repo_dir` | path | Checked-out repository under test |
| `project_config` | object | Sanitized config synced into ai-board |
| `agent` | enum | `CLAUDE` or `CODEX` |
| `scan_id` | string | Health scan record id |
| `project_id` | string | Project id |

## Environment Requirements

- ai-board checkout containing `scripts/run-health-tests.sh`
- target repo checkout
- workflow token auth for status callbacks
- any provisioned DB/cache services derived from `project_config.services`

## Steps

1. Load synced config for the target repo.
2. Resolve the primary runnable test command from config.
3. If no command exists, write a skipped result file and stop successfully.
4. Run the initial test pass through the shared target-aware test runner.
5. Compute score from the first run only.
6. If failures exist, invoke the existing automated remediation loop.
7. Re-run tests until success, retry exhaustion, or degradation guard stop.
8. Write `/tmp/health-scan-result.json`.
9. Update scan status as `COMPLETED`, `SKIPPED`, or `FAILED`.

## Callback / Reporting Contract

- Successful execution with runnable tests reports `COMPLETED`
- Successful execution without a runnable test command reports `SKIPPED`
- Orchestration failures report `FAILED`
- Remediation ticket generation continues unchanged for completed runs only
