# Research: Project Onboarding Setup Page, API, and Job Tracking

**Branch**: `AIB-577-project-onboarding-setup` | **Date**: 2026-04-08

## Resolved Unknowns

### 1. ProjectSetupJob Model Design

- **Decision**: Create a new `ProjectSetupJob` Prisma model following the `HealthScan` pattern (separate entity with status, timestamps, error tracking, telemetry).
- **Rationale**: HealthScan is the closest existing analogue — a project-scoped job with PENDING/RUNNING/COMPLETED/FAILED lifecycle and workflow dispatch. Reusing the same structural patterns ensures consistency and reduces learning curve.
- **Alternatives considered**: (a) Reusing the existing `Job` model with a new command type — rejected because `Job` is ticket-scoped (`ticketId` required) and setup jobs are project-scoped. (b) Adding a `setupStatus` field to `Project` — rejected per spec Decision 2 (derive from latest job, no dual-write).

### 2. Workflow Dispatch Pattern

- **Decision**: Create a new `dispatchOnboardWorkflow()` function in `lib/workflows/dispatch-onboard.ts` following the exact pattern of `dispatchHealthScanWorkflow()` in `lib/health/scan-dispatch.ts`.
- **Rationale**: Health scan dispatch is the closest match — project-scoped (not ticket-scoped), credential validation, test mode bypass, Octokit dispatch.
- **Alternatives considered**: Reusing `dispatchAIBoardWorkflow()` — rejected because it requires ticket-specific inputs (`ticket_id`, `stage`, `branch`) that don't apply to project setup.

### 3. Status Callback Endpoint

- **Decision**: Create `PATCH /api/projects/[projectId]/setup/jobs/[jobId]/status` following the pattern from `app/api/jobs/[id]/status/route.ts` and `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`.
- **Rationale**: Project-scoped callbacks match the HealthScan pattern. Using PATCH for status updates is established convention.
- **Alternatives considered**: Reusing the existing `/api/jobs/[id]/status` endpoint — rejected because ProjectSetupJob is a separate model, not a Job record.

### 4. Polling Strategy

- **Decision**: Create a `useSetupJobPolling` hook following `useJobPolling.ts` pattern with 2-second polling interval, stopping on terminal status.
- **Rationale**: Existing job polling uses TanStack Query with `refetchInterval` and terminal-state detection. Same pattern applies.
- **Alternatives considered**: WebSocket — rejected as overkill for a single-user setup flow with infrequent updates.

### 5. Config Sync Trigger

- **Decision**: Call `syncProjectConfig()` from `lib/config-sync.ts` inside the status callback handler when status transitions to COMPLETED.
- **Rationale**: The config sync module already handles GitHub fetch, YAML parse, validation, strip, and DB store with optimistic locking. No modifications needed.
- **Alternatives considered**: Triggering sync from the client after detecting COMPLETED — rejected because server-side trigger is more reliable and avoids race conditions.

### 6. Credential Check Flow

- **Decision**: Use `getOwnerCredential(projectId, provider)` from `lib/ai-credentials/workflow.ts` for pre-dispatch credential validation. Map agent selection to provider: CLAUDE → ANTHROPIC, CODEX → OPENAI.
- **Rationale**: This function already resolves the project owner and queries their credentials by provider. Exact match for our need.
- **Alternatives considered**: Client-side credential check — rejected because credential lookup requires DB access.

### 7. Setup Page Routing

- **Decision**: Create setup page at `app/projects/[projectId]/setup/page.tsx` as a new sub-route under the project layout.
- **Rationale**: Follows the existing project page structure (`board/`, `settings/`, `activity/`, `health/`, `analytics/`, `comparisons/`). Setup is a distinct flow, not a settings subsection.
- **Alternatives considered**: Modal on the board page — rejected because setup is a full-page flow with its own lifecycle states.

### 8. Redirect Logic for Unconfigured Projects

- **Decision**: Add redirect logic in the project board page (`app/projects/[projectId]/board/page.tsx`) — if project has no `configSyncedAt` and no active setup job, redirect to `/projects/[projectId]/setup`.
- **Rationale**: The board page is the default landing page after import. A server-side redirect is clean and immediate.
- **Alternatives considered**: Redirect in the project layout — rejected because non-board pages (settings, activity) should remain accessible for already-imported projects even without config.

## Existing Files

### Source Files to Modify

| File | Purpose | Action |
|------|---------|--------|
| `prisma/schema.prisma` | Data models | Add `ProjectSetupJob` model, `SetupJobStatus` enum, relation to `Project` |
| `app/projects/[projectId]/board/page.tsx` | Board page | Add redirect to setup if project unconfigured |
| `app/lib/query-keys.ts` | TanStack Query key factory | Add setup job query keys |

### Source Files as Pattern References

