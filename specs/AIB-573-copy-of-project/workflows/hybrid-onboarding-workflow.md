# Hybrid Onboarding Workflow

## Purpose

Define the GitHub Actions workflow that initializes an imported repository missing AI Board configuration, commits the generated artifact set, and reports progress back to the application.

## Workflow file

- Proposed path: `/home/runner/work/ai-board/ai-board/target/.github/workflows/project-onboarding.yml`

## Inputs

| Input | Type | Notes |
|------|------|------|
| `project_id` | string | AI Board project id |
| `setup_job_id` | string | Authoritative `ProjectSetupJob.id` |
| `githubRepository` | string | `owner/repo` target repository |
| `selected_agent` | string | `CLAUDE` or `CODEX` |
| `default_branch` | string | Optional override; otherwise resolve from repo metadata |
| `app_url` | env/var | Used for callback and credential fetch |

## Environment requirements

- `GH_PAT` secret for cloning and pushing to external repositories
- `WORKFLOW_API_TOKEN` secret for callback and internal credential APIs
- `CLAUDE_CODE_OAUTH_TOKEN` or `OPENAI_API_KEY` only as fallback when owner credential fetch fails
- Bun/Node setup matching the current workflow fleet
- `jq`, `git`, and existing shared setup scripts available on Ubuntu runner

## Steps

1. Callback `RUNNING`
   - PATCH `/api/projects/{projectId}/setup/status`
   - attach `setup_job_id`, `workflowRunId`, and resolved default branch once known

2. Checkout orchestration repository
   - sparse checkout `/home/runner/work/ai-board/ai-board/target/.claude-plugin` and shared workflow scripts

3. Checkout target repository default branch
   - full checkout of `${githubRepository}` into `target/`

4. Fetch owner AI credential
   - call `/api/internal/credentials?projectId={project_id}&provider={ANTHROPIC|OPENAI}`
   - export env var required by selected agent

5. Deterministic repository detection
   - inspect manifests, lockfiles, config files, service clues, and test tooling
   - emit `.ai-board/config.yml`
   - emit structured analysis summary JSON

6. Repository-aware guidance generation
   - inspect existing instruction/governance files
   - preserve existing primary instruction file if present
   - generate missing governance/instruction artifacts
   - create linked alias file
   - ensure `.gitignore` covers `.ai-board/`

7. Validate artifact set
   - confirm config file parses
   - confirm required artifact paths exist or are intentionally preserved
   - assemble artifact manifest for callback payload

8. Atomic repository commit
   - stage only onboarding artifacts
   - commit once on default branch
   - push to origin

9. Config sync completion
   - application callback persists artifact manifest, commit SHA, and triggers config sync

10. Terminal callback
   - `COMPLETED` with artifact summary and commit SHA
   - or `FAILED` with stable error code/message

## Failure handling

- Dispatch/setup validation failure before checkout: callback `FAILED` with `DISPATCH_FAILED`
- Detection cannot produce valid config: callback `FAILED` with `CONFIG_GENERATION_FAILED`
- Guidance generation fails after detection: callback `FAILED` with `GUIDANCE_GENERATION_FAILED`
- Git commit/push fails: callback `FAILED` with `COMMIT_FAILED`
- Config sync after commit fails: callback `FAILED` with `CONFIG_SYNC_FAILED`

No failure path may leave the setup job in `RUNNING` without a terminal callback.

## Outputs

- `commitSha`
- `defaultBranch`
- `analysisSummary`
- `artifactManifest[]`
- `configPreview`
- `errorCode` / `errorMessage` on failure
