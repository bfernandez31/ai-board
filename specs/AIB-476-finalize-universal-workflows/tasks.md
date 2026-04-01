# Tasks: Finalize Universal Workflows — run-command.sh + Conditional Services

**Input**: Design documents from `/specs/AIB-476-finalize-universal-workflows/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests for run-command.sh are included per plan.md testing strategy.

**Organization**: Tasks grouped by user story. Note: workflow files are updated once per file with all changes (run-command.sh, services, phase-aware setup) but tagged to the primary story they serve.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No project initialization needed — this feature adds/modifies scripts and workflow YAML in existing directories.

*Phase skipped — no new directories or dependencies required.*

---

## Phase 2: Foundational (Core Scripts)

**Purpose**: Create and modify the shell scripts that ALL workflow updates depend on. MUST complete before any user story phase.

**CRITICAL**: No workflow modifications can begin until both scripts are ready.

- [x] T001 Create `.github/scripts/run-command.sh` — config-driven command executor that reads `.ai-board/config.yml`, looks up command key via yq, and executes in target directory. Must handle: missing config (exit 0), missing key (exit 0), invalid YAML (exit 1), command execution with exit code passthrough. Include yq bootstrap logic. See `specs/AIB-476-finalize-universal-workflows/contracts/run-command-sh.md` for full contract.
- [x] T002 Modify `.github/scripts/setup-environment.sh` — add `--phase <lightweight|full>` parameter (default: `full`). Lightweight phase: yq bootstrap, config validation, package manager install, symlinks, partial validation. Full phase: all lightweight steps plus dependency install, agent CLI, env export, Prisma detection, Playwright detection, full validation. Reject unrecognized phase values with error. See `specs/AIB-476-finalize-universal-workflows/contracts/setup-environment-sh.md` for full contract.

**Checkpoint**: Both scripts ready and backward-compatible. Workflow updates can now begin.

---

## Phase 3: User Story 1 — External Project Runs Build Workflow with Custom Stack (Priority: P1)

**Goal**: `run-command.sh` correctly reads and executes project-specific commands from `.ai-board/config.yml`, enabling non-bun stacks to use ai-board workflows.

**Independent Test**: Create mock config.yml files with custom commands and verify run-command.sh executes the correct command for each key, handles missing config/keys gracefully, and propagates exit codes.

### Tests for User Story 1

- [x] T003 [US1] Create unit test file `tests/unit/scripts/run-command.test.ts` — test cases: (1) missing config.yml exits 0, (2) missing command key exits 0, (3) valid command executes and returns exit code, (4) invalid YAML exits 1, (5) missing arguments exits 1. Use Vitest with child_process.execSync to spawn the shell script.

### Implementation for User Story 1

- [x] T004 [US1] Update `.github/workflows/speckit.yml` — replace hardcoded `bun install --frozen-lockfile` with `ai-board/.github/scripts/run-command.sh target install`. For the implement job, replace project commands (install) with run-command.sh calls. Keep Prisma/Playwright infrastructure commands hardcoded. Add `setup-environment.sh target --phase lightweight` for specify/plan steps and `setup-environment.sh target --phase full` for implement steps. Use `ai-board/` workspace-root-relative paths per FR-010.
- [x] T005 [P] [US1] Update `.github/workflows/quick-impl.yml` — replace hardcoded install command with `ai-board/.github/scripts/run-command.sh target install`. Add `setup-environment.sh target --phase full` call. Keep Prisma/Playwright commands hardcoded. Use `ai-board/` prefix paths.
- [x] T006 [P] [US1] Update `.github/workflows/verify.yml` — replace hardcoded `bun install --frozen-lockfile` with `run-command.sh target install`, `bun run test:unit` with `run-command.sh target test_unit`, `npx playwright test` with `run-command.sh target test_e2e`. Add `setup-environment.sh target --phase full`. Keep Prisma/Playwright infrastructure setup hardcoded.
- [x] T007 [P] [US1] Update `.github/workflows/health-scan.yml` — replace hardcoded install with `run-command.sh target install`. Use `setup-environment.sh target --phase full` for TESTS scan type, `--phase lightweight` for others. Keep infrastructure commands hardcoded.
- [x] T008 [P] [US1] Update `.github/workflows/ai-board-assist.yml` — replace implicit bun commands with `run-command.sh` calls where applicable. Add `setup-environment.sh target --phase lightweight` call.

**Checkpoint**: All 6 workflows use run-command.sh for project commands. An external project with custom config.yml can execute workflows.

---

## Phase 4: User Story 2 — AI-Board Self-Management Continues Working (Priority: P1)

**Goal**: Verify that all workflow changes are backward-compatible with ai-board's own `.ai-board/config.yml` and existing bun-based commands.

**Independent Test**: Confirm ai-board's config.yml has all required command keys and that workflow steps resolve correctly for self-management.

### Implementation for User Story 2

- [x] T009 [US2] Validate ai-board's `.ai-board/config.yml` contains all command keys referenced by run-command.sh (`install`, `build`, `lint`, `type_check`, `test_unit`, `test_integration`, `test_e2e`). Add any missing keys. No modifications if all keys present.
- [x] T010 [US2] Update `.github/workflows/iterate.yml` — add `ai-board/.github/scripts/setup-environment.sh target --phase lightweight` call for environment setup. This workflow currently has no setup-environment.sh call.

**Checkpoint**: AI-board self-management workflows are verified compatible. Existing config.yml works with all updated workflows.

---

## Phase 5: User Story 3 — Workflow with Conditional Database Service (Priority: P2)

**Goal**: Workflows accept service container inputs (`needs_postgres`, `needs_redis`, `needs_mysql`, `needs_mongo`) and only provision containers when requested.

**Independent Test**: Inspect workflow YAML to confirm service definitions use conditional image expressions and that unused services have empty image strings.

### Implementation for User Story 3

- [x] T011 [US3] Add conditional service inputs and service container definitions to `.github/workflows/speckit.yml` — add 8 inputs (`needs_postgres`, `needs_redis`, `needs_mysql`, `needs_mongo` + version inputs) and conditional `services:` block using empty-image-string pattern per `specs/AIB-476-finalize-universal-workflows/contracts/workflow-service-inputs.md`.
- [x] T012 [P] [US3] Add conditional service inputs and service container definitions to `.github/workflows/quick-impl.yml` — same input schema and services block as speckit.yml.
- [x] T013 [P] [US3] Add conditional service inputs and service container definitions to `.github/workflows/verify.yml` — same input schema and services block as speckit.yml.
- [x] T014 [P] [US3] Add conditional service inputs and service container definitions to `.github/workflows/health-scan.yml` — same input schema and services block as speckit.yml. Services only needed for TESTS scan type.

**Checkpoint**: All 4 test-capable workflows accept service inputs. Containers only start when `needs_*` is true. Zero overhead when false.

---

## Phase 6: User Story 4 — Lightweight Phase Skips Heavy Setup (Priority: P2)

**Goal**: Specify/plan phases use lightweight setup (symlinks + runtime only); implement/verify/build phases use full setup. No unnecessary dependency installs for non-code-execution phases.

**Independent Test**: Review workflow YAML to confirm specify/plan steps call `setup-environment.sh --phase lightweight` and implement/verify steps call `--phase full`.

### Implementation for User Story 4

- [x] T015 [US4] Verify all `setup-environment.sh` calls in updated workflows use correct phase parameter — specify/plan steps: `--phase lightweight`; implement/build/verify/health-scan-TESTS steps: `--phase full`; iterate/assist steps: `--phase lightweight`. Fix any mismatches found during review of T004-T008 and T010 changes.

**Checkpoint**: Phase-aware setup confirmed across all workflows. Specify/plan phases skip dependency install, Prisma, and Playwright.

---

## Phase 7: User Story 5 — Backward Compatibility for Repos Without Config (Priority: P3)

**Goal**: Workflows complete without errors when target repository has no `.ai-board/config.yml`.

**Independent Test**: The run-command.sh unit tests (T003) already validate exit 0 for missing config. This phase ensures the full workflow path handles missing config gracefully.

### Implementation for User Story 5

- [x] T016 [US5] Verify run-command.sh handles missing config by reviewing T001 implementation — confirm silent exit 0 behavior with no stderr output when `.ai-board/config.yml` is absent.
- [x] T017 [US5] Verify setup-environment.sh handles missing config appropriately — per contract, setup-environment.sh requires config (exit 1 if missing), which is correct since setup is only called when a project is onboarded. Confirm this distinction from run-command.sh is documented in script header comments.

**Checkpoint**: Backward compatibility confirmed. Repos without config trigger graceful no-ops for project commands.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all changes

- [x] T018 [P] Verify all script references in workflow YAML files use `ai-board/` workspace-root-relative paths (NOT `../ai-board/`) per FR-010
- [x] T019 [P] Verify bun cache step is preserved in `.github/workflows/speckit.yml` per FR-012
- [x] T020 [P] Verify execution order is preserved in all workflows: symlinks → runtime → deps → dependency detection → Prisma → Playwright per FR-011
- [x] T021 Run `bun run type-check` and `bun run lint` to ensure no regressions
- [x] T022 Run `bun run test:unit tests/unit/scripts/run-command.test.ts` to confirm all tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories.
- **US1 (Phase 3)**: Depends on Phase 2 completion (scripts must exist before workflow updates)
- **US2 (Phase 4)**: Depends on Phase 3 (validate after workflows are updated)
- **US3 (Phase 5)**: Depends on Phase 2. Can run in parallel with Phase 3 (different sections of same files)
- **US4 (Phase 6)**: Depends on Phases 3-5 (verify after all workflow changes)
- **US5 (Phase 7)**: Depends on Phase 2 (validate script behavior)
- **Polish (Phase 8)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only. Core deliverable.
- **US2 (P1)**: Depends on US1 workflow updates being complete. Validation-focused.
- **US3 (P2)**: Independent of US1/US2 (different YAML sections). Can parallelize with US1.
- **US4 (P2)**: Depends on US1 (phase calls added during workflow updates). Verification-focused.
- **US5 (P3)**: Independent — validates foundational script behavior. Can parallelize with US1.

### Within Each User Story

- Tests (T003) written and verified before implementation
- Scripts (T001, T002) before workflow modifications
- Pattern workflow (speckit.yml) before applying to remaining workflows
- Validate after each workflow update

### Parallel Opportunities

- **Phase 2**: T001 and T002 can run in parallel (different files)
- **Phase 3**: T005, T006, T007, T008 can run in parallel after T004 establishes the pattern
- **Phase 5**: T012, T013, T014 can run in parallel (different workflow files)
- **Phase 8**: T018, T019, T020 can run in parallel (independent validations)

---

## Parallel Example: User Story 1 Workflow Updates

```bash
# First, establish the pattern with speckit.yml:
Task T004: Update speckit.yml (pattern workflow)

