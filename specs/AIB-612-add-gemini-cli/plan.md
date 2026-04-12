# Implementation Plan: Add Gemini as AI Agent Under Google Provider

**Branch**: `AIB-612-add-gemini-cli` | **Date**: 2026-04-12 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/spec.md`
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/spec.md`

## Summary

Add `GEMINI` as a first-class agent and `GOOGLE` as a first-class credential provider, extend supported multi-agent workflow dispatch to Gemini, and close the remaining Mistral consistency gaps in analytics and project setup. The implementation should reuse the existing encrypted BYOK credential system, keep unsupported workflows blocked before dispatch, and standardize agent availability through a shared supported-agent definition used by settings, ticket flows, setup, analytics, and telemetry ingestion.

## Technical Context

| Aspect | Detail |
|--------|--------|
| Feature | Add Gemini agent + Google credential provider with parity across credentials, selection, workflows, telemetry, analytics, and icon display |
| Language / Runtime | TypeScript 5.9 strict, Node.js 22.20.0, Bash in GitHub Actions |
| Frameworks | Next.js 16 App Router, React 18, Prisma 6.x, TanStack Query v5, shadcn/ui |
| Storage | PostgreSQL 14+ via Prisma; additive enum changes only unless job telemetry storage needs nullable cost-state metadata |
| Security | AES-256-GCM credential encryption, workflow bearer-token auth, provider-aware validation, owner/member authorization helpers |
| External systems | Gemini CLI, Google AI Studio API key auth, cached Google sign-in auth for Gemini CLI, GitHub Actions dispatch, existing telemetry endpoint |
| Headless execution | Gemini CLI supports headless mode in non-TTY or `-p` execution and can emit structured JSON / stream-json events suitable for workflow parsing |
| Telemetry choice | Reuse existing batch JSON telemetry path by parsing Gemini CLI `stream-json` output into model, token, tool, duration, and cost-availability fields |
| Key constraints | Gemini allowed only for specify / plan / implement / quick-impl / iterate; verify / ai-board-assist / retro-spec / onboard / health-scan stay non-Gemini |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All touched routes, utilities, workflow helpers, and UI surfaces already use typed Prisma enums and strict TS maps. |
| II. Component-Driven | PASS | All UI changes extend existing shadcn Select/Card/Dialog flows instead of introducing new primitives. |
| III. Test-Driven | PASS | Existing unit, component, and integration files already cover credentials, dispatch guards, setup, telemetry, and analytics; plan extends them instead of duplicating. |
| IV. Security-First | PASS | Provider/type validation, encrypted storage, workflow auth, and secret masking remain mandatory; Google credentials must not weaken existing handling. |
| V. Database Integrity | PASS | Enum additions are additive; dispatch and setup flows already use transactional guard patterns and failed-dispatch cleanup. |
| V. Spec Clarification | PASS | All auto-resolved decisions are present in the spec and the plan preserves the conservative workflow-blocking and cost-unavailable rules. |

**Gate Result**: PASS. Proceed with design.

### Post-Design Check

| Gate | Status | Evidence |
|------|--------|----------|
| Provider/type constraints stay centralized | PASS | `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/types.ts`, provider registry, and credential routes remain the single source of truth. |
| Unsupported workflows are blocked before dispatch | PASS | Gemini availability is scoped through shared supported-agent helpers and checked in setup / transition / workflow entry points before job creation. |
| DB consistency on external failure | PASS | Existing job-create then dispatch-failure recovery pattern is preserved for ticket transitions and setup jobs. |
| Tests extend existing domain coverage | PASS | Credentials, setup, analytics, telemetry, and UI selector tests are extended in-place; new tests are only planned if existing files would mix unrelated concerns. |
| Cost-unavailable state is explicit | PASS | Telemetry contract includes nullable cost plus explicit availability status instead of falling back to `0`. |

**Gate Result**: PASS. No blocking violations.

