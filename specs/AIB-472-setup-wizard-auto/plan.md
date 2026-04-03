# Implementation Plan: Setup Wizard — Auto-Detection + Questionnaire + File Commit

**Ticket**: AIB-472
**Branch**: `AIB-472-setup-wizard-auto`
**Created**: 2026-04-03
**Status**: Ready for Implementation

---

## Technical Context

| Aspect | Detail |
|--------|--------|
| **Feature** | Setup wizard for projects imported without `.ai-board/config.yml` |
| **Page Route** | `/projects/[id]/setup` (new) |
| **API Endpoints** | 2 new: detect + commit |
| **Core Libraries** | 3 new modules: detect, generate, commit |
| **UI Components** | ~10 new components (wizard + steps + preview) |
| **Database Changes** | None — reuses existing `config`/`configSyncedAt` fields |
| **Dependencies** | `js-yaml` (already transitive), `diff` (new, for file comparison) |
| **GitHub API** | Contents API (read), Git Data API (atomic commit), Languages API |

---

## Constitution Check

| Rule | Status | Notes |
|------|--------|-------|
| TypeScript strict mode | PASS | All new code in TypeScript with explicit types |
| shadcn/ui only | PASS | All UI primitives from shadcn/ui (Form, Input, Select, Button, Tabs, Card) |
| Server Components default | PASS | Setup page is server component; wizard is client component (requires interactivity) |
| Zod validation | PASS | API inputs validated with Zod; reuses config schema enums |
| Prisma for DB | PASS | No new schema; reuses existing `syncProjectConfig()` |
| Test-driven | PASS | Integration tests for APIs, component tests for wizard steps |
| Security-first | PASS | Auth on all endpoints; user's GitHub token for repo access; no secrets in responses |
| Optimistic updates | N/A | Wizard is a one-time flow, not a CRUD operation |
| No raw SQL | PASS | No database queries added — delegates to existing config-sync |
| Semantic color tokens | PASS | All styling via Tailwind semantic tokens, no hardcoded colors |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  /projects/[id]/setup (Server Component)                │
│  ├─ Auth guard: redirect if no session                  │
│  ├─ Config guard: redirect to board if config exists    │
│  └─ Renders <SetupWizard projectId={id} />              │
│                                                         │
│  SetupWizard (Client Component)                         │
│  ├─ Step 1: StackStep (language, framework, manager)    │
│  ├─ Step 2: ServicesStep (checkboxes + versions)        │
│  ├─ Step 3: CommandsStep (text fields)                  │
│  ├─ Step 4: AgentStep (CLI + model)                     │
│  └─ Review: FilePreview[] (edit + diff + skip)          │
│       └─ Confirm → POST /setup/commit                   │
│           └─ syncProjectConfig() → redirect to board    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  API Layer                                              │
│  ├─ POST /api/projects/[id]/setup/detect                │
│  │   └─ lib/setup/detect.ts (parallel GitHub API calls) │
│  └─ POST /api/projects/[id]/setup/commit                │
│      ├─ lib/setup/commit.ts (Git Data API: atomic)      │
│      └─ lib/config-sync.ts (existing: DB sync)          │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Types & Detection Logic

**Goal**: Define all types and implement repo auto-detection.

#### Task 1.1: Define types (`lib/setup/types.ts`)

Create TypeScript interfaces for:
- `DetectionResult` — all optional fields for detected stack info
- `DetectedService` — service type + version
- `ExistingFile` — path, content, sha
- `SetupWizardState` — step tracking + all form sections
- `StackSelection`, `ServiceSelection`, `CommandsSelection`, `AgentSelection`
- `GeneratedFile` — path, generated/edited content, existing content, skip flag
- API request/response types for detect and commit endpoints

Reuse enums from `lib/validations/config.ts`.

#### Task 1.2: Implement detection logic (`lib/setup/detect.ts`)

Core function: `detectRepoStack(octokit, owner, repo): Promise<DetectionResult>`

Detectors (all run in parallel via `Promise.allSettled`):
- `detectLanguage()` — `GET /repos/{o}/{r}/languages`, map top language to enum
- `detectFramework()` — read `package.json`/`pyproject.toml`/`Cargo.toml`, match deps
- `detectPackageManager()` — check root file listing for lock files
- `detectRuntimeVersion()` — read `.nvmrc`, `.node-version`, or `engines` in package.json
- `detectServices()` — parse `docker-compose.yml` images + check for `prisma/schema.prisma`
- `detectTestFrameworks()` — check root listing for config files (vitest, jest, pytest, playwright)
- `detectCommands()` — parse `scripts` from package.json
- `fetchExistingFiles()` — try to read the 3 target file paths, collect content + SHA

Each detector catches its own errors and returns `null`/`[]` on failure.

#### Task 1.3: Detection API route (`app/api/projects/[projectId]/setup/detect/route.ts`)

