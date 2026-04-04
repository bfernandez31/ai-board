# Tasks: Support OpenAI Credentials for Codex Agent

**Input**: Design documents from `/specs/AIB-536-support-openai-credentials/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/credentials-api.md

**Tests**: Included by default (constitution). All test tasks extend existing test files.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Schema & Provider Foundation)

**Purpose**: Database migration and core provider infrastructure that all user stories depend on.

- [ ] T001 Add `OPENAI` to `CredentialProvider` enum in `prisma/schema.prisma` and run migration (`bunx prisma migrate dev --name add-openai-credential-provider` then `bunx prisma generate`)
- [ ] T002 [P] Create OpenAI provider module in `lib/ai-credentials/providers/openai.ts` implementing `validateFormat(credentialType, value)` (sk- prefix + min 20 chars, reject OAUTH_TOKEN) and `verifyWithProvider(credentialType, value)` (GET `https://api.openai.com/v1/models` with Bearer token, 10s timeout, same result codes as Anthropic)
- [ ] T003 [P] Create provider registry in `lib/ai-credentials/providers/index.ts` exporting `getProviderModule(provider)` that returns `{ validateFormat, verifyWithProvider }` for ANTHROPIC or OPENAI

---

## Phase 2: Foundational (Type System & Service Layer)

**Purpose**: Core type updates and service layer changes that MUST be complete before any user story can be implemented.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Update type definitions in `lib/ai-credentials/types.ts`: add `AGENT_PROVIDER_MAP`, `PROVIDER_ALLOWED_TYPES`, refactor `ENV_VAR_MAP` to provider-aware composite keys, add `getEnvVar(provider, credentialType)` helper, widen `WorkflowCredentialRequest.provider` and `WorkflowResolvedCredential.provider` to `CredentialProvider`
- [ ] T005 Update credential service in `lib/ai-credentials/service.ts`: replace direct `anthropic` provider import with `getProviderModule(credential.provider)` from the registry; update `testCredential()` to route through correct provider module; scope OAuth skip logic to `ANTHROPIC` + `OAUTH_TOKEN` only

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Save OpenAI API Key (Priority: P1) MVP

**Goal**: Users can save an OpenAI API key through the credentials form with format validation, live verification, encryption, and upsert behavior.

**Independent Test**: Navigate to Settings > AI Credentials, select OpenAI provider, enter a key, verify it is stored with READY status.

### Tests for User Story 1
**RULE (constitution): Extend existing test files. All paths verified against filesystem.**

- [ ] T006 [P] [US1] Extend `tests/unit/ai-credentials.test.ts` with OpenAI format validation tests: sk- prefix passes, missing prefix fails, too-short key fails, OAUTH_TOKEN rejected for OPENAI, provider registry returns correct module for each provider
- [ ] T007 [P] [US1] Extend `tests/unit/components/credential-form.test.tsx` with provider selection tests: provider selector enabled with ANTHROPIC + OPENAI options, selecting OPENAI locks credential type to API_KEY, OpenAI format validation (sk- prefix), switching back to ANTHROPIC re-enables OAUTH_TOKEN
- [ ] T008 [P] [US1] Extend `tests/integration/credentials/credential-validation.test.ts` with OpenAI API validation tests: POST with OPENAI provider and valid format succeeds, POST with OPENAI + OAUTH_TOKEN returns 400, POST with OPENAI + invalid key format returns 400

### Implementation for User Story 1

- [ ] T009 [US1] Update credential API route in `app/api/credentials/route.ts`: add `'OPENAI'` to Zod provider enum, add provider-type constraint validation (OPENAI + OAUTH_TOKEN = 400), use `getProviderModule(validated.provider)` for format validation and live verification, scope OAuth skip to ANTHROPIC only
- [ ] T010 [US1] Update credential form in `components/credentials/credential-form.tsx`: enable provider Select, add OPENAI SelectItem, when OPENAI selected force credentialType to API_KEY and disable type selector (hide OAUTH_TOKEN), update placeholder to `sk-proj-...`, update client-side `validateFormat()` for sk- prefix when OPENAI
- [ ] T011 [US1] Verify provider display in `components/credentials/credential-item.tsx`: ensure OPENAI provider name displays correctly, verify verification messages reference correct provider name