## Design Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Research | `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/research.md` | Resolved unknowns, existing-file inventory, implementation patterns |
| Data Model | `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/data-model.md` | Enum additions, credential semantics, telemetry/cost-state impacts |
| Credential Contract | `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/contracts/credentials-api.md` | Google provider credential create/test/internal-resolution contract |
| Analytics Contract | `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/contracts/analytics-api.md` | Agent filter and aggregate response changes for Gemini + Mistral |
| Telemetry Contract | `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/contracts/telemetry-api.md` | Gemini batch telemetry payload and cost-availability semantics |
| Credential Workflow | `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/workflows/google-credential-verification.md` | Credential verification flow and command behavior |
| Dispatch Workflow | `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/workflows/gemini-workflow-dispatch.md` | Supported dispatch/runtime contract |
| Usage Workflow | `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/workflows/gemini-usage-ingestion.md` | Telemetry aggregation and reporting contract |

## Implementation Phases

### Phase 1: Schema, Core Types, and Shared Agent Definitions

**Goal**: Introduce `GEMINI` and `GOOGLE` at the enum and mapping level, then centralize workflow support definitions so UI and analytics stop hardcoding partial agent lists.

**Files to modify**:
1. `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`
2. `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/types.ts`
3. `/home/runner/work/ai-board/ai-board/target/app/lib/schemas/agent.ts`
4. `/home/runner/work/ai-board/ai-board/target/app/lib/utils/agent-icons.ts`
5. `/home/runner/work/ai-board/ai-board/target/app/lib/utils/agent-resolution.ts`
6. `/home/runner/work/ai-board/ai-board/target/lib/analytics/types.ts`
7. `/home/runner/work/ai-board/ai-board/target/lib/analytics/aggregations.ts`
8. `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts`
9. `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/analytics/route.ts`
10. `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/analytics/page.tsx`

**Notes**:
- Add `GEMINI` to `Agent` and `GOOGLE` to `CredentialProvider`.
- Keep `CredentialType` as `API_KEY | OAUTH_TOKEN`; `GOOGLE` allows both.
- Replace remaining hardcoded `CLAUDE/CODEX` analytics and setup filter lists with shared agent helpers.
- Model the Gemini icon/label exactly once in `agent-icons.ts` and reuse everywhere.

**Verification**:
- Prisma client compiles after enum additions.
- All `Record<Agent, ...>` and `Record<CredentialProvider, ...>` maps include Gemini/Google.
- Analytics filter parsing accepts `GEMINI` and `MISTRAL`.

### Phase 2: Google Credential Provider and BYOK UI/API

**Goal**: Add Google provider validation, verification, and storage behavior with parity to existing providers while preserving stricter failure handling.

**Files to create**:
1. `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/providers/google.ts`

**Files to modify**:
1. `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/providers/index.ts`
2. `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/service.ts`
3. `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/workflow.ts`
4. `/home/runner/work/ai-board/ai-board/target/app/api/credentials/route.ts`
5. `/home/runner/work/ai-board/ai-board/target/app/api/credentials/[id]/test/route.ts`
6. `/home/runner/work/ai-board/ai-board/target/app/api/internal/credentials/route.ts`
7. `/home/runner/work/ai-board/ai-board/target/components/credentials/credential-form.tsx`
8. `/home/runner/work/ai-board/ai-board/target/components/credentials/credential-item.tsx`

**Design choices**:
- `API_KEY` path validates and verifies against Google AI Studio usage, injected as `GEMINI_API_KEY`.
- `OAUTH_TOKEN` path stores a serialized Gemini CLI auth bundle for restoring cached sign-in state on the runner; the verification flow is format and structure validation only, with readiness never upgraded on unreachable/invalid parsing.
- Provider/type compatibility remains enforced before persistence.
- Internal credential resolution must support Google provider output without exposing plaintext or cacheable responses.

**Verification**:
- `POST /api/credentials` accepts Google API key and Google OAuth bundle, rejects invalid combinations, and stores encrypted values.
- `GET /api/internal/credentials?provider=GOOGLE` returns the correct env-var contract for workflow use.

### Phase 3: Agent Selection, Setup, and Workflow Eligibility

**Goal**: Make Gemini selectable everywhere it is supported, fix Mistral omissions in setup/analytics, and keep unsupported workflows blocked before job creation.

