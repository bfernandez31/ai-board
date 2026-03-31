# Tasks: BYOK - User API Key Management for AI Agents

**Input**: Design documents from `/specs/AIB-428-byok-gestion-des/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — testing strategy defined in plan.md (unit, component, integration).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema, encryption key provisioning, and Prisma client generation

- [ ] T001 Add CredentialProvider, CredentialType, and CredentialReadiness enums and UserCredential model (with readinessStatus, lastVerifiedAt, verificationCode, verificationMessage fields) with User relation to prisma/schema.prisma
- [ ] T002 Run Prisma migration (`bunx prisma migrate dev --name add-user-credential`) and regenerate client (`bunx prisma generate`)
- [ ] T003 Add `CREDENTIAL_ENCRYPTION_KEY` env var to `.env.local` and `.env.example` with generation instructions

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core libraries that ALL user stories depend on — encryption, validation, and database operations

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Create shared types and interfaces in lib/ai-credentials/types.ts (WorkflowCredentialRequest, WorkflowResolvedCredential, CredentialReadiness-related types, API response types with readinessStatus/verificationCode/verificationMessage)
- [ ] T005 [P] Implement AES-256-GCM encrypt/decrypt utilities in lib/ai-credentials/crypto.ts (encryptCredential, decryptCredential using CREDENTIAL_ENCRYPTION_KEY env var, 12-byte random IV, separate authTag)
- [ ] T006 [P] Implement Anthropic format validation + remote verification in lib/ai-credentials/providers/anthropic.ts (validateFormat for regex checks, verifyWithProvider for API call with 10s timeout, return verificationCode + verificationMessage)
- [ ] T007 [P] Implement business logic in lib/ai-credentials/service.ts (createOrReplaceCredential upsert, listCredentials metadata only, getCredentialForDecryption, deleteCredential, testCredential updating readinessStatus/verificationCode/verificationMessage)
- [ ] T007b [P] Implement owner resolution + workflow payload mapping in lib/ai-credentials/workflow.ts (getOwnerCredential resolving project→owner→credential, buildWorkflowPayload returning WorkflowResolvedCredential)
- [ ] T008 [P] Write unit tests for encryption round-trip and format validation in tests/unit/ai-credentials.test.ts

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Configure AI Credential (Priority: P1) 🎯 MVP

**Goal**: Users can navigate to settings, add their Anthropic API key or OAuth token, see it validated and stored encrypted, displayed masked (last 4 chars)

**Independent Test**: Navigate to settings, add a credential, verify it appears masked in the credential list

### Tests for User Story 1

- [ ] T009 [P] [US1] Write integration tests for GET /api/credentials and POST /api/credentials in tests/integration/credentials/credentials-api.test.ts (list empty, create API_KEY with readinessStatus, create OAUTH_TOKEN, upsert replaces existing, format validation errors, provider validation errors returning verificationCode/verificationMessage, 401 unauthorized)
- [ ] T010 [P] [US1] Write component tests for credential form in tests/unit/components/credential-form.test.tsx (render form fields, provider/type selection, real-time format validation, submit success, submit error display with verificationMessage)
- [ ] T011 [P] [US1] Write integration tests for credential format validation in tests/integration/credentials/credential-validation.test.ts (valid/invalid API_KEY format, valid/invalid OAUTH_TOKEN format)

### Implementation for User Story 1

- [ ] T012 [P] [US1] Implement GET handler (list user credentials with readinessStatus/verificationCode/verificationMessage, exclude encrypted fields) in app/api/credentials/route.ts
- [ ] T013 [P] [US1] Implement POST handler (Zod validation, format check via providers/anthropic.ts, provider verification, encrypt via crypto.ts, upsert via service.ts, return metadata with readinessStatus) in app/api/credentials/route.ts
- [ ] T014 [US1] Create credential management page with layout in app/settings/credentials/page.tsx
- [ ] T015 [P] [US1] Implement credential form component (provider select, type select, label input, value input with real-time format validation) in app/components/credentials/credential-form.tsx
- [ ] T016 [P] [US1] Implement credential list component (display provider, label, masked preview, readinessStatus badge, verificationMessage, timestamps) in app/components/credentials/credential-list.tsx
- [ ] T017 [US1] Add TanStack Query hooks for credential CRUD operations (useCredentials, useCreateCredential with optimistic updates) in app/components/credentials/ or lib/ hooks
- [ ] T018 [US1] Add "Credentials" navigation link to settings sidebar/nav (follow existing tokens nav pattern)

**Checkpoint**: User Story 1 fully functional — users can add and view encrypted credentials

---

## Phase 4: User Story 2 — Workflow Retrieves Owner Credential (Priority: P1)

**Goal**: Workflows automatically retrieve the project owner's decrypted credential via secure internal endpoint and set the correct environment variable; workflows are blocked if no credential is configured

**Independent Test**: Trigger a workflow for a project whose owner has a credential configured, verify the workflow receives the correct env var; trigger without credential, verify workflow is blocked with explicit message

### Tests for User Story 2

- [ ] T019 [P] [US2] Write integration tests for GET /api/internal/credentials in tests/integration/credentials/workflow-credential.test.ts (valid workflow token returns decrypted API_KEY with ANTHROPIC_API_KEY envVar, valid token returns OAUTH_TOKEN with CLAUDE_CODE_OAUTH_TOKEN envVar, 401 without token, 404 when no credential, 400 missing projectId)

### Implementation for User Story 2

- [ ] T020 [US2] Implement GET /api/internal/credentials endpoint (verify workflow token, resolve via lib/ai-credentials/workflow.ts, decrypt via crypto.ts, return WorkflowResolvedCredential payload) in app/api/internal/credentials/route.ts
- [ ] T021 [US2] Add credential existence check before workflow dispatch in app/lib/workflows/dispatch-ai-board.ts (use lib/ai-credentials/workflow.ts to check owner credential, throw user-facing error if missing)
- [ ] T022 [US2] Add credential fetch step to .github/workflows/ai-board-assist.yml (curl internal endpoint, mask value with ::add-mask::, export env var via $GITHUB_ENV)
- [ ] T023 [US2] Add credential fetch step to .github/workflows/speckit.yml (same pattern as ai-board-assist.yml for SPECIFY/PLAN/BUILD stages)

**Checkpoint**: User Story 2 fully functional — workflows retrieve and use owner credentials; blocked without credential

---

## Phase 5: User Story 3 — Manage Existing Credential (Priority: P2)

**Goal**: Users can test, replace, or delete their existing credential from the settings page

**Independent Test**: Add a credential, then perform test/replace/delete operations and verify each outcome

### Tests for User Story 3

- [ ] T024 [P] [US3] Write integration tests for DELETE /api/credentials/[id] and POST /api/credentials/[id]/test in tests/integration/credentials/credentials-api.test.ts (delete success 204, delete 404 not found, delete 401, test valid key returns readinessStatus READY, test invalid key returns readinessStatus ACTION_REQUIRED with verificationCode INVALID_KEY, test provider unreachable returns ACTION_REQUIRED with verificationCode UNREACHABLE)

### Implementation for User Story 3

- [ ] T025 [US3] Implement DELETE handler in app/api/credentials/[id]/route.ts (verify ownership, delete via service.ts, return 204)
- [ ] T026 [US3] Implement POST /api/credentials/[id]/test handler (verify ownership, decrypt via crypto.ts, verify via providers/anthropic.ts, update readinessStatus/lastVerifiedAt/verificationCode/verificationMessage via service.ts, return result) in app/api/credentials/[id]/test/route.ts
- [ ] T027 [US3] Implement credential test button component (trigger test, show loading/success/failure states with verificationMessage) in app/components/credentials/credential-test-button.tsx
- [ ] T028 [US3] Add delete and replace actions to credential-list.tsx with confirmation dialog (delete removes credential, replace opens form pre-filled with provider)
- [ ] T029 [US3] Add TanStack Query hooks for delete and test operations (useDeleteCredential, useTestCredential with optimistic readinessStatus updates)

**Checkpoint**: All user stories independently functional — full CRUD + workflow integration

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Security hardening, logging guardrails, and final validation

- [ ] T030 [P] Audit all API routes and logs to ensure credential values are never logged (FR-013) — check route handlers, middleware, error handlers
- [ ] T031 [P] Verify aurora-b+ theme styling on credential settings page (aurora-* CSS classes on dialogs, cards, forms)
- [ ] T032 Run quickstart.md validation — verify full flow end-to-end: add credential → list (check readinessStatus) → test → workflow retrieves → replace → delete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma schema + migration) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 (encryption, validation, DB ops)
- **User Story 2 (Phase 4)**: Depends on Phase 2 (encryption, DB ops); independent of US1
- **User Story 3 (Phase 5)**: Depends on Phase 2 (encryption, validation, DB ops); independent of US1/US2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories
- **US2 (P1)**: After Foundational — no dependency on other stories (uses DB ops directly, not UI)
- **US3 (P2)**: After Foundational — no dependency on other stories (can test delete/replace even without US1 UI, though typically follows US1)

### Within Each User Story

- Tests written FIRST, must FAIL before implementation
- DB operations / library code before API routes
- API routes before UI components
- Core implementation before integration points

### Parallel Opportunities

- **Phase 2**: T004, T005, T006, T007, T007b, T008 can all run in parallel (different files)
- **Phase 3**: T009, T010, T011 (tests) in parallel; T012, T013 in parallel; T015, T016 in parallel
- **Phase 4**: T019 (test) independent; after T020, T021/T022/T023 touch different files
- **Phase 5**: T024 independent; T025, T026 touch different route files (parallel); T027 parallel with T028
- **Cross-story**: US1, US2, US3 can all start in parallel after Phase 2

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task T009: "Integration tests for credentials API in tests/integration/credentials/credentials-api.test.ts"
Task T010: "Component tests for credential form in tests/unit/components/credential-form.test.tsx"
Task T011: "Integration tests for credential validation in tests/integration/credentials/credential-validation.test.ts"

# Launch parallel API route handlers:
Task T012: "GET handler in app/api/credentials/route.ts"
Task T013: "POST handler in app/api/credentials/route.ts"

# Launch parallel UI components:
Task T015: "Credential form in app/components/credentials/credential-form.tsx"
Task T016: "Credential list in app/components/credentials/credential-list.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema + migration)
2. Complete Phase 2: Foundational (crypto + validation + DB ops)
3. Complete Phase 3: User Story 1 (configure credential)
4. **STOP and VALIDATE**: Test US1 independently — user can add and view credentials
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → Deploy/Demo (MVP!)
3. Add US2 → Test independently → Workflows now use credentials
4. Add US3 → Test independently → Full credential management
5. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, user stories can run in parallel:
   - Parallel task 1: User Story 1 (Configure credential)
   - Parallel task 2: User Story 2 (Workflow retrieval)
   - Parallel task 3: User Story 3 (Manage credential)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Credential values must NEVER appear in logs — verify at every layer
