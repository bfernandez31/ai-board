# Tasks: Add Gemini as AI Agent Under Google Provider

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Test tasks are included by default per constitution. Existing test files are extended before any new test file is introduced.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently.

## Phase 1: Setup

**Purpose**: Establish the schema and provider scaffolding required for all later work.

- [X] T001 Extend `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` with `Agent.GEMINI` and `CredentialProvider.GOOGLE`, and create the generated migration under `/home/runner/work/ai-board/ai-board/target/prisma/migrations/`
- [X] T002 [P] Create `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/providers/google.ts` for Google API key verification and Gemini OAuth bundle validation
- [X] T003 [P] Regenerate the Prisma client from `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` so generated enum types include `GEMINI` and `GOOGLE`

---

## Phase 2: Foundational

**Purpose**: Centralize shared agent/provider definitions that block every user story.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [X] T004 [P] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-schema.test.ts`, `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-icons.test.ts`, and `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-resolution.test.ts` with Gemini and Google coverage before shared helper changes
- [X] T005 Extend `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/types.ts` and `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/providers/index.ts` with `GEMINI -> GOOGLE` mappings, allowed credential types, and workflow env-var contracts
- [X] T006 [P] Extend `/home/runner/work/ai-board/ai-board/target/app/lib/schemas/agent.ts`, `/home/runner/work/ai-board/ai-board/target/app/lib/utils/agent-icons.ts`, and `/home/runner/work/ai-board/ai-board/target/app/lib/utils/agent-resolution.ts` with shared Gemini metadata, aliases, and workflow-support helpers

**Checkpoint**: Shared enums, provider maps, and agent metadata are stable for all stories.

---

## Phase 3: User Story 1 - Add and Verify a Google Credential (Priority: P1) 🎯 MVP

**Goal**: Users can save, validate, and reuse Google credentials for Gemini without exposing secrets.

**Independent Test**: Save valid Google API key and OAuth bundle credentials through the UI and API, reject invalid combinations, and verify workflow credential resolution returns only the base64 env-var contract.

### Tests for User Story 1

- [X] T007 [P] [US1] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/ai-credentials.test.ts` with Google provider validation, readiness, and provider/type compatibility cases
- [X] T008 [P] [US1] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/components/credential-form.test.tsx` with Google API key and OAuth bundle entry states in the credential form
- [X] T009 [P] [US1] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/credentials-api.test.ts` and `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/credential-validation.test.ts` with Google create, retest, and unreachable-provider error scenarios
- [X] T010 [P] [US1] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/workflow-credential.test.ts` with Google workflow credential resolution cases for `GEMINI_API_KEY` and `GEMINI_OAUTH_JSON`

### Implementation for User Story 1

- [X] T011 [US1] Implement Google provider verification and OAuth bundle structural validation in `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/providers/google.ts` and wire it through `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/providers/index.ts`
- [X] T012 [US1] Extend `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/service.ts` and `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/workflow.ts` for encrypted Google credential storage, readiness handling, and workflow-facing env-var payloads
- [X] T013 [US1] Extend `/home/runner/work/ai-board/ai-board/target/app/api/credentials/route.ts`, `/home/runner/work/ai-board/ai-board/target/app/api/credentials/[id]/test/route.ts`, and `/home/runner/work/ai-board/ai-board/target/app/api/internal/credentials/route.ts` to accept, retest, and resolve Google credentials with `no-store` responses
- [X] T014 [US1] Extend `/home/runner/work/ai-board/ai-board/target/components/credentials/credential-form.tsx` and `/home/runner/work/ai-board/ai-board/target/components/credentials/credential-item.tsx` to collect Google credentials, show validation feedback, and mask stored values

**Checkpoint**: User Story 1 is complete when Google credentials can be saved, validated, and resolved safely for Gemini workflows.

---

## Phase 4: User Story 2 - Choose Gemini Where It Is Supported (Priority: P1)

**Goal**: Gemini appears in supported selection surfaces and is blocked before unsupported workflows can dispatch.

**Independent Test**: Verify Gemini appears in project settings, ticket create/edit, ticket summary, and setup agent-selection surfaces, and confirm unsupported setup or transition attempts fail with clear guard messages before ambiguous job creation.

### Tests for User Story 2

- [X] T015 [P] [US2] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/components/default-agent-card.test.tsx`, `/home/runner/work/ai-board/ai-board/target/tests/unit/components/agent-edit-dialog.test.tsx`, and `/home/runner/work/ai-board/ai-board/target/tests/unit/components/new-ticket-modal.test.tsx` with Gemini selection scenarios
- [X] T016 [P] [US2] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/components/setup/setup-page.test.tsx` and `/home/runner/work/ai-board/ai-board/target/tests/unit/components/ticket-card-deploy.test.tsx` with Gemini setup-option visibility and ticket badge rendering coverage
- [X] T017 [P] [US2] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/credential-dispatch-guard.test.ts` and `/home/runner/work/ai-board/ai-board/target/tests/integration/tickets/transitions.test.ts` with supported and unsupported Gemini workflow guard cases
- [X] T018 [P] [US2] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts` and `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-redirect.test.ts` with Gemini setup credential-check and blocked onboarding scenarios

### Implementation for User Story 2

- [X] T019 [US2] Extend `/home/runner/work/ai-board/ai-board/target/components/settings/default-agent-card.tsx`, `/home/runner/work/ai-board/ai-board/target/components/tickets/agent-edit-dialog.tsx`, and `/home/runner/work/ai-board/ai-board/target/components/board/new-ticket-modal.tsx` to offer Gemini in supported selection surfaces
- [X] T020 [US2] Extend `/home/runner/work/ai-board/ai-board/target/components/board/ticket-card.tsx` and `/home/runner/work/ai-board/ai-board/target/components/setup/setup-page-client.tsx` to render Gemini labels/icons and consistent supported-agent choices
- [X] T021 [US2] Extend `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/credential-check/route.ts` and `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/route.ts` to resolve Google credentials and reject unsupported Gemini setup dispatches before job creation
- [X] T022 [US2] Extend `/home/runner/work/ai-board/ai-board/target/lib/workflows/transition.ts` and `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/transition/route.ts` to enforce Gemini workflow eligibility and missing-credential errors before dispatch
- [X] T023 [US2] Extend `/home/runner/work/ai-board/ai-board/target/lib/workflows/dispatch-onboard.ts`, `/home/runner/work/ai-board/ai-board/target/lib/workflows/dispatch-retro-spec.ts`, `/home/runner/work/ai-board/ai-board/target/app/lib/workflows/dispatch-ai-board.ts`, `/home/runner/work/ai-board/ai-board/target/app/lib/workflows/dispatch-rollback-reset.ts`, and `/home/runner/work/ai-board/ai-board/target/lib/health/scan-dispatch.ts` to preserve explicit non-Gemini behavior for unsupported workflows

**Checkpoint**: User Story 2 is complete when supported selectors show Gemini consistently and unsupported entry points block it before dispatch.

---

## Phase 5: User Story 3 - Run Supported Gemini Workflows with Complete Job Tracking (Priority: P1)

**Goal**: Supported Gemini workflows execute in CI with the right credential materialization and emit complete job telemetry.

**Independent Test**: Dispatch supported Gemini workflows, confirm the runner installs and invokes Gemini headlessly, and verify job telemetry records model, tokens, tools, duration, and either estimated or unavailable cost.

### Tests for User Story 3

- [X] T024 [P] [US3] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/telemetry/aggregation.test.ts` and `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts` with Gemini batch payload merge and `costStatus=UNAVAILABLE` coverage

