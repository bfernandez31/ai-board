# Implementation Plan: AIB-607 — Add Gemini CLI as AI Agent

**Branch**: `AIB-607-add-gemini-cli`
**Status**: Ready for Implementation
**Created**: 2026-04-11

## Technical Context

| Aspect | Details |
|--------|---------|
| **Database** | Prisma schema enum extensions (Agent + CredentialProvider). Migration: two `ADD VALUE` statements. |
| **Auth/Credentials** | New `GOOGLE` provider module following Mistral pattern. AES-256-GCM encryption unchanged. |
| **Workflows** | Three workflow YAMLs gain `GEMINI→GOOGLE` credential mapping. `run-agent.sh` gains GEMINI case. |
| **Telemetry** | Native OTLP from Gemini CLI → existing `/api/telemetry/v1/logs` endpoint. New event names + pricing table. |
| **Analytics** | `NamedAgent` type made dynamic from Agent enum. Hardcoded agent arrays replaced. Fixes Mistral gap. |
| **UI** | Agent metadata entry + SVG icon. Setup page gains GEMINI + MISTRAL entries. |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TypeScript. Zod schemas for validation. |
| II. Component-Driven | PASS | Uses existing shadcn/ui components. No new UI primitives. |
| III. Test-Driven | PASS | Extends 7 existing test files + 1 new integration test. No duplication. |
| IV. Security-First | PASS | Credentials encrypted AES-256-GCM. Format validation + live verification. No secrets in responses. |
| V. Database Integrity | PASS | Changes via Prisma migration. No raw SQL. Enum-only extension. |
| V. Spec Guardrails | PASS | All 5 auto-resolved decisions documented with trade-offs. |

## Implementation Phases

### Phase 1: Data Layer — Schema + Credential Provider (FR-001, FR-002, FR-003, FR-004, FR-005, FR-019)

**Goal**: Gemini credentials can be stored, validated, and verified.

#### 1.1 Prisma Schema Migration

**File**: `prisma/schema.prisma`
- Add `GEMINI` to `Agent` enum (after MISTRAL)
- Add `GOOGLE` to `CredentialProvider` enum (after MISTRAL)
- Run `bunx prisma migrate dev --name add-gemini-google-enums`
- Run `bunx prisma generate`

#### 1.2 Application Mappings

**File**: `lib/ai-credentials/types.ts`
- Add `GEMINI: 'GOOGLE'` to `AGENT_PROVIDER_MAP`
- Add `GOOGLE: ['API_KEY', 'OAUTH_TOKEN']` to `PROVIDER_ALLOWED_TYPES`
- Add `'GOOGLE:API_KEY': 'GEMINI_API_KEY'` and `'GOOGLE:OAUTH_TOKEN': 'GEMINI_OAUTH_TOKEN'` to `ENV_VAR_MAP`

#### 1.3 Google Credential Provider Module

**New file**: `lib/ai-credentials/providers/google.ts`
- Follow exact pattern from `lib/ai-credentials/providers/mistral.ts` (see research.md "Patterns to Follow")
- `validateFormat()`: API_KEY requires `AIza` prefix, >= 39 chars, no whitespace. OAUTH_TOKEN requires >= 20 chars, no whitespace.
- `verifyWithProvider()`: API_KEY uses `GET https://generativelanguage.googleapis.com/v1beta/models?key={value}`. OAUTH_TOKEN uses same URL with `Authorization: Bearer {value}`. Same timeout/error handling as Mistral.

**File**: `lib/ai-credentials/providers/index.ts`
- Add `GOOGLE: google` to `PROVIDER_MODULES` registry

#### 1.4 Tests

- **Extend** `tests/unit/ai-credentials.test.ts`: Add Google API_KEY and OAUTH_TOKEN format validation tests
- **Extend** `tests/unit/credential-dispatch-guard.test.ts`: Add GEMINI→GOOGLE provider mapping assertion
- **New** `tests/integration/credentials/google-credential.test.ts`: Google credential verification integration tests (mock Google API responses)

---

### Phase 2: UI Layer — Agent Metadata, Icon, Selection (FR-006, FR-007, FR-008, FR-009)

**Goal**: Gemini appears on all agent selection surfaces. Mistral appears on setup page.

#### 2.1 Agent Icon

