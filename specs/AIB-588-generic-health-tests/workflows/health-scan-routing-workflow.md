# Workflow Specification: Health Scan Routing for TESTS

## Purpose

Route a `TESTS` scan request from ai-board application code to platform-owned workflow behavior without requiring repository-local orchestration files.

## Inputs

| Input | Type | Description |
|------|------|-------------|
| `scan_type` | enum | Health scan type |
| `githubRepository` | string | `owner/repo` target |
| `project.config` | object/null | Synced workflow configuration |
| `service inputs` | derived | Container provisioning flags from config services |

## Steps

1. Refresh project config when stale.
2. Dispatch `health-scan.yml`.
3. Provision services based on stored config.
4. Checkout ai-board for shared scripts and the target repo for the source under test.
5. For `scan_type = TESTS`, invoke the ai-board-owned TESTS orchestrator with the target repo path.
6. Normalize result envelope fields and update status/tickets.

## Error Behavior

- Missing config refresh fails dispatch before workflow execution.
- Missing runnable test command inside the workflow is not a routing error; it becomes a skipped scan result.
- Missing shared orchestrator assets or invalid routing is a workflow failure and must stay visible to maintainers.
