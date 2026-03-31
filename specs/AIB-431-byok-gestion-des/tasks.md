# Tasks: BYOK - gestion des cles API utilisateur pour les agents AI

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-431-byok-gestion-des/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-431-byok-gestion-des/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-431-byok-gestion-des/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-431-byok-gestion-des/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-431-byok-gestion-des/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-431-byok-gestion-des/contracts/`

**Tests**: Tests are required for this feature because `plan.md` explicitly assigns integration, component, unit, and minimal E2E coverage to the user stories.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently once the shared foundation is complete.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel after dependencies are satisfied
- **[Story]**: Present only on user story tasks (`[US1]`, `[US2]`, `[US3]`)
- Every task includes the exact file path that should be changed or validated

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared feature entry points and naming scaffolding used by the later implementation phases.

- [ ] T001 Add the AI-credentials query key namespace and cache helpers in `/home/runner/work/ai-board/ai-board/target/app/lib/query-keys.ts`
- [ ] T002 [P] Create shared AI credential enums, DTOs, and provider metadata in `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/types.ts`
- [ ] T003 [P] Scaffold the personal AI credentials settings page shell in `/home/runner/work/ai-board/ai-board/target/app/settings/ai-credentials/page.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the persistence, validation, crypto, and shared service layer that every user story depends on.

**⚠️ CRITICAL**: No user story work should start before this phase is complete.

- [ ] T004 Extend the Prisma schema with `UserAiCredential`, enum types, and the `User.aiCredentials` relation in `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`
- [ ] T005 Create the Prisma migration for `UserAiCredential` tables, indexes, and enum changes in `/home/runner/work/ai-board/ai-board/target/prisma/migrations/20260331120000_add_user_ai_credentials/migration.sql`
- [ ] T006 [P] Implement shared Zod request/response validation for labels, provider/type pairs, and workflow payloads in `/home/runner/work/ai-board/ai-board/target/lib/validations/ai-credentials.ts`
- [ ] T007 [P] Implement encryption, decryption, masking, and secret-shredding helpers in `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/crypto.ts`
- [ ] T008 [P] Implement the Anthropic provider adapter for local format checks and server verification in `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/providers/anthropic.ts`
- [ ] T009 Implement Prisma data-access helpers for active credential lookup, upsert, and soft delete in `/home/runner/work/ai-board/ai-board/target/lib/db/ai-credentials.ts`
- [ ] T010 Implement the shared credential service for masked summaries, readiness transitions, and replacement semantics in `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/service.ts`
- [ ] T011 Implement workflow owner resolution and provider auth-mode mapping in `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/workflow.ts`
- [ ] T012 [P] Add unit coverage for encryption, decryption, invalid-key handling, and delete-time shredding in `/home/runner/work/ai-board/ai-board/target/tests/unit/ai-credentials/crypto.test.ts`

**Checkpoint**: Foundation ready. User story implementation can now proceed with a shared schema, service layer, and crypto boundary.

---

## Phase 3: User Story 1 - Configurer une credentiel Anthropic utilisable (Priority: P1) 🎯 MVP

**Goal**: Let an authenticated user save one valid Anthropic credential from personal settings and see only masked metadata after verification.

**Independent Test**: Open `/settings/ai-credentials`, save a valid Anthropic credential, and confirm the page re-renders a masked summary with label, type, and `READY` status while rejecting invalid submissions.

### Tests for User Story 1

