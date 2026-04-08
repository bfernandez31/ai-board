# Workflow Specification: Onboard (Hybrid)

**File**: `.github/workflows/onboard.yml`
**Trigger**: `workflow_dispatch`
**Replaces**: Stub workflow from AIB-577

## Purpose

Two-phase hybrid workflow for project onboarding. Phase 1 performs deterministic stack detection. Phase 2 uses an LLM agent to generate project-specific guidance files. Supports partial success — Phase 1 outputs are committed even if Phase 2 fails.

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `project_id` | string | Yes | Project ID |
| `job_id` | string | Yes | ProjectSetupJob ID |
| `githubRepository` | string | Yes | Target repo in `owner/repo` format |
| `agent` | string | Yes | Agent type (`CLAUDE` or `CODEX`) |

## Environment

| Variable | Source | Description |
|----------|--------|-------------|
| `WORKFLOW_API_TOKEN` | Secret | Bearer token for status callbacks |
| `API_BASE_URL` | Var | Base URL for callback endpoints (default: `https://ai-board.vercel.app`) |
| `GH_PAT` | Secret | GitHub PAT with repo write access for target repo clone/push |
| `CLAUDE_CODE_OAUTH_TOKEN` | Secret | Claude CLI authentication (Phase 2) |
| `APP_URL` | Var | App URL for credential fetching and telemetry |

## Steps

### 1. Report RUNNING

```bash
curl -sf -X PATCH \
  "${API_BASE_URL}/api/projects/${PROJECT_ID}/setup/jobs/${JOB_ID}/status" \
  -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status":"RUNNING","workflowRunId":'"${GITHUB_RUN_ID}"'}'
```

Handle HTTP 409 (job already cancelled) by exiting workflow.

### 2. Fetch Owner AI Credential

Follow the credential fetching pattern from speckit.yml:

```bash
PROVIDER=$([ "${AGENT}" == "CODEX" ] && echo "OPENAI" || echo "ANTHROPIC")
RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${APP_URL}/api/internal/credentials?projectId=${PROJECT_ID}&provider=${PROVIDER}" \
  -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}")
HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
# Parse credentialType, envVar, value from JSON
# Base64 decode value, mask with ::add-mask::, export to GITHUB_ENV
```

If credential fetch fails, report FAILED and exit. Phase 2 requires this credential.

### 3. Sparse Checkout AI Board + Full Clone Target

```bash
# AI Board repo (for scripts and command files)
git clone --depth 1 --filter=blob:none --sparse \
  "https://x-access-token:${GH_PAT}@github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git" ai-board
cd ai-board && git sparse-checkout set .claude-plugin .github/scripts

# Target repository (full clone for detection and LLM analysis)
git clone "https://x-access-token:${GH_PAT}@github.com/${GITHUB_REPOSITORY}.git" target-repo
cd target-repo
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
```

### 4. Phase 1 — Stack Detection

```bash
bash ai-board/.github/scripts/detect-stack.sh target-repo
```

**Outputs**:
- `target-repo/.ai-board/config.yml` — validated project configuration
- `target-repo/analysis.json` — structured detection results for Phase 2

**On failure**: Report `CONFIG_GENERATION_FAILED` via callback, exit workflow. No files committed.

### 5. Phase 1 Commit (Partial Success Checkpoint)

If Phase 1 succeeds, stage and commit Phase 1 outputs immediately:

```bash
cd target-repo
git config user.email "ai-board[bot]@users.noreply.github.com"
git config user.name "ai-board[bot]"
git add .ai-board/config.yml
# Note: analysis.json is NOT committed (working artifact only)
```

Phase 1 files are staged but NOT committed yet — they'll be included in the single atomic commit after Phase 2 (or committed alone on Phase 2 failure).

### 6. Phase 2 — LLM Content Generation

```bash
# Check if CLAUDE.md already exists (skip generation if so)
SKIP_CLAUDE_MD=""
if [ -f "target-repo/CLAUDE.md" ]; then
  SKIP_CLAUDE_MD="--skip-claude-md"
fi

# Invoke agent via run-agent.sh
cd target-repo
bash ../ai-board/.github/scripts/run-agent.sh "${AGENT}" "ai-board.onboard" \
  "--analysis-json=analysis.json ${SKIP_CLAUDE_MD}"
```

