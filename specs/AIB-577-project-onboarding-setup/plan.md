# Implementation Plan: Project Onboarding Setup Page, API, and Job Tracking

**Branch**: `AIB-577-project-onboarding-setup` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-577-project-onboarding-setup/spec.md`

## Summary

Implements the project onboarding flow: a setup page where project owners select an agent CLI, verify credentials, and dispatch a stub onboarding workflow. The system tracks setup job status via polling, triggers config sync on completion, and redirects to the project board. This resolves the 404 dead-end for imported projects without configuration files.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, TanStack Query v5, shadcn/ui, Octokit
**Storage**: PostgreSQL 14+ via Prisma
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web application (Next.js)
**Project Type**: Web application
**Performance Goals**: Setup page load < 1s, status polling at 2s intervals, redirect within 2s of completion
**Constraints**: Owner-only access, single active job per project, workflow auth via Bearer token
**Scale/Scope**: 1 new Prisma model, 4 new API endpoints, 1 new page, 1 stub workflow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TypeScript with explicit types |
| II. Component-Driven | PASS | shadcn/ui components, Server Component default, feature folder structure |
| III. Test-Driven | PASS | Integration tests for API, RTL component tests for UI, extends no existing tests (new domain) |
| IV. Security-First | PASS | Zod validation on all inputs, workflow auth on callbacks, owner-only access, no exposed secrets |
| V. Database Integrity | PASS | Prisma migration, cascade deletes, no orphaned rows on dispatch failure |
| V. Spec Clarification | PASS | Auto-resolved decisions documented with trade-offs in spec |

### Post-Design Check

| Gate | Status | Evidence |
|------|--------|----------|
| No `any` types | PASS | All interfaces explicitly typed |
| Zod ↔ Prisma alignment | PASS | `agent` enum matches Prisma `Agent`, `status` matches `SetupJobStatus` |
| Input validation at boundaries | PASS | Zod on POST body, PATCH body, GET query params |
| Transactions for multi-table ops | PASS | Config sync on completion uses optimistic locking (existing pattern) |
| DB consistency on external failure | PASS | Dispatch failure → job marked FAILED before returning error |
| Auth on all routes | PASS | Owner-only for POST/GET, workflow token for PATCH |
| Tests verify behavior | PASS | Acceptance scenarios map to integration test cases |

## Project Structure

### Documentation (this feature)

```
specs/AIB-577-project-onboarding-setup/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research findings
├── data-model.md        # Phase 1: entity design
├── contracts/
│   └── setup-jobs-api.md  # Phase 1: API contracts
└── workflows/
    └── onboard-workflow.md  # Phase 1: stub workflow spec
```

### Source Code (repository root)

```
prisma/
└── schema.prisma                    # MODIFY: Add ProjectSetupJob model + SetupJobStatus enum

app/
├── projects/[projectId]/
│   ├── board/page.tsx               # MODIFY: Add redirect for unconfigured projects
│   └── setup/
│       └── page.tsx                 # NEW: Setup page (server component)
├── api/projects/[projectId]/setup/
│   ├── jobs/
│   │   ├── route.ts                 # NEW: POST (create + dispatch), GET (latest job)
│   │   └── [jobId]/status/
│   │       └── route.ts             # NEW: PATCH (workflow callback)
│   └── credential-check/
│       └── route.ts                 # NEW: GET (credential validation)
└── lib/
    ├── query-keys.ts                # MODIFY: Add setup job keys
    └── hooks/
        └── useSetupJobPolling.ts    # NEW: TanStack Query polling hook

components/
└── setup/
    └── setup-page-client.tsx        # NEW: Client component (UI, polling, dispatch)

lib/
└── workflows/
    └── dispatch-onboard.ts          # NEW: Onboard workflow dispatch function

.github/workflows/
└── onboard.yml                      # NEW: Stub onboard workflow

tests/
├── integration/projects/
│   ├── setup-job.test.ts            # NEW: API integration tests
│   └── setup-redirect.test.ts       # NEW: Redirect integration tests
└── unit/components/setup/
    └── setup-page.test.tsx          # NEW: RTL component tests
