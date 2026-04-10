# Implementation Plan: Add Mistral (vibe CLI) as Third AI Agent Provider

**Feature Branch**: `AIB-593-add-mistral-vibe`
**Created**: 2026-04-10
**Spec**: [spec.md](./spec.md)

## Technical Context

| Aspect | Details |
|--------|---------|
| **Feature** | Add Mistral (vibe CLI) as a third AI agent provider alongside Claude and Codex |
| **Scope** | Data model, credential management, agent selection UI, workflow execution, telemetry |
| **Primary Language** | TypeScript 5.9 (strict), Bash (workflows) |
| **Frameworks** | Next.js 16 (App Router), Prisma 6.x, React 18, TailwindCSS 3.4 |
| **Key Dependencies** | vibe CLI (Python package), Mistral API, OTLP (OpenTelemetry) |
| **Database** | PostgreSQL 14+ via Prisma — enum additions only, no new tables |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TS. Provider module follows existing interface. |
| II. Component-Driven | PASS | Extends existing shadcn/ui components (Select, Card). No new UI primitives. |
| III. Test-Driven | PASS | Extends 12 existing test files. New tests only for new provider module. |
| IV. Security-First | PASS | Mistral key encrypted with AES-256-GCM (existing mechanism). Live verification against Mistral API. PROVIDER_ALLOWED_TYPES restricts to API_KEY only. |
| V. Database Integrity | PASS | Additive enum migration only. No table changes. Existing constraints preserved. |
| V. Spec Clarification | PASS | 5 auto-resolved decisions documented with trade-offs per spec. |

**Gate violations**: None.

## Design Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Research | [research.md](./research.md) | Unknowns resolved, existing files inventory, patterns extracted |
| Data Model | [data-model.md](./data-model.md) | Enum extensions, mapping tables, migration plan |
| Credential API Contract | [contracts/credential-api.md](./contracts/credential-api.md) | Mistral credential validation and verification |
| Telemetry API Contract | [contracts/telemetry-api.md](./contracts/telemetry-api.md) | OTLP trace processing for Mistral |
| Workflow Execution | [workflows/mistral-workflow-execution.md](./workflows/mistral-workflow-execution.md) | run-agent.sh and workflow YAML extensions |

## Implementation Phases

### Phase 1: Data Model & Core Types (Foundation)

**Goal**: Add MISTRAL to enums and update all TypeScript mapping tables so the codebase compiles.

**Files to modify**:
1. `prisma/schema.prisma` — Add `MISTRAL` to `Agent` and `CredentialProvider` enums
2. Run `bunx prisma migrate dev --name add-mistral-agent` to create migration
3. Run `bunx prisma generate` to regenerate client
4. `lib/ai-credentials/types.ts` — Extend `AGENT_PROVIDER_MAP`, `PROVIDER_ALLOWED_TYPES`, `ENV_VAR_MAP`
5. `lib/ai-credentials/workflow.ts` — Extend `getMissingCredentialError` with Mistral case
6. `app/lib/utils/agent-icons.ts` — Add MISTRAL to `AGENT_METADATA`, extend `inferAgentFromIdentifier`
7. `app/lib/utils/agent-resolution.ts` — No change needed (generic over Agent enum)
8. `lib/workflows/transition.ts` — No change needed (uses AGENT_PROVIDER_MAP dynamically)

**Files to create**:
1. `public/agents/mistral.svg` — Mistral icon asset

**Verification**: `bun run type-check` passes. All `Record<Agent, ...>` and `Record<CredentialProvider, ...>` maps include MISTRAL.

### Phase 2: Credential Provider Module

**Goal**: Enable Mistral API key storage, format validation, and live verification.

