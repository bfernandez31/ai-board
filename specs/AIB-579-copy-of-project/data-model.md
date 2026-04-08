# Data Model: Project Onboarding Hybrid Workflow

## Persisted Entities

### ProjectSetupJob

Existing model in `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`; extend it for onboarding terminal-state reporting.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `id` | `Int` | Yes | Existing primary key |
| `projectId` | `Int` | Yes | Existing relation to `Project` |
| `agent` | `Agent` | Yes | Existing selected onboarding agent |
| `status` | `SetupJobStatus` | Yes | Existing lifecycle: `PENDING -> RUNNING -> COMPLETED/FAILED` |
| `workflowRunId` | `BigInt?` | No | Existing first-write-wins workflow run identifier |
| `errorMessage` | `String?` | No | Existing human-readable failure text |
| `artifactSummary` | `Json?` | No | Existing machine-readable created/preserved/missing summary |
| `startedAt` | `DateTime?` | No | Existing set on first RUNNING callback |
| `completedAt` | `DateTime?` | No | Existing set on terminal callback |
| `partial` | `Boolean` | Yes | New; `true` only when deterministic outputs were committed but guidance generation failed |
| `commitSha` | `String?` | No | New; commit produced by the onboarding workflow on success or partial success |
| `errorCode` | `String?` | No | New; normalized failure category such as `DISPATCH_FAILED`, `CONFIGURATION_GENERATION_FAILED`, `GUIDANCE_GENERATION_FAILED`, `COMMIT_FAILED` |
| `logs` | `String?` | No | New; terminal log tail or structured text summary for setup troubleshooting |
| `createdAt` | `DateTime` | Yes | Existing |
| `updatedAt` | `DateTime` | Yes | Existing |

### Project

No new relation is needed beyond the existing `setupJobs` relation, but onboarding continues to depend on:

| Field | Role in onboarding |
|------|--------------------|
| `githubOwner` + `githubRepo` | Target repository location |
| `config` | Stored validated `.ai-board/config.yml` after sync |
| `configSyncedAt` | Gate for setup redirect and post-onboard readiness |
| `defaultAgent` | Not the onboarding selector source of truth, but still relevant for later project behavior |

## Ephemeral Workflow Models

### RepositoryAnalysisSummary

Typed output of deterministic analysis, stored on disk during the workflow and optionally embedded in logs/artifact summaries, not persisted as its own DB table.

| Field | Type | Notes |
|------|------|-------|
| `primaryLanguage` | enum/string | One of the supported onboarding languages |
| `packageManager` | enum/string | Derived from lockfiles/manifests |
| `framework` | enum/string | Deterministic precedence result |
| `services` | array | Datastores or infrastructure inferred from repo files |
| `commands` | object | `install`, `build`, `lint`, `type_check`, `test_*`, `db_*` when safely inferable |
| `agentCli` | `claude-code` or `codex` | Derived from selected onboarding agent |
| `signals` | array | Evidence explaining the chosen stack interpretation |
| `conflicts` | array | Ambiguous detections resolved by precedence rules |
| `defaultBranch` | string | Branch actually analyzed and committed |

### OnboardingArtifactSummary

Structured payload persisted in `ProjectSetupJob.artifactSummary`.

| Field | Type | Notes |
|------|------|-------|
| `created` | array of artifact records | Files created in this run |
| `preserved` | array of artifact records | Existing protected files left untouched |
| `missing` | array of artifact records | Files intentionally absent because guidance failed or generation was skipped |
| `analysisPath` | string? | Optional path to the repository-analysis summary written during the workflow |
| `partialReason` | string? | Present when `partial=true` |

Artifact record shape:

| Field | Type | Notes |
|------|------|-------|
| `path` | string | Repository-relative artifact path |
| `kind` | string | `config`, `guidance`, `constitution`, `agent-entry`, `command`, `script` |
| `reason` | string? | Why it was preserved or missing |

## Validation Rules

- `status` remains the workflow state machine and does not encode partial completion by itself.
- `partial` may be `true` only when `status = COMPLETED`.
- `commitSha` may be set only when the workflow wrote a repository update.
- `errorCode` is required for terminal failures and absent for full success.
- `artifactSummary.created`, `artifactSummary.preserved`, and `artifactSummary.missing` must always be arrays when present.
- Generated `.ai-board/config.yml` must pass `/home/runner/work/ai-board/ai-board/target/lib/validations/config.ts` before commit.
- Stored config continues to strip `env`, `username`, and `password` fields before DB persistence.

## State Transitions

### Setup Job

| From | To | Conditions |
|------|----|------------|
| `PENDING` | `RUNNING` | Workflow starts and reports run id |
| `RUNNING` | `COMPLETED` | Repo update succeeded; `partial` indicates whether guidance artifacts are missing |
| `RUNNING` | `FAILED` | Deterministic analysis failed, commit failed, or setup/guidance failure produced no usable repository update |
| `COMPLETED` | `COMPLETED` | Idempotent callback retry only |
| `FAILED` | `FAILED` | Idempotent callback retry only |

### Outcome Semantics

| `status` | `partial` | Meaning |
|---------|-----------|---------|
| `COMPLETED` | `false` | Full success |
| `COMPLETED` | `true` | Partial success; deterministic outputs committed, guidance incomplete |
| `FAILED` | `false` | Terminal failure with `errorCode` |

## Schema Impact

Prisma migration required:

1. Add `partial`, `commitSha`, `errorCode`, and `logs` to `ProjectSetupJob`
2. Regenerate Prisma client after schema change

No new top-level tables are required for this feature.