**Expected outputs** (created by the agent):
- `CLAUDE.md` — project-specific guidance (skipped if exists)
- `.ai-board/memory/constitution.md` — governance principles
- `AGENTS.md` — symlink to `CLAUDE.md`

**On failure**: Fall through to partial success commit path.

### 7. Commit and Push

```bash
cd target-repo

# Stage all generated files
git add .ai-board/config.yml
git add .ai-board/memory/constitution.md 2>/dev/null || true
git add CLAUDE.md 2>/dev/null || true
git add AGENTS.md 2>/dev/null || true

# Check if there are changes to commit
if ! git diff --staged --quiet; then
  git commit -m "chore: initialize ai-board configuration"
  git push origin "${DEFAULT_BRANCH}"
  COMMIT_SHA=$(git rev-parse HEAD)
fi
```

**On push failure**: Report `COMMIT_FAILED` via callback.

### 8. Build Artifact Summary

```bash
# Determine which files were created, preserved, or missing
CREATED=()
MISSING=()
PRESERVED=()

[ -f ".ai-board/config.yml" ] && CREATED+=(".ai-board/config.yml") || MISSING+=(".ai-board/config.yml")
[ -f ".ai-board/memory/constitution.md" ] && CREATED+=(".ai-board/memory/constitution.md") || MISSING+=(".ai-board/memory/constitution.md")

# Check CLAUDE.md — could be created, preserved, or missing
if [ -n "${SKIP_CLAUDE_MD}" ]; then
  PRESERVED+=("CLAUDE.md")
elif [ -f "CLAUDE.md" ]; then
  CREATED+=("CLAUDE.md")
else
  MISSING+=("CLAUDE.md")
fi

[ -L "AGENTS.md" ] && CREATED+=("AGENTS.md") || MISSING+=("AGENTS.md")

PARTIAL="false"
if [ ${#MISSING[@]} -gt 0 ] && [ ${#CREATED[@]} -gt 0 ]; then
  PARTIAL="true"
fi
```

### 9. Report COMPLETED or FAILED

**Full success** (all files created):
```json
{
  "status": "COMPLETED",
  "artifactSummary": {
    "partial": false,
    "commitSha": "<sha>",
    "created": [".ai-board/config.yml", "CLAUDE.md", ".ai-board/memory/constitution.md", "AGENTS.md"],
    "missing": [],
    "preserved": []
  }
}
```

**Partial success** (Phase 1 OK, Phase 2 failed):
```json
{
  "status": "COMPLETED",
  "artifactSummary": {
    "partial": true,
    "errorCode": "GUIDANCE_GENERATION_FAILED",
    "commitSha": "<sha>",
    "created": [".ai-board/config.yml"],
    "missing": ["CLAUDE.md", ".ai-board/memory/constitution.md", "AGENTS.md"],
    "preserved": []
  }
}
```

**Total failure** (Phase 1 failed):
```json
{
  "status": "FAILED",
  "errorMessage": "Stack detection failed: <details>",
  "artifactSummary": {
    "errorCode": "CONFIG_GENERATION_FAILED",
    "created": [],
    "missing": [".ai-board/config.yml", "CLAUDE.md", ".ai-board/memory/constitution.md", "AGENTS.md"]
  }
}
```

### Error Handling (always runs)

```bash
# If any step fails and no callback was sent yet
if [ "${{ job.status }}" == "failure" ]; then
  curl -sf -X PATCH "${API_BASE_URL}/api/projects/${PROJECT_ID}/setup/jobs/${JOB_ID}/status" \
    -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"status":"FAILED","errorMessage":"Onboard workflow failed at step: '"${FAILED_STEP}"'"}'
fi
```

## Contract Stability

This workflow uses the same callback URL format, request shape, and authentication mechanism defined in the AIB-577 stub. The setup page requires no changes to work with this real implementation — the `artifactSummary` structure is additive.

## Timeout

Workflow timeout: 10 minutes (Phase 1 < 30s, Phase 2 < 3min, overhead < 6.5min).
