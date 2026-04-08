# Research: Project Onboarding — Setup Page, API, and Job Tracking

**Feature Branch**: `AIB-574-project-onboarding-setup`
**Date**: 2026-04-08

## Technical Decisions

### 1. Setup Job Model Strategy

**Decision**: Create a new `ProjectSetupJob` model separate from the existing `Job` model.

**Rationale**: The existing `Job` model is tightly coupled to tickets (`ticketId` is required, non-nullable). Setup jobs are project-level operations without a ticket context. Adding a nullable `ticketId` would break the existing data contract and introduce confusion. A dedicated model keeps responsibilities clear and avoids polluting the existing job system.

**Alternatives considered**:
- Adding `ticketId` as nullable on `Job` — rejected because it breaks existing queries, foreign key constraints, and the conceptual model (jobs belong to tickets)
- Creating a "virtual" ticket for setup — rejected as an anti-pattern that conflates domain concepts

### 2. Setup Page Routing

**Decision**: Add a new route at `app/projects/[projectId]/setup/page.tsx` within the existing project layout.

**Rationale**: Follows the existing pattern at `app/projects/[projectId]/board/page.tsx`, `settings/page.tsx`, etc. The setup page is a project-level view that fits naturally in the project route hierarchy.

**Alternatives considered**:
- Modal overlay on project board — rejected because setup is a blocking workflow, not a quick action
- Separate top-level route — rejected because it's inherently project-scoped

### 3. Status Callback Endpoint

**Decision**: Create a new endpoint `POST /api/projects/[projectId]/setup/status` for workflow callbacks, using the same `WORKFLOW_API_TOKEN` auth pattern as `PATCH /api/jobs/[id]/status`.

**Rationale**: Reuses the proven workflow auth pattern (`lib/workflow-auth.ts`) while keeping setup callbacks separate from ticket job callbacks. The endpoint handles status transitions, config sync on COMPLETED, and error persistence on FAILED.

**Alternatives considered**:
- Reusing `/api/jobs/[id]/status` — rejected because `ProjectSetupJob` is a different model
- Creating a generic webhook endpoint — over-engineered for a single workflow type

### 4. Polling Strategy

**Decision**: Use TanStack Query with 2s polling interval (matching existing `useJobPolling` pattern), auto-stopping when job reaches terminal state.

**Rationale**: Consistent with the established polling pattern in `app/lib/hooks/useJobPolling.ts`. The 2s interval matches CLAUDE.md's specified "2s jobs" polling rate.

### 5. Config Sync on Completion

**Decision**: Reuse existing `syncProjectConfig()` from `lib/config-sync.ts` when setup workflow reports COMPLETED. No modifications to config sync needed.

**Rationale**: The spec's assumption states "The existing config sync mechanism is reliable and does not require modification." The function already handles fetching `.ai-board/config.yml`, validating, and storing in the `config`/`configSyncedAt` fields.

### 6. Credential Check Strategy

**Decision**: Use existing `getOwnerCredential()` from `lib/ai-credentials/workflow.ts` with `AGENT_PROVIDER_MAP` from `lib/ai-credentials/types.ts` for credential verification. Client-side check via `GET /api/credentials` to show inline status; server-side re-verification at dispatch time.

**Rationale**: The credential infrastructure already maps Agent→CredentialProvider (CLAUDE→ANTHROPIC, CODEX→OPENAI) and provides `readinessStatus` for UI display. Dispatch-time check is the authoritative guard per spec decision #2.

## Existing Files

### Source Files to Extend

| Path | What It Covers | Action |
|------|---------------|--------|
| `prisma/schema.prisma` | All data models | Add `ProjectSetupJob` model |
| `lib/config-sync.ts` | Config sync from GitHub | Reuse as-is (no changes) |
| `lib/ai-credentials/workflow.ts` | Owner credential resolution | Reuse as-is |
| `lib/ai-credentials/types.ts` | Agent↔Provider mapping | Reuse as-is |
| `app/lib/workflow-auth.ts` | Workflow token validation | Reuse as-is |
| `app/lib/query-keys.ts` | TanStack Query key factory | Add setup job keys |
| `app/lib/job-state-machine.ts` | Job status transitions | Reuse as-is (same states apply) |

### Source Files to Create

| Path | Purpose |
|------|---------|
| `app/projects/[projectId]/setup/page.tsx` | Setup page (server component with redirect logic) |
| `components/setup/setup-page-client.tsx` | Setup page client component (agent selection, dispatch, polling) |
| `app/api/projects/[projectId]/setup/route.ts` | GET (status) + POST (dispatch) setup API |
| `app/api/projects/[projectId]/setup/status/route.ts` | PATCH callback endpoint for workflow status updates |
| `app/lib/hooks/useSetupPolling.ts` | TanStack Query hook for polling setup job status |

### Test Files to Extend

| Path | What It Covers | Action |
|------|---------------|--------|
| `tests/integration/projects/config-sync.test.ts` | Config sync integration | Potentially extend for post-setup sync |

### Test Files to Create

| Path | Purpose |
|------|---------|
| `tests/integration/projects/setup.test.ts` | Integration tests for setup dispatch API, status callback, and guards |
| `tests/unit/components/setup-page.test.tsx` | Component tests for setup page UI states |
| `tests/unit/useSetupPolling.test.ts` | Unit test for setup polling hook |
