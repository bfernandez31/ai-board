# Research: Project Onboarding — Hybrid Workflow

**Branch**: `AIB-575-project-onboarding-hybrid` | **Date**: 2026-04-08

## Resolved Unknowns

### 1. Config Schema Extension for New Languages

- **Decision**: Extend `ProjectLanguageSchema`, `ProjectFrameworkSchema`, and `PackageManagerSchema` in `lib/validations/config.ts` to add `ruby`, `php` languages; `bundler`, `composer` package managers; and `rails`, `laravel`, `rspec`, `phpunit`, `actix`, `rocket` framework values
- **Rationale**: Single schema source of truth (Decision 1 from spec). The schema already supports 7 languages and 9 frameworks; extension is additive
- **Alternatives considered**: Separate onboarding-only schema — rejected because it duplicates validation logic and diverges over time

### 2. Detection Script Technology Choice

- **Decision**: Pure bash script for Phase 1 stack detection. No external dependencies needed — detection uses `test -f`, `grep`, `jq` on manifest files
- **Rationale**: GitHub Actions runners have bash + jq pre-installed. Bash is fast, deterministic, and requires no setup step. Matches existing script patterns in `.claude-plugin/scripts/bash/`
- **Alternatives considered**: Node.js script (requires bun install step, slower startup), Python (extra runtime dependency)

### 3. LLM Agent Invocation for Phase 2

- **Decision**: Reuse `run-agent.sh` from `.github/scripts/` with a new `/ai-board.onboard` command file. Phase 2 invokes the agent CLI with the onboard command, passing `analysis.json` path as argument
- **Rationale**: `run-agent.sh` already handles Claude/Codex abstraction, credential masking, OAuth token refresh, and telemetry. Reusing it avoids duplicating 200+ lines of agent orchestration
- **Alternatives considered**: Direct Claude CLI invocation (loses Codex support and telemetry)

### 4. Callback API Compatibility

- **Decision**: Use existing `PATCH /api/projects/{projectId}/setup/jobs/{jobId}/status` endpoint with `artifactSummary` JSON field for file reporting. No app-layer changes needed
- **Rationale**: The setup job status API already accepts `artifactSummary: Record<string, unknown>`, `errorMessage: string`, and all required status transitions (PENDING→RUNNING→COMPLETED/FAILED). Contract is stable per AIB-577 spec
- **Alternatives considered**: New dedicated endpoint — rejected, existing endpoint fully supports the use case

### 5. Git Commit Strategy

- **Decision**: Use git commands directly in the workflow (configure bot user, stage, commit, push). Single atomic commit to default branch
- **Rationale**: Matches speckit.yml pattern (git config `ai-board[bot]`, `git add`, `git commit`, `git push`). Target repos are freshly imported with no branch protection expected
- **Alternatives considered**: GitHub API for content creation — rejected, too complex for multi-file atomic commits

## Existing Files

### Files to Modify

| Path | What It Covers | Action |
|------|---------------|--------|
| `.github/workflows/onboard.yml` | Stub onboard workflow | **Replace** stub with real two-phase workflow |
| `lib/validations/config.ts` | Config schema (Zod) | **Extend** enums with ruby, php, bundler, composer, rails, laravel, rspec, phpunit, actix, rocket |
| `specs/AIB-449-define-ai-board/contracts/config-schema.ts` | TypeScript type contract | **Extend** type unions to match new Zod enums |

### Files to Create

| Path | Purpose |
|------|---------|
| `.github/scripts/detect-stack.sh` | Phase 1: Deterministic stack detection script |
| `.claude-plugin/commands/ai-board.onboard.md` | Phase 2: LLM agent command for CLAUDE.md + constitution generation |
| `specs/AIB-575-project-onboarding-hybrid/workflows/onboard-workflow.md` | Updated workflow specification |

### Existing Files as Pattern References

| Path | Pattern To Extract |
|------|-------------------|
| `.github/workflows/speckit.yml` | Credential fetching, sparse checkout, run-agent.sh invocation, git commit/push, callback patterns |
| `.github/workflows/onboard.yml` | Current callback URL format and auth pattern |
| `.github/scripts/run-agent.sh` | Agent CLI abstraction, command file resolution |
| `lib/validations/config.ts` | Zod enum extension pattern |
| `.claude-plugin/scripts/bash/common.sh` | Shared bash utility functions |
| `app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts` | Status callback handler, artifactSummary persistence |

### Existing Test Files to Extend

| Path | What It Covers | Action |
|------|---------------|--------|
| `tests/unit/config-schema.test.ts` | Config schema validation (50+ tests) | **Extend** with new language/framework/manager values |
| `tests/unit/config-loader.test.ts` | Config file loading | No change needed |
| `tests/integration/projects/setup-job.test.ts` | Setup job CRUD + status transitions | **Extend** with artifactSummary assertions |

### New Test Files

| Path | Why New File |
|------|-------------|
| `tests/unit/detect-stack.test.ts` | New domain: bash script output validation via Node subprocess |

## Patterns to Follow

### 1. Credential Fetching Pattern (speckit.yml:221-252)

```bash
PROVIDER=$([ "${{ inputs.agent }}" == "CODEX" ] && echo "OPENAI" || echo "ANTHROPIC")
RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${APP_URL}/api/internal/credentials?projectId=${{ inputs.project_id }}&provider=${PROVIDER}" \
  -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}")
# Parse response body and HTTP status separately
HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
# Extract fields, base64 decode, mask, export
```

**How to apply**: Onboard workflow Phase 2 needs the owner's AI credential. Copy this exact pattern, including `::add-mask::` for secret masking and the HTTP code check.

### 2. Sparse Checkout Pattern (speckit.yml:140-180)

```bash
# Checkout ai-board repo (for scripts and commands)
git clone --depth 1 --filter=blob:none --sparse "${AI_BOARD_REPO}" ai-board
cd ai-board && git sparse-checkout set .claude-plugin .github/scripts
# Clone target repo fully
git clone "https://x-access-token:${GH_PAT}@github.com/${githubRepository}.git" target-repo
```

**How to apply**: Onboard workflow needs ai-board scripts (detect-stack.sh, run-agent.sh, command files) and full target repo clone.

### 3. Callback Error Reporting Pattern (onboard.yml + speckit.yml)

```bash
# Always use -sf flags; report FAILED on any step failure
curl -sf -X PATCH "${API_BASE_URL}/api/projects/${project_id}/setup/jobs/${job_id}/status" \
  -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"status":"FAILED","errorMessage":"...","artifactSummary":{...}}'
```

**How to apply**: Each error exit point in the workflow must report structured error with code in artifactSummary: `{"errorCode":"CONFIG_GENERATION_FAILED","created":[],"missing":[...]}`.

### 4. Git Bot User Configuration (speckit.yml:185-190)

```bash
git config user.email "ai-board[bot]@users.noreply.github.com"
git config user.name "ai-board[bot]"
```

**How to apply**: Configure in target-repo before any commit operations.

### 5. Agent Command File Resolution (run-agent.sh:70-85)

Command files are resolved from: `.claude-plugin/commands/{cmd}.md` → `.claude/commands/{cmd}.md` → `../ai-board/.claude-plugin/commands/{cmd}.md`

**How to apply**: Place the onboard command at `.claude-plugin/commands/ai-board.onboard.md` in the ai-board repo. The agent invocation uses `/ai-board.onboard` as the command name.
