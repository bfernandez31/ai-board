# Data Model: Project Onboarding — Hybrid Workflow

**Branch**: `AIB-575-project-onboarding-hybrid` | **Date**: 2026-04-08

## Entities

### 1. Analysis Result (New — runtime artifact, not persisted in DB)

Structured detection output produced by Phase 1 `detect-stack.sh`. Written to `analysis.json` in the target repo working directory. Consumed by Phase 2 agent command.

| Field | Type | Description |
|-------|------|-------------|
| `language` | `string \| null` | Primary detected language (e.g., "typescript", "python", "rust") |
| `framework` | `string \| null` | Detected framework (e.g., "nextjs", "django", "rails") |
| `packageManager` | `string \| null` | Detected package manager (e.g., "bun", "poetry", "cargo") |
| `testFramework` | `string \| null` | Detected test framework (e.g., "vitest", "pytest", "rspec") |
| `services` | `Array<{type: string, source: string}>` | Detected services with detection source |
| `commands` | `Record<string, string>` | Extracted commands from manifest/Makefile |
| `manifests` | `string[]` | List of detected manifest file paths |
| `lockfiles` | `string[]` | List of detected lockfile paths |
| `configFiles` | `string[]` | List of detected config file paths (docker-compose, ORM, etc.) |
| `projectName` | `string` | Derived from manifest or directory name |
| `runtimeVersions` | `Record<string, string>` | Detected runtime versions (node, python, java, etc.) |
| `secondaryLanguages` | `string[]` | Additional languages detected besides primary |

**Validation rules**:
- At least `projectName` must be non-null (derived from directory name as fallback)
- All other fields may be null/empty for empty repositories
- `language` value must be a valid `ProjectLanguageSchema` enum value or null
- `framework` value must be a valid `ProjectFrameworkSchema` enum value or null
- `packageManager` value must be a valid `PackageManagerSchema` enum value or null

### 2. Artifact Summary (Existing — stored in `ProjectSetupJob.artifactSummary` JSON)

Extended structure for the `artifactSummary` JSONB field on `ProjectSetupJob`. Previously empty `{}` from the stub workflow.

| Field | Type | Description |
|-------|------|-------------|
| `partial` | `boolean` | `true` if Phase 2 failed but Phase 1 succeeded |
| `errorCode` | `string \| undefined` | Structured error code if any phase failed |
| `commitSha` | `string \| undefined` | Git commit SHA of the generated files |
| `created` | `string[]` | List of file paths successfully created/committed |
| `missing` | `string[]` | List of file paths that should have been created but weren't |
| `preserved` | `string[]` | List of file paths that already existed and were preserved |

**Error codes** (stored in `errorCode` field):
- `DISPATCH_FAILED` — target repo clone/setup failed
- `CONFIG_GENERATION_FAILED` — Phase 1 detection script error
- `GUIDANCE_GENERATION_FAILED` — Phase 2 LLM agent error
- `COMMIT_FAILED` — git commit or push failed

**Validation**: Zod schema on the API already accepts `z.record(z.string(), z.unknown())` — no schema change needed. The structure above is a workflow-side convention.

### 3. Config Schema Extensions (Existing — `lib/validations/config.ts`)

New enum values to add:

| Schema | New Values | Justification |
|--------|-----------|---------------|
| `ProjectLanguageSchema` | `ruby`, `php` | FR-002: detect from Gemfile, composer.json |
| `PackageManagerSchema` | `bundler`, `composer` | FR-003: detect from Gemfile.lock, composer.lock |
| `ProjectFrameworkSchema` | `rails`, `laravel`, `rspec`, `phpunit`, `actix`, `rocket` | FR-004/FR-007: detect from dependency declarations |

**Note on test frameworks as framework values**: The spec lists rspec, phpunit, actix, rocket as framework values. However, rspec and phpunit are test frameworks, not application frameworks. They are included in the `framework` enum for detection purposes since the config schema uses a single `framework` field. The detection script will prioritize application frameworks (rails, laravel) over test frameworks when both are present.

### 4. Generated Files (New — created in target repository)

Files produced by the onboard workflow. Not persisted in the AI Board database — they live in the target repo.

| File | Phase | Condition | Description |
|------|-------|-----------|-------------|
| `.ai-board/config.yml` | 1 | Always created | Schema-validated project configuration |
| `analysis.json` | 1 | Always created | Detection results for Phase 2 context (not committed) |
| `CLAUDE.md` | 2 | Skip if exists | Project-specific AI agent guidance |
| `.ai-board/memory/constitution.md` | 2 | Always created | Governance principles derived from code patterns |
| `AGENTS.md` | 2 | Always created | Symlink → `CLAUDE.md` |

**Idempotency rules** (from Decision 4):
- `config.yml`: Always overwritten (deterministic, reflects current repo state)
- `CLAUDE.md`: Preserved if exists (respects user customizations)
- `constitution.md`: Always regenerated (governance should be fresh)
- `AGENTS.md`: Always recreated (symlink target may change)

## State Transitions

No new database state transitions. The existing `ProjectSetupJob` state machine is sufficient:

```
PENDING → RUNNING → COMPLETED (full or partial success)
                  → FAILED (total failure)
```

The `partial` flag in `artifactSummary` distinguishes full from partial completion — both use COMPLETED status per Decision 2.
