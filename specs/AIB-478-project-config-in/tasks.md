# Tasks: Project Config in DB + Dynamic Workflow Dispatch

**Input**: Design documents from `/specs/AIB-478-project-config-in/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/config-sync-api.md, quickstart.md

**Tests**: Included per plan.md testing strategy (unit + integration + component tests specified).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema changes and Prisma client regeneration

- [ ] T001 Add `config Json?` and `configSyncedAt DateTime?` fields to Project model in prisma/schema.prisma
- [ ] T002 Run Prisma migration (`add_project_config_fields`) and regenerate client

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core config sync module and service-input mapping that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create config sync module in lib/config-sync.ts — fetch `.ai-board/config.yml` from GitHub via Octokit `repos.getContent` (follow lib/github/constitution-fetcher.ts pattern), parse YAML, validate via `validateConfig()` from lib/validations/config.ts, strip `env` section, store in `project.config` + update `configSyncedAt` with optimistic locking via Prisma `updateMany`
- [ ] T004 Rewrite `getProjectServiceInputs()` in lib/workflows/service-inputs.ts to read from `project.config` — map `services` array to `needs_{type}`/`{type}_version` pairs, return defaults (PostgreSQL 16) when config is null. NOTE: `package_manager` is NOT a dispatch input (setup-environment.sh reads it from config.yml directly)
- [ ] T004b Centralize ORM setup in .github/scripts/setup-environment.sh — add a post-install phase (or new script) that runs `prisma generate` + `prisma migrate deploy` after dependency installation, using existing `HAS_PRISMA` detection. Remove hardcoded Prisma steps from all workflow YAML files (health-scan.yml, speckit.yml, quick-impl.yml, verify.yml). This ensures non-Prisma projects work without workflow changes.

**Checkpoint**: Foundation ready — config can be fetched, validated, stored, and mapped to service inputs

---

## Phase 3: User Story 1 — Workflow Dispatch with Dynamic Config (Priority: P1) 🎯 MVP

**Goal**: All workflow dispatches use per-project stored config for service inputs, with auto-refresh on stale config and blocking on sync failure.

**Independent Test**: Transition a ticket on a project with stored config and verify the dispatched workflow receives correct service inputs.

### Tests for User Story 1

- [ ] T005 [P] [US1] Create unit tests for config→service-input mapping (with config, without config, no services, multiple services) in tests/unit/service-inputs.test.ts
- [ ] T006 [P] [US1] Create integration tests for staleness check and auto-refresh logic in tests/integration/projects/config-sync.test.ts

### Implementation for User Story 1

- [ ] T007 [US1] Add staleness check + auto-refresh before dispatch in lib/workflows/transition.ts — before each `octokit.actions.createWorkflowDispatch` call, check if `project.configSyncedAt` is null or older than 1 hour; if stale, call config sync inline; if sync fails, block dispatch and surface error
- [ ] T008 [P] [US1] Add staleness check + auto-refresh before dispatch in lib/health/scan-dispatch.ts — same pattern as T007
- [ ] T009 [P] [US1] Add service inputs to AI-board workflow dispatch in app/lib/workflows/dispatch-ai-board.ts — spread `getProjectServiceInputs(project)` into dispatch inputs

**Checkpoint**: All dispatch paths (ticket transitions, health scans, AI-board assist) use dynamic config with auto-refresh. User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 — Config Sync from GitHub (Priority: P2)

**Goal**: Project owners can manually trigger config sync via API endpoint, with validation errors surfaced clearly.

**Independent Test**: Call `POST /api/projects/:projectId/config/sync` on a project with a valid config.yml and verify config is stored in the database.

### Tests for User Story 2

- [ ] T010 [P] [US2] Create integration tests for config sync API endpoint (valid sync, invalid YAML, missing file, GitHub error, unauthorized) in tests/integration/projects/config-sync.test.ts

### Implementation for User Story 2

- [ ] T011 [US2] Create config sync API endpoint at app/api/projects/[projectId]/config/sync/route.ts — POST handler that verifies project access via `verifyProjectAccess`, calls config sync from lib/config-sync.ts, returns stored config + syncedAt + warnings on success, returns validation errors (400), config-not-found (404), or GitHub errors (502) per contracts/config-sync-api.md

**Checkpoint**: Owners can manually sync config and see validation results. User Story 2 is fully functional and testable independently.

---

## Phase 5: User Story 3 — Config Display in Project Settings (Priority: P3)

**Goal**: Project settings shows a read-only formatted display of stored config with last sync timestamp and a sync button.

**Independent Test**: View project settings for a project with stored config and verify the display matches the stored data.

### Tests for User Story 3

- [ ] T012 [P] [US3] Create component test for ConfigCard (with config, without config, sync button interaction) in tests/unit/components/config-card.test.tsx

### Implementation for User Story 3

- [ ] T013 [US3] Create ConfigCard component in components/settings/config-card.tsx — read-only formatted display of runtime (language, framework, package manager), enabled services (with versions), agent config, and last sync timestamp; "Sync config" button that calls POST /api/projects/:projectId/config/sync; empty state prompting sync when no config; follow existing card patterns from components/settings/clarification-policy-card.tsx and components/settings/constitution-card.tsx
- [ ] T014 [US3] Integrate ConfigCard into project settings page — add ConfigCard to the settings layout, passing project data including config and configSyncedAt fields

**Checkpoint**: Owners can view their config and trigger manual sync from the settings UI. User Story 3 is fully functional and testable independently.

---

## Phase 6: User Story 4 — Config Import at Project Creation (Priority: P3)

**Goal**: New projects automatically fetch and store config from their repository during creation.

**Independent Test**: Create a new project pointing to a repository with config.yml and verify the config is automatically stored.

### Implementation for User Story 4

- [ ] T015 [US4] Add non-blocking config auto-import to project creation flow — after project is created in lib/db/projects.ts `createProject()` (or the API handler that calls it), attempt config fetch via lib/config-sync.ts as a fire-and-forget side effect; if fetch fails (no file, API error), project creation still succeeds with null config per research.md Decision 7

**Checkpoint**: New projects automatically have their config imported. User Story 4 is fully functional and testable independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Ensure config fields flow through existing GET responses and verify end-to-end behavior

- [ ] T016 Ensure `config` and `configSyncedAt` fields are included in GET /api/projects/:projectId response in app/api/projects/[projectId]/route.ts (and any project list endpoints) per contracts/config-sync-api.md
- [ ] T017 Run quickstart.md verification checklist — confirm all 9 items pass
- [ ] T018 Run `bun run type-check` and `bun run lint` to ensure no regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma schema + client) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 (service-inputs mapping + config-sync module)
- **User Story 2 (Phase 4)**: Depends on Phase 2 (config-sync module)
- **User Story 3 (Phase 5)**: Depends on Phase 4 (sync API endpoint for the sync button)
- **User Story 4 (Phase 6)**: Depends on Phase 2 (config-sync module)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Phase 2 — no dependencies on other stories
- **User Story 2 (P2)**: After Phase 2 — no dependencies on other stories
- **User Story 3 (P3)**: After User Story 2 (needs sync endpoint for button)
- **User Story 4 (P3)**: After Phase 2 — no dependencies on other stories

### Parallel Opportunities

- T005 and T006 can run in parallel (different test files)
- T007, T008, T009 — T008 and T009 can run in parallel (different files); T007 is independent
- T010 can run in parallel with US1 implementation tasks (different test file)
- T012 can run in parallel with US2 tasks (different test file)
- US1, US2, and US4 can all start in parallel after Phase 2

### Within Each User Story

- Tests before implementation (where applicable)
- Core logic before integration points
- Story complete before moving to next priority

---

## Parallel Example: After Phase 2 Completes

```
# These three tracks can run in parallel:

Track A (US1 - P1):
  T005 + T006 (tests in parallel) → T007 → T008 + T009 (in parallel)

Track B (US2 - P2):
  T010 (test) → T011

Track C (US4 - P3):
  T015

# Then sequentially:
Track D (US3 - depends on US2):
  T012 (test) → T013 → T014

# Finally:
Track E (Polish):
  T016 → T017 → T018
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema migration)
2. Complete Phase 2: Foundational (config-sync + service-inputs)
3. Complete Phase 3: User Story 1 (dispatch integration + auto-refresh)
4. **STOP and VALIDATE**: Test that dispatches use correct dynamic config
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Dynamic dispatch works (MVP!)
3. Add User Story 2 → Manual sync API available
4. Add User Story 3 → Settings UI displays config
5. Add User Story 4 → Auto-import on project creation
6. Polish → Config in GET responses, final validation

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, US1 + US2 + US4 can run in parallel
3. US3 follows after US2 completes (needs sync endpoint)
4. Polish after all stories complete
