# Implementation Plan: Project Onboarding — Setup Page, API, and Job Tracking

**Branch**: `AIB-574-project-onboarding-setup` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-574-project-onboarding-setup/spec.md`

## Summary

Implements the app-layer infrastructure for project onboarding: a setup page where owners select an agent CLI, verify credentials, and dispatch a stub onboarding workflow. Includes a new `ProjectSetupJob` data model, REST API for dispatch/status callbacks, real-time polling UI, and automatic config sync on completion. Projects without `.ai-board/config.yml` are redirected to setup; already-configured projects bypass it.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, TanStack Query v5, shadcn/ui, @octokit/rest
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web application (Next.js)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Setup page reflects job state within 5s of status change (SC-003), redirect for configured projects < 1s (SC-006)
**Constraints**: 2s polling interval for jobs (CLAUDE.md), workflow stub only (no real onboarding logic)
**Scale/Scope**: Single new page + 3 API routes + 1 Prisma model + 1 workflow stub

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All new code in strict TypeScript with explicit types |
| II. Component-Driven | ✅ PASS | Server component page with client component for interactivity; shadcn/ui primitives; route at `/app/projects/[projectId]/setup/` |
| III. Test-Driven | ✅ PASS | Integration tests for API, component tests for UI, existing tests extended where applicable |
| IV. Security-First | ✅ PASS | Zod validation on all inputs; owner-only dispatch; workflow token auth for callbacks; credential re-verification at dispatch |
| V. Database Integrity | ✅ PASS | Schema change via Prisma migration; cascade delete on project; status transitions validated before persistence |
| V. Spec Clarification | ✅ PASS | Auto-resolved decisions documented in spec with policies and trade-offs |

**No violations. Gate passed.**

## Project Structure

### Documentation (this feature)

```
specs/AIB-574-project-onboarding-setup/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research and existing file inventory
├── data-model.md        # Phase 1: ProjectSetupJob entity design
├── contracts/
│   └── api-endpoints.md # Phase 1: API request/response contracts
└── workflows/
    └── onboard-workflow.md  # Phase 1: Workflow stub specification
```

### Source Code (repository root)

```
prisma/
└── schema.prisma                          # Add ProjectSetupJob model

app/
├── projects/[projectId]/setup/
│   └── page.tsx                           # Server component: auth, redirect, data fetch
├── api/projects/[projectId]/setup/
│   ├── route.ts                           # GET (status) + POST (dispatch)
│   └── status/route.ts                    # PATCH (workflow callback)
└── lib/
    ├── query-keys.ts                      # Add setup query keys
    └── hooks/useSetupPolling.ts           # TanStack Query polling hook

components/
└── setup/
    └── setup-page-client.tsx              # Client component: agent select, dispatch, polling UI

.github/workflows/
└── onboard.yml                            # Stub workflow (dispatch target)