- Auth: `requireAuth()` + `verifyProjectAccess()`
- Create user GitHub client via `createUserGitHubClient(userId)`
- Fetch project's default branch via `GET /repos/{o}/{r}`
- Call `detectRepoStack()`
- Return `DetectResponse`

---

### Phase 2: File Generation & Commit

**Goal**: Generate config files from wizard state and commit atomically.

#### Task 2.1: File generators (`lib/setup/generate.ts`)

Three functions:
- `generateConfigYaml(state: SetupWizardState): string` — serialize to YAML using `js-yaml`
- `generateClaudeMd(state: SetupWizardState, projectName: string): string` — markdown template
- `generateConstitutionMd(): string` — default constitution template

Config YAML must match the schema in `lib/validations/config.ts`. Validate generated config via `validateConfig()` before returning.

CLAUDE.md template (from design doc Section 6):
```markdown
# {Project Name} Development Guidelines

## Tech Stack
- **Language**: {language}
- **Framework**: {framework}
- **Database**: {services list}
- **Testing**: {test frameworks}
- **Package Manager**: {manager}

## Commands
{each command as: `{key}`: `{value}`}

## Data Models
{if services include postgres: "Read `prisma/schema.prisma` for all models."}

## Testing
{instructions based on detected test frameworks}
```

Constitution template: default principles from design doc Section 6.

#### Task 2.2: Atomic commit helper (`lib/setup/commit.ts`)

Function: `commitSetupFiles(octokit, owner, repo, branch, files): Promise<CommitResult>`

Implementation using GitHub Git Data API:
1. `git.getRef()` — get latest commit SHA on default branch
2. `git.getCommit()` — get base tree SHA
3. `git.createTree()` — create new tree with all files (handling both new and updated files)
4. `git.createCommit()` — create commit with message `chore: initialize ai-board configuration`
5. `git.updateRef()` — point branch to new commit

Error handling:
- 409 conflict → `SHA_MISMATCH` error code
- 403/404 → `INSUFFICIENT_PERMISSIONS` or `BRANCH_PROTECTED`
- Map GitHub API errors to user-friendly messages

#### Task 2.3: Commit API route (`app/api/projects/[projectId]/setup/commit/route.ts`)

- Auth: `requireAuth()` + `verifyProjectAccess()`
- Validate request body with Zod (files array, paths, content)
- Create user GitHub client
- Call `commitSetupFiles()`
- On success: call `syncProjectConfig(project)` to store config in DB
- Return commit SHA, URL, and sync result

---

### Phase 3: Setup Page & Wizard UI

**Goal**: Build the 4-step wizard with pre-filled detection results.

#### Task 3.1: Setup page (`app/projects/[projectId]/setup/page.tsx`)

Server component:
- Verify auth (redirect to login if no session)
- Fetch project from DB
- If `project.config` exists → redirect to `/projects/{projectId}`
- Render `<SetupWizard projectId={projectId} />`

#### Task 3.2: Wizard container (`components/setup/setup-wizard.tsx`)

Client component managing:
- Detection query via `useMutation` (runs on mount)
- Wizard state (`useState<SetupWizardState>`)
- Step navigation (next/back)
- Pre-fill form from detection results
- Loading state during detection
- Error state with retry

#### Task 3.3: Step 1 — Stack (`components/setup/steps/stack-step.tsx`)

Form fields:
- Language: `<Select>` with options from config schema `Language` enum
- Framework: `<Select>` with contextual options (filtered by language)
- Package Manager: `<Select>` with options from config schema
- Runtime Version: `<Input>` (optional, text field)

Framework→Language mapping:
- TypeScript/JavaScript: Next.js, Express, none
- Python: FastAPI, Django, Flask, none
- Go: Gin, none
- Java/Kotlin: Spring Boot, Quarkus, Micronaut, none
- Rust: none

#### Task 3.4: Step 2 — Services (`components/setup/steps/services-step.tsx`)

For each service type (PostgreSQL, MySQL, Redis, MongoDB):
- Checkbox to enable/disable
- Version input (text field, shown when enabled)
- Pre-filled from detection

#### Task 3.5: Step 3 — Commands (`components/setup/steps/commands-step.tsx`)

Text fields for each command key:
- install, build, lint, type_check, test_unit, test_integration, test_e2e, db_setup, db_seed
- Pre-filled from detected `package.json` scripts
- Empty fields are omitted from generated config

#### Task 3.6: Step 4 — Agent (`components/setup/steps/agent-step.tsx`)

- CLI: Radio group (`claude-code` / `codex`)
- Model: `<Select>` with curated model list (static, from config schema)
- Default: `claude-code` + `claude-sonnet-4-6`

---

### Phase 4: Review & Commit UI

**Goal**: Preview generated files with editing, diff view, and commit action.

#### Task 4.1: Review step (`components/setup/review-step.tsx`)

