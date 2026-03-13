# Tasks: BYOK - Bring Your Own API Key

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-283-byok-bring-your/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-283-byok-bring-your/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-283-byok-bring-your/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-283-byok-bring-your/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-283-byok-bring-your/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-283-byok-bring-your/contracts/byok-api.yaml`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-283-byok-bring-your/quickstart.md`

**Tests**: Include unit, component, and backend integration coverage because the specification and quickstart explicitly require them. No Playwright tasks are included.

**Organization**: Tasks are grouped by user story to preserve independent implementation and verification.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the schema and shared DTO surface used by all BYOK flows.

- [X] T001 Add `AiProvider`, `AiCredentialValidationStatus`, `WorkflowCredentialSource`, `ProjectAiCredential`, and `JobAiCredentialSnapshot` to `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`
- [X] T002 Create the BYOK migration SQL under `/home/runner/work/ai-board/ai-board/target/prisma/migrations/` for the `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` changes
- [X] T003 [P] Define BYOK domain types in `/home/runner/work/ai-board/ai-board/target/lib/types/ai-credentials.ts`
- [X] T004 [P] Define request and response validation schemas in `/home/runner/work/ai-board/ai-board/target/lib/schemas/ai-credentials.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared security and orchestration layer that every user story depends on.

**⚠️ CRITICAL**: No user story work should start before this phase is complete.

- [X] T005 Regenerate the Prisma client from `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` with `bunx prisma generate`
- [X] T006 Implement server-side encryption and masking helpers using `PROJECT_CREDENTIAL_ENCRYPTION_KEY` in `/home/runner/work/ai-board/ai-board/target/lib/security/project-ai-credentials.ts`
- [X] T007 [P] Implement command and agent to provider resolution in `/home/runner/work/ai-board/ai-board/target/lib/services/workflow-provider-requirements.ts`
- [X] T008 [P] Implement Anthropic and OpenAI validation adapters with sanitized error mapping in `/home/runner/work/ai-board/ai-board/target/lib/services/ai-provider-validation.ts`
- [X] T009 Implement BYOK persistence, list shaping, validation orchestration, deletion, and job snapshot creation in `/home/runner/work/ai-board/ai-board/target/lib/services/ai-credential-service.ts`

**Checkpoint**: Shared BYOK persistence, crypto, validation, and requirement resolution are ready for story work.

---

## Phase 3: User Story 1 - Save and validate provider keys (Priority: P1) 🎯 MVP

**Goal**: Let a project owner save Anthropic and OpenAI keys, validate them safely, and see only masked status in project settings.

**Independent Test**: From project settings, save a valid Anthropic key and a valid OpenAI key, validate each one successfully, and confirm the UI shows only masked status plus validation state.

### Tests for User Story 1

- [X] T010 [P] [US1] Add unit coverage for encryption, decryption, and masked metadata helpers in `/home/runner/work/ai-board/ai-board/target/tests/unit/project-ai-credentials.test.ts`
- [X] T011 [P] [US1] Add component coverage for owner save and validate states in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/ai-credentials-card.test.tsx`
- [X] T012 [P] [US1] Add backend integration coverage for listing, saving, and validating provider keys in `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/ai-credentials.test.ts`

### Implementation for User Story 1

- [X] T013 [P] [US1] Implement provider status listing with owner/member response shaping in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/ai-credentials/route.ts`
- [X] T014 [US1] Implement provider save and replace handling in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/ai-credentials/[provider]/route.ts`
- [X] T015 [US1] Implement explicit re-validation of stored keys in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/ai-credentials/[provider]/validate/route.ts`
- [X] T016 [P] [US1] Build provider status row rendering for masked state and validation badges in `/home/runner/work/ai-board/ai-board/target/components/settings/ai-provider-status-row.tsx`
- [X] T017 [US1] Build the owner/member BYOK settings card with save and validate actions in `/home/runner/work/ai-board/ai-board/target/components/settings/ai-credentials-card.tsx`
- [X] T018 [US1] Add the BYOK settings card to `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/settings/page.tsx`

**Checkpoint**: Owners can save and validate keys end to end, and members can see only high-level provider status.

---

## Phase 4: User Story 2 - Rotate or remove provider keys safely (Priority: P1)

**Goal**: Let a project owner replace or delete stored keys without exposing previous secrets and without granting mutation access to members.

**Independent Test**: Replace an existing provider key and confirm only the new suffix is shown, then delete that key and confirm the provider becomes `NOT_CONFIGURED` while a member still sees read-only status.

### Tests for User Story 2

- [X] T019 [P] [US2] Extend project credential integration coverage for replace, delete, and member read-only cases in `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/ai-credentials.test.ts`
- [X] T020 [P] [US2] Extend settings card component coverage for replace and delete actions in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/ai-credentials-card.test.tsx`

