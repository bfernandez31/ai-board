# Tasks: [Compliance] Fix 2 violations - Security-First Design

**Input**: Design documents from `/specs/AIB-486-compliance-fix-2/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — plan.md explicitly requires updating existing unit and integration tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project setup needed — all changes modify existing files. This phase handles shared validation infrastructure changes that both user stories depend on.

- [x] T001 Add `unrecognized_keys` handling to `mapZodErrors()` in `lib/validations/config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema changes that MUST be complete before user story work begins

**⚠️ CRITICAL**: Both user stories depend on the `.strict()` migration completing first

- [x] T002 Replace `.passthrough()` with `.strict()` on `ProjectConfigSchema` in `lib/validations/config.ts`
- [x] T003 [P] Add `.strict()` to `ProjectSectionSchema` in `lib/validations/config.ts`
- [x] T004 [P] Add `.strict()` to `RuntimeSectionSchema` in `lib/validations/config.ts`
- [x] T005 [P] Add `.strict()` to `CommandsSectionSchema` in `lib/validations/config.ts`
- [x] T006 [P] Add `.strict()` to `AgentSectionSchema` in `lib/validations/config.ts`

**Checkpoint**: Schema enforcement foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 - Service Credentials Are Never Exposed (Priority: P1) 🎯 MVP

**Goal**: Strip `username` and `password` from service entries before DB storage and API response, ensuring sensitive credentials are never persisted or exposed.

**Independent Test**: Submit a config with service credentials via POST /api/projects/:id/config/sync and verify the response and stored data contain no `username` or `password` fields in service entries.

### Tests for User Story 1

- [x] T007 [P] [US1] Add unit tests for `stripServiceCredentials()` function in `tests/unit/config-schema.test.ts` — test stripping of `username`/`password` from services, partial credentials (only one present), and no-credential configs
- [x] T008 [P] [US1] Add integration tests verifying credentials absent from stored config and sync API response in `tests/integration/projects/config-sync.test.ts`

### Implementation for User Story 1

- [x] T009 [US1] Implement `stripServiceCredentials()` export function in `lib/validations/config.ts` — accepts validated `ProjectConfig`, returns plain object with `username` and `password` removed from each service entry
- [x] T010 [US1] Update `lib/config-sync.ts` to call `stripServiceCredentials()` after validation and alongside existing `env` stripping, before DB write and API response

**Checkpoint**: Service credentials are stripped from all config sync operations — US1 fully functional and testable

---

## Phase 4: User Story 2 - Unknown Config Fields Are Rejected (Priority: P1)

**Goal**: Reject config files containing fields not defined in the schema with clear validation errors, instead of silently persisting unvalidated data.

**Independent Test**: Submit a config with an extra unknown field (e.g., `extra_field: value`) and verify the sync endpoint returns a 400 validation error identifying the unknown field.

### Tests for User Story 2

- [x] T011 [US2] Update existing "unknown fields produce warnings" tests in `tests/unit/config-schema.test.ts` — change expectations from `success: true` with warnings to `success: false` with `unknown_field` errors for root-level and nested unknown fields

### Implementation for User Story 2

- [x] T012 [US2] Verify `.strict()` integration with `mapZodErrors()` handles `unrecognized_keys` issues correctly in `lib/validations/config.ts` — ensure error messages clearly identify unknown field name and location (satisfies FR-005)

**Checkpoint**: Unknown fields in configs are now rejected with descriptive errors — US2 fully functional and testable

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validation, cleanup, and verification across both user stories

- [x] T013 Run `bun run type-check` to verify no type errors across all modified files
- [x] T014 Run `bun run lint` to verify no lint errors across all modified files
- [x] T015 Run `bun run test:unit tests/unit/config-schema.test.ts` to verify all unit tests pass
- [x] T016 Run `bun run test:integration tests/integration/projects/config-sync.test.ts` to verify all integration tests pass
- [x] T017 Run quickstart.md validation per `specs/AIB-486-compliance-fix-2/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001 (mapZodErrors handling) — BLOCKS both user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion
- **Polish (Phase 5)**: Depends on both user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — independent of US2
- **User Story 2 (P1)**: Can start after Phase 2 — independent of US1
- Both stories modify `lib/validations/config.ts` but touch different sections (credential stripping vs. error handling)

### Within Each User Story

- Tests written alongside or before implementation
- Utility functions before calling code
- Unit tests before integration tests

### Parallel Opportunities

- T003–T006 (section `.strict()` additions) can all run in parallel
- T007 and T008 (US1 tests) can run in parallel
- US1 (Phase 3) and US2 (Phase 4) can proceed in parallel after Phase 2

---

## Parallel Example: User Story 1

```bash
# Launch tests for User Story 1 together:
Task: "Unit tests for stripServiceCredentials() in tests/unit/config-schema.test.ts"
Task: "Integration tests for credential stripping in tests/integration/projects/config-sync.test.ts"
```

## Parallel Example: Foundational Phase

```bash
# Launch all section .strict() changes together:
Task: "Add .strict() to ProjectSectionSchema in lib/validations/config.ts"
Task: "Add .strict() to RuntimeSectionSchema in lib/validations/config.ts"
Task: "Add .strict() to CommandsSectionSchema in lib/validations/config.ts"
Task: "Add .strict() to AgentSectionSchema in lib/validations/config.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (mapZodErrors handling)
2. Complete Phase 2: Foundational (.strict() migration)
3. Complete Phase 3: User Story 1 (credential stripping)
4. **STOP and VALIDATE**: Test credential stripping independently
5. Proceed to User Story 2

### Incremental Delivery

1. Complete Setup + Foundational → Schema enforcement ready
2. Add User Story 1 → Test credential stripping → Verify (MVP!)
3. Add User Story 2 → Test unknown field rejection → Verify
4. Polish phase → Full validation suite passes

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, both user stories can run in parallel:
   - Parallel task 1: User Story 1 (credential stripping)
   - Parallel task 2: User Story 2 (unknown field rejection)
3. Polish phase after both stories complete