Orchestrates 3 `FilePreview` instances:
- Generates file content from wizard state via `generateConfigYaml()`, `generateClaudeMd()`, `generateConstitutionMd()`
- Passes existing file content (if any) for diff
- Handles skip toggles
- "Commit to repository" button triggers commit mutation
- Error display with retry capability
- Loading state during commit

#### Task 4.2: File preview component (`components/setup/file-preview.tsx`)

Per-file display:
- File path header
- Syntax-highlighted code editor (`<textarea>` with monospace font or shadcn `<Textarea>`)
- Edit toggle (read-only by default, edit on click)
- For existing files: toggle between "Preview" and "Diff" views

#### Task 4.3: File diff component (`components/setup/file-diff.tsx`)

Simple side-by-side or unified diff view:
- Shows current (existing) vs new (generated/edited) content
- Line-by-line comparison with add/remove highlighting
- "Skip this file" checkbox

#### Task 4.4: Post-commit redirect

After successful commit:
- Show brief success message
- Redirect to `/projects/{projectId}` (project board)
- Use `router.push()` with a small delay for feedback

---

### Phase 5: Testing

#### Task 5.1: Integration tests for detection API

**File**: `tests/integration/setup/detect.test.ts`

Test scenarios:
- Successful detection with full results
- Partial detection (some API calls fail gracefully)
- Auth required (401 without session)
- Project access required (403 for non-member)
- GitHub API error handling (502)

Mock GitHub API responses for deterministic testing.

#### Task 5.2: Integration tests for commit API

**File**: `tests/integration/setup/commit.test.ts`

Test scenarios:
- Successful atomic commit of 3 files
- Successful commit with some files skipped
- Validation errors (empty content, invalid paths)
- Auth/access checks
- Config sync after commit

#### Task 5.3: Component tests for wizard steps

**File**: `tests/unit/components/setup/setup-wizard.test.tsx`

Test scenarios:
- Wizard renders with detection results pre-filled
- Step navigation (next/back)
- Form validation per step
- Review step shows generated files
- Commit button triggers mutation

Use `renderWithProviders()` pattern from existing component tests.

#### Task 5.4: Component tests for file preview

**File**: `tests/unit/components/setup/file-preview.test.tsx`

Test scenarios:
- Renders generated content
- Inline editing updates content
- Diff view for existing files
- Skip toggle behavior

---

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|------------|-----------|----------|-----------|
| US1: Complete wizard flow | Integration | `tests/integration/setup/` | API + DB operations, no browser needed |
| US2: Auto-detection accuracy | Integration | `tests/integration/setup/detect.test.ts` | Tests API logic with mocked GitHub responses |
| US3: File preview + editing | Component | `tests/unit/components/setup/` | React component with user interactions |
| US4: Existing files handling | Integration + Component | Both | API returns existing files; UI shows diff |
| US5: Error handling | Integration | `tests/integration/setup/commit.test.ts` | Tests error codes and retry behavior |

**Test count estimate**: ~15 integration tests, ~12 component tests

**No E2E tests**: The wizard is a standard form flow — no browser-specific features (no OAuth, no drag-drop, no viewport-dependent behavior). Integration + component tests provide full coverage.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Branch protection blocks commit | Medium | Low | Clear error message with resolution steps (FR-012) |
| GitHub API rate limiting during detection | Low | Low | `Promise.allSettled` ensures partial results; warning banner |
| Concurrent setup by multiple users | Low | Low | SHA mismatch detection with retry guidance |
| Token lacks write scope | Low | Medium | Pre-check via `requireRepoScope()` before wizard loads |
| Large repo slows detection | Low | Low | Detection only reads specific files, not full tree |

---

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| `lib/validations/config.ts` | Existing | Reuse enums and `validateConfig()` |
| `lib/config-sync.ts` | Existing | Reuse `syncProjectConfig()` after commit |
| `lib/github/user-client.ts` | Existing | Reuse `createUserGitHubClient()` |
| `lib/db/auth-helpers.ts` | Existing | Reuse `verifyProjectAccess()` |
| `js-yaml` | Existing (transitive) | YAML serialization for config.yml |
| `diff` | New (npm) | Lightweight diff library for file comparison |
| shadcn/ui components | Existing | Form, Select, Input, Textarea, Button, Card, Tabs, Badge |

---

## Design Artifacts

| Artifact | Path |
|----------|------|
| Feature Spec | `specs/AIB-472-setup-wizard-auto/spec.md` |
| Research | `specs/AIB-472-setup-wizard-auto/research.md` |
| Data Model | `specs/AIB-472-setup-wizard-auto/data-model.md` |
| API Contracts | `specs/AIB-472-setup-wizard-auto/contracts/` |
| Quickstart | `specs/AIB-472-setup-wizard-auto/quickstart.md` |
| This Plan | `specs/AIB-472-setup-wizard-auto/plan.md` |
