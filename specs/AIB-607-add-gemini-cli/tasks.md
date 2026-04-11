# Tasks: Add Gemini CLI as AI Agent (AIB-607)

**Input**: Design documents from `/specs/AIB-607-add-gemini-cli/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included by default (constitution). 7 existing test files extended, 1 new test file created.

**Organization**: Tasks grouped by user story (US1-US5) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prisma schema migration — enum extensions that all user stories depend on

- [x] T001 Add `GEMINI` to Agent enum and `GOOGLE` to CredentialProvider enum in `prisma/schema.prisma`
- [x] T002 Run `bunx prisma migrate dev --name add-gemini-google-enums` and `bunx prisma generate` to apply migration

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Application-level type mappings and provider registry shared across credentials, workflows, and analytics

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add `GEMINI: 'GOOGLE'` to `AGENT_PROVIDER_MAP`, `GOOGLE: ['API_KEY', 'OAUTH_TOKEN']` to `PROVIDER_ALLOWED_TYPES`, and `'GOOGLE:API_KEY': 'GEMINI_API_KEY'` / `'GOOGLE:OAUTH_TOKEN': 'GEMINI_OAUTH_TOKEN'` to `ENV_VAR_MAP` in `lib/ai-credentials/types.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 — Store and Validate Google Credentials (Priority: P1) MVP

**Goal**: Users can add, validate, and verify Google credentials (API key or OAuth token) via the AI Credentials settings page.

**Independent Test**: Add a Google credential and verify it shows as "Ready" — delivers authentication capability with Google's API.

### Tests for User Story 1

- [x] T004 [P] [US1] Extend `tests/unit/ai-credentials.test.ts` with Google API_KEY format validation (prefix `AIza`, min 39 chars, no whitespace) and OAUTH_TOKEN format validation (min 20 chars, no whitespace) test cases
- [x] T005 [P] [US1] Extend `tests/unit/credential-dispatch-guard.test.ts` with GEMINI→GOOGLE provider mapping assertion
- [x] T006 [P] [US1] Create `tests/integration/credentials/google-credential.test.ts` with Google credential verification integration tests: mock Google API responses for 200 (READY), 401/403 (ACTION_REQUIRED), 429 (RATE_LIMITED), and timeout (UNREACHABLE) scenarios for both API_KEY and OAUTH_TOKEN

### Implementation for User Story 1

- [x] T007 [US1] Create `lib/ai-credentials/providers/google.ts` following the Mistral provider pattern (`lib/ai-credentials/providers/mistral.ts`): export `validateFormat()` (API_KEY: `AIza` prefix, >=39 chars; OAUTH_TOKEN: >=20 chars) and `verifyWithProvider()` (GET `https://generativelanguage.googleapis.com/v1beta/models` with key param or Bearer header, 10s timeout, standard HTTP status handling)
- [x] T008 [US1] Register Google provider module in `lib/ai-credentials/providers/index.ts` by adding `GOOGLE: google` to `PROVIDER_MODULES` registry

**Checkpoint**: Google credentials can be stored, validated, and verified. US1 is independently testable.

---

## Phase 4: User Story 2 — Select Gemini as Agent for Project or Ticket (Priority: P1)

**Goal**: Gemini appears on all agent selection surfaces with icon/label. Mistral appears on setup page (fixing existing gap).

**Independent Test**: Set Gemini as a project's default agent and verify icon/label appear on ticket cards.

### Tests for User Story 2

- [x] T009 [P] [US2] Extend `tests/unit/agent-icons.test.ts` with GEMINI metadata assertions: icon path `/agents/gemini.svg`, label "Gemini", description, and `inferAgentFromIdentifier()` detection of "gemini" and "google" strings
- [x] T010 [P] [US2] Extend `tests/unit/agent-schema.test.ts` with GEMINI as a valid agent value in Zod schema validation

### Implementation for User Story 2

