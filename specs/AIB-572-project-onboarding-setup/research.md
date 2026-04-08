# Research: Project Onboarding — Setup Page + Hybrid Workflow

**Feature Branch**: `AIB-572-project-onboarding-setup`
**Date**: 2026-04-08

## Research Tasks

### R1: SetupJob Model Design

**Decision**: Dedicated `SetupJob` model separate from `Job` and `HealthScan`
**Rationale**: SetupJob has fundamentally different semantics — project-scoped (not ticket-scoped like Job), one-time onboarding (not recurring like HealthScan), tracks partial completion (Phase 1 vs Phase 2), and has agent selection state. Conflating with existing models would create confusing query patterns.
**Alternatives considered**:
- Reuse `Job` model: Rejected — Job requires ticketId (foreign key), but setup happens before any tickets exist
- Reuse `HealthScan` model: Rejected — Different lifecycle, different fields (no score/report), different cardinality (one per project vs. many per project)

### R2: Credential Check Pattern

**Decision**: Real-time credential check via dedicated API call on agent selection change, with debouncing
**Rationale**: Credentials can be added/revoked at any time. The existing `getOwnerCredential()` in `lib/ai-credentials/workflow.ts` already provides the lookup pattern. The spec explicitly requires live checks, not cached.
**Alternatives considered**:
- Cache credential status on page load: Rejected — stale state could cause dispatch failures
- Inline check during dispatch: Rejected — poor UX (user clicks button, then gets error)

### R3: Workflow Dispatch Pattern for Onboard

**Decision**: Follow `lib/health/scan-dispatch.ts` pattern — dedicated dispatch function with credential validation, test mode support, and Octokit dispatch
**Rationale**: Health scan dispatch is the closest analog: project-scoped, not ticket-scoped, requires credential validation, dispatches to a specific workflow file. All existing dispatchers share the same env vars and Octokit pattern.
**Alternatives considered**:
- Reuse `handleTicketTransition()`: Rejected — that function is stage/ticket-centric and would need heavy modification
- Generic dispatch utility: Over-engineering for a single new workflow

### R4: Config Enum Extension for Multi-Stack Detection

**Decision**: Extend `ProjectLanguageSchema`, `ProjectFrameworkSchema`, and `PackageManagerSchema` in `lib/validations/config.ts` to add ruby, php, rails, laravel, bundler, composer
**Rationale**: Spec FR-014 requires detection for Ruby and PHP ecosystems. The existing Zod enums are the single source of truth for config validation. Adding new enum values is additive and backward-compatible.
**Alternatives considered**:
- Separate validation schema for onboarding: Rejected — would diverge from the canonical config schema
- Accept unknown values: Rejected — defeats the purpose of schema validation

### R5: Partial Completion Handling

**Decision**: SetupJob tracks `isPartial` boolean flag. If Phase 1 succeeds but Phase 2 fails, the job is marked COMPLETED with `isPartial: true` and `completedFiles` lists what was committed.
**Rationale**: Spec FR-024 explicitly requires partial success reporting. A boolean flag plus file list gives the UI enough to render a clear partial-success state.
**Alternatives considered**:
- Separate status enum value (PARTIAL): Rejected — adds complexity to status checks; COMPLETED + flag is simpler
- Fail the entire job: Rejected — contradicts spec; Phase 1 output alone makes the project functional

### R6: Setup Page State Machine

**Decision**: Server component shell with client component wizard that manages states: `initial` → `checking-credential` → `ready` / `no-credential` → `dispatching` → `polling` → `completed` / `failed`
**Rationale**: Follows existing patterns (health dashboard uses similar polling). TanStack Query with refetchInterval handles polling. Server component validates ownership and checks for existing config (redirect if present).
**Alternatives considered**:
- Full server-side rendering with form actions: Rejected — polling and live credential checks need client-side interactivity
- WebSocket for real-time updates: Over-engineering — 2s polling is consistent with existing job status polling

## Existing Files

### Files to Modify

