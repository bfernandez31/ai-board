# Tasks: Create ai-board Claude Code Plugin Package

**Input**: Design documents from `/specs/AIB-197-create-ai-board/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: No tests required - plugin validated through workflow execution.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create plugin directory structure and manifest

- [x] T001 Create plugin directory structure: `.claude-plugin/`, `commands/`, `skills/`, `agents/`, `scripts/bash/`, `templates/`, `memory/`
- [x] T002 Create plugin manifest at `.claude-plugin/plugin.json` with name, version, description, author, keywords per contracts/plugin-manifest.json
- [x] T003 [P] Create `agents/.gitkeep` placeholder for AIB-199
- [x] T004 [P] Create `memory/constitution.md` template from `.specify/memory/constitution.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Copy scripts and templates that ALL commands depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Copy `scripts/bash/common.sh` from `.specify/scripts/bash/common.sh` with `${CLAUDE_PLUGIN_ROOT}` path updates
- [x] T006 [P] Copy `scripts/bash/create-new-feature.sh` from `.specify/scripts/bash/create-new-feature.sh`
- [x] T007 [P] Copy `scripts/bash/check-prerequisites.sh` from `.specify/scripts/bash/check-prerequisites.sh`
- [x] T008 [P] Copy `scripts/bash/setup-plan.sh` from `.specify/scripts/bash/setup-plan.sh`
- [x] T009 [P] Copy `scripts/bash/update-agent-context.sh` from `.specify/scripts/bash/update-agent-context.sh`
- [x] T010 [P] Copy `scripts/bash/create-pr-and-transition.sh` from `.specify/scripts/bash/create-pr-and-transition.sh`
- [x] T011 [P] Copy `scripts/bash/create-pr-only.sh` from `.specify/scripts/bash/create-pr-only.sh`
- [x] T012 [P] Copy `scripts/bash/detect-incomplete-implementation.sh` from `.specify/scripts/bash/detect-incomplete-implementation.sh`
- [x] T013 [P] Copy `scripts/bash/prepare-images.sh` from `.specify/scripts/bash/prepare-images.sh`
- [x] T014 [P] Copy `scripts/bash/transition-to-verify.sh` from `.specify/scripts/bash/transition-to-verify.sh`
- [x] T015 [P] Copy `scripts/bash/auto-ship-tickets.sh` from `.specify/scripts/bash/auto-ship-tickets.sh`
- [x] T016 [P] Copy `scripts/analyze-slow-tests.js` from `.specify/scripts/analyze-slow-tests.js`
- [x] T017 [P] Copy `scripts/analyze-test-duplicates.js` from `.specify/scripts/analyze-test-duplicates.js`
- [x] T018 [P] Copy `scripts/generate-test-report.js` from `.specify/scripts/generate-test-report.js`
- [x] T019 [P] Copy `templates/spec-template.md` from `.specify/templates/spec-template.md`
- [x] T020 [P] Copy `templates/plan-template.md` from `.specify/templates/plan-template.md`
- [x] T021 [P] Copy `templates/tasks-template.md` from `.specify/templates/tasks-template.md`
- [x] T022 [P] Copy `templates/checklist-template.md` from `.specify/templates/checklist-template.md`
- [x] T023 [P] Copy `templates/summary-template.md` from `.specify/templates/summary-template.md`
- [x] T024 [P] Copy `templates/agent-file-template.md` from `.specify/templates/agent-file-template.md`
- [x] T025 Copy `skills/testing/` directory from `.claude/skills/testing/` (SKILL.md and patterns/)

**Checkpoint**: Foundation ready - all scripts, templates, and skills in place

---

## Phase 3: User Story 1 - Install Plugin on Managed Project (Priority: P1) 🎯 MVP

**Goal**: Plugin structure complete with all commands available under `ai-board.*` namespace

**Independent Test**: Install plugin on a fresh project and verify all commands are available

### Implementation for User Story 1