### Implementation for User Story 2

- [X] T021 [US2] Implement provider deletion and `NOT_CONFIGURED` responses in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/ai-credentials/[provider]/route.ts`
- [X] T022 [US2] Update rotation and deletion orchestration, ownership metadata, and member-safe status shaping in `/home/runner/work/ai-board/ai-board/target/lib/services/ai-credential-service.ts`
- [X] T023 [US2] Add replace and delete UX plus member read-only states in `/home/runner/work/ai-board/ai-board/target/components/settings/ai-credentials-card.tsx`

**Checkpoint**: Rotation and deletion work safely for owners, and non-owners remain status-only readers.

---

## Phase 5: User Story 3 - Launch workflows only when required keys are available (Priority: P1)

**Goal**: Block workflow dispatch before launch when required providers are missing or invalid, and provide job-scoped credentials only to the running workflow.

**Independent Test**: Attempt to launch a workflow with a missing or invalid required provider and confirm the launch is blocked with provider-specific guidance, then launch again with valid credentials and confirm the workflow can fetch only its job snapshot credentials.

### Tests for User Story 3

- [X] T024 [P] [US3] Add unit coverage for workflow provider requirement resolution in `/home/runner/work/ai-board/ai-board/target/tests/unit/ai-provider-requirements.test.ts`
- [X] T025 [P] [US3] Add backend integration coverage for BYOK launch blocking and success paths in `/home/runner/work/ai-board/ai-board/target/tests/integration/tickets/transition-byok.test.ts`

### Implementation for User Story 3

- [X] T026 [US3] Extend pre-dispatch provider gating and credential snapshot creation in `/home/runner/work/ai-board/ai-board/target/lib/workflows/transition.ts`
- [X] T027 [P] [US3] Implement workflow-token-authenticated snapshot retrieval in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/jobs/[jobId]/provider-credentials/route.ts`
- [X] T028 [US3] Extend BYOK failure payloads in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
- [X] T029 [P] [US3] Update BYOK runtime provider auth export logic in `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh`
- [X] T030 [P] [US3] Update workflow runtime credential fetch and env wiring in `/home/runner/work/ai-board/ai-board/target/.github/workflows/speckit.yml`, `/home/runner/work/ai-board/ai-board/target/.github/workflows/quick-impl.yml`, `/home/runner/work/ai-board/ai-board/target/.github/workflows/verify.yml`, `/home/runner/work/ai-board/ai-board/target/.github/workflows/iterate.yml`, `/home/runner/work/ai-board/ai-board/target/.github/workflows/cleanup.yml`, and `/home/runner/work/ai-board/ai-board/target/.github/workflows/ai-board-assist.yml`

**Checkpoint**: Workflow launches are gated before dispatch, valid launches snapshot credentials, and workflows consume only job-scoped secrets.

---

## Phase 6: User Story 4 - Protect secrets throughout the user journey (Priority: P2)

**Goal**: Ensure saved keys never appear in UI responses, workflow-facing status, or sanitized validation errors beyond the allowed masked suffix.

**Independent Test**: Save keys, revisit settings, trigger validation failures, review workflow-related responses, and confirm no full key value appears in any user-visible payload or message.

### Tests for User Story 4

- [X] T031 [P] [US4] Extend project credential integration coverage for sanitized validation failures and masked-only responses in `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/ai-credentials.test.ts`
- [X] T032 [P] [US4] Extend BYOK transition integration coverage to assert workflow-visible responses never expose secrets in `/home/runner/work/ai-board/ai-board/target/tests/integration/tickets/transition-byok.test.ts`

### Implementation for User Story 4

- [X] T033 [US4] Harden provider-safe validation messages and redaction behavior in `/home/runner/work/ai-board/ai-board/target/lib/services/ai-provider-validation.ts`
- [X] T034 [US4] Restrict workflow credential payloads to authenticated job snapshots only in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/jobs/[jobId]/provider-credentials/route.ts`
- [X] T035 [US4] Enforce masked-only status rendering for members and owners in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/ai-credentials/route.ts` and `/home/runner/work/ai-board/ai-board/target/components/settings/ai-provider-status-row.tsx`

