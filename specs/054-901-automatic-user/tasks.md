# Tasks: Automatic User Creation for GitHub OAuth

**Input**: Design documents from `/specs/054-901-automatic-user/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL in this feature - only included because E2E authentication flow testing is critical for validation

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Next.js App Router**: `app/`, `tests/` at repository root
- **Authentication logic**: `app/lib/auth/`
- **Type definitions**: `types/`
- Paths follow Next.js 15 conventions as specified in plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create TypeScript type extensions for NextAuth in types/next-auth.d.ts
- [ ] T002 [P] Verify existing Prisma schema has User and Account models with correct fields in prisma/schema.prisma
- [ ] T003 [P] Verify database connection pooling configuration in .env (connection_limit=10, pool_timeout=20)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core authentication infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create user service module with transaction support in app/lib/auth/user-service.ts
- [ ] T005 [P] Implement GitHubProfile interface and validation function in app/lib/auth/user-service.ts
- [ ] T006 [P] Implement createOrUpdateUser function with User and Account upsert logic in app/lib/auth/user-service.ts
- [ ] T007 Create NextAuth configuration module in app/lib/auth/nextauth-config.ts
- [ ] T008 Implement signIn callback with validation and error handling in app/lib/auth/nextauth-config.ts
- [ ] T009 [P] Implement jwt callback to add userId to JWT token in app/lib/auth/nextauth-config.ts
- [ ] T010 [P] Implement session callback to add userId to session in app/lib/auth/nextauth-config.ts
- [ ] T011 Update NextAuth route handler to use new configuration in app/api/auth/[...nextauth]/route.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - First-Time GitHub Sign-In (Priority: P1) 🎯 MVP

**Goal**: New users can sign in with GitHub OAuth and immediately create projects without database constraint errors

**Independent Test**: Create a new GitHub OAuth session with a test account and verify: (1) User record is created in database, (2) Account record is linked, (3) User can create their first project without foreign key errors

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T012 [P] [US1] Create unit tests for validateGitHubProfile function in tests/unit/auth/user-service.test.ts
- [ ] T013 [P] [US1] Create unit tests for createOrUpdateUser with new user scenario in tests/unit/auth/user-service.test.ts
- [ ] T014 [P] [US1] Create unit tests for transaction rollback on Account creation failure in tests/unit/auth/user-service.test.ts

### Implementation for User Story 1

- [ ] T015 [US1] Implement email validation logic (reject if missing) in validateGitHubProfile function in app/lib/auth/user-service.ts
- [ ] T016 [US1] Implement User upsert with create branch (first-time user) in createOrUpdateUser function in app/lib/auth/user-service.ts
- [ ] T017 [US1] Implement Account upsert with create branch (first-time link) in createOrUpdateUser function in app/lib/auth/user-service.ts
- [ ] T018 [US1] Wrap User and Account operations in Prisma transaction for atomicity in app/lib/auth/user-service.ts
- [ ] T019 [US1] Add error logging for validation failures in app/lib/auth/nextauth-config.ts signIn callback
- [ ] T020 [US1] Add error logging for database operation failures in app/lib/auth/nextauth-config.ts signIn callback
- [ ] T021 [US1] Return false from signIn callback on validation or database errors in app/lib/auth/nextauth-config.ts

### E2E Tests for User Story 1

- [ ] T022 [US1] Create E2E test for first-time GitHub sign-in creates User record in tests/e2e/auth/first-time-signin.spec.ts
- [ ] T023 [US1] Create E2E test for User record has correct email and name after first sign-in in tests/e2e/auth/first-time-signin.spec.ts
- [ ] T024 [US1] Create E2E test for Account record is created with GitHub provider linkage in tests/e2e/auth/first-time-signin.spec.ts
- [ ] T025 [US1] Create E2E test for new user can create project without foreign key errors in tests/e2e/auth/first-time-signin.spec.ts
- [ ] T026 [US1] Create E2E test for authentication fails when GitHub profile missing email in tests/e2e/auth/first-time-signin.spec.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - new users can sign in and create projects

---

## Phase 4: User Story 2 - Returning User Sign-In (Priority: P2)

**Goal**: Existing users who return to the application have their User and Account records updated with current GitHub information

**Independent Test**: Sign in with an existing test user account, modify their GitHub profile (name/email), and verify the local database reflects the updates after next sign-in

### Tests for User Story 2

- [ ] T027 [P] [US2] Create unit tests for createOrUpdateUser with existing user scenario (update branch) in tests/unit/auth/user-service.test.ts
- [ ] T028 [P] [US2] Create unit tests for User upsert updates name and image when changed in tests/unit/auth/user-service.test.ts
- [ ] T029 [P] [US2] Create unit tests for Account upsert updates access token and refresh token in tests/unit/auth/user-service.test.ts

### Implementation for User Story 2

- [ ] T030 [US2] Implement User upsert with update branch (returning user) in createOrUpdateUser function in app/lib/auth/user-service.ts
- [ ] T031 [US2] Implement Account upsert with update branch (token refresh) in createOrUpdateUser function in app/lib/auth/user-service.ts
- [ ] T032 [US2] Ensure User email is NOT updated (email is unique identifier) in update branch in app/lib/auth/user-service.ts
- [ ] T033 [US2] Add logging for successful user updates with timing metrics in app/lib/auth/nextauth-config.ts signIn callback

### E2E Tests for User Story 2

- [ ] T034 [US2] Create E2E test for returning user sign-in updates User record (not duplicated) in tests/e2e/auth/returning-user.spec.ts
- [ ] T035 [US2] Create E2E test for User record name is updated when changed on GitHub in tests/e2e/auth/returning-user.spec.ts
- [ ] T036 [US2] Create E2E test for returning user can access existing projects immediately in tests/e2e/auth/returning-user.spec.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - new and returning users work correctly

---

## Phase 5: User Story 3 - Concurrent Authentication Handling (Priority: P3)

**Goal**: System handles concurrent database writes gracefully during high-traffic periods without creating duplicate user records

**Independent Test**: Use load testing tools to simulate 10-20 concurrent first-time authentications and verify: (1) No duplicate User records are created, (2) All authentications succeed, (3) All users can create projects afterward

### Tests for User Story 3

- [ ] T037 [P] [US3] Create unit tests for concurrent createOrUpdateUser calls with same email in tests/unit/auth/concurrent-auth.test.ts
- [ ] T038 [P] [US3] Create unit tests for PostgreSQL ON CONFLICT behavior with upsert in tests/unit/auth/concurrent-auth.test.ts
- [ ] T039 [P] [US3] Create unit tests for unique constraint violation handling (defensive) in tests/unit/auth/concurrent-auth.test.ts

### Implementation for User Story 3

- [ ] T040 [US3] Verify upsert uses email uniqueness constraint for User (where: { email }) in app/lib/auth/user-service.ts
- [ ] T041 [US3] Verify upsert uses composite key for Account (provider_providerAccountId) in app/lib/auth/user-service.ts
- [ ] T042 [US3] Add defensive error handling for Prisma P2002 (unique constraint violation) in app/lib/auth/user-service.ts
- [ ] T043 [US3] Add logging for unexpected unique constraint violations with debug context in app/lib/auth/user-service.ts

### E2E Tests for User Story 3

- [ ] T044 [US3] Create E2E load test simulating 10 concurrent first-time sign-ins in tests/e2e/auth/concurrent-auth.spec.ts
- [ ] T045 [US3] Create E2E test verifying no duplicate User records after concurrent authentications in tests/e2e/auth/concurrent-auth.spec.ts
- [ ] T046 [US3] Create E2E test verifying all concurrent authentications succeed (no failures) in tests/e2e/auth/concurrent-auth.spec.ts

**Checkpoint**: All user stories should now be independently functional - system handles first-time, returning, and concurrent authentication

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T047 [P] Add performance timing logs to signIn callback (target: < 500ms) in app/lib/auth/nextauth-config.ts
- [ ] T048 [P] Verify NEXTAUTH_SECRET is configured for production in .env.production
- [ ] T049 [P] Verify GitHub OAuth credentials (GITHUB_ID, GITHUB_SECRET) are configured in .env
- [ ] T050 Add comprehensive error messages for each failure scenario (missing email, database error, etc.) in app/lib/auth/nextauth-config.ts
- [ ] T051 [P] Document environment variable configuration in quickstart.md verification section
- [ ] T052 Run all unit tests and verify passing (bun run test:unit)
- [ ] T053 Run all E2E tests and verify passing (bun run test:e2e tests/e2e/auth/)
- [ ] T054 Verify all acceptance scenarios from spec.md are covered by tests
- [ ] T055 [P] Code cleanup and remove console.log debugging statements (keep console.error for production logging)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses same createOrUpdateUser function but tests update branch
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Validates concurrent behavior of US1 and US2 implementations

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Validation logic before database operations
- User upsert before Account upsert (Account depends on User ID)
- Error handling after core implementation
- E2E tests after unit tests and implementation

### Parallel Opportunities

- **Setup (Phase 1)**: All 3 tasks marked [P] can run in parallel
- **Foundational (Phase 2)**: Tasks T005-T006 and T009-T010 marked [P] can run in parallel
- **User Story 1**: Unit tests T012-T014 can run in parallel
- **User Story 2**: Unit tests T027-T029 can run in parallel
- **User Story 3**: Unit tests T037-T039 can run in parallel
- **Polish (Phase 6)**: Tasks T047-T049 and T051 can run in parallel
- **Cross-Story Parallelism**: Once Foundational phase completes, US1, US2, and US3 can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all unit tests for User Story 1 together:
Task: "Create unit tests for validateGitHubProfile function in tests/unit/auth/user-service.test.ts"
Task: "Create unit tests for createOrUpdateUser with new user scenario in tests/unit/auth/user-service.test.ts"
Task: "Create unit tests for transaction rollback on Account creation failure in tests/unit/auth/user-service.test.ts"

# After tests fail, implement core logic sequentially:
Task: "Implement email validation logic in validateGitHubProfile function"
Task: "Implement User upsert with create branch"
Task: "Implement Account upsert with create branch"
Task: "Wrap operations in transaction"
```