# Then, apply pattern in parallel to remaining workflows:
Task T005: Update quick-impl.yml     [P]
Task T006: Update verify.yml         [P]
Task T007: Update health-scan.yml    [P]
Task T008: Update ai-board-assist.yml [P]
```

## Parallel Example: User Story 3 Service Inputs

```bash
# First, establish pattern with speckit.yml:
Task T011: Add service inputs to speckit.yml

# Then, apply in parallel:
Task T012: Add service inputs to quick-impl.yml  [P]
Task T013: Add service inputs to verify.yml      [P]
Task T014: Add service inputs to health-scan.yml  [P]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (run-command.sh + setup-environment.sh)
2. Complete Phase 3: US1 tests + speckit.yml update
3. **STOP and VALIDATE**: Test run-command.sh unit tests, verify speckit.yml works
4. This alone enables external projects to use the build workflow

### Incremental Delivery

1. Phase 2 → Scripts ready
2. Phase 3 (US1) → External projects can use build workflow (MVP!)
3. Phase 4 (US2) → Self-management validated
4. Phase 5 (US3) → Conditional services available
5. Phase 6 (US4) → Phase optimization confirmed
6. Phase 7 (US5) → Backward compat validated
7. Phase 8 → Final polish

### Parallel Execution Strategy

1. Complete Phase 2 sequentially (T001 ‖ T002)
2. After Phase 2, run in parallel:
   - US1 workflow updates (T004 → T005‖T006‖T007‖T008)
   - US5 validation (T016, T017)
3. After US1, run in parallel:
   - US2 validation (T009, T010)
   - US3 service inputs (T011 → T012‖T013‖T014)
4. After all stories: US4 verification (T015) + Polish (T018‖T019‖T020, T021, T022)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Workflow files are modified once with all changes but tasks are tagged to primary story
- Infrastructure commands (Prisma generate, Playwright install) stay hardcoded per spec Decision 3
- All paths use `ai-board/` prefix per FR-010
- Commit after each task or logical group
- Stop at any checkpoint to validate independently
