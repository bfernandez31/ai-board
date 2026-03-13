# Tasks: BYOK - Bring Your Own API Key

**Input**: Design documents from `/specs/AIB-285-copy-of-byok/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-keys.md, quickstart.md

**Tests**: Included per constitution check (Section III: Test-Driven Development).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prisma schema, encryption utility, environment config, and shared types

- [x] T001 Add `APIProvider` enum and `ProjectAPIKey` model to `prisma/schema.prisma`, add `apiKeys` relation on `Project` model, then run `bunx prisma generate`
- [x] T002 Add `ENCRYPTION_MASTER_KEY` entry to `.env.example` with description comment
- [x] T003 [P] Create AES-256-GCM encrypt/decrypt utilities in `lib/encryption/api-keys.ts` using Node.js built-in `crypto` (IV 12 bytes, authTag 16 bytes, concatenated base64 output)
- [x] T004 [P] Create shared TypeScript types in `lib/types/api-keys.ts` (`APIProvider`, `APIKeyStatus`, `SaveAPIKeyRequest`, `ValidateAPIKeyRequest`, `SaveAPIKeyResponse`, `ValidateAPIKeyResponse`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database CRUD helpers and format validation that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create database CRUD operations in `lib/db/api-keys.ts` (save/upsert with encryption, list by project, delete by provider, get decrypted key for workflow dispatch)
- [x] T006 [P] Create API key format validation in `lib/api-keys/validate.ts` (prefix checks: Anthropic `sk-ant-`, OpenAI `sk-`; trim whitespace; Zod schemas for request validation)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Configure API Keys for a Project (Priority: P1) 🎯 MVP

**Goal**: Project owners can add API keys for Anthropic and OpenAI in project settings; keys are encrypted at rest and displayed masked (last 4 chars)

**Independent Test**: Navigate to project settings, enter API keys, verify masked display (`****abcd`), confirm persistence across page reloads

### Tests for User Story 1

- [x] T007 [P] [US1] Unit tests for encryption encrypt/decrypt and format validation in `tests/unit/encryption.test.ts`
- [x] T008 [P] [US1] Integration tests for POST save and GET list endpoints in `tests/integration/api-keys/crud.test.ts`

### Implementation for User Story 1

- [x] T009 [US1] Implement POST `/api/projects/[projectId]/api-keys/route.ts` — save/replace key with `verifyProjectOwnership`, Zod validation, format check, encrypt, upsert, return masked preview (support `skipValidation: true` initially)
- [x] T010 [US1] Implement GET `/api/projects/[projectId]/api-keys/route.ts` — list keys with `verifyProjectAccess`, owner sees masked preview + updatedAt, member sees only configured status
- [x] T011 [US1] Create `components/settings/api-keys-card.tsx` — card with per-provider rows showing status/masked preview, input for adding keys, save button, owner-only edit controls, member read-only status view; use TanStack Query for data fetching
- [x] T012 [US1] Add `APIKeysCard` to `app/projects/[projectId]/settings/page.tsx` — import and render within existing settings layout
- [x] T013 [P] [US1] Component tests for APIKeysCard rendering and owner/member views in `tests/unit/components/api-keys-card.test.tsx`

**Checkpoint**: Project owners can configure and view masked API keys. Keys encrypted at rest.

---

## Phase 4: User Story 3 - Workflows Use Project API Keys (Priority: P1)

**Goal**: Workflows automatically use project BYOK keys when configured; projects without keys fall back to repo secrets (ai-board) or show error (external)

**Independent Test**: Configure a project API key, trigger a workflow, verify dispatch inputs include the decrypted key

### Tests for User Story 3

- [x] T014 [P] [US3] Integration tests for workflow dispatch key injection and fallback behavior in `tests/integration/api-keys/workflow-dispatch.test.ts`

### Implementation for User Story 3

- [x] T015 [US3] Modify `lib/workflows/transition.ts` to retrieve and decrypt project API keys before workflow dispatch, inject as `anthropic_api_key` and `openai_api_key` inputs; pass empty string when no BYOK key exists
- [x] T016 [US3] Add pre-dispatch check in `lib/workflows/transition.ts` — block workflow dispatch for external projects without configured keys (FR-009), return actionable error message

**Checkpoint**: Workflows consume BYOK keys. Backward compatibility preserved for ai-board self-management.

---

## Phase 5: User Story 2 - Validate API Keys Before Saving (Priority: P2)

**Goal**: Project owners can test API keys before saving; validation calls provider API and reports valid/invalid/unreachable

**Independent Test**: Enter a key, click "Test", verify feedback message (valid/invalid/unreachable)

### Tests for User Story 2

- [x] T017 [P] [US2] Unit tests for provider-specific key validation (Anthropic, OpenAI, network failure) in `tests/unit/api-key-validation.test.ts`
- [x] T018 [P] [US2] Integration tests for POST validate endpoint in `tests/integration/api-keys/validate.test.ts`

### Implementation for User Story 2

- [x] T019 [US2] Add provider-specific live validation to `lib/api-keys/validate.ts` — Anthropic: POST `/v1/messages` with `max_tokens: 1`; OpenAI: GET `/v1/models`; 10s timeout; return valid/invalid/unreachable
- [x] T020 [US2] Implement POST `/api/projects/[projectId]/api-keys/validate/route.ts` — test key without saving, `verifyProjectOwnership`, return `ValidateAPIKeyResponse`
- [x] T021 [US2] Update POST save endpoint in `app/api/projects/[projectId]/api-keys/route.ts` to call live validation before saving (unless `skipValidation: true`); on network failure with `skipValidation: false`, return warning and allow save per FR-014
- [x] T022 [US2] Update `components/settings/api-keys-card.tsx` — add "Test" button per provider that calls validate endpoint, display validation feedback (valid/invalid/unreachable), allow save-without-validation option

**Checkpoint**: Key validation provides immediate feedback. Save-without-validation supported when provider is unreachable.

---

## Phase 6: User Story 4 - Manage (Replace/Delete) API Keys (Priority: P2)

**Goal**: Project owners can replace or delete existing API keys at any time

**Independent Test**: Replace an existing key and verify new masked preview; delete a key and verify workflows are blocked (external projects)

### Tests for User Story 4

- [x] T023 [P] [US4] Integration tests for DELETE endpoint and key replacement in `tests/integration/api-keys/manage.test.ts`

### Implementation for User Story 4

- [x] T024 [US4] Implement DELETE `/api/projects/[projectId]/api-keys/[provider]/route.ts` — delete key with `verifyProjectOwnership`, return 404 if not found
- [x] T025 [US4] Update `components/settings/api-keys-card.tsx` — add "Delete" button with confirmation dialog per provider, "Replace" flow that shows input when key already exists, optimistic UI updates via TanStack Query invalidation

**Checkpoint**: Full key lifecycle management complete. Replace and delete work independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Security hardening and final validation

- [x] T026 Audit all code paths to ensure API keys never appear in logs, API responses, or client-side state (FR-010, FR-011, SC-005)
- [x] T027 [P] Run `quickstart.md` validation — verify all implementation steps match the quickstart guide
- [x] T028 Run `bun run type-check` and `bun run lint` and fix all errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001 (Prisma schema) and T003 (encryption) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 completion — core MVP
- **US3 (Phase 4)**: Depends on Phase 2 (uses `lib/db/api-keys.ts` for key retrieval); can run in parallel with US1 but integration testing benefits from US1 completion
- **US2 (Phase 5)**: Depends on Phase 2; extends US1 endpoints and UI
- **US4 (Phase 6)**: Depends on Phase 2; extends US1 endpoints and UI
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US3 (P1)**: Can start after Phase 2 — independently testable via mocked key data; benefits from US1 for end-to-end flow
- **US2 (P2)**: Can start after Phase 2 — extends US1 save flow with validation; independently testable
- **US4 (P2)**: Can start after Phase 2 — extends US1 UI with delete/replace; independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Database/utility code before API routes
- API routes before UI components
- Core implementation before integration

### Parallel Opportunities

- T003 + T004 can run in parallel (different files, Phase 1)
- T005 + T006 can run in parallel (different files, Phase 2)
- T007 + T008 can run in parallel (test files, US1)
- T011 + T013 cannot — T013 depends on T011 being created
- T014 can start as soon as Phase 2 completes
- T017 + T018 can run in parallel (test files, US2)
- US1 and US3 can largely proceed in parallel after Phase 2

---

## Parallel Example: User Story 1

```bash
# Launch tests for US1 together:
Task: "Unit tests for encryption in tests/unit/encryption.test.ts"
Task: "Integration tests for API endpoints in tests/integration/api-keys/crud.test.ts"