```

**Structure Decision**: Web application (Next.js App Router). All new files follow existing feature folder conventions under `app/`, `components/`, `lib/`, and `tests/`.

## Implementation Phases

### Phase 1: Data Layer

1. Add `SetupJobStatus` enum and `ProjectSetupJob` model to `prisma/schema.prisma` (see `data-model.md`)
2. Add `setupJobs` relation to `Project` model
3. Run `bunx prisma migrate dev --name add-project-setup-job`
4. Run `bunx prisma generate`

### Phase 2: Workflow Dispatch

1. Create `lib/workflows/dispatch-onboard.ts` following `lib/health/scan-dispatch.ts:17-74` pattern:
   - Test mode bypass via `isWorkflowTestMode()`
   - Credential resolution via `getOwnerCredential(projectId, provider)`
   - `octokit.actions.createWorkflowDispatch()` to `onboard.yml`
   - Structured error re-throw in catch

### Phase 3: API Endpoints

1. **POST `/api/projects/[projectId]/setup/jobs/route.ts`**:
   - Auth: `verifyProjectOwnership()` from `lib/db/auth-helpers.ts`
   - Validate body with Zod (`agent` enum)
   - Pre-flight checks: no active job, not already configured, credential exists
   - Create `ProjectSetupJob` record with status PENDING
   - Dispatch workflow; on failure mark job FAILED (DB consistency per constitution V)
   - Return 201 with job data

2. **GET `/api/projects/[projectId]/setup/jobs/route.ts`**:
   - Auth: `verifyProjectOwnership()`
   - Query latest `ProjectSetupJob` by `createdAt DESC`
   - Return job + project `configSyncedAt`

3. **PATCH `/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts`**:
   - Auth: `validateWorkflowAuth()` from `app/lib/workflow-auth.ts`
   - Validate body with Zod
   - State machine validation (reuse `canTransition` logic pattern)
   - Idempotent handling (same status → 200 no-op)
   - Set `startedAt` on RUNNING, `completedAt` on terminal
   - On COMPLETED: trigger `syncProjectConfig()` from `lib/config-sync.ts` (non-blocking)
   - On FAILED: persist `errorMessage`
   - Return `{ id, status, completedAt }`

4. **GET `/api/projects/[projectId]/setup/credential-check/route.ts`**:
   - Auth: `verifyProjectOwnership()`
   - Map agent → provider (CLAUDE→ANTHROPIC, CODEX→OPENAI)
   - Query `getOwnerCredential(projectId, provider)`
   - Return `{ hasCredential, provider, settingsUrl? }`

### Phase 4: Frontend

1. **Add query keys** to `app/lib/query-keys.ts`:
   - `queryKeys.projects.setupJob(projectId)` → `['projects', id, 'setup', 'job']`
   - `queryKeys.projects.credentialCheck(projectId, agent)` → `['projects', id, 'setup', 'credential', agent]`

2. **Create polling hook** `app/lib/hooks/useSetupJobPolling.ts`:
   - TanStack Query `useQuery()` fetching `GET /api/projects/:id/setup/jobs`
   - 2-second `refetchInterval` while status is PENDING or RUNNING
   - Stop polling on terminal status or when `configSyncedAt` is set
   - `staleTime: 0`, `gcTime: 5 * 60 * 1000`, `refetchIntervalInBackground: true`

3. **Create setup page server component** `app/projects/[projectId]/setup/page.tsx`:
   - `export const dynamic = 'force-dynamic'`
   - Verify project exists via DB query
   - If `configSyncedAt` is set → `redirect()` to board
   - Pass `projectId` and initial data to client component

4. **Create setup page client component** `components/setup/setup-page-client.tsx`:
   - Agent selection (Radio group or card selector using shadcn/ui)
   - Credential check (query on agent change, show/hide guidance)
   - Initialize button (disabled when credential missing or job active)
   - Status display (PENDING → spinner, RUNNING → progress, COMPLETED → redirecting, FAILED → error + retry)
   - Polling via `useSetupJobPolling` hook
   - Redirect to board via `router.push()` when `configSyncedAt` becomes set
   - Aurora theme classes for card/dialog surfaces

5. **Add board redirect** in `app/projects/[projectId]/board/page.tsx`:
   - After loading project, check if `configSyncedAt` is null
   - If null → `redirect()` to `/projects/${projectId}/setup`

### Phase 5: Stub Workflow

1. Create `.github/workflows/onboard.yml` per `workflows/onboard-workflow.md`:
   - `workflow_dispatch` trigger with inputs: `project_id`, `job_id`, `githubRepository`, `agent`
   - Step 1: PATCH RUNNING status with `workflowRunId`
   - Step 2: `sleep 5` (simulate work)
   - Step 3: PATCH COMPLETED status
   - Error handler: PATCH FAILED status on any step failure

## Testing Strategy

### Integration Tests (Vitest)

**File**: `tests/integration/projects/setup-job.test.ts` (NEW)

| Test | Maps to | Type |
|------|---------|------|
| POST creates setup job and returns 201 | US1-AC2 | Happy path |
| POST rejects non-owner with 403 | US2-AC1 | Auth guard |
| POST rejects already-configured project with 409 | US2-AC4 | Guard |
| POST rejects when active job exists with 409 | US2-AC3 | Guard |
| POST rejects when credential missing with 409 | US3-AC1/AC2 | Guard |
| GET returns latest setup job | US1-AC4 | Polling |
| GET returns null when no job exists | US1-AC1 | Initial state |
| PATCH updates status PENDING → RUNNING | US5-AC1 | Callback |
| PATCH updates status RUNNING → COMPLETED and triggers config sync | US5-AC2 | Callback + side effect |
| PATCH updates status RUNNING → FAILED with error message | US5-AC3 | Callback |
| PATCH rejects invalid transition with 400 | US5 | State machine |
| PATCH rejects unauthenticated request with 401 | US5-AC4 | Auth guard |
| PATCH is idempotent for same status | US5 | Idempotent |
| Retry after failure creates new job | US4-AC2/AC3 | Retry flow |

**File**: `tests/integration/projects/setup-redirect.test.ts` (NEW)

| Test | Maps to | Type |
|------|---------|------|
| Board page redirects to setup when unconfigured | US1-AC1 | Redirect |
| Setup page redirects to board when configured | US2-AC2 | Redirect |

### Component Tests (Vitest + RTL)

**File**: `tests/unit/components/setup/setup-page.test.tsx` (NEW)

| Test | Maps to | Type |
|------|---------|------|
| Renders agent selection options | US1-AC1 | Render |
| Disables button when credential missing | US3-AC1/AC2 | UI guard |
| Enables button when credential valid | US3-AC3 | UI state |
| Shows running state with spinner | US1-AC4 | Status display |
| Shows error and retry button on failure | US4-AC1 | Error display |
| Calls dispatch API on initialize click | US1-AC2 | Interaction |

## Complexity Tracking

No constitution violations. No complexity exceptions needed.