**Checkpoint**: User Story 1 fully functional - users can save, validate, and store OpenAI API keys

---

## Phase 4: User Story 2 - Codex Workflow Dispatches with OpenAI Credential (Priority: P1)

**Goal**: Workflow dispatch resolves the correct credential (OPENAI for Codex, ANTHROPIC for Claude) based on the ticket's effective agent and injects the correct environment variable.

**Independent Test**: Dispatch a workflow for a Codex-agent ticket and verify OPENAI_API_KEY env var is set; dispatch for CLAUDE ticket and verify ANTHROPIC_API_KEY is used.

### Tests for User Story 2
**RULE (constitution): Extend existing test files.**

- [ ] T012 [P] [US2] Extend `tests/unit/credential-dispatch-guard.test.ts` with provider-aware dispatch tests: Codex-agent ticket resolves OPENAI provider, missing OPENAI credential blocks dispatch with provider-specific error, CLAUDE ticket continues to resolve ANTHROPIC
- [ ] T013 [P] [US2] Extend `tests/integration/credentials/workflow-credential.test.ts` with OpenAI workflow credential tests: GET `/api/internal/credentials?projectId=1&provider=OPENAI` returns OPENAI_API_KEY envVar, default (no provider param) returns ANTHROPIC credential (backward compat), provider-specific 404 error message

### Implementation for User Story 2

- [ ] T014 [US2] Update workflow credential functions in `lib/ai-credentials/workflow.ts`: add optional `provider` parameter to `getOwnerCredential()` (default ANTHROPIC), use `getEnvVar(credential.provider, credential.credentialType)` in `buildWorkflowPayload()`, replace `MISSING_CREDENTIAL_ERROR` with `getMissingCredentialError(provider)` for provider-specific messages
- [ ] T015 [US2] Update transition dispatch in `lib/workflows/transition.ts`: after `resolveEffectiveAgent(ticket)`, compute provider via `AGENT_PROVIDER_MAP[effectiveAgent]`, pass provider to `getOwnerCredential()`, use `getMissingCredentialError(provider)` for errors
- [ ] T016 [US2] Update internal credential endpoint in `app/api/internal/credentials/route.ts`: add optional `provider` query param (default ANTHROPIC), pass provider to `getOwnerCredential()`, update 404 error message to be provider-aware

**Checkpoint**: User Story 2 fully functional - Codex workflows resolve OpenAI credentials, Claude workflows unchanged

---

## Phase 5: User Story 3 - Manage OpenAI Credentials (Priority: P2)

**Goal**: Users can test and delete their stored OpenAI credentials through the same UI and API used for Anthropic credentials.

**Independent Test**: Test an existing OpenAI credential via the UI test button; delete it via the delete confirmation dialog.

### Tests for User Story 3
**RULE (constitution): Extend existing test files.**

- [ ] T017 [P] [US3] Extend `tests/integration/credentials/credentials-api.test.ts` with OpenAI credential lifecycle tests: full CRUD lifecycle for OPENAI credential, user can have both ANTHROPIC and OPENAI credentials simultaneously, replacing OPENAI credential (upsert behavior)

### Implementation for User Story 3

- [ ] T018 [US3] No additional implementation needed - credential test and delete operations are provider-agnostic. Verify that POST `/api/credentials/[id]/test` correctly routes through OpenAI provider module for OPENAI credentials (already handled by T005 service update). Verify DELETE works for OPENAI credentials.

**Checkpoint**: User Story 3 complete - full credential lifecycle (save, test, delete) works for OpenAI

---

## Phase 6: User Story 4 - Hardcoded CLAUDE Commands Use Anthropic Credentials (Priority: P2)

**Goal**: Code-review and ai-board-assist commands always resolve Anthropic credentials, regardless of the ticket's configured agent.

**Independent Test**: Run a code-review or ai-board-assist command on a Codex-agent ticket and verify it resolves the Anthropic credential.

### Tests for User Story 4
**RULE (constitution): Extend existing test files.**

- [ ] T019 [US4] Extend `tests/unit/credential-dispatch-guard.test.ts` with hardcoded CLAUDE command tests: ai-board-assist dispatch always checks ANTHROPIC credential regardless of ticket agent, code-review dispatch always checks ANTHROPIC credential

### Implementation for User Story 4