### Implementation for User Story 3

- [X] T025 [US3] Extend `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh` to install `@google/gemini-cli`, restore Google auth material, run Gemini headlessly, and emit `stream-json` telemetry
- [X] T026 [US3] Extend `/home/runner/work/ai-board/ai-board/target/.github/workflows/speckit.yml`, `/home/runner/work/ai-board/ai-board/target/.github/workflows/quick-impl.yml`, and `/home/runner/work/ai-board/ai-board/target/.github/workflows/iterate.yml` to pass Google credentials only for Gemini-supported workflow runs
- [X] T027 [US3] Extend `/home/runner/work/ai-board/ai-board/target/.github/workflows/verify.yml`, `/home/runner/work/ai-board/ai-board/target/.github/workflows/ai-board-assist.yml`, `/home/runner/work/ai-board/ai-board/target/.github/workflows/onboard.yml`, `/home/runner/work/ai-board/ai-board/target/.github/workflows/retro-spec.yml`, and `/home/runner/work/ai-board/ai-board/target/.github/workflows/health-scan.yml` to preserve explicit non-Gemini auth paths and rejection behavior
- [X] T028 [US3] Extend `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts` to ingest Gemini batch payloads, merge usage stats, and preserve unavailable-cost semantics

**Checkpoint**: User Story 3 is complete when supported Gemini workflows run end to end and persist complete job metrics.

---

