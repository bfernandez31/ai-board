# Tasks: Define .ai-board/config.yml Schema and Validation

**Input**: Design documents from `/specs/AIB-449-define-ai-board/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/config-schema.ts

**Tests**: Included — plan.md explicitly defines unit tests for schema validation and file loading (Steps 4–5).

**Organization**: Tasks grouped by user story. Each story is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add new dependency and create file scaffolding

- [x] T001 Install `yaml` v2.x dependency via `bun add yaml`
- [x] T002 [P] Create empty file `lib/validations/config.ts` with module doc comment and imports (zod, yaml types)
- [x] T003 [P] Create empty file `lib/config-loader.ts` with module doc comment and imports

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define all Zod enum schemas, section schemas, and shared types that every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Define enum schemas (`ProjectLanguageSchema`, `ProjectFrameworkSchema`, `PackageManagerSchema`, `ServiceTypeSchema`, `AgentCliSchema`, `ValidationErrorTypeSchema`) in `lib/validations/config.ts`
- [x] T005 Define `ProjectSectionSchema` with required `name` (non-empty string), required `language` (enum), optional `framework` (enum, default `"none"`) in `lib/validations/config.ts`
- [x] T006 Define `RuntimeSectionSchema` with required `manager` (enum), optional `manager_version`, `node`, `python` (all strings) in `lib/validations/config.ts`
- [x] T007 Define `CommandsSectionSchema` with required `install` (non-empty string), optional `build`, `lint`, `type_check`, `test_unit`, `test_integration`, `test_e2e` (all strings, default `undefined`) in `lib/validations/config.ts`
- [x] T008 Define `ServiceConfigSchema` with required `type` (enum) and `version` (non-empty string), optional `database`, `username`, `password` in `lib/validations/config.ts`
- [x] T009 Define `AgentSectionSchema` with optional `cli` (enum, default `"claude-code"`), optional `model` (string) in `lib/validations/config.ts`
- [x] T010 Define root `ProjectConfigSchema` composing all section schemas with `.passthrough()` for unknown field detection — `version` as `z.literal(1)`, required `project`, `runtime`, `commands`, optional `services` (default `[]`), `env` (default `{}`), `agent` (default `{ cli: "claude-code" }`) in `lib/validations/config.ts`
- [x] T011 Export inferred TypeScript types via `z.infer<>` for all schemas (`ProjectConfig`, `ProjectSection`, `RuntimeSection`, `CommandsSection`, `ServiceConfig`, `AgentSection`) in `lib/validations/config.ts`

**Checkpoint**: All Zod schemas defined and types exported — user story implementation can now begin

---

## Phase 3: User Story 1 — Valid Config Parsing (Priority: P1) 🎯 MVP

**Goal**: Parse a valid `.ai-board/config.yml` and return a fully typed `ProjectConfig` object with defaults populated

**Independent Test**: Provide a valid YAML object (all fields or only required fields) and verify the parsed output matches expected typed values with correct defaults

### Tests for User Story 1

- [x] T012 [P] [US1] Write test: valid config with all fields returns success with correct types in `tests/unit/config-schema.test.ts`
- [x] T013 [P] [US1] Write test: valid config with only required fields returns success with defaults populated (`framework: "none"`, `services: []`, `env: {}`, `agent.cli: "claude-code"`) in `tests/unit/config-schema.test.ts`
- [x] T014 [P] [US1] Write test: valid config with all sections fully populated has every field present with correct types in `tests/unit/config-schema.test.ts`

### Implementation for User Story 1

- [x] T015 [US1] Implement `validateConfig(raw: unknown): ValidationResult` function in `lib/validations/config.ts` — runs `safeParse()`, collects unknown field warnings via key diff against known schema keys, returns discriminated union result
- [x] T016 [US1] Export `ValidationError`, `ValidationWarning`, and `ValidationResult` types from `lib/validations/config.ts` per contracts/config-schema.ts interface

**Checkpoint**: `validateConfig()` works for valid inputs — run tests to verify

---

## Phase 4: User Story 2 — Invalid Config Produces Actionable Errors (Priority: P1)

**Goal**: Return clear, structured error messages for all invalid fields in a single pass (not fail-on-first)

**Independent Test**: Provide configs with missing required fields, invalid enums, wrong types, and multiple errors — verify each produces correct `ValidationError` objects with path, type, value, and message

### Tests for User Story 2

- [x] T017 [P] [US2] Write test: missing required fields (`version`, `project.name`, `project.language`, `runtime.manager`, `commands.install`) produce errors with correct paths and `missing_required` type in `tests/unit/config-schema.test.ts`
- [x] T018 [P] [US2] Write test: invalid enum values (`project.language: "ruby"`) produce `invalid_value` error listing allowed values in `tests/unit/config-schema.test.ts`
- [x] T019 [P] [US2] Write test: wrong types (`runtime.node: 22` number instead of string) produce `invalid_type` error in `tests/unit/config-schema.test.ts`
- [x] T020 [P] [US2] Write test: config with multiple errors returns all errors together (not just the first) in `tests/unit/config-schema.test.ts`
- [x] T021 [P] [US2] Write test: empty object returns all required-field errors in `tests/unit/config-schema.test.ts`

### Implementation for User Story 2

- [x] T022 [US2] Implement Zod-to-ValidationError mapping in `validateConfig()` — map Zod issue codes to `ValidationErrorType` (`missing_required`, `invalid_value`, `invalid_type`), include field path, invalid value, and human-readable message with fix guidance in `lib/validations/config.ts`

**Checkpoint**: `validateConfig()` produces actionable errors for all invalid inputs — run tests to verify

---

## Phase 5: User Story 3 — Missing Config File Detection (Priority: P2)

**Goal**: Fail immediately with a clear message when `.ai-board/config.yml` is not found

**Independent Test**: Call `loadConfig()` against a directory without the config file and verify the specific FR-010 error message

### Tests for User Story 3

- [x] T023 [P] [US3] Write test: missing `.ai-board/config.yml` file returns error with message "Missing .ai-board/config.yml" in `tests/unit/config-loader.test.ts`
- [x] T024 [P] [US3] Write test: invalid YAML syntax returns parse error with line info and guidance in `tests/unit/config-loader.test.ts`
- [x] T025 [P] [US3] Write test: valid file delegates to `validateConfig()` and returns correct result in `tests/unit/config-loader.test.ts`
- [x] T026 [P] [US3] Write test: empty file returns all required-field errors in `tests/unit/config-loader.test.ts`

### Implementation for User Story 3

- [x] T027 [US3] Implement `loadConfig(projectDir: string): Promise<ValidationResult>` in `lib/config-loader.ts` — resolve path to `{projectDir}/.ai-board/config.yml`, check file existence (return FR-010 error if missing), read and parse YAML (catch syntax errors with line info), delegate to `validateConfig()`

**Checkpoint**: `loadConfig()` handles missing files, bad YAML, and valid files — run tests to verify

---

## Phase 6: User Story 4 — Optional Commands Gracefully Skipped (Priority: P2)

**Goal**: Configs with missing optional commands validate without errors and mark commands as undefined/skippable

**Independent Test**: Parse a config with only `commands.install` defined, verify validation passes and optional commands are `undefined`

### Tests for User Story 4

- [x] T028 [P] [US4] Write test: config with only `commands.install` validates successfully, all other commands are `undefined` in `tests/unit/config-schema.test.ts`
- [x] T029 [P] [US4] Write test: config with `commands.lint` omitted returns `undefined` for lint (workflow can check truthiness to skip) in `tests/unit/config-schema.test.ts`

**Checkpoint**: Optional command skip behavior verified — no implementation changes needed (handled by Zod defaults in Phase 2)

---

## Phase 7: User Story 5 — Schema Version Validation (Priority: P3)

**Goal**: Validate the `version` field against supported versions and produce clear errors for unsupported versions

**Independent Test**: Provide configs with `version: 1` (pass), `version: 2` (fail with supported versions list), `version: "one"` (fail with type error)

### Tests for User Story 5

- [x] T030 [P] [US5] Write test: `version: 1` passes validation in `tests/unit/config-schema.test.ts`
- [x] T031 [P] [US5] Write test: `version: 2` fails with "Unsupported config version" error listing supported versions in `tests/unit/config-schema.test.ts`
- [x] T032 [P] [US5] Write test: `version: "one"` (string) fails with type error in `tests/unit/config-schema.test.ts`

**Checkpoint**: Version validation covers supported, unsupported, and wrong-type cases — no additional implementation needed (handled by `z.literal(1)` in Phase 2)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and quality checks across all user stories

- [x] T033 [P] Run `bun run type-check` and fix any type errors across `lib/validations/config.ts` and `lib/config-loader.ts`
- [x] T034 [P] Run `bun run lint` and fix any lint issues across all new files
- [x] T035 Run all unit tests together: `bun run test:unit tests/unit/config-schema.test.ts` and `bun run test:unit tests/unit/config-loader.test.ts`
- [x] T036 Validate unknown fields produce warnings (not errors) — ensure `.passthrough()` + key diff logic emits `ValidationWarning` objects per FR-014 in `lib/validations/config.ts`
- [x] T037 Run quickstart.md validation — execute the example code from `specs/AIB-449-define-ai-board/quickstart.md` to confirm API works as documented

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001 for yaml dep) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — core parsing
- **US2 (Phase 4)**: Depends on Foundational (Phase 2) — can run in parallel with US1
- **US3 (Phase 5)**: Depends on US1 (Phase 3) — `loadConfig` calls `validateConfig`
- **US4 (Phase 6)**: Depends on Foundational (Phase 2) — tests only, no new implementation
- **US5 (Phase 7)**: Depends on Foundational (Phase 2) — tests only, no new implementation
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependencies on other stories
- **US2 (P1)**: Can start after Foundational — parallel with US1 (shares `lib/validations/config.ts` but different functions/tests)
- **US3 (P2)**: Depends on US1 — `loadConfig` delegates to `validateConfig`
- **US4 (P2)**: Can start after Foundational — test-only, validates default behavior
- **US5 (P3)**: Can start after Foundational — test-only, validates literal(1) behavior

### Within Each User Story

- Tests written FIRST, verify they FAIL before implementation
- Implementation satisfies failing tests
- Story checkpoint: all tests pass

### Parallel Opportunities

- T002 and T003 can run in parallel (different files)
- T012, T013, T014 can run in parallel (same file but independent test cases)
- T017, T018, T019, T020, T021 can run in parallel (independent test cases)
- T023, T024, T025, T026 can run in parallel (independent test cases)
- US1 and US2 can run in parallel (US1 = valid paths, US2 = error paths)
- US4 and US5 can run in parallel with US3 (test-only phases)

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together:
Task: "Write test: valid config with all fields in tests/unit/config-schema.test.ts"
Task: "Write test: valid config with only required fields in tests/unit/config-schema.test.ts"
Task: "Write test: valid config fully populated in tests/unit/config-schema.test.ts"
```