- [x] T011 [P] [US2] Create `public/agents/gemini.svg` with Gemini sparkle icon SVG matching existing agent icon dimensions
- [x] T012 [P] [US2] Add GEMINI entry to `AGENT_METADATA` in `app/lib/utils/agent-icons.ts` with `{ description: 'Google Gemini CLI', iconPath: '/agents/gemini.svg', label: 'Gemini' }` and update `inferAgentFromIdentifier()` to detect "gemini" or "google"
- [x] T013 [US2] Add GEMINI and MISTRAL to `AGENTS` array in `components/setup/setup-page-client.tsx` (FR-008, FR-009)
- [x] T014 [US2] Extend agent validation schema in `app/api/projects/[projectId]/setup/jobs/route.ts` to include all agents, and add agent eligibility check returning 400 if GEMINI is used for ONBOARD/RETRO_SPEC commands

**Checkpoint**: Gemini is selectable across all UI surfaces. Mistral setup page gap fixed. US2 is independently testable.

---

## Phase 5: User Story 3 — Execute Workflows with Gemini Agent (Priority: P1)

**Goal**: Gemini workflows (speckit, quick-impl, iterate) dispatch with correct credentials and execute via Gemini CLI in headless mode.

**Independent Test**: Dispatch a quick-impl job with Gemini agent and verify workflow completes.

### Tests for User Story 3

- No automated tests for shell scripts or workflow YAMLs (tested via workflow execution). Manual verification: trigger a quick-impl job with GEMINI agent on a test project.

### Implementation for User Story 3

- [x] T015 [P] [US3] Add `GEMINI) PROVIDER="GOOGLE" ;;` to the credential fetch case statement in `.github/workflows/speckit.yml`
- [x] T016 [P] [US3] Add `GEMINI) PROVIDER="GOOGLE" ;;` to the credential fetch case statement in `.github/workflows/quick-impl.yml`
- [x] T017 [P] [US3] Add `GEMINI) PROVIDER="GOOGLE" ;;` to the credential fetch case statement in `.github/workflows/iterate.yml`
- [x] T018 [US3] Add GEMINI case to `.github/scripts/run-agent.sh`: `validate_auth()` requiring `GEMINI_API_KEY` or `GEMINI_OAUTH_TOKEN`, `install_gemini()` function (npm global install, verify binary), `setup_gemini_telemetry()` function (set `GEMINI_TELEMETRY_ENABLED=1`, OTLP endpoint/protocol), `invoke_gemini()` function (resolve command file, configure model, headless mode), and main dispatch case `GEMINI)` chaining validate→install→setup_telemetry→invoke
- [x] T019 [US3] Add comment documenting Gemini exclusion from verify workflow in `lib/workflows/transition.ts` (verify.yml hardcoded to Claude dependencies)

**Checkpoint**: Gemini workflows dispatch and execute correctly. US3 is independently testable via workflow run.

---

## Phase 6: User Story 4 — Track Gemini Job Metrics and Costs (Priority: P2)

**Goal**: Telemetry captures token usage, cost, model, tool data, and duration for Gemini jobs via native OTLP events.

**Independent Test**: Run a Gemini job and verify token counts, cost, and duration appear on the job detail view.

### Tests for User Story 4

- [x] T020 [US4] Extend `tests/integration/telemetry/agent-agnostic.test.ts` with: Gemini `api_response` event extracting token metrics and cost estimation, Gemini `tool_call` event extracting tool name, unknown model fallback to `gemini-2.5-pro` pricing, and `thought_tokens` mapping to `cacheReadTokens`

### Implementation for User Story 4

- [x] T021 [US4] Add Gemini event detection, `GEMINI_PRICING` table (`gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`), and `estimateGeminiCost()` function to `app/api/telemetry/v1/logs/route.ts` — parse `gemini_cli.api_response` for `input_tokens`, `output_tokens`, `thought_tokens` (→cacheReadTokens), `model`, `duration_ms`; parse `gemini_cli.tool_call` for `tool_name`; follow existing `estimateOpenAICost()`/`estimateMistralCost()` patterns

**Checkpoint**: Gemini telemetry is captured and costs estimated. US4 is independently testable.

---

## Phase 7: User Story 5 — View Gemini and Mistral in Analytics Dashboard (Priority: P2)

**Goal**: Analytics dashboard dynamically reflects all agents from the Agent enum. Gemini and Mistral visible in filters.

**Independent Test**: Run jobs with Gemini/Mistral and verify both appear in the analytics agent filter.

### Tests for User Story 5