**New file**: `public/agents/gemini.svg`
- Gemini logo SVG (Google's Gemini sparkle icon)
- Same dimensions as existing agent icons

#### 2.2 Agent Metadata

**File**: `app/lib/utils/agent-icons.ts`
- Add GEMINI entry to `AGENT_METADATA`:
  ```
  [Agent.GEMINI]: { description: 'Google Gemini CLI', iconPath: '/agents/gemini.svg', label: 'Gemini' }
  ```
- Update `inferAgentFromIdentifier()` to detect "gemini" or "google" in agent identifier strings

#### 2.3 Setup Page Fix

**File**: `components/setup/setup-page-client.tsx`
- Add GEMINI and MISTRAL to `AGENTS` array (FR-008, FR-009)
- Note: Setup page dispatches onboard/retro-spec workflows. Gemini is NOT eligible for these (FR-011). Must either:
  - a) Show Gemini in the list but block dispatch with a clear message, OR
  - b) Exclude Gemini from the setup agent list since setup only runs onboard/retro-spec
  - **Decision**: Option (b) — only show agents eligible for setup workflows. Add MISTRAL (which IS eligible for onboard). Gemini excluded from setup with a note explaining why.
  - Actually, per FR-008 spec says "System MUST include Gemini in the project setup/onboarding agent selection list". So option (a): show Gemini but validate at dispatch time (the credential-check and job creation APIs will reject it).

**File**: `app/api/projects/[projectId]/setup/jobs/route.ts`
- Extend agent validation schema from `z.enum(['CLAUDE', 'CODEX'])` to include all agents
- Add agent eligibility check: if agent is GEMINI and command is ONBOARD/RETRO_SPEC, return 400 with message "Gemini is not supported for setup workflows. Please use Claude or Codex."

#### 2.4 Tests

- **Extend** `tests/unit/agent-icons.test.ts`: Add GEMINI metadata assertions (icon, label, description, identifier inference)
- **Extend** `tests/unit/agent-schema.test.ts`: Add GEMINI to valid agent values

---

### Phase 3: Workflow Layer — Dispatch + CLI Execution (FR-010, FR-011, FR-012, FR-013, FR-020)

**Goal**: Gemini workflows dispatch correctly. Gemini CLI installs and runs in CI.

#### 3.1 Workflow Eligibility

