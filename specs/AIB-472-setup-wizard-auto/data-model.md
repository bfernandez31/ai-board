# Data Model: Setup Wizard — Auto-Detection + Questionnaire + File Commit

**Ticket**: AIB-472
**Date**: 2026-04-03

---

## Entities

### 1. DetectionResult (Client-side only — not persisted)

Represents the output of GitHub repo analysis. Each field is optional (best-effort detection).

| Field | Type | Description |
|-------|------|-------------|
| `language` | `Language \| null` | Detected primary language (enum from config schema) |
| `framework` | `Framework \| null` | Detected framework from dependency analysis |
| `manager` | `PackageManager \| null` | Detected package manager from lock files |
| `managerVersion` | `string \| null` | Manager version if detectable |
| `runtimeVersion` | `string \| null` | Language runtime version (e.g., Node 22) |
| `services` | `DetectedService[]` | Detected services (DB, cache, etc.) |
| `testFrameworks` | `string[]` | Detected test framework names |
| `commands` | `Record<string, string>` | Detected commands from package.json scripts |
| `existingFiles` | `ExistingFile[]` | Existing config/CLAUDE/constitution files in repo |

**Relationships**: None (ephemeral, lives in React state)

**Validation**: No validation needed — all fields optional, used as pre-fill hints only.

---

### 2. DetectedService (Embedded in DetectionResult)

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'postgres' \| 'redis' \| 'mysql' \| 'mongo'` | Service type (matches config schema enum) |
| `version` | `string \| null` | Detected version (e.g., "16" for PostgreSQL) |

---

### 3. ExistingFile (Embedded in DetectionResult)

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | File path in repo (e.g., `.ai-board/config.yml`) |
| `content` | `string` | Current file content (decoded from base64) |
| `sha` | `string` | Git blob SHA (needed for update commits) |

---

### 4. SetupWizardState (Client-side only — not persisted)

Represents the user's progress and selections through the 4-step wizard.

| Field | Type | Description |
|-------|------|-------------|
| `step` | `1 \| 2 \| 3 \| 4 \| 'review'` | Current wizard step |
| `stack` | `StackSelection` | Step 1: Language, framework, manager |
| `services` | `ServiceSelection[]` | Step 2: Selected services with versions |
| `commands` | `CommandsSelection` | Step 3: Build/test/lint commands |
| `agent` | `AgentSelection` | Step 4: CLI and model choice |

**Relationships**: None (lives in React state)

**State transitions**: `1 → 2 → 3 → 4 → review → (commit success) → redirect` or `review → (commit fail) → review` (retry with preserved state)

---

### 5. StackSelection (Embedded in SetupWizardState)

| Field | Type | Validation |
|-------|------|------------|
| `language` | `Language` | Required — enum from config schema |
| `framework` | `Framework \| 'none'` | Required — contextual options based on language |
| `manager` | `PackageManager` | Required — enum from config schema |
| `managerVersion` | `string` | Optional |
| `runtimeVersion` | `string` | Optional |

---

### 6. ServiceSelection (Embedded in SetupWizardState)

| Field | Type | Validation |
|-------|------|------------|
| `type` | `'postgres' \| 'redis' \| 'mysql' \| 'mongo'` | Required |
| `version` | `string` | Required — defaults from detection or common defaults |
| `enabled` | `boolean` | Whether user selected this service |

---

### 7. CommandsSelection (Embedded in SetupWizardState)

| Field | Type | Validation |
|-------|------|------------|
| `install` | `string` | Optional |
| `build` | `string` | Optional |
| `lint` | `string` | Optional |
| `type_check` | `string` | Optional |
| `test_unit` | `string` | Optional |
| `test_integration` | `string` | Optional |
| `test_e2e` | `string` | Optional |
| `db_setup` | `string` | Optional |
| `db_seed` | `string` | Optional |

All fields are optional strings — empty strings are omitted from generated config.

---

### 8. AgentSelection (Embedded in SetupWizardState)

| Field | Type | Validation |
|-------|------|------------|
| `cli` | `'claude-code' \| 'codex'` | Required — radio selection |
| `model` | `string` | Required — dropdown from curated list |

---

### 9. GeneratedFile (Client-side — used during review step)

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Target file path in repo |
| `generatedContent` | `string` | Content generated from wizard state |
| `editedContent` | `string` | User-modified content (initialized to generated) |
| `existingContent` | `string \| null` | Current repo content (null if new file) |
| `existingSha` | `string \| null` | Git SHA of existing file (null if new) |
| `skip` | `boolean` | User chose to skip this file (don't commit) |

**Instances**: Exactly 3 per setup:
1. `.ai-board/config.yml`
2. `CLAUDE.md`
3. `.ai-board/constitution.md`

---

## Database Changes

**No schema changes required.** The existing `Project` model already has:
- `config: Json?` — stores the synced config.yml content
- `configSyncedAt: DateTime?` — tracks last sync

The setup wizard writes files to GitHub and then triggers the existing `syncProjectConfig()` flow to populate these fields. No new tables or columns needed.

---

## Enum Reuse

All enums are reused from the existing config validation schema (`lib/validations/config.ts`):

| Enum | Values |
|------|--------|
| `Language` | `typescript`, `javascript`, `python`, `go`, `rust`, `java`, `kotlin` |
| `Framework` | `nextjs`, `express`, `fastapi`, `django`, `flask`, `gin`, `spring-boot`, `quarkus`, `micronaut`, `none` |
| `PackageManager` | `bun`, `npm`, `yarn`, `pnpm`, `pip`, `poetry`, `cargo`, `maven`, `gradle` |
| `ServiceType` | `postgres`, `redis`, `mysql`, `mongo` |
| `AgentCli` | `claude-code`, `codex` |