- [x] T026 [P] [US1] Copy and rename `commands/ai-board.specify.md` from `.claude/commands/speckit.specify.md`, update internal references from `speckit.*` to `ai-board.*`
- [x] T027 [P] [US1] Copy and rename `commands/ai-board.plan.md` from `.claude/commands/speckit.plan.md`, update internal references
- [x] T028 [P] [US1] Copy and rename `commands/ai-board.tasks.md` from `.claude/commands/speckit.tasks.md`, update internal references
- [x] T029 [P] [US1] Copy and rename `commands/ai-board.implement.md` from `.claude/commands/speckit.implement.md`, update internal references
- [x] T030 [P] [US1] Copy and rename `commands/ai-board.clarify.md` from `.claude/commands/speckit.clarify.md`, update internal references
- [x] T031 [P] [US1] Copy and rename `commands/ai-board.checklist.md` from `.claude/commands/speckit.checklist.md`, update internal references
- [x] T032 [P] [US1] Copy and rename `commands/ai-board.constitution.md` from `.claude/commands/speckit.constitution.md`, update internal references
- [x] T033 [P] [US1] Copy and rename `commands/ai-board.analyze.md` from `.claude/commands/speckit.analyze.md`, update internal references
- [x] T034 [P] [US1] Copy and rename `commands/ai-board.verify.md` from `.claude/commands/verify.md`, update internal references
- [x] T035 [P] [US1] Copy and rename `commands/ai-board.cleanup.md` from `.claude/commands/cleanup.md`, update internal references
- [x] T036 [P] [US1] Copy and rename `commands/ai-board.quick-impl.md` from `.claude/commands/quick-impl.md`, update internal references
- [x] T037 [P] [US1] Copy and rename `commands/ai-board.iterate-verify.md` from `.claude/commands/iterate-verify.md`, update internal references
- [x] T038 [P] [US1] Copy and rename `commands/ai-board.code-review.md` from `.claude/commands/code-review.md`, update internal references
- [x] T039 [P] [US1] Copy and rename `commands/ai-board.code-simplifier.md` from `.claude/commands/code-simplifier.md`, update internal references
- [x] T040 [P] [US1] Copy and rename `commands/ai-board.compare.md` from `.claude/commands/compare.md`, update internal references
- [x] T041 [P] [US1] Copy and rename `commands/ai-board.sync-specifications.md` from `.claude/commands/sync-specifications.md`, update internal references
- [x] T042 [P] [US1] Copy `commands/ai-board-assist.md` from `.claude/commands/ai-board-assist.md` (already ai-board namespace)
- [x] T043 [US1] Update all script path references in commands from `.specify/` to `${CLAUDE_PLUGIN_ROOT}/`
- [x] T044 [US1] Add first-run constitution check to `commands/ai-board.specify.md` and `commands/ai-board.plan.md` per research.md

**Checkpoint**: At this point, User Story 1 should be fully functional - all 17 commands available

---

## Phase 4: User Story 2 - Execute Specification Workflow (Priority: P1)

**Goal**: GitHub workflow `speckit.yml` executes successfully with renamed commands

**Independent Test**: Trigger speckit.yml workflow and verify ai-board.specify, ai-board.plan, ai-board.tasks, ai-board.implement commands execute

### Implementation for User Story 2

- [x] T045 [US2] Update `.github/workflows/speckit.yml` command invocations from `/speckit.specify` to `/ai-board.specify`
- [x] T046 [US2] Update `.github/workflows/speckit.yml` command invocations from `/speckit.plan` to `/ai-board.plan`
- [x] T047 [US2] Update `.github/workflows/speckit.yml` command invocations from `/speckit.tasks` to `/ai-board.tasks`
- [x] T048 [US2] Update `.github/workflows/speckit.yml` command invocations from `/speckit.implement` to `/ai-board.implement`
- [x] T049 [US2] Update `.github/workflows/speckit.yml` command invocations from `/speckit.clarify` to `/ai-board.clarify`

**Checkpoint**: At this point, speckit.yml workflow should execute with renamed commands

---

## Phase 5: User Story 3 - Execute Quick Implementation Workflow (Priority: P2)

**Goal**: GitHub workflow `quick-impl.yml` executes successfully with renamed command

**Independent Test**: Trigger quick-impl.yml workflow and verify ai-board.quick-impl command executes

### Implementation for User Story 3

- [x] T050 [US3] Update `.github/workflows/quick-impl.yml` command invocation from `/quick-impl` to `/ai-board.quick-impl`

**Checkpoint**: At this point, quick-impl.yml workflow should execute with renamed command

