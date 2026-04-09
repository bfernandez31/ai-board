# Workflow: retro-spec.yml

## Overview

GitHub Actions workflow triggered by API dispatch when a project owner requests specification generation from the board. Follows the same structural pattern as `onboard.yml`.

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `project_id` | string | Yes | Project ID |
| `job_id` | string | Yes | ProjectSetupJob ID (command=RETRO_SPEC) |
| `githubRepository` | string | Yes | Target repository in format `owner/repo` |
| `agent` | string | Yes | Agent type: `CLAUDE` or `CODEX` |
| `depth` | string | Yes | Spec depth: `QUICK`, `STANDARD`, or `COMPREHENSIVE` |
| `docUrl` | string | No | Optional external documentation URL |
| `context` | string | No | Optional additional context from user |

## Environment Variables

Same as `onboard.yml`:
- `APP_URL`: Application URL for API callbacks
- `WORKFLOW_API_TOKEN`: Bearer token for status updates
- `CLAUDE_CODE_OAUTH_TOKEN`: Fallback Claude CLI auth
- `ANTHROPIC_MODEL`: Model identifier
- Telemetry env vars (OTEL)

## Steps

### Step 1: Report RUNNING
```
PATCH ${APP_URL}/api/projects/${project_id}/setup/jobs/${job_id}/status
Body: { "status": "RUNNING", "workflowRunId": ${{ github.run_id }} }
```
On 409 response: job was cancelled, abort workflow.

### Step 2: Fetch AI Credential
```
GET ${APP_URL}/api/internal/credentials?projectId=${project_id}&provider=${PROVIDER}
```
Map agent to provider: CLAUDE→ANTHROPIC, CODEX→OPENAI.
Base64-decode credential value, mask in logs, export to `$GITHUB_ENV`.

### Step 3: Fetch GitHub Token
```
GET ${APP_URL}/api/internal/github-token?projectId=${project_id}
```
Use `.github/scripts/fetch-repo-token.sh`. Fallback to `secrets.GH_PAT`.

### Step 4: Clone Target Repository
```bash
git clone "https://x-access-token:${REPO_TOKEN}@github.com/${githubRepository}.git" target-repo
cd target-repo
git remote set-url origin "https://github.com/${githubRepository}.git"
```

### Step 5: Fetch External Documentation (conditional)
If `docUrl` is provided:
```bash
DOC_CONTENT=$(curl -sL --max-time 30 "${docUrl}" 2>/dev/null || echo "")
if [ -z "$DOC_CONTENT" ]; then
  echo "::warning::Documentation URL unreachable, proceeding with codebase only"
fi
```
Non-fatal: logs warning if unreachable, continues with codebase analysis only.

### Step 6: Execute Agent Command
Run the `ai-board.retro-spec` agent command with inputs:
- Codebase context (from cloned repo)
- `depth` level
- External documentation content (if fetched)
- Additional context (if provided)
- Existing `.ai-board/config.yml` and agent context files

### Step 7: Commit and Push
```bash
cd target-repo
git add specs/specifications/
git commit -m "docs: generate project specifications (retro-spec, depth=${depth})"
git push origin HEAD
```
Commit generated specs to the default branch.

### Step 8: Report COMPLETED
```
PATCH ${APP_URL}/api/projects/${project_id}/setup/jobs/${job_id}/status
Body: {
  "status": "COMPLETED",
  "artifactSummary": {
    "depth": "${depth}",
    "files": ["specs/specifications/overview.md", ...],
    "docUrlUsed": true/false,
    "commitSha": "${COMMIT_SHA}"
  }
}
```

### Error Handling
On any failure:
```
PATCH ${APP_URL}/api/projects/${project_id}/setup/jobs/${job_id}/status
Body: {
  "status": "FAILED",
  "errorMessage": "${ERROR_MESSAGE}"
}
```

## Timeout

`timeout-minutes: 30` (Comprehensive depth may take up to 20 minutes per SC-002).

## Permissions

```yaml
permissions:
  contents: write  # For committing specs to target repo
```
