# Tasks: Add Mistral (vibe CLI) as Third AI Agent Provider

**Input**: Design documents from `/specs/AIB-593-add-mistral-vibe/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend Prisma enums and regenerate client so TypeScript compilation unblocks all downstream work.

- [ ] T001 Add MISTRAL to Agent and CredentialProvider enums in prisma/schema.prisma
- [ ] T002 Run Prisma migration (`bunx prisma migrate dev --name add-mistral-agent`) and regenerate client (`bunx prisma generate`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend all TypeScript mapping tables, create the provider module, and add the icon asset. These are shared by multiple user stories and MUST complete before any story work begins.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 [P] Extend AGENT_PROVIDER_MAP, PROVIDER_ALLOWED_TYPES, and ENV_VAR_MAP with MISTRAL entries in lib/ai-credentials/types.ts
- [ ] T004 [P] Extend getMissingCredentialError with Mistral provider name in lib/ai-credentials/workflow.ts
- [ ] T005 [P] Add MISTRAL to AGENT_METADATA and extend inferAgentFromIdentifier (match `mistral`/`vibe`) in app/lib/utils/agent-icons.ts
- [ ] T006 [P] Create Mistral icon SVG asset at public/agents/mistral.svg
- [ ] T007 Create Mistral provider module (validateFormat + verifyWithProvider) following openai.ts pattern in lib/ai-credentials/providers/mistral.ts
- [ ] T008 Register Mistral module in PROVIDER_MODULES in lib/ai-credentials/providers/index.ts (depends on T007)

**Checkpoint**: `bun run type-check` passes. All `Record<Agent, ...>` and `Record<CredentialProvider, ...>` maps include MISTRAL.

---

## Phase 3: User Story 1 — Store Mistral API Key (Priority: P1) MVP

**Goal**: Project owners can store, validate, and verify a Mistral API key via the credential settings page.

**Independent Test**: Navigate to credential settings, select Mistral provider, enter an API key, and verify it appears stored with masked preview (last 4 chars).

### Tests for User Story 1

- [ ] T009 [P] [US1] Extend tests/unit/ai-credentials.test.ts with Mistral format validation cases (empty, too short, whitespace, valid, OAUTH_TOKEN rejection)
- [ ] T010 [P] [US1] Extend tests/integration/credentials/credentials-api.test.ts with Mistral credential CRUD scenarios (create, replace, list)
- [ ] T011 [P] [US1] Extend tests/integration/credentials/credential-validation.test.ts with Mistral key format validation (min length, no whitespace, type restriction)

### Implementation for User Story 1

- [ ] T012 [US1] Add Mistral provider option and format hints (placeholder, min length) to components/credentials/credential-form.tsx

**Checkpoint**: Mistral credential can be created, validated, verified, and stored via POST /api/credentials. Tests pass.

---

## Phase 4: User Story 2 — Select Mistral as Default Agent (Priority: P1)

**Goal**: Mistral appears in the project "Default Agent" dropdown. New tickets inherit Mistral as the effective agent.

**Independent Test**: Change default agent to Mistral in project settings, create a new ticket, verify it resolves to Mistral.

### Tests for User Story 2

- [ ] T013 [P] [US2] Extend tests/unit/agent-schema.test.ts with MISTRAL enum validation
- [ ] T014 [P] [US2] Extend tests/unit/agent-resolution.test.ts with MISTRAL resolution tests (project default, ticket override, fallback)
- [ ] T015 [P] [US2] Extend tests/unit/agent-icons.test.ts with Mistral icon path, label, description, and identifier inference (`mistral`, `vibe`)
- [ ] T016 [P] [US2] Extend tests/unit/components/default-agent-card.test.tsx to verify MISTRAL option renders in agent dropdown
- [ ] T017 [P] [US2] Extend tests/unit/credential-dispatch-guard.test.ts with MISTRAL dispatch guard (missing credential blocks transition)

**Checkpoint**: Mistral selectable as default agent, resolves correctly, dispatch blocked without credential. Tests pass.

---

## Phase 5: User Story 3 — Override Agent to Mistral on a Ticket (Priority: P2)

**Goal**: Users can override a ticket's agent to Mistral, replacing the project default for that specific ticket.

**Independent Test**: Edit a ticket's agent field to Mistral, verify effective agent resolves to Mistral regardless of project default.

### Tests for User Story 3

- [ ] T018 [P] [US3] Extend tests/unit/components/agent-edit-dialog.test.tsx to verify MISTRAL option renders in agent override dropdown

**Checkpoint**: Mistral selectable as per-ticket override. Tests pass.

---

## Phase 6: User Story 4 — Execute Workflow with Mistral Agent (Priority: P1)

**Goal**: Workflow stages dispatched for Mistral-assigned tickets install vibe CLI, authenticate, disable datalake telemetry, and execute commands.

**Independent Test**: Dispatch a workflow stage for a Mistral-assigned ticket and verify the job completes with expected artifacts.

### Tests for User Story 4

- [ ] T019 [P] [US4] Extend tests/integration/credentials/workflow-credential.test.ts with Mistral provider parameter (envVar=MISTRAL_API_KEY, encoding)

### Implementation for User Story 4

- [ ] T020 [US4] Add MISTRAL case to .github/scripts/run-agent.sh: validate_auth (MISTRAL_API_KEY), install_mistral (pip install vibe-cli), setup_mistral_telemetry (VIBE_TELEMETRY=false, OTEL env vars), invoke_mistral (cat | vibe --profile agent -m mistral-large-latest -)
- [ ] T021 [P] [US4] Add MISTRAL_API_KEY to env block in .github/workflows/speckit.yml
- [ ] T022 [P] [US4] Add MISTRAL_API_KEY to env block in .github/workflows/quick-impl.yml
- [ ] T023 [P] [US4] Add MISTRAL_API_KEY to env block in .github/workflows/verify.yml
- [ ] T024 [P] [US4] Add MISTRAL_API_KEY to env block in .github/workflows/iterate.yml
- [ ] T025 [P] [US4] Add MISTRAL_API_KEY to env block in .github/workflows/ai-board-assist.yml

**Checkpoint**: Workflow dispatched with agent=MISTRAL installs vibe, disables datalake telemetry, and invokes vibe with the command prompt. Tests pass.

---

## Phase 7: User Story 5 — View Mistral Telemetry Data (Priority: P2)

**Goal**: OTLP trace payloads from vibe are processed into Job telemetry metrics (tokens, cost, duration, tools).

**Independent Test**: Post an OTLP trace payload with Mistral span data and verify job telemetry view displays token counts, estimated costs, and tool usage.

### Tests for User Story 5

- [ ] T026 [P] [US5] Extend tests/integration/telemetry/agent-agnostic.test.ts with Mistral trace event processing (resourceSpans detection, span attribute extraction, cost estimation with MISTRAL_PRICING, no regression for Claude/Codex log processing)

### Implementation for User Story 5

- [ ] T027 [US5] Add OTLP trace Zod schema (resourceSpans, scopeSpans, spans) to lib/schemas/otlp.ts if not already present
- [ ] T028 [US5] Replace early-return for resourceSpans in app/api/telemetry/v1/logs/route.ts with trace processing logic: add MISTRAL_PRICING table, estimateMistralCost function, parse trace spans (gen_ai.usage.* attributes, gen_ai.request.model, span timestamps for duration, tool.name), accumulate metrics and update Job record

**Checkpoint**: Posting OTLP trace payload with Mistral span data updates Job telemetry fields correctly. Existing Claude/Codex telemetry unaffected. Tests pass.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories and non-regression check.

- [ ] T029 Run `bun run type-check` and fix any remaining TypeScript errors
- [ ] T030 Run `bun run lint` and fix any linting issues
- [ ] T031 Run `bun run test:unit` to confirm all unit tests pass (including pre-existing)
- [ ] T032 Run `bun run test:integration` to confirm all integration tests pass (including pre-existing)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma enums + generate) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — credential provider module required
- **US2 (Phase 4)**: Depends on Phase 2 — enum maps and metadata required. Independent of US1.
- **US3 (Phase 5)**: Depends on Phase 2 — agent metadata required. Independent of US1/US2.
- **US4 (Phase 6)**: Depends on Phase 2 — credential workflow integration required. Independent of US1/US2/US3 (shell/YAML only).
- **US5 (Phase 7)**: Depends on Phase 2 — pricing table uses enum values. Independent of other stories.
- **Polish (Phase 8)**: Depends on all user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Independent — credential storage standalone
- **US2 (P1)**: Independent — agent selection uses enum directly
- **US3 (P2)**: Independent — ticket override uses same enum
- **US4 (P1)**: Independent — workflow scripts are separate from app code
- **US5 (P2)**: Independent — telemetry processing is separate from other stories

### Within Each User Story

- Tests written and confirmed to FAIL before implementation
- Models/types before services
- Services before endpoints/UI
- Core implementation before integration

### Parallel Opportunities

- T003, T004, T005, T006 can all run in parallel (different files, no dependencies)
- T009, T010, T011 can all run in parallel (different test files)
- T013, T014, T015, T016, T017 can all run in parallel (different test files)
- T021, T022, T023, T024, T025 can all run in parallel (different workflow YAML files)
- After Phase 2 completes, all 5 user stories (Phases 3-7) can execute in parallel

---

## Parallel Example: User Story 4 (Workflow Execution)

```bash
# Launch all workflow YAML updates in parallel:
Task T021: "Add MISTRAL_API_KEY to .github/workflows/speckit.yml"
Task T022: "Add MISTRAL_API_KEY to .github/workflows/quick-impl.yml"
Task T023: "Add MISTRAL_API_KEY to .github/workflows/verify.yml"
Task T024: "Add MISTRAL_API_KEY to .github/workflows/iterate.yml"
Task T025: "Add MISTRAL_API_KEY to .github/workflows/ai-board-assist.yml"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + 4)

1. Complete Phase 1: Setup (enums + migration)
2. Complete Phase 2: Foundational (mappings, provider module, icon)
3. Complete Phase 3: US1 — Store Mistral API Key
4. Complete Phase 4: US2 — Select Mistral as Default Agent
5. Complete Phase 6: US4 — Execute Workflow with Mistral
6. **STOP and VALIDATE**: Mistral agent is fully functional end-to-end
7. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. Add US1 -> Credentials work -> Test independently
3. Add US2 -> Agent selection works -> Test independently
4. Add US4 -> Workflows execute -> Test independently (MVP complete!)
5. Add US3 -> Ticket override works -> Test independently
6. Add US5 -> Telemetry visible -> Test independently
7. Polish -> All tests green, no regressions

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Phase 2 is done, all user stories can run in parallel:
   - Parallel task A: US1 (credential storage)
   - Parallel task B: US2 (agent selection)
   - Parallel task C: US3 (ticket override)
   - Parallel task D: US4 (workflow execution)
   - Parallel task E: US5 (telemetry)
3. Stories complete and integrate independently
4. Polish phase validates everything together

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