tests/
├── integration/projects/setup.test.ts     # API integration tests
├── unit/components/setup-page.test.tsx    # Component tests
└── unit/useSetupPolling.test.ts           # Polling hook tests
```

**Structure Decision**: Extends existing Next.js App Router structure. New page at `/projects/[projectId]/setup/` follows the pattern of `/board/`, `/settings/`, `/health/` etc. API routes nested under `/api/projects/[projectId]/setup/` follow REST conventions.

## Implementation Phases

### Phase 1: Data Model & Migration

1. Add `ProjectSetupJob` model to `prisma/schema.prisma` (see [data-model.md](./data-model.md))
2. Add `setupJobs ProjectSetupJob[]` relation to `Project` model
3. Run `bunx prisma migrate dev --name add_project_setup_job`
4. Run `bunx prisma generate`

### Phase 2: API Routes

1. **GET/POST `/api/projects/[projectId]/setup/route.ts`**:
   - GET: Return setup state derived from latest `ProjectSetupJob` + `configSyncedAt`
   - POST: Validate owner, check no active job, check not already configured, verify credential, create `ProjectSetupJob`, dispatch workflow (or skip in test mode)
   - See [contracts/api-endpoints.md](./contracts/api-endpoints.md) for request/response schemas

2. **PATCH `/api/projects/[projectId]/setup/status/route.ts`**:
   - Workflow token auth via `validateWorkflowAuth()`
   - Validate status transition via `canTransition()` from `job-state-machine.ts`
   - Update job record; set `completedAt` on terminal states
   - On COMPLETED: call `syncProjectConfig()` and return `configSynced` flag
   - On FAILED: persist `logs` for UI display

### Phase 3: Client Hooks & Query Keys

1. Add `setupStatus: (projectId: number) => ['projects', projectId, 'setup', 'status']` to `app/lib/query-keys.ts`
2. Create `useSetupPolling(projectId)` hook in `app/lib/hooks/useSetupPolling.ts`:
   - Polls GET `/api/projects/{projectId}/setup` at 2s interval
   - Auto-stops when `setupState` is `CONFIGURED` or job is terminal
   - Returns `{ setupState, latestJob, isPolling }`

### Phase 4: UI Components

1. **Server page** (`app/projects/[projectId]/setup/page.tsx`):
   - Auth check: redirect unauthenticated users
   - Data fetch: project with `configSyncedAt` and membership
   - If `configSyncedAt` is set: redirect to `/projects/[projectId]/board`
   - If user is not owner or member: return 403
   - Render `SetupPageClient` with project data and `isOwner` flag

2. **Client component** (`components/setup/setup-page-client.tsx`):
   - Agent selection (CLAUDE / CODEX radio/toggle using shadcn/ui)
   - Credential status indicator (fetches via `GET /api/credentials` filtered by provider)
   - "Initialize Project" button (disabled when: no credential, job in progress, not owner)
   - Progress state: elapsed time counter, status text, loading spinner
   - Success state: success message + "Go to Board" link
   - Error state: error details from `logs` + "Retry" button
   - Uses `useSetupPolling()` for real-time updates

### Phase 5: Workflow Stub

1. Create `.github/workflows/onboard.yml`:
   - `workflow_dispatch` trigger with inputs per [workflows/onboard-workflow.md](./workflows/onboard-workflow.md)
   - Steps: callback RUNNING → sleep 5s → callback COMPLETED (or FAILED on error)

### Phase 6: Post-Import Redirect

1. Identify the project import/creation flow and add redirect logic:
   - After project creation, if `configSyncedAt` is null, redirect to `/projects/[projectId]/setup`
   - This likely touches the project creation success handler or post-import redirect

## Testing Strategy

### Integration Tests (`tests/integration/projects/setup.test.ts`)

New file — no existing test covers setup API.

| Test | What It Verifies |
|------|-----------------|
| POST dispatch creates job and returns 201 | FR-005 |
| POST rejects non-owner with 403 | FR-015 |
| POST rejects when already configured (409) | FR-007 |
| POST rejects when job in progress (409) | FR-006 |
| POST rejects when credential missing (422) | FR-003 |
| GET returns NEEDS_SETUP for new project | FR-017 |
| GET returns IN_PROGRESS for active job | FR-017 |
| PATCH callback updates status (RUNNING) | FR-010 |
| PATCH callback updates status (COMPLETED) + triggers config sync | FR-011 |
| PATCH callback updates status (FAILED) with logs | FR-019 |
| PATCH rejects invalid transition (400) | State machine |
| PATCH rejects unauthorized (401) | FR-018 |

### Component Tests (`tests/unit/components/setup-page.test.tsx`)

New file — no existing test covers setup UI.

| Test | What It Verifies |
|------|-----------------|
| Renders agent selection options | FR-002 |
| Disables button when credential missing | FR-003, FR-004 |
| Enables button when credential present | FR-003 |
| Shows progress state during RUNNING | FR-008, FR-009 |
| Shows success state on COMPLETED | FR-012 |
| Shows error + retry on FAILED | FR-013, FR-014 |
| Disables dispatch for non-owners | FR-015 |

### Unit Tests (`tests/unit/useSetupPolling.test.ts`)

New file — polling hook is new.

| Test | What It Verifies |
|------|-----------------|
| Polls at 2s interval | Polling pattern |
| Stops polling on terminal state | Auto-stop |
| Returns correct setup state derivation | State logic |

## Complexity Tracking

*No constitution violations. No complexity exceptions needed.*