**Files to modify**:
1. `/home/runner/work/ai-board/ai-board/target/components/settings/default-agent-card.tsx`
2. `/home/runner/work/ai-board/ai-board/target/components/tickets/agent-edit-dialog.tsx`
3. `/home/runner/work/ai-board/ai-board/target/components/board/new-ticket-modal.tsx`
4. `/home/runner/work/ai-board/ai-board/target/components/board/ticket-card.tsx`
5. `/home/runner/work/ai-board/ai-board/target/components/setup/setup-page-client.tsx`
6. `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/credential-check/route.ts`
7. `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/route.ts`
8. `/home/runner/work/ai-board/ai-board/target/lib/workflows/transition.ts`
9. `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
10. `/home/runner/work/ai-board/ai-board/target/lib/workflows/dispatch-onboard.ts`
11. `/home/runner/work/ai-board/ai-board/target/lib/workflows/dispatch-retro-spec.ts`
12. `/home/runner/work/ai-board/ai-board/target/app/lib/workflows/dispatch-ai-board.ts`
13. `/home/runner/work/ai-board/ai-board/target/app/lib/workflows/dispatch-rollback-reset.ts`
14. `/home/runner/work/ai-board/ai-board/target/lib/health/scan-dispatch.ts`

**Notes**:
- Setup and onboarding should show Gemini and Mistral in agent choices when the flow offers supported selectable agents, but actual setup-job dispatch must reject Gemini if onboarding remains unsupported.
- Transition and setup routes must perform eligibility checks before they create ambiguous jobs.
- AI-assist, verify, retro-spec, onboard, and health-scan continue to resolve their current non-Gemini providers explicitly.

**Verification**:
- Project settings, ticket create/edit flows, and ticket badges render Gemini label/icon.
- Setup flow presents Gemini/Mistral consistently where agent choices are displayed, but POST guards reject unsupported dispatches with clear messages.

### Phase 4: Gemini Workflow Runtime and Secret Materialization

**Goal**: Teach the workflow runner how to install and invoke Gemini CLI in CI, restore Google credentials safely, and thread Google secrets only into supported workflows.

**Files to modify**:
1. `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh`
2. `/home/runner/work/ai-board/ai-board/target/.github/workflows/speckit.yml`
3. `/home/runner/work/ai-board/ai-board/target/.github/workflows/quick-impl.yml`
4. `/home/runner/work/ai-board/ai-board/target/.github/workflows/iterate.yml`
5. `/home/runner/work/ai-board/ai-board/target/.github/workflows/verify.yml`
6. `/home/runner/work/ai-board/ai-board/target/.github/workflows/ai-board-assist.yml`
7. `/home/runner/work/ai-board/ai-board/target/.github/workflows/onboard.yml`
8. `/home/runner/work/ai-board/ai-board/target/.github/workflows/retro-spec.yml`
9. `/home/runner/work/ai-board/ai-board/target/.github/workflows/health-scan.yml`

**Runtime contract**:
- Install Gemini CLI from `@google/gemini-cli`.
- Use headless mode with `-p` / non-TTY execution and `--output-format stream-json`.
- Prefer `GEMINI_API_KEY` when present; otherwise restore cached OAuth material under `~/.gemini` for headless reuse.
- Mask all returned secrets and keep unsupported workflows on their existing auth paths.

**Verification**:
- Supported workflows resolve `agent=GEMINI` and invoke Gemini CLI.
- Unsupported workflows reject Gemini before attempting internal credential fetch or CLI invocation.

### Phase 5: Telemetry, Cost Availability, and Analytics Aggregation

**Goal**: Capture Gemini usage with the same job-level fidelity as other agents and fix Mistral filter/setup omissions by standardizing aggregation logic.

**Files to modify**:
1. `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts`
2. `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts`
3. `/home/runner/work/ai-board/ai-board/target/lib/analytics/types.ts`
4. `/home/runner/work/ai-board/ai-board/target/lib/analytics/aggregations.ts`
5. `/home/runner/work/ai-board/ai-board/target/components/analytics/analytics-dashboard.tsx`
6. `/home/runner/work/ai-board/ai-board/target/components/analytics/overview-cards.tsx`
7. `/home/runner/work/ai-board/ai-board/target/components/analytics/top-tools-chart.tsx`

**Design choices**:
- Extend the batch telemetry payload to identify the agent/provider and to carry either `costUsd` or `costStatus: 'UNAVAILABLE'`.
- Parse Gemini CLI `stream-json` `tool_use`, `tool_result`, and final `result`/stats events into the same persisted job fields the dashboard already reads.
- Update analytics agent-option counting and filter normalization to include Gemini and Mistral, based on effective agent rather than hardcoded two-agent assumptions.

**Verification**:
- Gemini jobs populate model, token, tool, duration, and cost-or-unavailable fields.
- Analytics filter options include Gemini and Mistral when relevant job history exists.

### Phase 6: Test Extensions

**Goal**: Cover credential behavior, workflow guards, setup/UI availability, telemetry ingestion, and analytics regressions without adding unnecessary new files.

**Test files to extend**:
1. `/home/runner/work/ai-board/ai-board/target/tests/unit/ai-credentials.test.ts`
2. `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-schema.test.ts`
3. `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-icons.test.ts`
4. `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-resolution.test.ts`
5. `/home/runner/work/ai-board/ai-board/target/tests/unit/credential-dispatch-guard.test.ts`
6. `/home/runner/work/ai-board/ai-board/target/tests/unit/components/credential-form.test.tsx`
7. `/home/runner/work/ai-board/ai-board/target/tests/unit/components/default-agent-card.test.tsx`
8. `/home/runner/work/ai-board/ai-board/target/tests/unit/components/agent-edit-dialog.test.tsx`
9. `/home/runner/work/ai-board/ai-board/target/tests/unit/components/new-ticket-modal.test.tsx`
10. `/home/runner/work/ai-board/ai-board/target/tests/unit/components/setup/setup-page.test.tsx`
11. `/home/runner/work/ai-board/ai-board/target/tests/unit/components/analytics-dashboard.test.tsx`
12. `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/credentials-api.test.ts`
13. `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/credential-validation.test.ts`
14. `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/workflow-credential.test.ts`
15. `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts`
16. `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-redirect.test.ts`
17. `/home/runner/work/ai-board/ai-board/target/tests/integration/analytics/analytics-route.test.ts`
18. `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts`

**New test files only if needed**:
- A dedicated Gemini provider unit test file is acceptable only if `/tests/unit/ai-credentials.test.ts` becomes unreadable after adding Google API key and OAuth-bundle cases.

## Testing Strategy

Follow constitution section III:

- Extend existing test domains first. This feature already touches established credential, setup, analytics, telemetry, and selector coverage.
- Prefer integration tests for credential APIs, setup job guards, transition dispatch, telemetry ingestion, and analytics responses.
- Use RTL component tests for selector surfaces and setup-page rendering/interaction.
- Avoid new E2E coverage unless a browser-only Google sign-in path becomes mandatory for a shipped flow; current acceptance criteria can be covered without Playwright.
- Validate regression behavior for Claude, Codex, and current Mistral paths in the same files that receive Gemini coverage.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gemini OAuth cache format differs from current inference | Medium | Medium | Store a serialized auth bundle behind the existing encrypted OAUTH_TOKEN type and keep API-key flow as the supported CI default. |
| Gemini CLI stream-json schema changes | Medium | Medium | Isolate event parsing behind a provider-specific translator and preserve raw error payloads when parsing fails. |
| Analytics regressions from widening agent filters | Medium | High | Centralize supported-agent lists and extend integration route coverage with Gemini + Mistral fixtures. |
| Unsupported workflow leakage | Low | High | Gate at UI option generation and again in dispatch APIs before job creation. |
| Cost metadata lag for Gemini models | Medium | Medium | Persist tokens/tools/model and explicit `UNAVAILABLE` cost status rather than synthesizing `0`. |

## Dependencies

- Gemini CLI official docs and headless mode behavior verified on 2026-04-12:
  - https://geminicli.com/docs/get-started/authentication/
  - https://geminicli.com/docs/cli/headless/
  - https://geminicli.com/docs/cli/telemetry/
- Internal dependency on the existing encrypted credential store and workflow auth system.