- [ ] T020 [P] [US4] Update ai-board-assist dispatch in `app/lib/workflows/dispatch-ai-board.ts`: always pass `provider: 'ANTHROPIC'` to `getOwnerCredential()` regardless of ticket agent
- [ ] T021 [P] [US4] Update rollback-reset dispatch in `app/lib/workflows/dispatch-rollback-reset.ts`: resolve provider from agent via `AGENT_PROVIDER_MAP[resolveEffectiveAgent(ticket)]`, pass provider to `getOwnerCredential()`

**Checkpoint**: User Story 4 complete - hardcoded CLAUDE commands always use Anthropic credentials

---

## Phase 7: User Story 5 - Health-Scan Credential Resolution (Priority: P3)

**Goal**: Health scan dispatches always resolve Anthropic credentials (health scans run Claude).

**Independent Test**: Trigger a health scan and verify it resolves the ANTHROPIC credential.

### Implementation for User Story 5

- [ ] T022 [US5] Update health scan dispatch in `lib/health/scan-dispatch.ts`: pass `'ANTHROPIC'` to `getOwnerCredential()` since health scans always use Claude

**Checkpoint**: User Story 5 complete - health scans correctly resolve credentials

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories.

- [ ] T023 Run `bun run type-check` to verify all type changes compile cleanly across all modified files
- [ ] T024 Run `bun run lint` to verify no linting regressions
- [ ] T025 Run `bun run test:unit` to verify all unit tests pass (T006, T007, T012, T019)
- [ ] T026 Run `bun run test:integration` to verify all integration tests pass (T008, T013, T017)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (needs Prisma types + provider registry)
- **Phase 3 (US1 - Save Key)**: Depends on Phase 2 (needs service layer + types)
- **Phase 4 (US2 - Workflow Dispatch)**: Depends on Phase 2 (needs types + workflow functions)
- **Phase 5 (US3 - Manage)**: Depends on Phase 3 (needs save working first)
- **Phase 6 (US4 - Hardcoded CLAUDE)**: Depends on Phase 4 (needs workflow dispatch updated)
- **Phase 7 (US5 - Health Scan)**: Depends on Phase 2 (needs types)
- **Phase 8 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: After Phase 2 - no dependencies on other stories
- **US2 (P1)**: After Phase 2 - independent of US1 (different files)
- **US3 (P2)**: After US1 (needs save to work before test/delete)
- **US4 (P2)**: After US2 (needs workflow dispatch updated)
- **US5 (P3)**: After Phase 2 - independent of other stories

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel (different new files)
- **Phase 3 (US1)**: T006, T007, T008 tests can run in parallel; T009, T010 touch different files
- **Phase 4 (US2)**: T012, T013 tests can run in parallel
- **US1 and US2**: Can start in parallel after Phase 2 (touch different files)
- **US4**: T020, T021 can run in parallel (different files)
- **US5**: Can run in parallel with US3 or US4

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (different test files):
Task T006: "Extend tests/unit/ai-credentials.test.ts with OpenAI format validation"
Task T007: "Extend tests/unit/components/credential-form.test.tsx with provider selection"
Task T008: "Extend tests/integration/credentials/credential-validation.test.ts with OpenAI API tests"

# Then implement (T009 and T010 touch different files):
Task T009: "Update app/api/credentials/route.ts"
Task T010: "Update components/credentials/credential-form.tsx"
```

## Parallel Example: US1 + US2 in Parallel

```bash
# After Phase 2 completes, both stories can start simultaneously:
# Worker A: User Story 1 (API route + form)
Task T006-T011

# Worker B: User Story 2 (workflow dispatch)
Task T012-T016
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema + provider)
2. Complete Phase 2: Foundational (types + service)
3. Complete Phase 3: User Story 1 (save OpenAI key)
4. **STOP and VALIDATE**: Users can save and store OpenAI keys
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. US1 (Save Key) -> Test independently -> MVP!
3. US2 (Workflow Dispatch) -> Test independently -> Codex workflows work
4. US3 (Manage) -> Test independently -> Full CRUD lifecycle
5. US4 (Hardcoded CLAUDE) -> Test independently -> Safety for existing commands
6. US5 (Health Scan) -> Test independently -> Complete coverage
7. Each story adds value without breaking previous stories
