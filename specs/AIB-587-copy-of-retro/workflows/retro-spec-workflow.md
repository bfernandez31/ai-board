# Workflow: retro-spec.yml

**Purpose**: Clone target repository, analyze codebase, generate specifications, and commit to default branch.

---

## Trigger

```yaml
on:
  workflow_dispatch:
    inputs:
      project_id:
        description: 'Project ID'
        required: true
        type: string
      job_id:
        description: 'Spec generation job ID'
        required: true
        type: string
      githubRepository:
        description: 'Target repository in format owner/repo'
        required: true
        type: string
      agent:
        description: 'Agent type (CLAUDE or CODEX)'
        required: true
        type: string
      depth:
        description: 'Spec depth (quick, standard, comprehensive)'
        required: true
        type: string
      documentation_url:
        description: 'Optional external documentation URL'
        required: false
        type: string
        default: ''
      additional_context:
        description: 'Optional additional context for generation'
        required: false
        type: string
        default: ''
```

## Environment Variables

Same pattern as `onboard.yml`:
- `APP_URL`, `WORKFLOW_API_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_MODEL`
- OTEL telemetry variables for observability

## Job Steps

### Step 1: Report RUNNING
- PATCH `/api/projects/{project_id}/spec-generation/jobs/{job_id}/status`
- Body: `{"status":"RUNNING","workflowRunId":<run_id>}`
- Handle 409 (already cancelled) → abort

### Step 2: Fetch Credentials
- Fetch owner AI credential (ANTHROPIC for Claude, OPENAI for Codex)
- Fetch owner GitHub token for target repo access
- Fail fast if credentials missing

### Step 3: Clone Repositories
- Sparse checkout ai-board repo (scripts, commands, skills only)
- Full clone target repo using owner GitHub token
- Checkout default branch

### Step 4: Setup Environment
- Install Bun/Node
- Create symlinks to Claude plugin commands/skills

### Step 5: Fetch External Documentation (conditional)
- If `documentation_url` is non-empty, fetch content via curl
- Store in `$WORKSPACE/external-docs.md`
- If fetch fails, log warning and continue without external docs (FR-014)

### Step 6: Execute Retro-Spec Command
- Run `run-agent.sh` with `ai-board.retro-spec` command
- Pass arguments: `--depth $depth [--docs-path $docs_path] [--additional-context "$context"]`
- Working directory: target repo clone
- The command analyzes the codebase and generates `specs/specifications/` directory

### Step 7: Commit and Push
- Configure git (user.name, user.email)
- Stage `specs/specifications/` directory
- Commit with message: `chore: generate project specifications (${depth})`
- Push to default branch using owner GitHub token
- Capture commit SHA

### Step 8: Report Success
- PATCH status to COMPLETED
- Include `artifactSummary`:
  ```json
  {
    "depth": "standard",
    "created": ["specs/specifications/overview.md", "..."],
    "commitSha": "abc123",
    "documentationUrlAccessible": true
  }
  ```

### Failure Handling
- On ANY step failure: PATCH status to FAILED with descriptive error
- Include `artifactSummary` with error details
- Partial results are NOT committed (FR per spec)

## Timeout
- `timeout-minutes: 30` (comprehensive depth may take up to 20 min)

## Permissions
```yaml
permissions:
  contents: write
```