**Files to create**:
1. `lib/ai-credentials/providers/mistral.ts` — Format validation + live verification following the openai.ts pattern (research.md §Patterns #1)

**Files to modify**:
1. `lib/ai-credentials/providers/index.ts` — Import and register mistral module in `PROVIDER_MODULES`

**Verification**: Can create a Mistral credential via POST /api/credentials with proper validation and verification flow.

### Phase 3: UI Extensions

**Goal**: Mistral appears in all agent selection dropdowns and credential forms.

**Files to modify**:
1. `components/credentials/credential-form.tsx` — Add MISTRAL to provider options, add format hints (placeholder text, min length)
2. No changes needed for:
   - `components/settings/default-agent-card.tsx` — Iterates `Object.values(Agent)`, auto-includes MISTRAL
   - `components/tickets/agent-edit-dialog.tsx` — Same auto-inclusion
   - `components/board/ticket-detail-modal.tsx` — Uses agent-icons helpers
   - `components/board/new-ticket-modal.tsx` — Same auto-inclusion

**Verification**: UI shows Mistral option in project settings, ticket creation, ticket edit, and credential form.

### Phase 4: Workflow Execution (Shell & YAML)

**Goal**: vibe CLI installs, authenticates, and executes when agent=MISTRAL in workflows.

**Files to modify**:
1. `.github/scripts/run-agent.sh` — Add MISTRAL case: `validate_auth`, `install_mistral`, `setup_mistral_telemetry`, `invoke_mistral` (see workflows/mistral-workflow-execution.md)
2. `.github/workflows/speckit.yml` — Add `MISTRAL_API_KEY` to env block
3. `.github/workflows/quick-impl.yml` — Same
4. `.github/workflows/verify.yml` — Same
5. `.github/workflows/iterate.yml` — Same
6. `.github/workflows/ai-board-assist.yml` — Same

**Verification**: Dispatching a workflow with agent=MISTRAL installs vibe, disables datalake telemetry, and invokes the command.

### Phase 5: Telemetry Trace Processing

**Goal**: OTLP trace payloads from vibe are processed into Job telemetry metrics.

**Files to modify**:
1. `app/api/telemetry/v1/logs/route.ts`:
   - Replace the early-return for `resourceSpans` (line 71) with trace processing logic
   - Add `MISTRAL_PRICING` table following `OPENAI_PRICING` pattern
   - Add `estimateMistralCost` function
   - Parse trace spans: extract tokens from `gen_ai.usage.*` attributes, model from `gen_ai.request.model`, duration from span timestamps, tools from `tool.name`
2. `lib/schemas/otlp.ts` — Add Zod schema for OTLP trace format (`resourceSpans`, `scopeSpans`, `spans`) if needed for validation

**Verification**: Posting an OTLP trace payload with Mistral span data updates the Job's telemetry fields correctly.

### Phase 6: Testing

**Goal**: All new functionality covered by tests; all existing tests still pass.

**Test files to extend** (per research.md §Existing Files):
1. `tests/unit/agent-schema.test.ts` — MISTRAL enum validation
2. `tests/unit/agent-resolution.test.ts` — MISTRAL resolution (ticket override, project default)
3. `tests/unit/agent-icons.test.ts` — Mistral icon, label, description, identifier inference
4. `tests/unit/ai-credentials.test.ts` — Mistral format validation (provider registry, format rules)
5. `tests/unit/credential-dispatch-guard.test.ts` — MISTRAL dispatch guard (missing credential blocks transition)
6. `tests/integration/credentials/credentials-api.test.ts` — Mistral credential CRUD
7. `tests/integration/credentials/credential-validation.test.ts` — Mistral key format validation
8. `tests/integration/credentials/workflow-credential.test.ts` — Mistral provider parameter
9. `tests/integration/telemetry/agent-agnostic.test.ts` — Mistral trace event processing, cost estimation
10. `tests/unit/components/default-agent-card.test.tsx` — Verify MISTRAL renders
11. `tests/unit/components/agent-edit-dialog.test.tsx` — Verify MISTRAL renders

**Test types** (per constitution §III decision tree):
- Prisma enums, mapping tables, format validation → **Vitest unit test**
- UI components with agent dropdowns → **Vitest + RTL component test**
- Credential API, telemetry API → **Vitest integration test**
- No new E2E tests needed (agent selection follows existing patterns)

**Verification**: `bun run test:unit` and `bun run test:integration` pass. No regressions.

## Testing Strategy

Following constitution §III:
- **Search existing tests FIRST** — 11 existing test files identified for extension
- **No new test files** unless adding would mix unrelated concerns (Mistral provider format validation may warrant a dedicated test if `ai-credentials.test.ts` becomes unwieldy)
- **Integration over E2E** — All API interactions tested via Vitest integration tests
- **Component tests** — Use existing RTL test files for agent dropdowns
- **Test data** — Use `[e2e]` prefix for any project/ticket test fixtures

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| vibe CLI API changes | Medium | Medium | Pin vibe-cli version in install step; test with specific version |
| Mistral API key format changes | Low | Low | Permissive format validation; live verification is the real check |
| OTLP trace format differs from expected | Medium | Medium | Test with real vibe trace output; fallback to accepting without processing |
| Telemetry endpoint regression for Claude/Codex | Low | High | Existing telemetry tests serve as regression suite (FR-013) |
| Python 3.12+ not available on runner | Low | Medium | GitHub Actions ubuntu-latest includes Python 3.12+; detect and fail early |

## Dependencies

- **External**: Mistral API (for credential verification), vibe CLI package (for workflow execution)
- **Internal**: No blocking dependencies on other tickets
- **Secrets**: `MISTRAL_API_KEY` must be added to GitHub repository secrets for fallback
