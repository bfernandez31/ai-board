# Data Model: Project Setup Page and Hybrid Initialization Workflow

## 1. `ProjectSetupJob` (new persisted model)

**Purpose**: Authoritative project-scoped onboarding run record used by the setup page, workflow callbacks, retry behavior, and completion summaries.

### Proposed fields

| Field | Type | Notes |
|------|------|------|
| `id` | `Int @id @default(autoincrement())` | Primary key |
| `projectId` | `Int` | FK to `Project`, one project can have many historical setup jobs |
| `selectedAgent` | `Agent` | `CLAUDE` or `CODEX`, captured at dispatch time |
| `status` | `ProjectSetupJobStatus` | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| `dispatchKey` | `String? @db.VarChar(100)` | Optional idempotency token or workflow correlation key |
| `workflowRunId` | `BigInt?` | GitHub Actions run id for debugging and duplicate detection |
| `defaultBranch` | `String? @db.VarChar(255)` | Resolved repo default branch used by onboarding |
| `commitSha` | `String? @db.VarChar(40)` | Atomic commit produced on success |
| `analysisSummary` | `Json?` | Structured deterministic detection output |
| `artifactManifest` | `Json?` | Generated/preserved file summary and review metadata |
| `configPreview` | `Json?` | Sanitized generated config preview or sync summary |
| `errorCode` | `String? @db.VarChar(100)` | Stable failure category for retry guidance |
| `errorMessage` | `String? @db.VarChar(2000)` | Latest actionable failure message |
| `startedAt` | `DateTime?` | First transition to `RUNNING` |
| `completedAt` | `DateTime?` | Terminal completion/failure timestamp |
| `createdAt` | `DateTime @default(now())` | Creation time |
| `updatedAt` | `DateTime @updatedAt` | Mutation time |

### Relationships

- `ProjectSetupJob.projectId -> Project.id` with `onDelete: Cascade`
- `Project.setupJobs -> ProjectSetupJob[]` (new relation)

### Validation rules

- Exactly one active setup job (`PENDING` or `RUNNING`) per project at a time.
- `selectedAgent` must be a supported `Agent` enum value.
- `commitSha` is required for `COMPLETED`.
- `errorCode` and `errorMessage` are required for `FAILED`.
- `startedAt` is set once when leaving `PENDING` for `RUNNING`.
- `completedAt` is set only for terminal statuses.

### State transitions

- `PENDING -> RUNNING`
- `RUNNING -> COMPLETED`
- `RUNNING -> FAILED`
- `RUNNING -> CANCELLED`
- `PENDING -> FAILED` if dispatch fails after row creation
- Retry behavior creates a new row; failed jobs are never resumed

## 2. `Project` (existing model, extended usage)

**Purpose in this feature**: Determines whether setup is required and remains the storage location for synced `.ai-board/config.yml`.

### Relevant existing fields

| Field | Existing type | Usage |
|------|------|------|
| `id` | `Int` | Routing and setup ownership key |
| `userId` | `String` | Owner-only setup authorization |
| `githubOwner` / `githubRepo` | `String` | Repository lookup and workflow dispatch target |
| `defaultAgent` | `Agent` | Default suggestion for setup page selection |
| `config` | `Json?` | Synced generated configuration |
| `configSyncedAt` | `DateTime?` | Determines whether setup can be skipped |

### Feature rules

- Setup is required when `config` is null or `configSyncedAt` is null/stale immediately after import, unless a sync proves valid config already exists.
- Once onboarding completes and config sync succeeds, normal board access resumes through existing project routes.
- No additional persistent onboarding flags are required on `Project` if `ProjectSetupJob` plus `config/configSyncedAt` remain authoritative.

## 3. `UserCredential` (existing model, reused)

**Purpose in this feature**: Determines whether the chosen setup agent can be used before dispatch and provides secrets to the workflow.

### Relevant existing fields

| Field | Usage |
|------|------|
| `provider` | Maps `CLAUDE -> ANTHROPIC`, `CODEX -> OPENAI` |
| `credentialType` | Workflow env var mapping |
| `readinessStatus` | Blocks setup start until usable |
| `verificationCode` / `verificationMessage` | Actionable UX guidance |
| `lastVerifiedAt` | Informational detail for setup/readiness UI |

### Feature rules

- Setup start is disabled until the selected agent’s provider credential is present and ready.
- Credential secrets remain inaccessible to browser clients and continue to flow only through workflow-authenticated APIs.

## 4. `OnboardingArtifactSet` (repository-backed aggregate, not a Prisma table)

**Purpose**: The committed files produced or preserved by onboarding.

### Canonical artifact members

| Artifact | Expected location | Notes |
|------|------|------|
| Project config | `.ai-board/config.yml` | Deterministically generated, then synced into `Project.config` |
| Governance file | `.ai-board/memory/constitution.md` or repo governance path | Generated from repository conventions plus baseline governance |
| Primary instruction file | `CLAUDE.md`, `AGENTS.md`, or existing detected primary file | Preserved if it already exists |
| Linked alias file | `AGENTS.md` or selected-agent alias | Symbolic link to the primary instruction file where missing |
| Ignore updates | `.gitignore` | Ensures `.ai-board/` metadata is ignored when needed |
| Analysis summary | `.ai-board/onboarding/analysis-summary.json` or workflow temp artifact | Input to guidance generation and settings review summary |

### Rules

- The repository is the source of truth for artifact contents.
- `ProjectSetupJob.artifactManifest` stores a summary only: path, status (`generated`, `preserved`, `updated`), and review hints.
- Successful onboarding requires these artifact changes to be committed together in one atomic default-branch commit.

## 5. `RepositoryAnalysisSummary` (structured JSON contract)

**Purpose**: Hand-off object from deterministic repository detection to agent-authored guidance generation and UI success summaries.

### Proposed shape

| Field | Type | Notes |
|------|------|------|
| `detectedLanguages` | `string[]` | Evidence-derived language list |
| `frameworks` | `string[]` | Detected frameworks/runtime hints |
| `packageManagers` | `string[]` | `bun`, `npm`, `pnpm`, `poetry`, etc. |
| `commands` | `Record<string, string>` | install/build/lint/test/start/test-type commands |
| `services` | `Array<{ type: string; version?: string; evidence: string[] }>` | Database/cache/service hints |
| `testingSignals` | `string[]` | Vitest/Playwright/Jest/etc. evidence |
| `architectureNotes` | `string[]` | High-signal project structure observations |
| `confidence` | `Record<string, 'high' | 'medium' | 'low'>` | Detection confidence summary |

### Rules

- The summary must be structured enough to drive deterministic config output and agent prompt context without reparsing raw repo state.
- Mixed or incomplete evidence still yields the best valid output rather than blocking unless config generation becomes invalid.

## 6. Derived DTOs for API/UI

### `ProjectSetupState`

- `projectId`
- `requiresSetup`
- `selectedAgentDefault`
- `eligibleAgents[]` with provider mapping and readiness
- `latestSetupJob`
- `redirectTo` when config is already synced

### `ProjectSetupStatus`

- `jobId`
- `status`
- `selectedAgent`
- `elapsedSeconds`
- `startedAt`
- `completedAt`
- `error`
- `artifactManifest`
- `commitSha`

### `OnboardingArtifactDocument`

- `path`
- `kind`
- `status`
- `content`
- `editable`
- `lastCommittedSha`

These DTOs belong in application code rather than Prisma schema, but they define the contract between the setup page, settings review UI, and workflow callbacks.
