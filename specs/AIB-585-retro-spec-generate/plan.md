# Implementation Plan: AIB-585 Retro-Spec Generate

**Feature Branch**: `AIB-585-retro-spec-generate`
**Created**: 2026-04-09
**Spec**: `specs/AIB-585-retro-spec-generate/spec.md`

## Technical Context

| Aspect | Detail |
|--------|--------|
| **Database** | PostgreSQL + Prisma 6.x — extend `ProjectSetupJob` model with `command` discriminator and retro-spec fields |
| **Backend** | Next.js 16 App Router — extend existing setup jobs API routes |
| **Frontend** | React 18 + TanStack Query v5 — new board components (banner, modal, badge) |
| **Workflow** | GitHub Actions — new `retro-spec.yml` workflow following `onboard.yml` pattern |
| **Agent** | New `ai-board.retro-spec` command for LLM-powered spec generation |
| **State** | TanStack Query polling (2s interval) for job status; localStorage for banner dismissal |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TypeScript with explicit types |
| II. Component-Driven | PASS | shadcn/ui components for modal, banner; feature folder `components/board/` |
| III. Test-Driven | PASS | Integration tests for API, unit tests for new components |
| IV. Security-First | PASS | Zod validation on all inputs; owner-only access; credential pre-check |
| V. Database Integrity | PASS | Prisma migration; atomic transaction for job creation; no raw SQL |
| V. Spec Guardrails | PASS | Auto-resolved decisions documented with trade-offs |

## Design Artifacts

- [`research.md`](./research.md) — Unknowns resolved, existing files inventory, patterns to follow
- [`data-model.md`](./data-model.md) — Schema changes (SetupJobCommand enum, new fields)
- [`contracts/api-endpoints.md`](./contracts/api-endpoints.md) — API contract changes
- [`workflows/retro-spec-workflow.md`](./workflows/retro-spec-workflow.md) — GitHub Actions workflow spec
- [`workflows/retro-spec-command.md`](./workflows/retro-spec-command.md) — Agent command spec

## Implementation Phases

### Phase 1: Database & API (Backend Foundation)

**Goal**: Schema migration and API route extensions for retro-spec job lifecycle.

#### 1.1 Prisma Schema Migration
- **File**: `prisma/schema.prisma`
- Add `SetupJobCommand` enum (`ONBOARD`, `RETRO_SPEC`)
- Add fields to `ProjectSetupJob`: `command`, `depth`, `docUrl`, `context`
- Add composite index `[projectId, command, status]`
- Run `bunx prisma migrate dev --name add_retro_spec_command`
- Run `bunx prisma generate`

#### 1.2 Extend POST Setup Jobs Route
- **File**: `app/api/projects/[projectId]/setup/jobs/route.ts`
- Extend Zod schema: optional `command` (default `ONBOARD`), conditional `depth` (required for RETRO_SPEC), optional `docUrl`, `context`
- Invert `configSyncedAt` check for RETRO_SPEC (MUST be set)
- Scope active-job check by `command` type
- On RETRO_SPEC: dispatch `retro-spec.yml` instead of `onboard.yml`
- Return new fields in response

#### 1.3 Extend GET Setup Jobs Route
- **File**: `app/api/projects/[projectId]/setup/jobs/route.ts`
- Add optional `command` query parameter for filtering
- Return `command`, `depth`, `docUrl` in response

#### 1.4 Extend PATCH Status Route
- **File**: `app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts`
- On COMPLETED: check `job.command` — only trigger `syncProjectConfig()` for ONBOARD jobs
- RETRO_SPEC completion: no side effects needed

#### 1.5 Create Workflow Dispatch Function
- **File**: `lib/workflows/dispatch-retro-spec.ts` (new)
- Follow pattern from `lib/workflows/dispatch-onboard.ts` (see research.md §Patterns)
- Inputs: `project_id`, `job_id`, `githubRepository`, `agent`, `depth`, `docUrl`, `context`
- Test mode support, credential pre-check, Octokit dispatch

### Phase 2: Frontend — Board Banner & Modal (UI)

**Goal**: Dismissible banner, spec generation modal, and status badge on the board.

#### 2.1 Add Retro-Spec Query Key
- **File**: `app/lib/query-keys.ts`
- Add `retroSpecJob(projectId)` key under `projects`

#### 2.2 Create Retro-Spec Polling Hook
- **File**: `app/lib/hooks/useRetroSpecPolling.ts` (new)
- Follow pattern from `app/lib/hooks/useSetupJobPolling.ts`
- GET `/api/projects/:projectId/setup/jobs?command=RETRO_SPEC` at 2s interval
- Stop polling on COMPLETED or FAILED
- Return `{ job, isGenerating, isCompleted, isFailed, error }`

#### 2.3 Create Retro-Spec Banner Component
- **File**: `components/board/retro-spec-banner.tsx` (new)
- Dismissible banner: "Project specs not generated — Specs improve health scans, ticket workflows, and code review quality — [Generate] [×]"
- Dismissal persists to `localStorage` key: `retro-spec-banner-dismissed-${projectId}`
- "Generate" button opens the modal
- Conditional render: only when project has `configSyncedAt` set, no completed RETRO_SPEC job, and not dismissed
- Accessibility: `role="alert"`, `aria-live="polite"`

#### 2.4 Create Retro-Spec Modal Component
- **File**: `components/board/retro-spec-modal.tsx` (new)
- shadcn/ui `Dialog` with aurora styling
- Fields:
  - Depth picker (radio group): Quick / Standard (default) / Comprehensive — with descriptions and time estimates
  - Documentation URL input (optional, URL validation)
  - Additional context textarea (optional)
