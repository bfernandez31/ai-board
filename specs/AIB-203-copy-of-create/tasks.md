# Tasks: AI-Board Claude Code Plugin Package

**Input**: Design documents from `/specs/AIB-203-copy-of-create/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Integration tests for plugin installation, unit tests for path resolution utilities (per spec.md requirements).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create plugin directory structure and configuration files

- [x] T001 Create plugin manifest directory at .claude-plugin/
- [x] T002 Create plugin.json manifest at .claude-plugin/plugin.json with schema from contracts/plugin-manifest.schema.json
- [x] T003 [P] Create hooks directory at hooks/
- [x] T004 [P] Create hooks.json configuration at hooks/hooks.json with schema from contracts/hooks.schema.json
- [x] T005 [P] Create commands directory at commands/
- [x] T006 [P] Create scripts directory at scripts/
- [x] T007 [P] Create scripts/bash directory at scripts/bash/
- [x] T008 [P] Create templates directory at templates/
- [x] T009 [P] Create skills directory at skills/
- [x] T010 [P] Create memory directory at memory/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add path resolution utilities and constitution setup that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T011 Add get_plugin_root() function to .specify/scripts/bash/common.sh for dual-mode path resolution (plugin vs standalone)
- [x] T012 Create setup-constitution.sh script at scripts/bash/setup-constitution.sh for post-install hook (copies constitution.md only if target doesn't exist)
- [x] T013 Copy constitution.md template to memory/constitution.md from .specify/memory/constitution.md

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Install AI-Board Plugin on Managed Project (Priority: P1) MVP

**Goal**: Package all ai-board components (commands, scripts, templates, skills, memory, hooks) so plugin installation makes all resources available

**Independent Test**: Run plugin installation on a fresh project and verify all expected files and commands are available

### Tests for User Story 1

- [ ] T014 [P] [US1] Create unit test for get_plugin_root() path resolution in tests/unit/plugin/path-resolution.test.ts
- [ ] T015 [P] [US1] Create integration test for plugin installation validation in tests/integration/plugin/installation.test.ts

### Implementation for User Story 1

**Copy Scripts (10 bash + 3 JS):**

- [ ] T016 [P] [US1] Copy common.sh to scripts/bash/common.sh (with get_plugin_root function already added)
- [ ] T017 [P] [US1] Copy create-new-feature.sh to scripts/bash/create-new-feature.sh
- [ ] T018 [P] [US1] Copy check-prerequisites.sh to scripts/bash/check-prerequisites.sh
- [ ] T019 [P] [US1] Copy setup-plan.sh to scripts/bash/setup-plan.sh
- [ ] T020 [P] [US1] Copy create-pr-and-transition.sh to scripts/bash/create-pr-and-transition.sh
- [ ] T021 [P] [US1] Copy create-pr-only.sh to scripts/bash/create-pr-only.sh
- [ ] T022 [P] [US1] Copy prepare-images.sh to scripts/bash/prepare-images.sh
- [ ] T023 [P] [US1] Copy detect-incomplete-implementation.sh to scripts/bash/detect-incomplete-implementation.sh
- [ ] T024 [P] [US1] Copy auto-ship-tickets.sh to scripts/bash/auto-ship-tickets.sh
- [ ] T025 [P] [US1] Copy transition-to-verify.sh to scripts/bash/transition-to-verify.sh
- [ ] T026 [P] [US1] Copy update-agent-context.sh to scripts/bash/update-agent-context.sh
- [ ] T027 [P] [US1] Copy analyze-slow-tests.js to scripts/analyze-slow-tests.js
- [ ] T028 [P] [US1] Copy analyze-test-duplicates.js to scripts/analyze-test-duplicates.js
- [ ] T029 [P] [US1] Copy generate-test-report.js to scripts/generate-test-report.js

**Copy Templates (6 files):**

- [ ] T030 [P] [US1] Copy spec-template.md to templates/spec-template.md
- [ ] T031 [P] [US1] Copy plan-template.md to templates/plan-template.md
- [ ] T032 [P] [US1] Copy tasks-template.md to templates/tasks-template.md
- [ ] T033 [P] [US1] Copy checklist-template.md to templates/checklist-template.md
- [ ] T034 [P] [US1] Copy summary-template.md to templates/summary-template.md
- [ ] T035 [P] [US1] Copy agent-file-template.md to templates/agent-file-template.md

**Copy Skills (testing skill):**

- [ ] T036 [P] [US1] Copy testing skill directory to skills/testing/ including SKILL.md and patterns/

**Checkpoint**: User Story 1 complete - plugin installation creates all expected files and directories

---

## Phase 4: User Story 2 - Execute AI-Board Commands via Plugin (Priority: P2)

**Goal**: All commands resolve scripts and templates using ${CLAUDE_PLUGIN_ROOT} for portable path resolution

**Independent Test**: Invoke each ai-board command and verify it completes without path resolution errors

### Implementation for User Story 2

**Create Renamed Commands (16 command files):**

- [ ] T037 [P] [US2] Create ai-board.specify.md at commands/ai-board.specify.md (copy from .claude/commands/speckit.specify.md, rename namespace, update paths to ${CLAUDE_PLUGIN_ROOT})
- [ ] T038 [P] [US2] Create ai-board.clarify.md at commands/ai-board.clarify.md (copy from .claude/commands/speckit.clarify.md, rename namespace, update paths)
- [ ] T039 [P] [US2] Create ai-board.plan.md at commands/ai-board.plan.md (copy from .claude/commands/speckit.plan.md, rename namespace, update paths)
- [ ] T040 [P] [US2] Create ai-board.tasks.md at commands/ai-board.tasks.md (copy from .claude/commands/speckit.tasks.md, rename namespace, update paths)
- [ ] T041 [P] [US2] Create ai-board.implement.md at commands/ai-board.implement.md (copy from .claude/commands/speckit.implement.md, rename namespace, update paths)
- [ ] T042 [P] [US2] Create ai-board.checklist.md at commands/ai-board.checklist.md (copy from .claude/commands/speckit.checklist.md, rename namespace, update paths)
- [ ] T043 [P] [US2] Create ai-board.analyze.md at commands/ai-board.analyze.md (copy from .claude/commands/speckit.analyze.md, rename namespace, update paths)
- [ ] T044 [P] [US2] Create ai-board.constitution.md at commands/ai-board.constitution.md (copy from .claude/commands/speckit.constitution.md, rename namespace, update paths)
- [ ] T045 [P] [US2] Create ai-board.quick-impl.md at commands/ai-board.quick-impl.md (copy from .claude/commands/quick-impl.md, rename namespace, update paths)
- [ ] T046 [P] [US2] Create ai-board.cleanup.md at commands/ai-board.cleanup.md (copy from .claude/commands/cleanup.md, rename namespace, update paths)
- [ ] T047 [P] [US2] Create ai-board.verify.md at commands/ai-board.verify.md (copy from .claude/commands/verify.md, rename namespace, update paths)
- [ ] T048 [P] [US2] Create ai-board.iterate-verify.md at commands/ai-board.iterate-verify.md (copy from .claude/commands/iterate-verify.md, rename namespace, update paths)
- [ ] T049 [P] [US2] Create ai-board.code-review.md at commands/ai-board.code-review.md (copy from .claude/commands/code-review.md, rename namespace, update paths)
- [ ] T050 [P] [US2] Create ai-board.code-simplifier.md at commands/ai-board.code-simplifier.md (copy from .claude/commands/code-simplifier.md, rename namespace, update paths)
- [ ] T051 [P] [US2] Create ai-board.compare.md at commands/ai-board.compare.md (copy from .claude/commands/compare.md, rename namespace, update paths)
- [ ] T052 [P] [US2] Create ai-board.sync-specifications.md at commands/ai-board.sync-specifications.md (copy from .claude/commands/sync-specifications.md, rename namespace, update paths)

**Update Internal Command Cross-References in all created commands:**

- [ ] T053 [US2] Update internal command cross-references in all 16 commands (change /speckit.* to /ai-board.*, /quick-impl to /ai-board.quick-impl, etc.)

**Checkpoint**: User Story 2 complete - all commands execute correctly with plugin-relative paths

---

## Phase 5: User Story 3 - GitHub Workflows Execute Plugin Commands (Priority: P2)

**Goal**: All GitHub Actions workflows invoke the renamed ai-board.* commands successfully

**Independent Test**: Trigger each workflow and verify it invokes the correct ai-board command name

### Implementation for User Story 3

- [ ] T054 [P] [US3] Update .github/workflows/speckit.yml to use ai-board.* command names (speckit.specify -> ai-board.specify, speckit.plan -> ai-board.plan, speckit.tasks -> ai-board.tasks, speckit.implement -> ai-board.implement, speckit.clarify -> ai-board.clarify)
- [ ] T055 [P] [US3] Update .github/workflows/quick-impl.yml to use /ai-board.quick-impl (replace /quick-impl)
- [ ] T056 [P] [US3] Update .github/workflows/verify.yml to use /ai-board.verify (replace /verify)
- [ ] T057 [P] [US3] Update .github/workflows/cleanup.yml to use /ai-board.cleanup (replace /cleanup)
- [ ] T058 [P] [US3] Update .github/workflows/iterate.yml to use /ai-board.iterate-verify (replace /iterate-verify)

**Checkpoint**: User Story 3 complete - all workflows invoke correct command names

---

## Phase 6: User Story 4 - Plugin Validation (Priority: P3)

**Goal**: Plugin passes Claude Code's plugin validation checks for registry listing

**Independent Test**: Run Claude Code's plugin validation command on the plugin package

### Implementation for User Story 4

- [ ] T059 [US4] Validate plugin.json manifest against contracts/plugin-manifest.schema.json
- [ ] T060 [US4] Validate hooks.json against contracts/hooks.schema.json
- [ ] T061 [US4] Verify all 16 command files referenced in plugin exist and have valid format per contracts/command-file.schema.json
- [ ] T062 [US4] Verify all script files referenced in commands exist and are executable (755 permission)
- [ ] T063 [US4] Verify all template files referenced in commands exist
- [ ] T064 [US4] Verify skills/testing/SKILL.md exists and has valid structure

**Checkpoint**: User Story 4 complete - plugin passes all validation checks

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup

- [ ] T065 Run all unit tests in tests/unit/plugin/ to verify path resolution
- [ ] T066 Run all integration tests in tests/integration/plugin/ to verify installation
- [ ] T067 Verify constitution copy behavior (new project gets template, existing project preserves customizations)
- [ ] T068 Run quickstart.md validation scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (P1): Can proceed immediately after Foundational
  - US2 (P2): Can run in parallel with US1 (different files)
  - US3 (P2): Can run in parallel with US1/US2 (different files)
  - US4 (P3): Depends on US1-US3 completion (validates their outputs)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - Copies files, no dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - Creates commands, no dependencies on US1 (parallel OK)
- **User Story 3 (P2)**: Can start after Foundational - Updates workflows, no dependencies on US1/US2 (parallel OK)
- **User Story 4 (P3)**: Must wait for US1-US3 - Validates files created by previous stories

### Within Each User Story

- Tests first (US1 only has tests), then implementation
- Scripts before commands (commands reference scripts)
- Cross-references after individual commands created
- Validation after all files exist

### Parallel Opportunities

**Phase 1 (Setup):**
- T003-T010 can all run in parallel (independent directories)

**Phase 2 (Foundational):**
- T012, T013 can run in parallel (different files)

**Phase 3 (US1):**
- T014-T015 tests can run in parallel
- T016-T036 all file copies can run in parallel (21 parallel tasks!)

**Phase 4 (US2):**
- T037-T052 all command files can run in parallel (16 parallel tasks!)
- T053 must wait for all commands to be created

**Phase 5 (US3):**
- T054-T058 all workflow updates can run in parallel (5 parallel tasks)

**Phase 6 (US4):**
- Sequential validation required (validates outputs from previous phases)

---

## Parallel Example: User Story 1

```bash
# Launch all script copies together (14 parallel tasks):
Task: "Copy common.sh to scripts/bash/common.sh"
Task: "Copy create-new-feature.sh to scripts/bash/create-new-feature.sh"
Task: "Copy check-prerequisites.sh to scripts/bash/check-prerequisites.sh"
# ... (11 more script copies)