**File**: `lib/workflows/transition.ts`
- Add agent eligibility check before dispatch. For verify workflow, ensure only CLAUDE is dispatched (it's hardcoded to Claude dependencies).
- For now, no change needed here since verify.yml doesn't use run-agent.sh for the agent CLI (it uses Claude directly). But add a comment documenting the constraint.

#### 3.2 Workflow YAML Credential Mapping

**Files**: `.github/workflows/speckit.yml`, `.github/workflows/quick-impl.yml`, `.github/workflows/iterate.yml`
- Add `GEMINI) PROVIDER="GOOGLE" ;;` to the credential fetch case statement in each workflow

#### 3.3 Run-Agent Script

**File**: `.github/scripts/run-agent.sh`
- Add `GEMINI` case to `validate_auth()`: require `GEMINI_API_KEY` or `GEMINI_OAUTH_TOKEN`
- Add `install_gemini()` function: npm global install, verify binary exists
- Add `setup_gemini_telemetry()` function: set `GEMINI_TELEMETRY_ENABLED=1`
- Add `invoke_gemini()` function: resolve command file, configure model, invoke in headless mode
- Add `GEMINI)` case to main dispatch: `validate_auth → install_gemini → setup_gemini_telemetry → invoke_gemini`
- Update error message in `*` case to include GEMINI in supported list

#### 3.4 Tests

- No automated tests for shell scripts (tested via workflow execution)
- Manual verification plan: trigger a quick-impl job with GEMINI agent on a test project

---

### Phase 4: Telemetry Layer — OTLP Processing + Cost Estimation (FR-014, FR-015)

**Goal**: Gemini job metrics captured and costs estimated.

#### 4.1 Telemetry Endpoint

**File**: `app/api/telemetry/v1/logs/route.ts`
- Add Gemini event detection (after Codex, before tool events):
  ```typescript
  const isGeminiApiResponse = eventName === 'gemini_cli.api_response';
  const isGeminiToolCall = eventName === 'gemini_cli.tool_call';
  ```
- For `gemini_cli.api_response`: extract `input_tokens`, `output_tokens`, `thought_tokens` (→ cacheReadTokens), `model`, `duration_ms`. Estimate cost via `estimateGeminiCost()`.
- For `gemini_cli.tool_call`: extract `tool_name` → add to `metrics.toolsUsed`
- Add `GEMINI_PRICING` table and `estimateGeminiCost()` function following exact pattern from `estimateOpenAICost()` and `estimateMistralCost()`

#### 4.2 Tests

- **Extend** `tests/integration/telemetry/agent-agnostic.test.ts`:
  - Add test: Gemini `api_response` event with token metrics and cost estimation
  - Add test: Gemini `tool_call` event with tool name extraction
  - Add test: Gemini unknown model falls back to `gemini-2.5-pro` pricing
  - Add test: Gemini `thought_tokens` maps to `cacheReadTokens`

---

### Phase 5: Analytics Layer — Dynamic Agent Filtering (FR-016, FR-017, FR-018)

**Goal**: Analytics dashboard supports all agents dynamically. Gemini and Mistral visible.

#### 5.1 Analytics Types

**File**: `lib/analytics/types.ts`
- Change `NamedAgent` from hardcoded union to derive from Prisma Agent enum:
  ```typescript
  import { Agent } from '@prisma/client';
  export type NamedAgent = Agent;  // 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI'
  ```
- `AgentFilter` remains `'all' | NamedAgent` (unchanged structure)

#### 5.2 Analytics Queries

**File**: `lib/analytics/queries.ts`
- `getAvailableAgents()`: Replace hardcoded `['CLAUDE', 'CODEX'] as const` with `Object.values(Agent)` from Prisma
- Replace hardcoded `new Map<NamedAgent, number>([['CLAUDE', 0], ['CODEX', 0]])` with dynamic initialization from all Agent enum values
- Import `Agent` from `@prisma/client`

#### 5.3 Tests

- **Extend** `tests/integration/analytics/analytics-route.test.ts`: Add test verifying Gemini and Mistral appear in available agents when they have jobs
- **Extend** `tests/unit/components/analytics-dashboard.test.tsx`: Verify agent filter renders all agent options

---

## Testing Strategy

### Test Type Selection (per Constitution §III Decision Tree)

| Change Area | Test Type | Rationale |
|-------------|-----------|-----------|
| Google credential format validation | Vitest unit | Pure function, no side effects |
| Google credential verification | Vitest integration | External API call (mocked) |
| AGENT_PROVIDER_MAP / ENV_VAR_MAP | Vitest unit | Pure data mapping |
| Agent metadata (icons, labels) | Vitest unit | Pure function |
| Telemetry OTLP processing | Vitest integration | Database operations |
| Analytics queries | Vitest integration | Database operations |
| Setup page agent list | Vitest + RTL component | User interaction |
| Analytics agent filter | Vitest + RTL component | User interaction |

### Existing Test Files Extended (7)

1. `tests/unit/ai-credentials.test.ts` — Google format validation
2. `tests/unit/credential-dispatch-guard.test.ts` — GEMINI→GOOGLE mapping
3. `tests/unit/agent-icons.test.ts` — GEMINI metadata
4. `tests/unit/agent-schema.test.ts` — GEMINI in schema
5. `tests/integration/telemetry/agent-agnostic.test.ts` — Gemini OTLP events
6. `tests/integration/analytics/analytics-route.test.ts` — Dynamic agent filter
7. `tests/unit/components/analytics-dashboard.test.tsx` — Agent filter UI

### New Test Files (1)

1. `tests/integration/credentials/google-credential.test.ts` — Google provider verification with mocked API

### No E2E Tests Needed

All changes are API-level or component-level. No browser-only features (no OAuth, drag-drop, or viewport-dependent behavior). Integration tests provide sufficient coverage.

## Dependency Order

```
Phase 1 (Schema + Credentials)
  └─→ Phase 2 (UI - Agent Metadata + Selection)
  └─→ Phase 3 (Workflows - Dispatch + CLI)
  └─→ Phase 4 (Telemetry - OTLP Processing)
       └─→ Phase 5 (Analytics - Dynamic Filtering)
```

Phases 2, 3, 4 can proceed in parallel after Phase 1 completes. Phase 5 depends on Phase 4 (telemetry must work for analytics data to exist).

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Gemini CLI package name/install method changes | Abstract behind `install_gemini()` function; easy to update |
| Google API key format changes | Format validation is conservative (prefix + min length); live verification catches format changes |
| Gemini OTLP event schema differs from expected | Graceful handling: missing attributes default to zero; unknown events ignored |
| Pricing table outdated | Static table with fallback to most expensive model; easy to update |
| Mistral analytics fix has side effects | Dynamic agent filtering is additive; existing Claude/Codex queries unchanged |
