# Workflow Definition: Project Onboarding

## Purpose

Run a minimal project-scoped onboarding workflow from start request through authenticated callback so imported repositories without `.ai-board/config.yml` can become usable AI Board projects.

## Repository Artifact

- Proposed workflow file: `/home/runner/work/ai-board/ai-board/target/.github/workflows/project-onboarding.yml`

## Inputs

| Input | Type | Notes |
|-------|------|-------|
| `project_id` | string | Required project identifier |
| `setup_attempt_id` | string | Required setup-attempt identifier |
| `githubRepository` | string | Required `owner/repo` target repository |
| `agent` | string | `CLAUDE` or `CODEX` |
| `owner_user_id` | string | For audit/logging if needed |

## Environment Requirements

| Variable | Source | Purpose |
|----------|--------|---------|
| `APP_URL` | repo variable | API callback target |
| `WORKFLOW_API_TOKEN` | repo secret | Authenticate callbacks |
| `GH_PAT` | repo secret | Checkout target repository |
| provider-specific AI credential | `/api/internal/credentials` | Run onboarding command with owner’s selected agent credential |

## High-Level Steps

1. Mark setup attempt `RUNNING` through the setup callback API.
2. Checkout the ai-board repo for shared scripts and the target repository for onboarding changes.
3. Fetch the owner credential for the selected agent/provider using the existing internal credentials endpoint.
4. Run the onboarding command in the checked-out target repository.
5. Report progress messages back to the setup callback endpoint as needed.
6. Report `COMPLETED` with artifact summary, or `FAILED` with failure details.

## Failure Handling

- If dispatch preconditions fail before workflow creation, the API should not leave a successful active attempt behind.
- If the workflow cannot fetch credentials, it reports `FAILED`.
- If command execution fails, it reports `FAILED` with an actionable message.
- If the workflow reports `COMPLETED` but config sync fails in the app, the callback endpoint returns a sync failure and the attempt is persisted as terminal failure.

## Output

- Updated `ProjectSetupAttempt`
- Optional artifact summary
- Project config synchronized on success