# Launch all template copies together (6 parallel tasks):
Task: "Copy spec-template.md to templates/spec-template.md"
Task: "Copy plan-template.md to templates/plan-template.md"
# ... (4 more template copies)

# Launch skill copy:
Task: "Copy testing skill directory to skills/testing/"
```

---

## Parallel Example: User Story 2

```bash
# Launch all command file creations together (16 parallel tasks):
Task: "Create ai-board.specify.md at commands/ai-board.specify.md"
Task: "Create ai-board.clarify.md at commands/ai-board.clarify.md"
Task: "Create ai-board.plan.md at commands/ai-board.plan.md"
# ... (13 more command files)

# After all commands created, update cross-references:
Task: "Update internal command cross-references in all 16 commands"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (create directories)
2. Complete Phase 2: Foundational (path resolution, constitution setup)
3. Complete Phase 3: User Story 1 (copy scripts, templates, skills)
4. **STOP and VALIDATE**: Test plugin installation independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready
2. Add User Story 1 -> Test independently -> Plugin files in place
3. Add User Story 2 -> Test independently -> Commands available
4. Add User Story 3 -> Test independently -> Workflows updated
5. Add User Story 4 -> Test independently -> Validation passes
6. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel after Foundational phase:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, US1-US3 can run in parallel:
   - Parallel task 1: User Story 1 (scripts, templates, skills)
   - Parallel task 2: User Story 2 (commands)
   - Parallel task 3: User Story 3 (workflows)
3. After US1-US3 complete, run US4 (validation)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Scripts require 755 (executable) permission
- Paths in commands MUST use ${CLAUDE_PLUGIN_ROOT} for portability
- Constitution copy is non-destructive (preserve existing customizations)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