- [ ] T013 [P] [US1] Add integration coverage for list, create, verify, and masked-summary responses in `/home/runner/work/ai-board/ai-board/target/tests/integration/ai-credentials/settings-api.test.ts`
- [ ] T014 [P] [US1] Add component coverage for provider/type selection, inline validation, and status rendering in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/ai-credential-settings-card.test.tsx`
- [ ] T015 [P] [US1] Add a Playwright smoke test for the save flow and post-save masked display in `/home/runner/work/ai-board/ai-board/target/tests/e2e/ai-credentials.spec.ts`

### Implementation for User Story 1

- [ ] T016 [P] [US1] Implement the AI-credential React Query hooks for list and save mutations in `/home/runner/work/ai-board/ai-board/target/lib/hooks/mutations/useAiCredentials.ts`
- [ ] T017 [P] [US1] Implement the masked credential list and primary settings card in `/home/runner/work/ai-board/ai-board/target/components/ai-credentials/credential-list.tsx` and `/home/runner/work/ai-board/ai-board/target/components/ai-credentials/credential-settings-card.tsx`
- [ ] T018 [P] [US1] Implement the save credential dialog with client-side validation and submit states in `/home/runner/work/ai-board/ai-board/target/components/ai-credentials/save-credential-dialog.tsx`
- [ ] T019 [US1] Implement the session-authenticated list endpoint for masked credential summaries in `/home/runner/work/ai-board/ai-board/target/app/api/settings/ai-credentials/route.ts`
- [ ] T020 [US1] Implement the provider-scoped upsert endpoint with provider verification and masked responses in `/home/runner/work/ai-board/ai-board/target/app/api/settings/ai-credentials/[provider]/route.ts`
- [ ] T021 [US1] Wire the settings page to the new hooks and components in `/home/runner/work/ai-board/ai-board/target/app/settings/ai-credentials/page.tsx`
- [ ] T022 [US1] Add an AI Credentials navigation entry and coverage for it in `/home/runner/work/ai-board/ai-board/target/components/auth/user-menu.tsx` and `/home/runner/work/ai-board/ai-board/target/tests/unit/components/user-menu.test.tsx`

**Checkpoint**: User Story 1 is complete when a user can save exactly one valid Anthropic credential, see only masked metadata afterward, and receive actionable validation errors for invalid credentials.

---

## Phase 4: User Story 2 - Lancer un workflow avec la credentiel du owner (Priority: P1)

**Goal**: Ensure every AI workflow launch resolves only the project owner’s credential through a workflow-only endpoint and fails closed when that credential is unusable.

**Independent Test**: Launch a workflow against a project with a `READY` owner credential and against a project without one, and confirm the workflow-only endpoint returns the owner secret only in the allowed case while blocked launches surface remediation guidance before AI execution begins.

### Tests for User Story 2

- [ ] T023 [P] [US2] Add integration coverage for workflow token auth, owner resolution, and fail-closed responses in `/home/runner/work/ai-board/ai-board/target/tests/integration/ai-credentials/workflow-owner-credential.test.ts`
- [ ] T024 [P] [US2] Extend workflow launch gating coverage for allowed and blocked transitions in `/home/runner/work/ai-board/ai-board/target/tests/integration/tickets/transitions.test.ts`

### Implementation for User Story 2

- [ ] T025 [US2] Implement the workflow-only owner credential retrieval endpoint in `/home/runner/work/ai-board/ai-board/target/app/api/internal/workflows/projects/[projectId]/providers/[provider]/credential/route.ts`
- [ ] T026 [US2] Enforce owner credential eligibility before AI job creation in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/jobs/route.ts`
- [ ] T027 [US2] Surface blocked-launch remediation details through the stage-transition mutation flow in `/home/runner/work/ai-board/ai-board/target/app/lib/hooks/mutations/useStageTransition.ts`

**Checkpoint**: User Story 2 is complete when workflow-authenticated callers can resolve only the owner credential, member launches still use the owner credential, and launches fail before AI execution if the owner credential is missing or unusable.

---

## Phase 5: User Story 3 - Gerer le cycle de vie de la credentiel sans re-exposer le secret (Priority: P2)

**Goal**: Support replacement, deletion, and masked lifecycle visibility for Anthropic credentials without ever re-exposing the full secret.

**Independent Test**: Replace an existing credential, confirm the next workflow uses the new one, then delete it and confirm the next workflow is blocked while the settings page never reveals the old secret.

### Tests for User Story 3

- [ ] T028 [P] [US3] Extend settings API integration coverage for replacement, deletion, and readiness transitions in `/home/runner/work/ai-board/ai-board/target/tests/integration/ai-credentials/settings-api.test.ts`
- [ ] T029 [P] [US3] Extend component coverage for masked persisted state and delete confirmation flows in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/ai-credential-settings-card.test.tsx`
- [ ] T030 [P] [US3] Extend Playwright coverage for replace and delete lifecycle flows in `/home/runner/work/ai-board/ai-board/target/tests/e2e/ai-credentials.spec.ts`

### Implementation for User Story 3

- [ ] T031 [US3] Implement the delete credential dialog and destructive mutation wiring in `/home/runner/work/ai-board/ai-board/target/components/ai-credentials/delete-credential-dialog.tsx`
- [ ] T032 [US3] Add provider-scoped delete handling with soft-delete shredding semantics in `/home/runner/work/ai-board/ai-board/target/app/api/settings/ai-credentials/[provider]/route.ts`
- [ ] T033 [US3] Update masked lifecycle messaging and replacement/delete states in `/home/runner/work/ai-board/ai-board/target/components/ai-credentials/credential-settings-card.tsx`

**Checkpoint**: User Story 3 is complete when replacement takes effect for the next launch, deletion immediately removes launch eligibility, and every later view remains masked.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize generated artifacts, verify the designed scenarios, and clear project-wide quality gates.

- [ ] T034 [P] Regenerate the Prisma client for the new credential schema rooted in `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`
- [ ] T035 [P] Validate the designed user and workflow scenarios against `/home/runner/work/ai-board/ai-board/target/specs/AIB-431-byok-gestion-des/quickstart.md`
- [ ] T036 [P] Run `bun run type-check` and fix any BYOK-related issues in `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/`
- [ ] T037 [P] Run `bun run lint` and fix any BYOK-related issues in `/home/runner/work/ai-board/ai-board/target/app/settings/ai-credentials/page.tsx` and `/home/runner/work/ai-board/ai-board/target/components/ai-credentials/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and can start immediately.
- **Phase 2: Foundational** depends on Phase 1 and blocks every user story.
- **Phase 3: US1** depends on Phase 2 and delivers the MVP credential-management flow.
- **Phase 4: US2** depends on Phase 2; delivery should follow US1 so the workflow path can be exercised with real saved credentials.
- **Phase 5: US3** depends on Phase 2 and reuses the save/list flow from US1 plus the launch gating from US2.
- **Phase 6: Polish** depends on the stories selected for release.