- [x] T022 [P] [US5] Extend `tests/integration/analytics/analytics-route.test.ts` with test verifying Gemini and Mistral appear in available agents when they have jobs
- [x] T023 [P] [US5] Extend `tests/unit/components/analytics-dashboard.test.tsx` with test verifying agent filter renders all agent options including Gemini and Mistral

### Implementation for User Story 5

- [x] T024 [US5] Change `NamedAgent` type in `lib/analytics/types.ts` from hardcoded union to `Agent` imported from `@prisma/client` (FR-018)
- [x] T025 [US5] Replace hardcoded `['CLAUDE', 'CODEX']` in `getAvailableAgents()` and hardcoded `Map` initialization in `lib/analytics/queries.ts` with dynamic `Object.values(Agent)` from Prisma

**Checkpoint**: Analytics dashboard supports all agents dynamically. Mistral gap fixed. US5 is independently testable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories

- [x] T026 Run `bun run type-check` and `bun run lint` to verify zero type and lint errors across all changes
- [x] T027 Run `bun run test:unit` and `bun run test:integration` to verify all existing and new tests pass
- [x] T028 Verify no regressions in existing Claude, Codex, and Mistral functionality (FR-022)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma types must exist) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (needs type mappings)
- **US2 (Phase 4)**: Depends on Phase 2 (needs Agent enum generated)
- **US3 (Phase 5)**: Depends on Phase 2 (needs credential env var mappings)
- **US4 (Phase 6)**: Depends on Phase 2 (needs Agent enum only)
- **US5 (Phase 7)**: Depends on Phase 2 (needs Agent enum)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2
- **US2 (P1)**: Independent after Phase 2
- **US3 (P1)**: Independent after Phase 2 (workflow YAMLs/scripts are separate files)
- **US4 (P2)**: Independent after Phase 2
- **US5 (P2)**: Independent after Phase 2 (analytics types are self-contained)

### Within Each User Story

- Tests written first, verified to fail before implementation
- Provider modules before registry registration
- Type changes before consuming code
- Core implementation before integration

### Parallel Opportunities

- **Phase 2**: Single task (T003) — no parallelism needed
- **US1 tests**: T004, T005, T006 can run in parallel (different test files)
- **US2 tests**: T009, T010 can run in parallel (different test files)
- **US2 impl**: T011, T012 can run in parallel (SVG asset vs TS code)
- **US3 impl**: T015, T016, T017 can run in parallel (different workflow YAMLs)
- **US5 tests**: T022, T023 can run in parallel (different test files)
- **Cross-story**: US1, US2, US3, US4, US5 can all proceed in parallel after Phase 2

---

## Parallel Example: After Phase 2 Completes

```
# All five user stories can launch in parallel:
Story 1: T004→T005→T006→T007→T008 (Credentials)
Story 2: T009→T010→T011→T012→T013→T014 (Agent Selection/UI)
Story 3: T015→T016→T017→T018→T019 (Workflows)
Story 4: T020→T021 (Telemetry)
Story 5: T022→T023→T024→T025 (Analytics)

# Within US3, workflow YAMLs in parallel:
Task: T015 "Add GEMINI case to speckit.yml"
Task: T016 "Add GEMINI case to quick-impl.yml"
Task: T017 "Add GEMINI case to iterate.yml"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema migration)
2. Complete Phase 2: Foundational (type mappings)
3. Complete Phase 3: User Story 1 (Google credentials)
4. **STOP and VALIDATE**: Test credential storage/verification independently
5. Deploy if ready — users can now store Google credentials

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Credentials) → Test independently → MVP!
3. Add US2 (Agent Selection) → Test independently → Gemini selectable
4. Add US3 (Workflows) → Test independently → Gemini executes jobs
5. Add US4 (Telemetry) → Test independently → Usage visibility
6. Add US5 (Analytics) → Test independently → Full analytics coverage
7. Each story adds value without breaking previous stories

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially (T001→T002→T003)
2. Once Phase 2 is done, all user stories can run in parallel:
   - Parallel track 1: US1 (Credentials)
   - Parallel track 2: US2 (Agent Selection/UI)
   - Parallel track 3: US3 (Workflows)
   - Parallel track 4: US4 (Telemetry)
   - Parallel track 5: US5 (Analytics)
3. Polish phase after all tracks complete

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- 7 existing test files extended (no duplication), 1 new test file created
- All file paths verified against filesystem
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
