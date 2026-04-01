# Tasks: Finalize Universal Workflows — run-command.sh + Conditional Services

**Input**: Design documents from `/specs/AIB-475-finalize-universal-workflows/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Unit tests for `run-command.sh` included per plan.md Task 9.

**Organization**: Tasks grouped by user story. US1+US2 (both P1) share workflow update tasks since replacing hardcoded commands and preserving backward compatibility are implemented in the same file edits. US3 service inputs are added in the same workflow edits. US4 covers lightweight-only workflows separately.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (Core Scripts)

**Purpose**: Create the two foundational scripts that ALL workflow updates depend on. These MUST be complete before any workflow file is modified.

**Why critical**: Every workflow update references `run-command.sh` and `setup-environment.sh --mode`. Without these, no workflow changes can function.

- [x] T001 [P] Create centralized command dispatch script at `.github/scripts/run-command.sh` — accepts `<target-dir>` and `<command-key>`, reads `.ai-board/config.yml` via yq, executes configured command or falls back to hardcoded defaults, handles missing config (fallback), empty values (silent skip), and invalid YAML (exit 2). See `contracts/run-command.md` for full interface. Make executable with `chmod +x`.
- [x] T002 [P] Add `--mode lightweight|full` parameter to `.github/scripts/setup-environment.sh` — parse `--mode` flag (default: `lightweight`), wrap dependency install, Prisma detect/generate/migrate, Playwright detect/install, env export, and global-setup steps in `if [[ "$MODE" == "full" ]]` guard. Lightweight steps (yq, validation, symlinks, runtimes, git config, agent CLI) always run. Preserve execution order: symlinks → runtimes → deps → Prisma → Playwright (FR-010). See `contracts/setup-environment.md`.

**Checkpoint**: Both scripts functional. `run-command.sh` can parse config and execute commands; `setup-environment.sh` respects `--mode` flag. All user story work can now begin.

---

## Phase 2: User Story 1 + User Story 2 — Universal Command Execution + Backward Compatibility (Priority: P1) MVP

**Goal**: Replace ALL hardcoded project-specific commands in the four main workflow files with `run-command.sh` calls, and replace setup steps with `setup-environment.sh --mode` calls. This simultaneously enables external projects (US1) and preserves ai-board's own behavior via fallback defaults (US2).

**Independent Test (US1)**: Create a mock `.ai-board/config.yml` with non-bun commands (e.g., `npm ci`, `pytest`) and verify `run-command.sh` reads and executes them correctly.

**Independent Test (US2)**: Run each workflow type against the ai-board repository (which has config.yml) and confirm all steps complete identically to current hardcoded behavior. Also verify a target repo WITHOUT config.yml falls back to ai-board defaults.

### Unit Tests

- [x] T003 [US1] Create unit tests for `run-command.sh` at `tests/unit/scripts/run-command.test.sh` (or Vitest shell exec wrapper) — test cases: (1) valid config executes configured command and returns exit code, (2) missing config uses fallback default, (3) empty command value exits 0 silently, (4) missing command key exits 0 silently, (5) invalid YAML exits 2 with error message, (6) unrecognized command key exits 0 silently, (7) missing arguments fails with usage message, (8) command failure returns non-zero exit code faithfully.

### Workflow Updates (US1+US2+US3 combined per file)

Each workflow update replaces hardcoded commands with `run-command.sh`, replaces setup steps with `setup-environment.sh --mode`, adds conditional service inputs (US3), preserves Bun cache step (FR-013), and ensures all script paths use `ai-board/.github/scripts/` prefix (FR-011).

- [ ] T004 [P] [US1] Update `.github/workflows/speckit.yml` — (1) add 8 service inputs per `contracts/workflow-service-inputs.md`, (2) replace static `image: postgres:14` with conditional expression, add Redis/MySQL/MongoDB conditional services, (3) specify/plan commands use `setup-environment.sh <target> --mode lightweight`, implement command uses `--mode full`, (4) replace hardcoded `bun install --frozen-lockfile` with `run-command.sh <target> install`, (5) replace hardcoded test commands with `run-command.sh` calls, (6) preserve Bun cache step, (7) fix all paths to `ai-board/.github/scripts/` prefix.
- [ ] T005 [P] [US1] Update `.github/workflows/quick-impl.yml` — (1) add 8 service inputs, (2) replace static PostgreSQL with conditional + add other conditional services, (3) use `setup-environment.sh <target> --mode full`, (4) replace hardcoded commands with `run-command.sh` calls, (5) preserve Bun cache, (6) fix script path references.
- [ ] T006 [P] [US1] Update `.github/workflows/verify.yml` — (1) add 8 service inputs, (2) conditional services, (3) use `setup-environment.sh <target> --mode full`, (4) replace `bun run test:unit --reporter=json` with `run-command.sh <target> test_unit` (append reporter flags after base command), (5) replace `npx playwright test` with `run-command.sh <target> test_e2e`, (6) preserve Bun cache, (7) fix paths. **Note**: verify.yml appends framework-specific flags (`--reporter=json`, `--outputFile`) — config command is the base; additional flags appended by the workflow step.
- [ ] T007 [P] [US1] Update `.github/workflows/health-scan.yml` — (1) add 8 service inputs, (2) make PostgreSQL conditional (combine existing TESTS-only logic with `needs_postgres`), add other conditional services, (3) TESTS scan type uses `setup-environment.sh <target> --mode full`, non-TESTS types use `--mode lightweight`, (4) replace hardcoded install/prisma commands with `run-command.sh` calls, (5) fix paths.

**Checkpoint**: The four main workflows now use universal command execution. External projects with `.ai-board/config.yml` can run specify, plan, implement, verify, and health-scan workflows. ai-board itself continues working via config or fallback defaults. Service containers are conditionally started.

---

## Phase 3: User Story 4 — Lightweight Workflows Stay Lightweight (Priority: P2)

**Goal**: Update `ai-board-assist.yml` and `iterate.yml` to use `setup-environment.sh --mode lightweight`, ensuring they never trigger dependency installation, Prisma, or Playwright setup.

**Independent Test**: Trigger an ai-board-assist or iterate workflow and confirm that no dependency install, Prisma, or Playwright steps execute — only symlinks, runtimes, and git config.

- [ ] T008 [US4] Update `.github/workflows/ai-board-assist.yml` — (1) no service inputs needed, (2) replace hardcoded `bun install --frozen-lockfile` with conditional setup: VERIFY stage with /review uses `setup-environment.sh <target> --mode full`, other stages use `--mode lightweight`, (3) remove hardcoded `npx prisma generate/migrate/seed` (handled by full mode), (4) remove hardcoded `npx playwright install` (handled by full mode), (5) fix all script path references to `ai-board/.github/scripts/` prefix.
- [ ] T009 [US4] Update `.github/workflows/iterate.yml` — (1) no service inputs needed, (2) replace any hardcoded setup with `setup-environment.sh <target> --mode lightweight`, (3) fix script path references, (4) minimal changes — this workflow is already lightweight.

**Checkpoint**: All 6 workflow files updated. Lightweight workflows (assist, iterate) skip heavy setup. All workflows use universal scripts.

---

## Phase 4: Polish & Validation

**Purpose**: Verify all changes are correct and consistent across all workflow files.

- [ ] T010 Validate all workflow path references — grep all `.github/workflows/*.yml` for `../ai-board/` (must find zero matches per FR-011/SC-006), grep for hardcoded `bun install`, `bun run test`, `npx prisma`, `npx playwright` outside comments (must find zero except in `run-command.sh` fallback table), verify all `setup-environment.sh` and `run-command.sh` calls use `ai-board/.github/scripts/` prefix.
- [ ] T011 [P] Verify `run-command.sh` fallback defaults match current ai-board `.ai-board/config.yml` commands — cross-reference the fallback table in `run-command.sh` against the actual config file to ensure defaults produce identical behavior.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately. T001 and T002 are independent and parallelizable.
- **US1+US2+US3 (Phase 2)**: Depends on Phase 1 completion (both T001 and T002). T003-T007 all depend on foundational scripts existing.
- **US4 (Phase 3)**: Depends on T002 only (setup-environment.sh --mode). Can run in parallel with Phase 2 if desired, but sequencing after Phase 2 is recommended for consistency.
- **Polish (Phase 4)**: Depends on all workflow updates (T004-T009) being complete.

### Within Phase 2

- T003 (unit tests) depends on T001 (run-command.sh must exist to test)
- T004, T005, T006, T007 are all parallelizable (different files, no interdependencies)
- T003 can run in parallel with T004-T007

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational — no dependencies on other stories
- **US2 (P1)**: Implemented via same tasks as US1 (fallback defaults in T001, setup modes in T002)
- **US3 (P2)**: Implemented in same workflow edits as US1/US2 (T004-T007)
- **US4 (P2)**: Depends only on T002 — independent of US1/US3

### Parallel Opportunities

**Maximum parallelism within each phase:**

```
Phase 1:  T001 ║ T002                    (2 parallel)
Phase 2:  T003 ║ T004 ║ T005 ║ T006 ║ T007  (5 parallel, all after Phase 1)
Phase 3:  T008 ║ T009                    (2 parallel, after T002)
Phase 4:  T010 ║ T011                    (2 parallel, after all workflows)
```

---

## Parallel Example: Phase 2

```bash
# After Phase 1 completes, launch all Phase 2 tasks together:
Task: "Unit tests for run-command.sh in tests/unit/scripts/run-command.test.sh"
Task: "Update speckit.yml in .github/workflows/speckit.yml"
Task: "Update quick-impl.yml in .github/workflows/quick-impl.yml"
Task: "Update verify.yml in .github/workflows/verify.yml"
Task: "Update health-scan.yml in .github/workflows/health-scan.yml"
```

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2 = US1+US2+US3)

1. Complete Phase 1: Foundational scripts (T001, T002)
2. Complete Phase 2: Main workflow updates (T003-T007)
3. **STOP and VALIDATE**: Test ai-board workflows still work (US2), test with mock external config (US1), verify conditional services (US3)
4. At this point, the core feature is fully functional

### Incremental Delivery

1. Phase 1 → Foundational scripts ready
2. Phase 2 → Main workflows universalized (MVP!)
3. Phase 3 → Lightweight workflows updated (full coverage)
4. Phase 4 → Validated and audited (release-ready)

---

## Notes

- All changes are Bash scripts and YAML — no TypeScript, no database, no API changes
- The dispatch-side (ai-board app passing service inputs) is OUT OF SCOPE (separate ticket)
- `deploy-preview.yml`, `rollback-reset.yml`, `auto-ship.yml`, `nightly-health.yml` need NO changes
- The AIB-468 revert (commit `6eda97d9`) identified three root causes — all addressed in T001 (fallbacks), T002 (--mode), and path prefix convention (all tasks)
- `yq v4.44.1` is the pinned version — `run-command.sh` must self-bootstrap it if not on PATH