### User Story Dependency Graph

- **US1 (P1)**: Starts after Foundational and has no dependency on other user stories.
- **US2 (P1)**: Starts after Foundational, but the recommended completion order is **US1 -> US2** so workflow launch behavior can be validated against the real settings flow.
- **US3 (P2)**: Starts after Foundational, but the recommended completion order is **US1 -> US2 -> US3** because it extends both the settings lifecycle and the launch gating behavior.

### Within Each User Story

- Write the listed tests first and confirm they fail before implementation.
- Finish shared hooks/services before wiring routes and UI that consume them.
- Keep each story independently testable at its checkpoint before moving on.

### Parallel Opportunities

- In Phase 1, `T002` and `T003` can run in parallel after `T001`.
- In Phase 2, `T006`, `T007`, `T008`, and `T012` can run in parallel after `T004` and `T005`.
- In US1, `T013`, `T014`, `T015`, `T016`, `T017`, and `T018` can run in parallel once the foundation is ready.
- In US2, `T023` and `T024` can run in parallel before `T025`, and `T026` can proceed once `T025` is in place.
- In US3, `T028`, `T029`, and `T030` can run in parallel before `T031` through `T033`.
- In Phase 6, `T034` through `T037` can be split across parallel validation agents once implementation is complete.

---

## Parallel Example: User Story 1

```bash
Task: "T013 [US1] Add integration coverage in tests/integration/ai-credentials/settings-api.test.ts"
Task: "T014 [US1] Add component coverage in tests/unit/components/ai-credential-settings-card.test.tsx"
Task: "T015 [US1] Add Playwright smoke coverage in tests/e2e/ai-credentials.spec.ts"
Task: "T016 [US1] Implement hooks in lib/hooks/mutations/useAiCredentials.ts"
Task: "T018 [US1] Implement save dialog in components/ai-credentials/save-credential-dialog.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T023 [US2] Add workflow-owner integration coverage in tests/integration/ai-credentials/workflow-owner-credential.test.ts"
Task: "T024 [US2] Extend launch gating coverage in tests/integration/tickets/transitions.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T028 [US3] Extend settings API lifecycle coverage in tests/integration/ai-credentials/settings-api.test.ts"
Task: "T029 [US3] Extend component lifecycle coverage in tests/unit/components/ai-credential-settings-card.test.tsx"
Task: "T030 [US3] Extend Playwright lifecycle coverage in tests/e2e/ai-credentials.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (`US1`) and validate the masked save flow independently.
3. Stop and review the UX, provider verification behavior, and masked persistence before starting workflow integration.

### Incremental Delivery

1. Deliver **US1** to establish BYOK configuration in personal settings.
2. Deliver **US2** to make workflow launches owner-scoped and fail closed.
3. Deliver **US3** to finish credential rotation and deletion behavior.
4. Run the Phase 6 quality gates before merging.

### Suggested MVP Scope

- **Recommended MVP**: Phase 1, Phase 2, and Phase 3 (`US1`) only.
- **Why**: `US1` provides the minimal user-visible BYOK capability and unlocks realistic validation for the later workflow and lifecycle stories.

---

## Notes

- All tasks use the required checklist format: checkbox, task ID, optional `[P]`, required story labels for user-story work, and exact file paths.
- `US1` is the primary MVP increment.
- `US2` and `US3` remain independently testable using the saved credential state created by the shared foundation and `US1`.