---

## Phase 6: User Story 4 - Execute Verify Workflow (Priority: P2)

**Goal**: GitHub workflows `verify.yml` and `iterate.yml` execute successfully with renamed commands

**Independent Test**: Trigger verify.yml workflow and verify ai-board.verify command executes

### Implementation for User Story 4

- [x] T051 [P] [US4] Update `.github/workflows/verify.yml` command invocation from `/verify` to `/ai-board.verify`
- [x] T052 [P] [US4] Update `.github/workflows/iterate.yml` command invocation from `/iterate-verify` to `/ai-board.iterate-verify`

**Checkpoint**: At this point, verify.yml and iterate.yml workflows should execute with renamed commands

---

## Phase 7: User Story 5 - Execute Cleanup Workflow (Priority: P3)

**Goal**: GitHub workflow `cleanup.yml` executes successfully with renamed command

**Independent Test**: Trigger cleanup.yml workflow and verify ai-board.cleanup command executes

### Implementation for User Story 5

- [x] T053 [US5] Update `.github/workflows/cleanup.yml` command invocation from `/cleanup` to `/ai-board.cleanup`

**Checkpoint**: At this point, cleanup.yml workflow should execute with renamed command

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation and final integration

- [x] T054 Validate plugin.json against contracts/plugin-manifest.json schema
- [x] T055 Verify all 17 command frontmatter follows contracts/command-frontmatter.json schema
- [x] T056 Run quickstart.md validation scenarios:
  - Scenario 1: Plugin installation path resolution
  - Scenario 2: Specification workflow command chain
  - Scenario 3: Quick implementation workflow
  - Scenario 4: Verify workflow execution
  - Scenario 5: AI-Board assist response

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (Phase 3): Commands creation - foundational for all workflows
  - US2 (Phase 4): Depends on US1 for command availability
  - US3-5 (Phase 5-7): Can run in parallel after US1 completes
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - All commands must be created first
- **User Story 2 (P1)**: Depends on US1 (commands must exist before workflow updates)
- **User Story 3 (P2)**: Depends on US1, can run parallel with US2/US4/US5
- **User Story 4 (P2)**: Depends on US1, can run parallel with US2/US3/US5
- **User Story 5 (P3)**: Depends on US1, can run parallel with US2/US3/US4

### Within Each User Story

- Commands before workflow updates
- All commands in US1 can run in parallel (different files)
- Workflow updates can run in parallel once commands exist

### Parallel Opportunities

- T003-T004: Setup placeholders can run in parallel
- T006-T024: All script/template copies can run in parallel
- T026-T042: All 17 command copies can run in parallel
- T045-T049: Speckit.yml updates must be sequential (same file)
- T051-T052: Verify/iterate workflow updates can run in parallel (different files)

---

## Parallel Example: User Story 1

```bash
# Launch all command copies together:
Task: "Copy and rename commands/ai-board.specify.md from .claude/commands/speckit.specify.md"
Task: "Copy and rename commands/ai-board.plan.md from .claude/commands/speckit.plan.md"
Task: "Copy and rename commands/ai-board.tasks.md from .claude/commands/speckit.tasks.md"
# ... all 17 commands in parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (plugin structure)
2. Complete Phase 2: Foundational (scripts, templates, skills)
3. Complete Phase 3: User Story 1 (all 17 commands)
4. **STOP and VALIDATE**: Verify commands are accessible via `/ai-board.*`
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test commands → MVP ready
3. Add User Story 2 → Test speckit.yml workflow
4. Add User Story 3-5 → Test remaining workflows
5. Polish phase → Full validation

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially
2. Complete User Story 1 (all commands must exist first)
3. Once US1 is done, workflow updates can run in parallel:
   - Parallel task 1: User Story 2 (speckit.yml)
   - Parallel task 2: User Story 3 (quick-impl.yml)
   - Parallel task 3: User Story 4 (verify.yml, iterate.yml)
   - Parallel task 4: User Story 5 (cleanup.yml)
4. Polish phase completes integration

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All path references must use `${CLAUDE_PLUGIN_ROOT}` per research.md
- Commands require both copy AND path updates (two operations per command)
- No tests included - plugin validates via workflow execution per plan.md
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
