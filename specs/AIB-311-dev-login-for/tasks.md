# Tasks: Dev Login for Preview Environments

**Input**: Design documents from `/specs/AIB-311-dev-login-for/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dev-login.md

**Tests**: Included — plan.md explicitly defines integration and component test strategies.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment configuration for dev login feature

- [x] T001 Add `DEV_LOGIN_SECRET` and `NEXT_PUBLIC_DEV_LOGIN` entries to `.env.example` with documentation comments

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core auth infrastructure that MUST be complete before any user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Add `createOrUpdateDevUser(email: string)` function to `app/lib/auth/user-service.ts` — upsert by email with deterministic SHA-256 ID, email-prefix display name, case-insensitive email normalization
- [x] T003 Add conditional Credentials provider to `lib/auth.ts` — import CredentialsProvider, create `devLoginProvider()` gated on `DEV_LOGIN_SECRET` env var, implement `authorize` callback with timing-safe secret comparison via `crypto.timingSafeEqual`, call `createOrUpdateDevUser` on success, return null on failure
- [x] T004 Update `signIn` callback in `lib/auth.ts` to skip GitHub-specific validation when `account?.provider === 'credentials'`

**Checkpoint**: Foundation ready — Credentials provider registers when `DEV_LOGIN_SECRET` is set, user upsert works

---

## Phase 3: User Story 1 - Dev Login on Preview Environment (Priority: P1) 🎯 MVP

**Goal**: A developer can sign in via Dev Login form on a preview environment and get a fully functional session

**Independent Test**: Deploy to preview with `DEV_LOGIN_SECRET` and `NEXT_PUBLIC_DEV_LOGIN=true` set, enter valid credentials, verify redirect to `/projects` with working session

### Tests for User Story 1

- [x] T005 [P] [US1] Integration test: `authorize` returns user for correct secret in `tests/unit/auth/dev-login.test.ts`
- [x] T006 [P] [US1] Integration test: `createOrUpdateDevUser` creates new user with correct fields (deterministic ID, lowercase email, email-prefix name) in `tests/unit/auth/dev-login.test.ts`
- [x] T007 [P] [US1] Integration test: `createOrUpdateDevUser` upserts existing user without overwriting name/image in `tests/unit/auth/dev-login.test.ts`
- [x] T008 [P] [US1] Integration test: email normalization treats `User@Test.com` and `user@test.com` as same user in `tests/unit/auth/dev-login.test.ts`

### Implementation for User Story 1

- [x] T009 [P] [US1] Create `DevLoginForm` client component in `components/auth/dev-login-form.tsx` — email + secret inputs using shadcn/ui (Input, Button, Label), client-side validation (both fields required, email format), call `signIn("credentials", { email, secret, redirect: false })`, redirect to callbackUrl on success, display error on failure
- [x] T010 [US1] Update signin page in `app/auth/signin/page.tsx` — read `NEXT_PUBLIC_DEV_LOGIN` env var, conditionally render `DevLoginForm` below GitHub button with visual "or" separator, pass `callbackUrl` prop

### Component Tests for User Story 1

- [x] T011 [P] [US1] Component test: form renders email and secret inputs, submit disabled when empty, displays error on failed login, calls signIn with correct params in `tests/unit/components/dev-login-form.test.tsx`

**Checkpoint**: User Story 1 complete — dev login form renders and authenticates users on preview environments

---

## Phase 4: User Story 2 - Invalid Credentials Rejection (Priority: P1)

**Goal**: Invalid secret submissions are rejected without creating a session, with clear error feedback

**Independent Test**: Submit Dev Login form with incorrect secret, verify no session created and error message displayed

### Tests for User Story 2

- [x] T012 [P] [US2] Integration test: `authorize` returns null for incorrect secret in `tests/unit/auth/dev-login.test.ts`
- [x] T013 [P] [US2] Integration test: `authorize` returns null for empty email in `tests/unit/auth/dev-login.test.ts`
- [x] T014 [P] [US2] Integration test: `authorize` returns null for empty secret in `tests/unit/auth/dev-login.test.ts`
- [x] T015 [P] [US2] Integration test: timing-safe comparison works for different-length secrets in `tests/unit/auth/dev-login.test.ts`

### Implementation for User Story 2

Note: The rejection logic is already implemented in Phase 2 (T003 — `authorize` returns null on mismatch) and Phase 3 (T009 — form displays error on failure). This phase validates that behavior through tests.

- [x] T016 [US2] Verify client-side validation in `components/auth/dev-login-form.tsx` prevents submission with empty email or empty secret fields (already part of T009, this task validates behavior)

**Checkpoint**: User Story 2 complete — invalid credentials always rejected, error messages shown

---

## Phase 5: User Story 3 - Production Environment Unchanged (Priority: P1)

**Goal**: Production environments (without `DEV_LOGIN_SECRET`) show no trace of the dev login feature

**Independent Test**: Verify signin page without `NEXT_PUBLIC_DEV_LOGIN` shows only GitHub OAuth, verify providers list excludes Credentials when `DEV_LOGIN_SECRET` is unset

### Tests for User Story 3

- [x] T017 [P] [US3] Integration test: Credentials provider not in providers when `DEV_LOGIN_SECRET` is unset in `tests/unit/auth/dev-login.test.ts`

### Implementation for User Story 3

Note: The conditional gating is already implemented in Phase 2 (T003 — provider gated on env var) and Phase 3 (T010 — form gated on `NEXT_PUBLIC_DEV_LOGIN`). This phase validates that behavior.

- [x] T018 [US3] Verify that `lib/auth.ts` providers array does not include Credentials when `DEV_LOGIN_SECRET` is undefined (validate T003 implementation)

**Checkpoint**: User Story 3 complete — production environments are completely unaffected

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and quality assurance

- [x] T019 Run `bun run type-check` and fix any TypeScript errors
- [x] T020 Run `bun run lint` and fix any linting issues
- [x] T021 Run full test suite `bun run test` to verify all existing tests still pass (SC-005)
- [x] T022 Verify `DEV_LOGIN_SECRET` does not appear in any client-side bundle output (FR-008, security audit)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **User Stories (Phases 3-5)**: All depend on Phase 2 completion
  - US1 (Phase 3): Can start after Phase 2
  - US2 (Phase 4): Can start after Phase 2 (tests independent, but validation task T016 depends on T009)
  - US3 (Phase 5): Can start after Phase 2 (validation depends on T003, T010)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — implements the full login flow
- **User Story 2 (P1)**: Tests are independent, but validation references US1 form component (T009)
- **User Story 3 (P1)**: Tests are independent, but validation references foundational tasks (T003, T010)

### Within Each User Story

- Tests written first, expected to fail before implementation
- Foundation code (user-service, auth config) before UI components
- UI components before page integration
- Story complete before moving to next priority

### Parallel Opportunities

- T005, T006, T007, T008 (US1 integration tests) can run in parallel
- T009, T011 (US1 form component + component test) can run in parallel with integration tests
- T012, T013, T014, T015 (US2 tests) can run in parallel
- T017 (US3 test) can run in parallel with US2 tests
- All test files are separate from implementation files — tests and implementation can be parallelized

---

## Parallel Example: User Story 1

```bash
# Launch all integration tests for US1 together:
Task: "Integration test: authorize returns user for correct secret in tests/unit/auth/dev-login.test.ts"
Task: "Integration test: createOrUpdateDevUser creates new user in tests/unit/auth/dev-login.test.ts"
Task: "Integration test: createOrUpdateDevUser upserts existing user in tests/unit/auth/dev-login.test.ts"
Task: "Integration test: email normalization in tests/unit/auth/dev-login.test.ts"

# Launch form component + component test in parallel:
Task: "Create DevLoginForm client component in components/auth/dev-login-form.tsx"
Task: "Component test: form renders in tests/unit/components/dev-login-form.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (env vars)
2. Complete Phase 2: Foundational (user-service + auth config)
3. Complete Phase 3: User Story 1 (form + signin page + tests)
4. **STOP and VALIDATE**: Test dev login end-to-end on preview environment
5. Deploy if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy (MVP!)
3. Add User Story 2 → Validate rejection behavior → Deploy
4. Add User Story 3 → Validate production safety → Deploy
5. Polish → Type-check, lint, full test suite → Ship

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All 3 user stories are P1 priority — security and functionality are co-equal
- No schema changes needed — existing User model is sufficient
- Integration tests share a single test file (`tests/unit/auth/dev-login.test.ts`) organized by describe blocks
- Component test in separate file (`tests/unit/components/dev-login-form.test.tsx`)