## Phase 6: User Story 4 - Analyze Agent Usage Consistently Across Gemini and Mistral (Priority: P2)

**Goal**: Analytics and setup consistency surfaces derive agent options from shared definitions and actual job history instead of hardcoded partial lists.

**Independent Test**: Load analytics for mixed-agent projects and confirm Gemini and Mistral appear in filters, aggregates, and incomplete-cost messaging without regressing Claude or Codex behavior.

### Tests for User Story 4

- [X] T029 [P] [US4] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/analytics/analytics-route.test.ts` and `/home/runner/work/ai-board/ai-board/target/tests/unit/components/analytics-dashboard.test.tsx` with Gemini and Mistral filter options, effective-agent normalization, and incomplete-cost scenarios

### Implementation for User Story 4

- [X] T030 [US4] Extend `/home/runner/work/ai-board/ai-board/target/lib/analytics/types.ts`, `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts`, and `/home/runner/work/ai-board/ai-board/target/lib/analytics/aggregations.ts` to derive available agents and cost semantics from effective agent history
- [X] T031 [US4] Extend `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/analytics/route.ts` and `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/analytics/page.tsx` to accept `agent=GEMINI|MISTRAL` and normalize invalid filters to `all`
- [X] T032 [US4] Extend `/home/runner/work/ai-board/ai-board/target/components/analytics/analytics-dashboard.tsx`, `/home/runner/work/ai-board/ai-board/target/components/analytics/overview-cards.tsx`, and `/home/runner/work/ai-board/ai-board/target/components/analytics/top-tools-chart.tsx` to render Gemini and Mistral filter options plus incomplete-cost messaging

**Checkpoint**: User Story 4 is complete when analytics surfaces show Gemini and Mistral consistently and accurately.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Run repo-wide validation and fix cross-story regressions after all targeted changes land.

- [X] T033 [P] Run focused unit regressions covering `/home/runner/work/ai-board/ai-board/target/tests/unit/` and fix any Gemini or Google breakage in the corresponding source files under `/home/runner/work/ai-board/ai-board/target/app/`, `/home/runner/work/ai-board/ai-board/target/components/`, and `/home/runner/work/ai-board/ai-board/target/lib/`
- [X] T034 [P] Run focused integration regressions covering `/home/runner/work/ai-board/ai-board/target/tests/integration/` and fix any workflow, credential, setup, telemetry, or analytics failures in the touched API and workflow files
- [X] T035 Run `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`, `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh`, `/home/runner/work/ai-board/ai-board/target/app/`, `/home/runner/work/ai-board/ai-board/target/components/`, and `/home/runner/work/ai-board/ai-board/target/lib/` through final `bun run type-check` and `bun run lint` cleanup

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately and prepares schema plus provider scaffolding.
- **Foundational (Phase 2)**: Depends on Setup and blocks all story work.
- **User Story 1 (Phase 3)**: Depends on Foundational and should land first because Google credential support gates Gemini execution.
- **User Story 2 (Phase 4)**: Depends on Foundational and User Story 1 because supported selection and dispatch guards require the Google provider contract.
- **User Story 3 (Phase 5)**: Depends on Foundational and User Story 1 because runtime dispatch consumes Google workflow credentials and telemetry contracts.
- **User Story 4 (Phase 6)**: Depends on Foundational and should follow User Stories 2 and 3 so analytics reflects the final selector and telemetry behavior.
- **Polish (Phase 7)**: Depends on all desired stories being complete.

### User Story Dependencies

- **US1**: No story dependency beyond Foundational.
- **US2**: Requires US1 for Google credential resolution and provider-aware dispatch guards.
- **US3**: Requires US1 for runtime credential materialization.
- **US4**: Requires the shared agent definitions from Foundational and is safest after US2 and US3 stabilize selector and telemetry behavior.

### Within Each User Story

- Tests must be written and fail before implementation changes in that story.
- Shared types and helper changes come before UI or API integration in that story.
- API and workflow guards land before surfaces that depend on them.
- A story is complete only when its independent test passes without relying on unfinished later stories.

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`.
- `T004` and `T006` can run in parallel while `T005` is being prepared.
- Within US1, `T007` through `T010` can run in parallel, then `T013` and `T014` can proceed in parallel after `T011` and `T012`.
- Within US2, `T015` through `T018` can run in parallel, then `T019` and `T020` can proceed in parallel before route and dispatch guard work.
- Within US3, `T026` and `T027` can run in parallel after `T025`.
- Within US4, `T031` and `T032` can run in parallel after `T030`.

---

