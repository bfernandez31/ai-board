# Workflow Specification: Repository Onboarding

**File**: `/home/runner/work/ai-board/ai-board/target/.github/workflows/onboard.yml`
**Trigger**: `workflow_dispatch`

## Purpose

Initialize an imported repository for AI Board by generating a valid operational config, optionally generating project-specific guidance, committing the resulting artifacts to the repository default branch, and reporting structured completion back to the setup page.

## Inputs

| Input | Type | Required | Description |
|------|------|----------|-------------|
| `project_id` | string | Yes | AI Board project id |
| `job_id` | string | Yes | `ProjectSetupJob` id |
| `githubRepository` | string | Yes | Target repo in `owner/repo` format |
| `agent` | string | Yes | `CLAUDE` or `CODEX` |

## Environment

| Variable | Source | Purpose |
|---------|--------|---------|
| `WORKFLOW_API_TOKEN` | secret | Setup callback auth |
| `APP_URL` or `API_BASE_URL` | var/secret | App callback base URL |
| `GH_PAT` | secret | Cross-repo checkout and push |

## Phases

### 1. Report RUNNING

- PATCH the existing setup-job status endpoint with `status=RUNNING` and `workflowRunId`

### 2. Checkout Repositories

- Checkout `ai-board` tools
- Checkout target repository default branch with push capability

### 3. Fetch Owner Credential

- Call `/api/internal/credentials?projectId=...&provider=...`
- Export the returned credential to environment variables with masking
- Do not fall back to repository-level AI secrets for onboarding

### 4. Deterministic Analysis

- Run the detection command spec from `detect-stack-command.md`
- Produce:
  - repository analysis JSON
  - valid `.ai-board/config.yml`
  - deterministic artifact-summary entries
- If this phase fails, report `FAILED` with `errorCode=CONFIGURATION_GENERATION_FAILED`

### 5. Guidance Generation

- Invoke `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh`
- Use a new onboarding command file that instructs the agent to inspect the checked-out target repo and write project-specific guidance artifacts
- Preserve existing protected files rather than overwrite them
- If this phase fails, continue to commit deterministic outputs only and mark the final callback `partial=true`

### 6. Assemble And Commit Artifacts

- Merge deterministic outputs and any successfully generated guidance
- Build `created`, `preserved`, and `missing` artifact groups
- Commit once to the target repository default branch
- If commit/push fails, report `FAILED` with `errorCode=COMMIT_FAILED`

### 7. Final Callback

- On full success: `status=COMPLETED`, `partial=false`, `commitSha`, `artifactSummary`
- On partial success: `status=COMPLETED`, `partial=true`, `commitSha`, `errorCode=GUIDANCE_GENERATION_FAILED`, `artifactSummary`, `logs`
- On failure: `status=FAILED`, `errorCode`, `errorMessage`, `logs`

## Non-Negotiable Constraints

- No dependency installation
- No runtime service startup
- No multi-commit success path
- No overwrite of protected existing guidance files
- No change to setup callback path or auth model