---

## Parallel Example: Foundational Phase

```bash
# After T004 completes, these can run in parallel:
Task: "Implement GitHubProfile interface and validation function" (T005)
Task: "Implement createOrUpdateUser function" (T006)

# After T007 completes, these can run in parallel:
Task: "Implement jwt callback" (T009)
Task: "Implement session callback" (T010)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T011) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T012-T026)
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Run unit tests: `bun run test:unit tests/unit/auth/user-service.test.ts`
   - Run E2E tests: `bun run test:e2e tests/e2e/auth/first-time-signin.spec.ts`
   - Manual test: Sign in with GitHub, create a project
5. Deploy/demo if ready - MVP delivers immediate value!

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP - new users can sign in!)
3. Add User Story 2 → Test independently → Deploy/Demo (returning users work correctly!)
4. Add User Story 3 → Test independently → Deploy/Demo (concurrent authentication handled!)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T011)
2. Once Foundational is done:
   - Developer A: User Story 1 (T012-T026) - First-time sign-in
   - Developer B: User Story 2 (T027-T036) - Returning user updates
   - Developer C: User Story 3 (T037-T046) - Concurrent authentication
3. Stories complete and integrate independently
4. Team reconvenes for Phase 6: Polish (T047-T055)

---

## Task Summary

- **Total Tasks**: 55
- **Setup Phase**: 3 tasks
- **Foundational Phase**: 8 tasks (BLOCKS all stories)
- **User Story 1 (P1 - MVP)**: 15 tasks (5 unit tests + 10 implementation + 5 E2E tests)
- **User Story 2 (P2)**: 10 tasks (3 unit tests + 4 implementation + 3 E2E tests)
- **User Story 3 (P3)**: 10 tasks (3 unit tests + 4 implementation + 3 E2E tests)
- **Polish Phase**: 9 tasks

### Parallel Opportunities Identified

- **Phase 1**: 2 parallel tasks (T002-T003)
- **Phase 2**: 4 parallel tasks (T005-T006, T009-T010)
- **User Story 1**: 3 parallel unit tests (T012-T014)
- **User Story 2**: 3 parallel unit tests (T027-T029)
- **User Story 3**: 3 parallel unit tests (T037-T039)
- **Phase 6**: 4 parallel tasks (T047-T049, T051)
- **Cross-Story**: All 3 user stories can proceed in parallel after Foundational phase

### MVP Scope (Recommended)

**Minimum Viable Product**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (User Story 1)
- **Tasks**: T001-T026 (26 tasks)
- **Deliverable**: New users can sign in with GitHub OAuth and immediately create projects
- **Value**: Solves the core problem - eliminates "foreign key constraint violation" errors
- **Time Estimate**: 2-3 hours (per quickstart.md)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD approach)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All file paths are absolute and follow Next.js 15 App Router conventions
- TypeScript strict mode enforced throughout (no `any` types)
- Prisma transactions ensure atomic User + Account creation (no partial failures)
- NextAuth callbacks fail authentication on database errors (no orphaned sessions)
