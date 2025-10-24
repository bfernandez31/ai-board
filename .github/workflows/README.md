# GitHub Workflows - ARCHIVED

## Migration to V2 Worker Architecture

As of this commit, AI Board has migrated from GitHub Actions to a local worker queue architecture using BullMQ and Redis.

### Why the Migration?

- **Platform Independence**: No longer tied to GitHub Actions
- **Local Development**: Full workflow execution on localhost
- **Performance**: 85% faster with workspace caching (3-5s vs 20-40s)
- **Cost**: More predictable costs (~$15-30/month vs GitHub Actions minutes)
- **Control**: Direct control over execution environment

### Archived Workflows

The following workflows have been moved to `./archived/`:

1. **speckit.yml** - Replaced by worker queue handling `specify`, `plan`, `implement` commands
2. **quick-impl.yml** - Replaced by worker queue handling `quick-impl` command
3. **ai-board-assist.yml** - Replaced by worker queue handling `comment-*` commands

### New Architecture

Instead of GitHub Actions, workflows are now processed by:

- **Queue**: BullMQ with Redis for job persistence
- **Worker**: Containerized Bun service that processes jobs
- **API**: Enqueues jobs instead of dispatching GitHub workflows

See `/worker/README.md` for details on the new worker architecture.

### Rollback Instructions

If you need to rollback to GitHub Actions:

1. Move workflows back: `mv archived/*.yml ../`
2. Revert `app/lib/workflows/transition.ts` to use GitHub dispatch
3. Revert `app/lib/workflows/dispatch-ai-board.ts` to use Octokit
4. Remove worker queue dependencies from package.json

### Migration Date

- **Date**: October 24, 2024
- **Branch**: feature/v2-worker-architecture
- **Commit**: See git history for details