- "Generate Specs" button: POST to `/api/projects/:projectId/setup/jobs` with `command: "RETRO_SPEC"`
- On success: close modal, start polling
- On error: show inline error (toast for dispatch failures)

#### 2.5 Create Retro-Spec Badge Component
- **File**: `components/board/retro-spec-badge.tsx` (new)
- States:
  - Generating: "Generating specs..." with pulse animation
  - Completed: "Specs ready" — fades out after 30s
  - Failed: Error indicator with retry button
- Positioned in board area above stage columns

#### 2.6 Integrate into Board Component
- **File**: `components/board/board.tsx`
- Import and render `RetroSpecBanner` and `RetroSpecBadge`
- Pass `projectId` prop
- Banner renders above stage columns (same level as OfflineIndicator)
- Badge renders in the same area, mutually exclusive with banner (badge shown when job is active)

#### 2.7 Extend Board Page Server Component
- **File**: `app/projects/[projectId]/board/page.tsx`
- Query for latest completed RETRO_SPEC job to determine if specs exist
- Pass `hasSpecs: boolean` prop to Board component (used by banner visibility logic)

#### 2.8 Add "Generate Specs" to Board Menu
- Ensure the modal can be triggered from an alternate location (e.g., project settings or board menu) for users who dismissed the banner (FR-013)

### Phase 3: GitHub Workflow & Agent Command

**Goal**: The workflow and agent command that actually generate specifications.

#### 3.1 Create Retro-Spec Workflow
- **File**: `.github/workflows/retro-spec.yml` (new)
- Follow `onboard.yml` structure (see `workflows/retro-spec-workflow.md`)
- Inputs: project_id, job_id, githubRepository, agent, depth, docUrl, context
- Steps: report RUNNING → fetch credentials → clone repo → fetch docs (if URL) → run agent command → commit specs → report COMPLETED/FAILED
- Timeout: 30 minutes

#### 3.2 Create Retro-Spec Agent Command
- **File**: `.claude-plugin/commands/ai-board.retro-spec.md` (new)
- Prompt template for LLM-powered codebase analysis and spec generation
- Depth-scaled output (see `workflows/retro-spec-command.md`)
- Writes to `specs/specifications/` directory

### Phase 4: Setup Page Redirect Fix

**Goal**: Ensure setup page redirects to board when configSyncedAt is set.

#### 4.1 Verify Server-Side Redirect
- **File**: `app/projects/[projectId]/setup/page.tsx`
- Already redirects when `configSyncedAt` is set (line 42) — verify no regressions
- Already blocks non-owners (line 45) — verify

#### 4.2 Verify Client-Side Redirect
- **File**: `components/setup/setup-page-client.tsx`
- Already redirects when polling detects `configSyncedAt` — verify no regressions
- Ensure no "re-initialize" button shown for configured projects

### Phase 5: Testing

#### 5.1 Integration Tests — Retro-Spec API
- **File**: `tests/integration/projects/retro-spec-job.test.ts` (new)
- Test POST with RETRO_SPEC command: valid creation, missing depth rejection, configSyncedAt required, concurrent job prevention
- Test GET with command filter
- Test PATCH status transitions (no config sync on RETRO_SPEC completion)

#### 5.2 Extend Existing Setup Job Tests
- **File**: `tests/integration/projects/setup-job.test.ts`
- Add tests verifying ONBOARD jobs still work with the new `command` field (backward compatibility)
- Verify command defaults to ONBOARD when omitted

#### 5.3 Unit Tests — Banner Component
- **File**: `tests/unit/components/board/retro-spec-banner.test.tsx` (new)
- Renders when specs not generated and not dismissed
- Hidden when dismissed (localStorage)
- Hidden when specs already generated
- Generate button opens modal
- Dismiss button persists to localStorage

#### 5.4 Unit Tests — Modal Component
- **File**: `tests/unit/components/board/retro-spec-modal.test.tsx` (new)
- Depth selection defaults to Standard
- URL validation on docUrl field
- Submit dispatches POST with correct payload
- Error states displayed

## Testing Strategy

Following constitution §III Test-Driven Development:

| Test Type | Files | Rationale |
|-----------|-------|-----------|
| Integration (Vitest) | `retro-spec-job.test.ts`, extend `setup-job.test.ts` | API routes with DB operations |
| Unit + RTL (Vitest) | `retro-spec-banner.test.tsx`, `retro-spec-modal.test.tsx` | React components with user interactions |
| E2E (Playwright) | None initially | API tests cover the critical paths; E2E only if browser-specific behavior needed |

**Existing test files to verify** (no regressions):
- `tests/integration/projects/setup-job.test.ts` — onboard job tests
- `tests/integration/projects/setup-redirect.test.ts` — redirect behavior
- `tests/unit/components/setup/setup-page.test.tsx` — setup page rendering

## Dependency Order

```
Phase 1 (DB + API) → Phase 2 (Frontend) → Phase 3 (Workflow) → Phase 4 (Verify) → Phase 5 (Tests)
```

Phase 1 must complete first as all other phases depend on the schema and API. Phase 2 and Phase 3 can proceed in parallel after Phase 1. Phase 4 is verification only. Phase 5 should be written alongside each phase but is listed last for clarity.

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Existing onboard tests break due to schema change | Default `command = ONBOARD` ensures backward compat; run existing tests after migration |
| Workflow timeout for Comprehensive depth | 30-min timeout with clear depth-to-time expectations in UI |
| Banner dismissed but user wants specs later | FR-013: "Generate Specs" accessible from board menu/settings |
| Concurrent retro-spec + onboard jobs | Scoped by `command` type — independent job tracking |