## Parallel Example: User Story 2

```bash
# Launch all US2 tests together:
Task: "Write test: missing required fields in tests/unit/config-schema.test.ts"
Task: "Write test: invalid enum values in tests/unit/config-schema.test.ts"
Task: "Write test: wrong types in tests/unit/config-schema.test.ts"
Task: "Write test: multiple errors in tests/unit/config-schema.test.ts"
Task: "Write test: empty object in tests/unit/config-schema.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install yaml)
2. Complete Phase 2: Foundational (all Zod schemas)
3. Complete Phase 3: US1 — valid config parsing
4. **STOP and VALIDATE**: `validateConfig()` works for valid inputs
5. This delivers the core capability: workflows can parse config files

### Incremental Delivery

1. Setup + Foundational → Schemas ready
2. US1 → Valid parsing works → MVP!
3. US2 → Error messages work → Production-quality validation
4. US3 → File loading works → End-to-end config loading
5. US4 + US5 → Edge cases verified → Full confidence
6. Polish → Type-check, lint, quickstart validation

### Parallel Execution Strategy

1. Complete Setup + Foundational sequentially (T001 → T004–T011)
2. Once Foundational is done, execute in parallel:
   - Stream A: US1 (Phase 3) → US3 (Phase 5) — sequential, US3 depends on US1
   - Stream B: US2 (Phase 4) — parallel with Stream A
   - Stream C: US4 + US5 (Phases 6–7) — parallel, test-only phases
3. Polish phase after all streams complete

---

## Notes

- All implementation is in 2 files: `lib/validations/config.ts` and `lib/config-loader.ts`
- All tests are in 2 files: `tests/unit/config-schema.test.ts` and `tests/unit/config-loader.test.ts`
- No database changes — purely file-based validation utility
- No UI changes — library code only
- Contract in `contracts/config-schema.ts` defines the public API interface that implementation must satisfy
