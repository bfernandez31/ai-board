# Tasks: Personal Access Tokens for API Authentication

**Input**: Design documents from `/specs/AIB-173-personal-access-tokens/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Included per spec requirements (Testing Trophy: unit for generate/validate, integration for API, E2E for modal UX only)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- Next.js App Router: `app/`, `components/`, `lib/`
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema and token utility foundation

- [ ] T001 Add PersonalAccessToken model to prisma/schema.prisma
- [ ] T002 Add personalAccessTokens relation to User model in prisma/schema.prisma
- [ ] T003 Run Prisma migration: `bunx prisma migrate dev --name add-personal-access-tokens`
- [ ] T004 [P] Create token generation utility in lib/tokens/generate.ts
- [ ] T005 [P] Create rate limiting utility in lib/tokens/rate-limit.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Create token database operations (CRUD) in lib/db/tokens.ts
- [ ] T007 Create token validation utility in lib/tokens/validate.ts
- [ ] T008 Add getCurrentUserOrToken() helper to lib/db/users.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Generate New Token (Priority: P1) 🎯 MVP

**Goal**: Users can generate a new personal access token with a name, displayed once

**Independent Test**: Generate a token via UI, copy it, use it to authenticate an API request

### Tests for User Story 1

- [ ] T009 [P] [US1] Unit test for token generation in tests/unit/tokens/generate.test.ts
- [ ] T010 [P] [US1] Integration test for POST /api/tokens in tests/integration/tokens/api.test.ts

### Implementation for User Story 1

- [ ] T011 [US1] Create POST endpoint for token creation in app/api/tokens/route.ts
- [ ] T012 [P] [US1] Create CreateTokenDialog component in components/tokens/create-token-dialog.tsx
- [ ] T013 [P] [US1] Create useCreateToken mutation hook in lib/hooks/mutations/useTokens.ts
- [ ] T014 [US1] Create token settings page shell in app/settings/tokens/page.tsx

**Checkpoint**: User Story 1 complete - users can generate and copy tokens

---

## Phase 4: User Story 2 - Authenticate API Request with Token (Priority: P1)

**Goal**: External tools can make authenticated API requests using Bearer tokens

**Independent Test**: Make API request with valid token, verify 200; with invalid token, verify 401

### Tests for User Story 2

- [ ] T015 [P] [US2] Unit test for token validation in tests/unit/tokens/validate.test.ts
- [ ] T016 [P] [US2] Integration test for Bearer auth in tests/integration/tokens/api.test.ts

### Implementation for User Story 2

- [ ] T017 [US2] Integrate getCurrentUserOrToken() into existing API routes pattern
- [ ] T018 [US2] Add lastUsedAt update on successful token validation in lib/tokens/validate.ts
- [ ] T019 [US2] Add rate limiting to token validation in lib/tokens/validate.ts

**Checkpoint**: User Story 2 complete - external tools can authenticate via Bearer token

---

## Phase 5: User Story 3 - View Token List (Priority: P2)

**Goal**: Users can view all their tokens with metadata (name, preview, dates)

**Independent Test**: Create multiple tokens, navigate to settings page, verify all display correctly

### Tests for User Story 3

- [ ] T020 [US3] Integration test for GET /api/tokens in tests/integration/tokens/api.test.ts

### Implementation for User Story 3

- [ ] T021 [US3] Create GET endpoint for listing tokens in app/api/tokens/route.ts
- [ ] T022 [P] [US3] Create TokenList component in components/tokens/token-list.tsx
- [ ] T023 [P] [US3] Create TokenItem component in components/tokens/token-item.tsx
- [ ] T024 [US3] Create useTokens query hook in lib/hooks/mutations/useTokens.ts
- [ ] T025 [US3] Integrate TokenList into settings page in app/settings/tokens/page.tsx

**Checkpoint**: User Story 3 complete - users can view their token list

---

## Phase 6: User Story 4 - Delete Token (Priority: P2)

**Goal**: Users can revoke tokens with confirmation, immediately invalidating them

**Independent Test**: Delete a token, verify subsequent API requests with that token return 401

### Tests for User Story 4

- [ ] T026 [US4] Integration test for DELETE /api/tokens/[id] in tests/integration/tokens/api.test.ts

### Implementation for User Story 4

- [ ] T027 [US4] Create DELETE endpoint in app/api/tokens/[id]/route.ts
- [ ] T028 [P] [US4] Create DeleteTokenDialog component in components/tokens/delete-token-dialog.tsx
- [ ] T029 [US4] Create useDeleteToken mutation hook in lib/hooks/mutations/useTokens.ts
- [ ] T030 [US4] Integrate delete functionality into TokenItem in components/tokens/token-item.tsx

**Checkpoint**: User Story 4 complete - users can revoke tokens

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: E2E tests and final validation

- [ ] T031 E2E test for token generation flow in tests/e2e/tokens.spec.ts
- [ ] T032 E2E test for token deletion flow in tests/e2e/tokens.spec.ts
- [ ] T033 Run full test suite and type-check: `bun run test && bun run type-check`
- [ ] T034 Run quickstart.md validation commands

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 priority but can run in parallel
  - US3 and US4 are P2 priority, can run in parallel after US1/US2
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Uses token DB ops from T006
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Uses token DB ops from T006

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Database operations before API endpoints
- API endpoints before UI components
- Core implementation before integration

### Parallel Opportunities

- T004, T005 can run in parallel (different files)
- T009, T010 can run in parallel (different test files)
- T012, T013 can run in parallel (different files)
- T015, T016 can run in parallel (different test files)
- T022, T023 can run in parallel (different components)
- T028 can run in parallel with other US4 tasks (separate component file)
- User Stories 1 & 2 can run in parallel (both P1)
- User Stories 3 & 4 can run in parallel (both P2)

---

## Parallel Example: User Story 1

```bash
# Launch tests in parallel:
Task: "Unit test for token generation in tests/unit/tokens/generate.test.ts"
Task: "Integration test for POST /api/tokens in tests/integration/tokens/api.test.ts"

# Launch UI components in parallel:
Task: "Create CreateTokenDialog component in components/tokens/create-token-dialog.tsx"
Task: "Create useCreateToken mutation hook in lib/hooks/mutations/useTokens.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup (database schema, utilities)
2. Complete Phase 2: Foundational (token DB ops, validation, auth helper)
3. Complete Phase 3: User Story 1 (token generation)
4. Complete Phase 4: User Story 2 (API authentication)
5. **STOP and VALIDATE**: Test token generation and API auth independently
6. Deploy/demo if ready - external tools can now authenticate!

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Users can generate tokens → Demo
3. Add User Story 2 → External tools can authenticate → **MVP COMPLETE**
4. Add User Story 3 → Users can view token list → Enhanced UX
5. Add User Story 4 → Users can revoke tokens → Full feature complete
6. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, P1 stories run in parallel:
   - Parallel task 1: User Story 1 (Generate Token)
   - Parallel task 2: User Story 2 (API Authentication)
3. Then P2 stories run in parallel:
   - Parallel task 3: User Story 3 (View Token List)
   - Parallel task 4: User Story 4 (Delete Token)
4. Polish phase after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US1 + US2 together form the minimum viable PAT system