## Parallel Example: User Story 1

```bash
Task: "Extend /home/runner/work/ai-board/ai-board/target/tests/unit/ai-credentials.test.ts with Google provider validation, readiness, and provider/type compatibility cases"
Task: "Extend /home/runner/work/ai-board/ai-board/target/tests/unit/components/credential-form.test.tsx with Google API key and OAuth bundle entry states in the credential form"
Task: "Extend /home/runner/work/ai-board/ai-board/target/tests/integration/credentials/credentials-api.test.ts and /home/runner/work/ai-board/ai-board/target/tests/integration/credentials/credential-validation.test.ts with Google create, retest, and unreachable-provider error scenarios"
Task: "Extend /home/runner/work/ai-board/ai-board/target/tests/integration/credentials/workflow-credential.test.ts with Google workflow credential resolution cases for GEMINI_API_KEY and GEMINI_OAUTH_JSON"
```

## Parallel Example: User Story 2

```bash
Task: "Extend /home/runner/work/ai-board/ai-board/target/tests/unit/components/default-agent-card.test.tsx, /home/runner/work/ai-board/ai-board/target/tests/unit/components/agent-edit-dialog.test.tsx, and /home/runner/work/ai-board/ai-board/target/tests/unit/components/new-ticket-modal.test.tsx with Gemini selection scenarios"
Task: "Extend /home/runner/work/ai-board/ai-board/target/tests/unit/components/setup/setup-page.test.tsx and /home/runner/work/ai-board/ai-board/target/tests/unit/components/ticket-card-deploy.test.tsx with Gemini setup-option visibility and ticket badge rendering coverage"
Task: "Extend /home/runner/work/ai-board/ai-board/target/tests/unit/credential-dispatch-guard.test.ts and /home/runner/work/ai-board/ai-board/target/tests/integration/tickets/transitions.test.ts with supported and unsupported Gemini workflow guard cases"
Task: "Extend /home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts and /home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-redirect.test.ts with Gemini setup credential-check and blocked onboarding scenarios"
```

## Parallel Example: User Story 3

```bash
Task: "Extend /home/runner/work/ai-board/ai-board/target/tests/unit/telemetry/aggregation.test.ts and /home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts with Gemini batch payload merge and costStatus=UNAVAILABLE coverage"
Task: "Extend /home/runner/work/ai-board/ai-board/target/.github/workflows/speckit.yml, /home/runner/work/ai-board/ai-board/target/.github/workflows/quick-impl.yml, and /home/runner/work/ai-board/ai-board/target/.github/workflows/iterate.yml to pass Google credentials only for Gemini-supported workflow runs"
Task: "Extend /home/runner/work/ai-board/ai-board/target/.github/workflows/verify.yml, /home/runner/work/ai-board/ai-board/target/.github/workflows/ai-board-assist.yml, /home/runner/work/ai-board/ai-board/target/.github/workflows/onboard.yml, /home/runner/work/ai-board/ai-board/target/.github/workflows/retro-spec.yml, and /home/runner/work/ai-board/ai-board/target/.github/workflows/health-scan.yml to preserve explicit non-Gemini auth paths and rejection behavior"
```

## Parallel Example: User Story 4

```bash
Task: "Extend /home/runner/work/ai-board/ai-board/target/tests/integration/analytics/analytics-route.test.ts and /home/runner/work/ai-board/ai-board/target/tests/unit/components/analytics-dashboard.test.tsx with Gemini and Mistral filter options, effective-agent normalization, and incomplete-cost scenarios"
Task: "Extend /home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/analytics/route.ts and /home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/analytics/page.tsx to accept agent=GEMINI|MISTRAL and normalize invalid filters to all"
Task: "Extend /home/runner/work/ai-board/ai-board/target/components/analytics/analytics-dashboard.tsx, /home/runner/work/ai-board/ai-board/target/components/analytics/overview-cards.tsx, and /home/runner/work/ai-board/ai-board/target/components/analytics/top-tools-chart.tsx to render Gemini and Mistral filter options plus incomplete-cost messaging"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate Google credential create, retest, and internal resolution flows independently before moving on.

### Incremental Delivery

1. Land shared enum and agent-definition work first to stop hardcoded drift.
2. Deliver US1 so Gemini has a safe credential path.
3. Deliver US2 so Gemini becomes selectable only where supported.
4. Deliver US3 so supported Gemini workflows run end to end with telemetry.
5. Deliver US4 to close analytics and Mistral consistency gaps.
6. Finish with repo-wide test, type-check, and lint cleanup.
