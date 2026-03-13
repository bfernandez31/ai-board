# Tasks: BYOK - Bring Your Own API Key

**Input**: Design documents from `/specs/AIB-247-byok-bring-your/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-keys.md

**Tests**: Included — plan.md explicitly lists test files and constitution check confirms Test-Driven approach.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema changes for ProjectApiKey model and environment setup

- [x] T001 Add `ApiKeyProvider` enum and `ProjectApiKey` model to `prisma/schema.prisma`, add `apiKeys` relation to `Project` model
- [x] T002 Run Prisma migration (`bunx prisma migrate dev --name add_project_api_keys`) and regenerate client

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Create AES-256-GCM encrypt/decrypt utilities in `lib/crypto/encryption.ts` using Node.js native `crypto` module with `API_KEY_ENCRYPTION_KEY` env var
- [x] T004 [P] Create provider-specific format validation in `lib/validation/api-key-formats.ts` (Anthropic: `sk-ant-` prefix, OpenAI: `sk-` prefix, min length 20)
- [x] T005 Create database CRUD operations in `lib/db/api-keys.ts` (`getApiKeysByProject`, `saveApiKey`, `deleteApiKey`, `getEncryptedKey`)

### Foundational Tests

- [x] T006 [P] Write unit tests for encryption in `tests/unit/crypto-encryption.test.ts` (encrypt/decrypt roundtrip, different IVs per call, tamper detection, invalid key handling)
- [x] T007 [P] Write unit tests for format validation in `tests/unit/api-key-formats.test.ts` (valid/invalid formats per provider, edge cases)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Add API Keys to Project (Priority: P1) 🎯 MVP

**Goal**: Project owners can save Anthropic/OpenAI API keys encrypted at rest, with masked display (last 4 chars only). Members see configuration status but cannot manage keys.

**Independent Test**: Navigate to project settings, enter an API key, verify it is saved with masked display. Return to settings and confirm masked preview persists without exposing full key.

### Implementation for User Story 1

- [x] T008 [P] [US1] Create `POST` handler (save/replace key) in `app/api/projects/[projectId]/api-keys/route.ts` — Zod validation, format check, encrypt, upsert via `lib/db/api-keys.ts`, owner-only via `verifyProjectOwnership`
- [x] T009 [P] [US1] Create `GET` handler (list masked keys) in `app/api/projects/[projectId]/api-keys/route.ts` — return both providers with `configured` boolean and masked preview, access via `verifyProjectAccess`
- [x] T010 [US1] Create `ApiKeysCard` component in `components/settings/api-keys-card.tsx` — provider sections with status indicator, masked preview, input field for adding key, save button; read-only mode for non-owners
- [x] T011 [US1] Add `ApiKeysCard` to project settings page in `app/projects/[projectId]/settings/page.tsx`

### Tests for User Story 1

- [x] T012 [P] [US1] Write integration tests for save and list endpoints in `tests/integration/api-keys/crud.test.ts` (save key, list masked, owner-only enforcement, member read access)
- [x] T013 [P] [US1] Write component tests for `ApiKeysCard` in `tests/unit/components/api-keys-card.test.tsx` (render states, save flow, owner vs member view)

**Checkpoint**: User Story 1 should be fully functional — owners can add keys, see masked previews, members see status

---

## Phase 4: User Story 4 — Workflow Uses Project API Key (Priority: P1)

**Goal**: Workflows retrieve the project's decrypted API key at dispatch time. If no key is configured, the workflow is blocked with an actionable error message.

**Independent Test**: Configure a key and trigger a workflow — verify workflow inputs include the API key. Remove the key and confirm workflow is blocked with clear error.

### Implementation for User Story 4

- [x] T014 [US4] Update workflow dispatch in `lib/workflows/transition.ts` to retrieve and decrypt project API key via `getEncryptedKey` + `decrypt`, inject as workflow input (`anthropicApiKey`/`openaiApiKey`), block with actionable error if key missing
- [x] T015 [US4] Update relevant workflow YAML files in `.github/workflows/` to accept API key inputs and mask them with `::add-mask::`

### Tests for User Story 4

- [x] T016 [US4] Add integration tests for workflow key injection in `tests/integration/api-keys/crud.test.ts` (key retrieval + decryption, missing key blocking)

**Checkpoint**: User Stories 1 and 4 form the complete MVP — keys can be stored and used by workflows

---

## Phase 5: User Story 2 — Validate API Key (Priority: P2)

**Goal**: Owners can test saved keys against provider APIs to confirm validity before relying on them for workflows.

**Independent Test**: Save a key, click "Test Key" button, verify validation result (valid/invalid/unreachable) displays correctly.

### Implementation for User Story 2

- [x] T017 [US2] Create `POST` handler for key validation in `app/api/projects/[projectId]/api-keys/[provider]/validate/route.ts` — decrypt stored key, call provider API (Anthropic: POST `/v1/messages`, OpenAI: GET `/v1/models`), return valid/invalid/unreachable
- [x] T018 [US2] Add "Test Key" button and validation result display to `ApiKeysCard` in `components/settings/api-keys-card.tsx`

### Tests for User Story 2

- [x] T019 [US2] Add integration tests for validate endpoint in `tests/integration/api-keys/crud.test.ts` (valid key, invalid key, no key configured, owner-only access)

**Checkpoint**: Owners can now validate keys before relying on them

---

## Phase 6: User Story 3 — Replace or Remove API Key (Priority: P2)

**Goal**: Owners can rotate keys by replacing with a new one or remove keys entirely, with warnings about workflow impact.

**Independent Test**: Save a key, replace it with a new key (verify old key gone), then remove it entirely and verify warning message about blocked workflows.

### Implementation for User Story 3

- [x] T020 [US3] Create `DELETE` handler in `app/api/projects/[projectId]/api-keys/[provider]/route.ts` — owner-only via `verifyProjectOwnership`, return warning message about blocked workflows
- [x] T021 [US3] Add "Remove Key" button with confirmation dialog and workflow-blocked warning to `ApiKeysCard` in `components/settings/api-keys-card.tsx`

### Tests for User Story 3

- [x] T022 [US3] Add integration tests for delete endpoint in `tests/integration/api-keys/crud.test.ts` (delete key, 404 for missing key, owner-only access)

**Checkpoint**: Full BYOK key lifecycle management is complete

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Security hardening and final validation across all user stories

- [ ] T023 Verify zero key exposure — audit all API responses, logs, and error traces for full key leakage in all route handlers
- [ ] T024 Add `API_KEY_ENCRYPTION_KEY` to `.env.example` with generation instructions
- [ ] T025 Run quickstart.md validation — verify all implementation steps match actual code

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — no other story dependencies
- **US4 (Phase 4)**: Depends on Foundational (Phase 2) — can run in parallel with US1 but benefits from US1 routes being complete
- **US2 (Phase 5)**: Depends on Foundational (Phase 2) — benefits from US1 (needs saved keys to validate)
- **US3 (Phase 6)**: Depends on Foundational (Phase 2) — benefits from US1 (needs saved keys to delete)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependencies on other stories
- **User Story 4 (P1)**: Can start after Foundational — uses `lib/db/api-keys.ts` and `lib/crypto/encryption.ts` from Phase 2
- **User Story 2 (P2)**: Can start after Foundational — uses saved keys from US1 flow but endpoint is independent
- **User Story 3 (P2)**: Can start after Foundational — uses saved keys from US1 flow but endpoint is independent

### Within Each User Story

- Models/utilities before services
- Services before endpoints
- Core implementation before UI integration
- Tests can run in parallel with each other

### Parallel Opportunities

- T003 + T004: Encryption and format validation are independent files
- T006 + T007: Unit tests for different utilities
- T008 + T009: GET and POST handlers in same file but independent logic
- T012 + T013: Integration and component tests are independent
- US1 + US4: Can proceed in parallel after Phase 2
- US2 + US3: Can proceed in parallel after Phase 2

---

## Parallel Example: User Story 1

```bash
# Launch route handlers in parallel:
Task: "Create POST handler in app/api/projects/[projectId]/api-keys/route.ts"
Task: "Create GET handler in app/api/projects/[projectId]/api-keys/route.ts"

# Launch tests in parallel:
Task: "Integration tests in tests/integration/api-keys/crud.test.ts"
Task: "Component tests in tests/unit/components/api-keys-card.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 4)

1. Complete Phase 1: Setup (schema + migration)
2. Complete Phase 2: Foundational (encryption, validation, DB ops, unit tests)
3. Complete Phase 3: User Story 1 (save/list keys + UI)
4. Complete Phase 4: User Story 4 (workflow integration)
5. **STOP and VALIDATE**: Test key storage + workflow injection end-to-end
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 + US4 → Test independently → Deploy/Demo (MVP!)
3. Add US2 → Test key validation → Deploy/Demo
4. Add US3 → Test key removal → Deploy/Demo
5. Polish → Security audit → Final deploy

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, stories can run in parallel:
   - Parallel task 1: User Story 1 (Add Keys)
   - Parallel task 2: User Story 4 (Workflow Integration)
3. After US1 complete:
   - Parallel task 3: User Story 2 (Validate)
   - Parallel task 4: User Story 3 (Remove)
4. Polish phase after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- `API_KEY_ENCRYPTION_KEY` env var must be set before any encryption tasks run