**Checkpoint**: All BYOK surfaces remain masked and sanitized, even for validation failures and workflow-facing responses.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and contract alignment across all user stories.

- [X] T036 [P] Validate the implemented flows against `/home/runner/work/ai-board/ai-board/target/specs/AIB-283-byok-bring-your/quickstart.md`
- [X] T037 [P] Reconcile API behavior with `/home/runner/work/ai-board/ai-board/target/specs/AIB-283-byok-bring-your/contracts/byok-api.yaml`
- [X] T038 Run `bun run type-check` and `bun run lint` after the BYOK changes rooted in `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`, `/home/runner/work/ai-board/ai-board/target/lib/`, `/home/runner/work/ai-board/ai-board/target/app/`, `/home/runner/work/ai-board/ai-board/target/components/`, and `/home/runner/work/ai-board/ai-board/target/tests/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies.
- **Phase 2: Foundational**: Depends on Phase 1 and blocks all story work.
- **Phase 3: User Story 1**: Depends on Phase 2 and delivers the MVP.
- **Phase 4: User Story 2**: Depends on Phase 3 because it extends the same owner/member credential management surface.
- **Phase 5: User Story 3**: Depends on Phase 2 for shared services and on Phase 3 for persisted credential state; it does not require US2 to be complete.
- **Phase 6: User Story 4**: Depends on Phases 3 and 5 because it hardens both settings and workflow-facing secret handling.
- **Phase 7: Polish**: Depends on the user stories selected for release.

### User Story Dependencies

- **US1 (P1)**: First deliverable and recommended MVP.
- **US2 (P1)**: Builds on US1 persistence and settings UI behavior.
- **US3 (P1)**: Builds on foundational services plus the persisted credential state introduced in US1.
- **US4 (P2)**: Hardening pass across US1 and US3 surfaces.

### Within Each User Story

- Test tasks should be written first and fail before implementation.
- API and service changes should land before the final UI wiring that consumes them.
- Workflow scripts and YAML changes should follow the server-side credential snapshot endpoint they depend on.

### Parallel Opportunities

- `T003` and `T004` can run in parallel after `T001`.
- `T007` and `T008` can run in parallel after `T006`.
- In US1, `T010`, `T011`, `T012`, `T013`, and `T016` can proceed in parallel once Phase 2 is complete.
- In US2, `T019` and `T020` can proceed in parallel before `T021` to `T023`.
- In US3, `T024`, `T025`, `T027`, `T029`, and `T030` can proceed in parallel after `T026` is defined enough to stabilize the interfaces.
- In US4, `T031` and `T032` can proceed in parallel with `T033` once the sanitized error contract is agreed.

---

## Parallel Example: User Story 1

```bash
Task: "T010 [US1] Add unit coverage for encryption, decryption, and masked metadata helpers in tests/unit/project-ai-credentials.test.ts"
Task: "T011 [US1] Add component coverage for owner save and validate states in tests/unit/components/ai-credentials-card.test.tsx"
Task: "T012 [US1] Add backend integration coverage for listing, saving, and validating provider keys in tests/integration/projects/ai-credentials.test.ts"
Task: "T016 [US1] Build provider status row rendering for masked state and validation badges in components/settings/ai-provider-status-row.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T024 [US3] Add unit coverage for workflow provider requirement resolution in tests/unit/ai-provider-requirements.test.ts"
Task: "T025 [US3] Add backend integration coverage for BYOK launch blocking and success paths in tests/integration/tickets/transition-byok.test.ts"
Task: "T027 [US3] Implement workflow-token-authenticated snapshot retrieval in app/api/projects/[projectId]/jobs/[jobId]/provider-credentials/route.ts"
Task: "T029 [US3] Update BYOK runtime provider auth export logic in .github/scripts/run-agent.sh"
```

---

## Implementation Strategy

### MVP First

1. Complete Phases 1 and 2.
2. Complete Phase 3 (US1).
3. Validate the independent test for US1 before moving on.

### Incremental Delivery

1. Add Phase 4 to complete safe key lifecycle management.
2. Add Phase 5 to gate workflow launches and deliver end-to-end BYOK execution.
3. Add Phase 6 to harden all user-visible and workflow-visible secret surfaces.
4. Finish with Phase 7 verification and contract alignment.
