# GitHub Workflows Context

## Architecture

All workflows execute on ai-board repository (centralized). External repos are cloned via `githubRepository` input.

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| speckit.yml | SPECIFY/PLAN/BUILD stages | Main development workflow |
| quick-impl.yml | INBOX→BUILD | Fast-track simple fixes |
| cleanup.yml | Project menu | Technical debt cleanup |
| verify.yml | VERIFY stage | Test execution + PR creation |
| deploy-preview.yml | Manual | Vercel preview deployment |
| rollback-reset.yml | VERIFY→PLAN | Git reset preserving specs |
| ai-board-assist.yml | @ai-board mention | AI comment assistance |
| iterate.yml | VERIFY stage | Minor fixes during review |

## Required Secrets

- `GH_PAT`: Cross-repo access (repo scope)
- `WORKFLOW_API_TOKEN`: API authentication for job status updates
- `CLAUDE_CODE_OAUTH_TOKEN`: Claude CLI authentication

## Key Patterns

1. **Job Status**: Always update via `PATCH /api/jobs/:id/status` (RUNNING → COMPLETED/FAILED)
2. **Branch Naming**: `{ticket-num}-{description}` or `cleanup-YYYYMMDD`
3. **Parseable Output**: Use `--json` flag for script outputs
4. **Environment**: Set `MERGE_POINT`, `TICKET_KEY` as env vars for commands

## Scripts

`.github/scripts/` contains shell utilities for workflows:
- `setup-test-env.sh`: Prepare test environment
- Always source from workflow, never run standalone
