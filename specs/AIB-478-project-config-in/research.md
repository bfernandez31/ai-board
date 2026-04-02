# Research: Project Config in DB + Dynamic Workflow Dispatch

**Branch**: `AIB-478-project-config-in` | **Date**: 2026-04-02

## Decision 1: Database Storage Format for Config

- **Decision**: Store parsed config as Prisma `Json?` field on the `Project` model, alongside a `DateTime?` for last sync timestamp
- **Rationale**: Prisma natively supports `Json` type mapped to PostgreSQL `jsonb`. This allows querying config fields directly if needed, while keeping the schema simple. The validated `ProjectConfig` type from Zod ensures type safety at the application layer.
- **Alternatives considered**:
  - Separate normalized tables (one for services, one for runtime, etc.) — rejected because config structure is read-heavy, rarely queried by individual fields, and JSON storage avoids migration churn when config schema evolves
  - Raw YAML string — rejected because it requires parsing on every read and prevents any DB-level querying

## Decision 2: Config Fetch Mechanism

- **Decision**: Reuse the established `octokit.repos.getContent()` pattern with the platform's `GITHUB_TOKEN`, following the same approach as `constitution-fetcher.ts`
- **Rationale**: The codebase already fetches `.ai-board/memory/constitution.md` from target repos using this exact pattern. Config lives at `.ai-board/config.yml` in the same repo. No new auth mechanism needed.
- **Alternatives considered**:
  - User-specific GitHub tokens (BYOK GitHub credential) — rejected for this ticket; the platform token already has read access to target repos. Can be added later if needed for private repos.
  - Git clone + file read — rejected; overkill for a single file fetch

## Decision 3: Config-to-Service-Inputs Mapping

- **Decision**: Map `services` array entries to workflow input flags. Each service type maps to `needs_{type}: 'true'` and `{type}_version: '{version}'`. The `runtime.manager` maps to a `package_manager` input.
- **Rationale**: Workflow YAML files already accept `needs_postgres` and `postgres_version` as inputs. Extending this pattern to other services (redis, mysql, mongo) maintains consistency. Package manager is a new input that workflows need for correct `install` commands.
- **Alternatives considered**:
  - Passing the entire config as a single JSON input — rejected because workflows need flat key-value inputs for GitHub Actions `inputs`
  - Only mapping postgres (status quo) — rejected because the feature spec explicitly requires dynamic service mapping

## Decision 4: Staleness Check and Auto-Refresh

- **Decision**: Check `configSyncedAt` timestamp before dispatch. If null or older than 1 hour, trigger an inline sync (fetch → validate → store) before proceeding. If sync fails, block dispatch with error.
- **Rationale**: Per spec FR-004 and FR-010, stale config must be refreshed, and failed refresh must block dispatch. Inline sync adds ~1-3s latency only when config is actually stale, which is rare in normal operation.
- **Alternatives considered**:
  - Background cron sync — rejected because it doesn't guarantee freshness at dispatch time and adds infrastructure complexity
  - "Last known good" fallback on sync failure — rejected per spec Decision 2 (CONSERVATIVE: block rather than risk wrong config)

## Decision 5: Config Sync API Design

- **Decision**: `POST /api/projects/:projectId/config/sync` — dedicated endpoint rather than extending PATCH on the project route
- **Rationale**: Config sync is an imperative action (fetch from GitHub, validate, store) rather than a simple field update. A dedicated route makes the action explicit, allows specific error responses (validation errors, GitHub API errors), and keeps the project PATCH route focused on simple field updates.
- **Alternatives considered**:
  - PATCH `/api/projects/:id` with `{ action: 'sync-config' }` — rejected because PATCH semantics imply partial updates, not trigger-action operations
  - GET with side effects — rejected as it violates HTTP semantics

## Decision 6: Env Section Handling

- **Decision**: Exclude the `env` section from database storage. Store all other config sections. The `env` section in config.yml is used by workflows at runtime (injected as environment variables) but should not be persisted in the platform DB.
- **Rationale**: The `env` section may contain sensitive values (API keys, connection strings). Storing them in the platform DB creates a security risk. Workflows can read env directly from config.yml at execution time.
- **Alternatives considered**:
  - Store env in encrypted format — rejected because it adds complexity with no clear benefit; workflows already have access to the repo
  - Store env keys only (no values) — considered viable but deferred to avoid scope creep

## Decision 7: Auto-Import at Project Creation

- **Decision**: Attempt config fetch in the project creation flow as a non-blocking side effect. If fetch fails (no file, API error), project creation still succeeds with null config.
- **Rationale**: Per spec US4, auto-import is a convenience feature. Blocking project creation on config availability would be disruptive, especially for new repos that haven't added config.yml yet.
- **Alternatives considered**:
  - Skip auto-import entirely (manual sync only) — rejected because the spec explicitly requires it (FR-009)
  - Background job for import — rejected as overengineering for a single API call

## Decision 8: Concurrency Control for Auto-Refresh

- **Decision**: Use optimistic locking via Prisma's `updateMany` with a `configSyncedAt` condition. Only one refresh will succeed; concurrent requests that lose the race simply re-read the freshly updated config.
- **Rationale**: Per spec edge case, "only one refresh should execute." A DB-level conditional update is simpler and more reliable than application-level mutexes, especially in a serverless environment where multiple instances may process concurrent requests.
- **Alternatives considered**:
  - In-memory lock/mutex — rejected because Next.js can run multiple instances (serverless functions)
  - Redis distributed lock — rejected as overengineering for this use case