| File | Purpose | Reuse Pattern |
|------|---------|---------------|
| `lib/health/scan-dispatch.ts` | Health scan workflow dispatch | Dispatch function structure, credential check, test mode bypass |
| `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` | Health scan status callback | PATCH handler structure, state validation, side effects on completion |
| `app/api/jobs/[id]/status/route.ts` | Job status callback | Workflow auth, state machine validation, idempotent handling |
| `app/lib/job-state-machine.ts` | State machine with transitions | `canTransition()`, `isTerminalStatus()` pattern for setup job states |
| `app/lib/hooks/useJobPolling.ts` | Job polling hook | TanStack Query polling with terminal state detection |
| `lib/config-sync.ts` | Config sync utility | Call `syncProjectConfig()` on completion — no modification needed |
| `lib/ai-credentials/workflow.ts` | Credential lookup | `getOwnerCredential()` for pre-dispatch validation — no modification needed |
| `lib/db/auth-helpers.ts` | Auth helpers | `verifyProjectOwnership()` for owner-only access on setup |
| `app/lib/workflow-auth.ts` | Workflow Bearer auth | `validateWorkflowAuth()` for callback authentication |
| `app/projects/[projectId]/health/page.tsx` | Health page | Reference for project sub-page component structure |

### New Files to Create

| File | Purpose |
|------|---------|
| `app/projects/[projectId]/setup/page.tsx` | Setup page (server component with redirect logic) |
| `components/setup/setup-page-client.tsx` | Setup page client component (agent selection, dispatch, polling UI) |
| `app/api/projects/[projectId]/setup/jobs/route.ts` | POST: create setup job + dispatch; GET: latest setup job status |
| `app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts` | PATCH: workflow status callback |
| `lib/workflows/dispatch-onboard.ts` | Onboard workflow dispatch function |
| `app/lib/hooks/useSetupJobPolling.ts` | Setup job polling hook |
| `.github/workflows/onboard.yml` | Stub onboard workflow (dispatch → callback COMPLETED) |

### Test Files

| File | Action | Rationale |
|------|--------|-----------|
| `tests/integration/projects/setup-job.test.ts` | **Create** | No existing test covers setup job API; integration tests for POST, GET, PATCH |
| `tests/integration/projects/setup-redirect.test.ts` | **Create** | No existing test covers setup redirect; test board redirect for unconfigured projects |
| `tests/unit/components/setup/setup-page.test.tsx` | **Create** | No existing component test covers setup page UI; RTL tests for agent selection, credential check, dispatch flow |

## Patterns to Follow

### Dispatch-Then-Rollback Pattern (from `lib/health/scan-dispatch.ts:17-74`)

1. Check test mode bypass first (`isWorkflowTestMode()`)
2. Validate credentials before dispatch (`getOwnerCredential()`)
3. Validate environment variables (`GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`)
4. Dispatch via `octokit.actions.createWorkflowDispatch()`
5. Wrap dispatch in try/catch with structured error re-throw
6. **Critical**: If dispatch fails, the caller must handle cleanup (e.g., mark setup job as FAILED)

### Status Callback Pattern (from `app/api/jobs/[id]/status/route.ts:45-296`)

1. Validate workflow auth first (`validateWorkflowAuth()`)
2. Parse and validate body with Zod
3. Fetch current record and verify existence
4. Check idempotent case (same status → 200 no-op)
5. Validate state transition (`canTransition()`)
6. Build update data dynamically (avoid passing `undefined` with `exactOptionalPropertyTypes`)
7. Set `startedAt` on RUNNING, `completedAt` on terminal states
8. Fire-and-forget side effects on terminal states (non-blocking `.catch()`)
9. Return minimal response: `{ id, status, completedAt }`

### Error Handling Pattern (from `app/api/jobs/[id]/status/route.ts`)

- Structured logging: `console.error('[Component]', { contextFields })`
- Performance tracking: `startTime = Date.now()`, log `elapsedMs` on completion
- Specific HTTP codes: 400 (validation), 401 (auth), 404 (not found), 409 (conflict), 500 (internal)
- Response shape: `{ error: string, details?: unknown }`

### Polling Hook Pattern (from `app/lib/hooks/useJobPolling.ts`)

- TanStack Query `useQuery()` with dynamic `refetchInterval`
- Poll at 2-second intervals when job is active
- Stop polling when terminal status detected
- `staleTime: 0`, `gcTime: 5 * 60 * 1000`
- `refetchIntervalInBackground: true`
- Invalidate related queries on terminal state

### Security Patterns

- **Workflow callbacks**: Always validate Bearer token via `validateWorkflowAuth()` using `crypto.timingSafeEqual()` (from `app/lib/workflow-auth.ts`)
- **Owner-only access**: Use `verifyProjectOwnership()` from `lib/db/auth-helpers.ts` for setup page and dispatch endpoint
- **Credentials**: Never expose credential values in API responses; use `getOwnerCredential()` which returns boolean existence check for pre-flight validation
