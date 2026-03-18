# Tasks: Dev Login for Preview Environments

**Input**: Design documents from `/specs/AIB-313-dev-login-for/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because `spec.md` and `plan.md` explicitly require automated validation for enabled, disabled, successful, and failed dev-login scenarios.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. `US1`, `US2`, `US3`)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Auth Scaffolding)

**Purpose**: Create the shared files and test helpers that all dev-login work will build on.

- [ ] T001 Create the shared preview-auth helper module with exported dev-login types and placeholders in `app/lib/auth/dev-login.ts`
- [ ] T002 [P] Create reusable unit-test fixtures for dev-login environment variables and credentials payloads in `tests/unit/auth/dev-login-test-helpers.ts`
- [ ] T003 [P] Create reusable integration-test fixtures for NextAuth credential posts and session assertions in `tests/integration/auth/dev-login-test-helpers.ts`
- [ ] T004 [P] Create reusable sign-in page render helpers for search params and server-action mocking in `tests/unit/components/sign-in-page-test-helpers.tsx`

---

## Phase 2: Foundational (Blocking Auth Wiring)

**Purpose**: Wire the shared predicate and credentials provider into the existing auth flow before story-specific behavior is added.

**CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T005 Implement the shared preview-availability predicate, email normalization, and credentials schema in `app/lib/auth/dev-login.ts`
- [ ] T006 Update `lib/auth.ts` to register a gated `Credentials` provider and keep provider-aware JWT/session callbacks compatible with both GitHub and credentials sign-in
- [ ] T007 Update `app/auth/signin/page.tsx` to read `callbackUrl` and `error` query params and add the server-action plumbing needed for a credentials submit path

**Checkpoint**: Shared auth wiring is ready; user-story behavior can now be implemented and validated independently.

---

## Phase 3: User Story 1 - Sign In to a Preview Deployment (Priority: P1) 🎯 MVP

**Goal**: A tester in a preview deployment can sign in with an email address and the shared secret, land on `/projects`, and receive a normal authenticated session.

**Independent Test**: In a preview-configured runtime, submit a valid email and secret on `/auth/signin`, then confirm the browser redirects to `/projects` and `/api/auth/session` returns the signed-in user.

### Tests for User Story 1

- [ ] T008 [P] [US1] Add unit tests for valid credentials parsing, normalized email handling, and successful provisioning in `tests/unit/auth/dev-login-success.test.ts`
- [ ] T009 [P] [US1] Add component tests for the enabled preview sign-in form and callback preservation on `/auth/signin` in `tests/unit/components/sign-in-page-enabled.test.tsx`
- [ ] T010 [P] [US1] Add contract tests for `POST /api/auth/callback/credentials` success redirects and `GET /api/auth/session` authenticated payloads in `tests/integration/auth/dev-login-contract-success.test.ts`
- [ ] T011 [P] [US1] Add integration tests for first-time user creation and existing-user reuse in `tests/integration/auth/dev-login-success.test.ts`
- [ ] T012 [P] [US1] Add a minimal browser redirect test for preview dev-login success in `tests/e2e/auth/dev-login.spec.ts`

### Implementation for User Story 1

- [ ] T013 [US1] Implement transactional user lookup, first-time user creation, and credentials `Account` upsert in `app/lib/auth/dev-login.ts`
- [ ] T014 [US1] Return the provisioned database user from `Credentials.authorize()` and preserve standard session IDs in `lib/auth.ts`
- [ ] T015 [US1] Render and submit the preview-only email and shared-secret form, redirecting successful sign-ins to `/projects`, in `app/auth/signin/page.tsx`

**Checkpoint**: Valid preview credentials create or reuse the correct user and reach the projects area through the normal authenticated session flow.

---

## Phase 4: User Story 2 - Preserve Existing Sign-In Behavior When Disabled (Priority: P2)

**Goal**: Environments without preview dev-login enabled continue to expose only the standard GitHub sign-in path.

**Independent Test**: Open `/auth/signin` in a production or otherwise disabled environment and confirm the credentials form is absent while direct credential submissions are rejected.

### Tests for User Story 2

- [ ] T016 [P] [US2] Add unit tests covering disabled combinations of `VERCEL_ENV`, `DEV_LOGIN_ENABLED`, and missing `DEV_LOGIN_SECRET` in `tests/unit/auth/dev-login-availability.test.ts`
- [ ] T017 [P] [US2] Add component tests proving disabled environments render only the GitHub path on `/auth/signin` in `tests/unit/components/sign-in-page-disabled.test.tsx`
- [ ] T018 [P] [US2] Add contract tests for hidden `/auth/signin` dev-login controls and rejected disabled credential callbacks in `tests/integration/auth/dev-login-contract-disabled.test.ts`
- [ ] T019 [P] [US2] Add integration tests proving direct credentials attempts fail when preview gating is off in `tests/integration/auth/dev-login-disabled.test.ts`

### Implementation for User Story 2

- [ ] T020 [US2] Gate the sign-in page form entirely behind the shared preview predicate while preserving the GitHub button in `app/auth/signin/page.tsx`
- [ ] T021 [US2] Reject credentials authorization early when preview dev login is unavailable in `app/lib/auth/dev-login.ts`

**Checkpoint**: Disabled and production environments keep the current GitHub-only sign-in behavior with no usable credentials fallback.

---

## Phase 5: User Story 3 - Reject Invalid Dev Login Attempts Safely (Priority: P3)

**Goal**: Invalid email formats or wrong secrets fail safely, keep the user signed out, and show a generic retry-safe error message.

**Independent Test**: In a preview-enabled runtime, submit an invalid email or wrong secret and confirm the user stays signed out, no account data is created, and `/auth/signin?error=dev-login` shows a generic failure message.

### Tests for User Story 3

- [ ] T022 [P] [US3] Add unit tests for invalid email handling, secret mismatch handling, and non-leaking failure results in `tests/unit/auth/dev-login-failure.test.ts`
- [ ] T023 [P] [US3] Add component tests for the generic `error=dev-login` retry message on `/auth/signin` in `tests/unit/components/sign-in-page-error.test.tsx`
- [ ] T024 [P] [US3] Add contract tests for failed credential submissions redirecting back to `/auth/signin?error=dev-login` in `tests/integration/auth/dev-login-contract-failure.test.ts`
- [ ] T025 [P] [US3] Add integration tests proving invalid attempts create no `User`, `Account`, or authenticated session state in `tests/integration/auth/dev-login-failure.test.ts`

### Implementation for User Story 3

- [ ] T026 [US3] Implement secure secret comparison and generic failure responses without leaking secret details in `app/lib/auth/dev-login.ts`
- [ ] T027 [US3] Render the generic inline dev-login failure state on `/auth/signin` and add fallback error mapping in `app/auth/signin/page.tsx` and `app/auth/error/page.tsx`

**Checkpoint**: Invalid preview credentials fail cleanly, persist nothing, and expose no sensitive authentication details.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all stories and shared auth surfaces.

- [ ] T028 Run `bun run test:unit` for `tests/unit/auth/dev-login-*.test.ts` and `tests/unit/components/sign-in-page-*.test.tsx`
- [ ] T029 Run `bun run test:integration` for `tests/integration/auth/dev-login-*.test.ts` and `tests/integration/auth/dev-login-contract-*.test.ts`
- [ ] T030 Run `bun run test:e2e` for `tests/e2e/auth/dev-login.spec.ts`
- [ ] T031 Run `bun run type-check` and `bun run lint` and fix issues in `app/lib/auth/dev-login.ts`, `lib/auth.ts`, `app/auth/signin/page.tsx`, `app/auth/error/page.tsx`, and the new auth test files
- [ ] T032 Run the verification steps from `specs/AIB-313-dev-login-for/quickstart.md` and confirm enabled, disabled, success, and failure scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies; start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user-story implementation.
- **Phase 3 (US1)**: Depends on Phase 2; defines the MVP.
- **Phase 4 (US2)**: Depends on Phase 2; can run after or alongside US1 once the shared provider wiring exists.
- **Phase 5 (US3)**: Depends on Phase 2; can run after or alongside US1/US2 once the shared helper exists.
- **Phase 6 (Polish)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; no dependency on US2 or US3.
- **US2 (P2)**: Starts after Phase 2; depends only on the shared gating/provider foundation, not on US1 completion.
- **US3 (P3)**: Starts after Phase 2; depends only on the shared gating/provider foundation, not on US1 or US2 completion.

### Within Each User Story

- Story tests should be written first and made to fail before implementation.
- Helper logic in `app/lib/auth/dev-login.ts` should land before auth wiring changes that depend on it.
- Auth provider changes in `lib/auth.ts` should land before sign-in-page wiring that submits credentials through NextAuth.
- UI error handling should land after the failure behavior exists in the shared helper.

### Parallel Opportunities

- T002, T003, and T004 can run in parallel during setup because they create separate test helper files.
- T008-T012 can run in parallel for US1 because each task targets a separate test file.
- T016-T019 can run in parallel for US2 because each task targets a separate test file.
- T022-T025 can run in parallel for US3 because each task targets a separate test file.
- After Phase 2, US1, US2, and US3 can be executed in parallel by separate ai-board workers if they coordinate shared-file merges for `app/lib/auth/dev-login.ts`, `lib/auth.ts`, and `app/auth/signin/page.tsx`.

---

## Parallel Example: User Story 1

```bash
# Launch the US1 test tasks in parallel after Phase 2:
Task: "T008 [US1] Add unit tests in tests/unit/auth/dev-login-success.test.ts"
Task: "T009 [US1] Add component tests in tests/unit/components/sign-in-page-enabled.test.tsx"
Task: "T010 [US1] Add contract tests in tests/integration/auth/dev-login-contract-success.test.ts"
Task: "T011 [US1] Add integration tests in tests/integration/auth/dev-login-success.test.ts"
Task: "T012 [US1] Add E2E test in tests/e2e/auth/dev-login.spec.ts"
```

## Parallel Example: User Story 2

```bash
# Launch the US2 validation tasks in parallel after Phase 2:
Task: "T016 [US2] Add unit tests in tests/unit/auth/dev-login-availability.test.ts"
Task: "T017 [US2] Add component tests in tests/unit/components/sign-in-page-disabled.test.tsx"
Task: "T018 [US2] Add contract tests in tests/integration/auth/dev-login-contract-disabled.test.ts"
Task: "T019 [US2] Add integration tests in tests/integration/auth/dev-login-disabled.test.ts"
```

## Parallel Example: User Story 3

```bash
# Launch the US3 failure-path tasks in parallel after Phase 2:
Task: "T022 [US3] Add unit tests in tests/unit/auth/dev-login-failure.test.ts"
Task: "T023 [US3] Add component tests in tests/unit/components/sign-in-page-error.test.tsx"
Task: "T024 [US3] Add contract tests in tests/integration/auth/dev-login-contract-failure.test.ts"
Task: "T025 [US3] Add integration tests in tests/integration/auth/dev-login-failure.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational auth wiring.
3. Complete Phase 3: User Story 1.
4. Validate preview sign-in success end to end before expanding scope.

### Incremental Delivery

1. Setup + Foundational: shared helper, provider wiring, and sign-in page plumbing are in place.
2. Deliver US1: preview sign-in succeeds and redirects to `/projects`.
3. Deliver US2: disabled and production environments stay GitHub-only.
4. Deliver US3: invalid attempts fail safely with generic feedback.
5. Finish with Phase 6 verification and quality gates.

### Suggested MVP Scope

- Phase 1
- Phase 2
- Phase 3 (US1) only

This delivers the minimum viable preview-login flow while leaving disabled-state hardening and failure-path UX as follow-on increments.

---

## Notes

- No Prisma schema change is planned; the feature reuses existing `User`, `Account`, and `Session` models in `prisma/schema.prisma`.
- The same shared predicate must control both UI rendering and credentials authorization so disabled environments cannot be bypassed by direct POSTs.
- All failure messaging should remain generic and must not reveal whether the email, the secret, or the environment gate caused rejection.
