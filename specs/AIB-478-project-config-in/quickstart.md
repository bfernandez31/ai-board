# Quickstart: Project Config in DB

**Branch**: `AIB-478-project-config-in` | **Date**: 2026-04-02

## Overview

This feature stores project configuration (`.ai-board/config.yml`) in the database and uses it to dynamically generate workflow dispatch inputs. It replaces the hardcoded service inputs with per-project configuration.

## Implementation Order

### Step 1: Database Schema

```bash
# Add config and configSyncedAt fields to Project model
# Edit prisma/schema.prisma, then:
bunx prisma migrate dev --name add_project_config_fields
bunx prisma generate
```

### Step 2: Config Sync Logic (`lib/config-sync.ts`)

New module that:
1. Fetches `.ai-board/config.yml` from GitHub (via Octokit `repos.getContent`)
2. Parses YAML content
3. Validates against `ProjectConfigSchema` (reuse existing `validateConfig`)
4. Strips `env` section
5. Stores in `project.config` + updates `configSyncedAt`

Pattern: Follow `lib/github/constitution-fetcher.ts` for the fetch pattern.

### Step 3: Dynamic Service Inputs (`lib/workflows/service-inputs.ts`)

Replace hardcoded return with:
1. If `project.config` is null → return defaults (PostgreSQL 16)
2. If config exists → map `services` array to `needs_{type}` / `{type}_version` pairs

> **Note**: `package_manager` is NOT a dispatch input. `setup-environment.sh` reads `runtime.manager` directly from the cloned repo's `config.yml`.

### Step 3b: Centralize ORM Setup (`.github/scripts/setup-environment.sh`)

Move Prisma commands out of individual workflow YAML files and into the setup script:
1. Add a post-install function that runs `prisma generate` + `prisma migrate deploy` when `HAS_PRISMA=true`
2. Workflows call `setup-environment.sh --phase post-install` (or similar) after `Install Dependencies`
3. Remove hardcoded `Generate Prisma Client` and `Apply Database Migrations` steps from health-scan.yml, speckit.yml, quick-impl.yml, verify.yml

### Step 4: Auto-Refresh Before Dispatch

In `lib/workflows/transition.ts` (and other dispatch call sites):
1. Before dispatching, check if `project.configSyncedAt` is null or > 1 hour old
2. If stale, call config sync inline
3. If sync fails, block dispatch with error

### Step 5: Config Sync API Endpoint

`POST /api/projects/:projectId/config/sync`:
1. Verify project access
2. Call config sync logic from Step 2
3. Return stored config + validation warnings

### Step 6: Config Display Component

`components/settings/config-card.tsx`:
1. Read-only display of stored config (formatted, not raw YAML)
2. "Sync config" button that calls the sync endpoint
3. Last sync timestamp display
4. Empty state when no config synced

### Step 7: Auto-Import on Project Creation

In the project creation flow, attempt config fetch as non-blocking side effect.

## Key Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `config Json?` and `configSyncedAt DateTime?` to Project |
| `lib/workflows/service-inputs.ts` | Read from project.config, map services→inputs |
| `lib/workflows/transition.ts` | Add staleness check + auto-refresh before dispatch |
| `lib/health/scan-dispatch.ts` | Add staleness check before dispatch |
| `app/lib/workflows/dispatch-ai-board.ts` | Add service inputs to AI-board dispatch |
| `app/api/projects/[projectId]/config/sync/route.ts` | NEW: sync endpoint |
| `components/settings/config-card.tsx` | NEW: config display card |

## Key Files to Create

| File | Purpose |
|------|---------|
| `lib/config-sync.ts` | Fetch + validate + store config from GitHub |
| `app/api/projects/[projectId]/config/sync/route.ts` | API endpoint for manual sync |
| `components/settings/config-card.tsx` | Settings UI component |

## Testing

```bash
# Unit tests for service input mapping
bun run test:unit tests/unit/service-inputs.test.ts

# Integration tests for sync API
bun run test:integration tests/integration/projects/config-sync.test.ts

# Component test for config card
bun run test:unit tests/unit/components/config-card.test.tsx
```

## Verification Checklist

- [ ] `getProjectServiceInputs()` returns correct inputs for projects with config
- [ ] `getProjectServiceInputs()` returns defaults for projects without config
- [ ] Config sync endpoint validates YAML and returns errors for invalid config
- [ ] Config sync endpoint handles missing config.yml gracefully
- [ ] Stale config triggers auto-refresh before dispatch
- [ ] Failed auto-refresh blocks dispatch with clear error
- [ ] Config card displays formatted config data
- [ ] Config card shows empty state for unconfigured projects
- [ ] Existing projects with no config continue working identically
- [ ] No workflow YAML file contains hardcoded ORM commands (prisma generate, prisma migrate)
- [ ] `getProjectServiceInputs()` does NOT return `package_manager` (read by setup script instead)
