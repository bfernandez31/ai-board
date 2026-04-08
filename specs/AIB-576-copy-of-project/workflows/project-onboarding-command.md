# Command Specification: Project Onboarding Command

## Purpose

Define the minimal agent-executed onboarding command used by the project-onboarding workflow for this ticket.

## Invocation Surface

- Proposed executor: `/home/runner/work/ai-board/ai-board/target/app/lib/workflows/dispatch-project-onboarding.ts`
- Proposed workflow runtime step: call the agent CLI after credentials and repository checkout are prepared

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `project_id` | yes | AI Board project identifier |
| `setup_attempt_id` | yes | Persisted setup-attempt identifier |
| `github_repository` | yes | Target repository in `owner/repo` format |
| `agent` | yes | `CLAUDE` or `CODEX` |

## Functional Phases

1. Inspect repository for `.ai-board/config.yml`.
2. If config already exists and is valid, emit a completion summary indicating setup was effectively a no-op.
3. Otherwise create or preserve the minimal files needed to exercise onboarding end to end.
4. Return a structured artifact summary for callback persistence.

## Expected Output Format

The workflow should normalize command output into a callback payload shaped like:

```json
{
  "status": "COMPLETED",
  "message": "Created AI Board onboarding files",
  "artifactSummary": {
    "created": [".ai-board/config.yml"],
    "preserved": [".github/workflows/ci.yml"],
    "notes": ["Left existing project scripts unchanged"]
  }
}
```

## Constraints

- The command is intentionally minimal for this ticket; it exists to validate the application-side lifecycle rather than to implement a full repository bootstrapper.
- It must be idempotent enough that a retry after failure does not corrupt existing repo state.
- It must not require target repositories to preinstall workflow files beyond the platform’s established multi-repository model.
