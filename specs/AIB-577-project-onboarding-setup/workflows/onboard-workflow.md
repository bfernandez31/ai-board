# Workflow Specification: Onboard (Stub)

**File**: `.github/workflows/onboard.yml`
**Trigger**: `workflow_dispatch`

## Purpose

Stub workflow for the project onboarding pipeline. Simulates the onboarding process by calling status callbacks. Real workflow logic (stack detection, config generation, file commits) is deferred to a follow-up ticket.

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `project_id` | string | Yes | Project ID |
| `job_id` | string | Yes | ProjectSetupJob ID |
| `githubRepository` | string | Yes | Target repo in `owner/repo` format |
| `agent` | string | Yes | Selected agent CLI (`CLAUDE` or `CODEX`) |

## Environment

| Variable | Source | Description |
|----------|--------|-------------|
| `WORKFLOW_API_TOKEN` | Secret | Bearer token for status callbacks |
| `APP_BASE_URL` | Secret/Var | Base URL for callback endpoints |

## Steps

### 1. Signal RUNNING

```bash
curl -s -X PATCH \
  "${APP_BASE_URL}/api/projects/${PROJECT_ID}/setup/jobs/${JOB_ID}/status" \
  -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status": "RUNNING", "workflowRunId": '"${GITHUB_RUN_ID}"'}'
```

### 2. Simulate Work

```bash
sleep 5  # Brief pause simulating onboarding work
```

In the real implementation, this step will:
- Clone the target repository
- Detect project stack (language, framework, package manager)
- Generate `.ai-board/config.yml` using LLM
- Generate `.claude/commands/` and `.specify/scripts/bash/` files
- Commit and push generated files

### 3. Signal COMPLETED

```bash
curl -s -X PATCH \
  "${APP_BASE_URL}/api/projects/${PROJECT_ID}/setup/jobs/${JOB_ID}/status" \
  -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status": "COMPLETED", "artifactSummary": {"files": []}}'
```

### Error Handling

If any step fails, signal FAILED:

```bash
curl -s -X PATCH \
  "${APP_BASE_URL}/api/projects/${PROJECT_ID}/setup/jobs/${JOB_ID}/status" \
  -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status": "FAILED", "errorMessage": "'"${ERROR_MESSAGE}"'"}'
```

## Contract Stability

The callback URL format, request shape, and authentication mechanism defined here are stable contracts. The real workflow implementation must use these same endpoints and payloads — no app-layer changes should be needed when the stub is replaced.