# After tests, launch API routes in parallel:
Task: "POST save endpoint in app/api/projects/[projectId]/api-keys/route.ts"
Task: "GET list endpoint in app/api/projects/[projectId]/api-keys/route.ts"
# Note: These are in the same file so they execute sequentially (T009 then T010)
```

## Parallel Example: User Story 3

```bash
# After Phase 2, workflow tasks can start independently:
Task: "Integration tests for workflow dispatch in tests/integration/api-keys/workflow-dispatch.test.ts"
# Then implementation:
Task: "Modify lib/workflows/transition.ts for key injection"
Task: "Add pre-dispatch check in lib/workflows/transition.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundational (T005–T006)
3. Complete Phase 3: User Story 1 (T007–T013)
4. **STOP and VALIDATE**: Test key save/list/masked display independently
5. Deploy/demo if ready — owners can configure keys

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → Deploy/Demo (MVP — key configuration!)
3. Add US3 → Test independently → Deploy/Demo (workflows consume keys)
4. Add US2 → Test independently → Deploy/Demo (validation before save)
5. Add US4 → Test independently → Deploy/Demo (delete/replace)
6. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done:
   - Parallel task 1: US1 (Configure keys)
   - Parallel task 2: US3 (Workflow integration)
3. After US1 completes:
   - Parallel task 3: US2 (Validation — extends US1)
   - Parallel task 4: US4 (Manage — extends US1)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **NEVER** log or return plaintext API keys (FR-010, FR-011)
- Use `verifyProjectOwnership()` for all mutating endpoints
- Trim whitespace before validation and storage