| Path | What it covers | Action |
|------|---------------|--------|
| `prisma/schema.prisma` | Database schema | Add SetupJob model, SetupJobStatus enum |
| `lib/validations/config.ts` | Config Zod schema | Add ruby, php, rails, laravel, bundler, composer to enums |
| `app/api/projects/import/route.ts` | Import API | Already redirects to setup — verify integration |

### Files to Extend (Reference/Reuse patterns from)

| Path | What it covers | Pattern to reuse |
|------|---------------|-----------------|
| `lib/health/scan-dispatch.ts` | Health scan workflow dispatch | Credential validation + Octokit dispatch pattern |
| `lib/ai-credentials/workflow.ts` | Credential lookup for workflows | `getOwnerCredential()` for credential check |
| `lib/ai-credentials/types.ts` | Agent-to-provider mapping | `AGENT_PROVIDER_MAP` for resolving which credential to check |
| `lib/config-sync.ts` | Config sync from GitHub | `syncProjectConfig()` called after onboard workflow completes |
| `lib/workflows/service-inputs.ts` | Service container inputs | `getProjectServiceInputs()` — may not be needed for onboard (lightweight) |
| `lib/db/auth-helpers.ts` | Auth verification | `verifyProjectOwnership()` for owner-only guard |
| `app/projects/[projectId]/board/page.tsx` | Board page | Server component access validation pattern |
| `components/projects/import-project-modal.tsx` | Import modal | Already routes to `/projects/${id}/setup` when no config |

### Files to Create

| Path | Purpose |
|------|---------|
| `app/projects/[projectId]/setup/page.tsx` | Setup page (server component shell) |
| `components/setup/setup-wizard.tsx` | Client component: full setup flow orchestration |
| `components/setup/agent-selector.tsx` | Agent CLI radio group (Claude Code / Codex) |
| `components/setup/credential-status.tsx` | Credential availability indicator |
| `components/setup/setup-progress.tsx` | Running/completed/failed state display |
| `components/setup/setup-file-list.tsx` | List of committed files on success |
| `lib/setup/service.ts` | SetupJob CRUD, duplicate guard |
| `lib/setup/dispatch.ts` | Onboard workflow dispatch |
| `hooks/use-setup-job.ts` | TanStack Query polling hook |
| `app/api/projects/[projectId]/setup/route.ts` | GET status + POST dispatch |
| `.github/workflows/onboard.yml` | Onboard workflow definition |
| `.specify/scripts/bash/detect-stack.sh` | Phase 1: deterministic detection |
| `.claude/commands/onboard.md` | Phase 2: agent command |

### Existing Test Files

| Path | Covers | Action |
|------|--------|--------|
| `tests/integration/projects/crud.test.ts` | Project CRUD | No change needed |
| `tests/integration/projects/import.test.ts` | Project import | May extend to verify setup redirect |
| `tests/integration/projects/config-sync.test.ts` | Config sync | No change needed |
| `tests/integration/credentials/credentials-api.test.ts` | Credential CRUD | No change needed |
| `tests/integration/credentials/workflow-credential.test.ts` | Workflow credential resolution | May extend for setup credential check |
| `tests/integration/health/trigger-scan.test.ts` | Health scan dispatch | Reference pattern for setup dispatch tests |
| `tests/unit/credential-dispatch-guard.test.ts` | Credential dispatch blocking | Reference for setup credential guard tests |
| `tests/unit/components/projects/import-project-modal.test.tsx` | Import modal | May extend to verify setup redirect |

### Test Files to Create

| Path | Purpose | Test Type |
|------|---------|-----------|
| `tests/unit/setup/service.test.ts` | SetupJob service logic (duplicate guard, status transitions) | Unit |
| `tests/integration/setup/dispatch.test.ts` | POST dispatch endpoint, credential validation, duplicate rejection | Integration |
| `tests/integration/setup/status.test.ts` | GET status endpoint, polling behavior | Integration |
| `tests/unit/components/setup/setup-wizard.test.tsx` | Setup wizard states, agent selection, dispatch flow | Component |
| `tests/unit/components/setup/agent-selector.test.tsx` | Agent radio group interaction | Component |
