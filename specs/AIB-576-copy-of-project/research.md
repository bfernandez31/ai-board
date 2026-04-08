# Research: Project Onboarding Setup Flow

**Feature Branch**: `AIB-576-copy-of-project`
**Date**: 2026-04-08

## Resolved Unknowns

### 1. How should onboarding history be persisted?

- **Decision**: Introduce a dedicated `ProjectSetupAttempt` model with one row per start/retry, related back to `Project`.
- **Rationale**: FR-007, FR-015, and FR-017 require timestamps, result summaries, failure details, and retry history. A single mutable project field cannot satisfy auditability or “latest attempt wins” restoration.
- **Alternatives considered**: Store setup status directly on `Project` only; rejected because retries would overwrite history and stale callbacks would be hard to reconcile.

### 2. What determines whether setup is complete?

- **Decision**: Treat setup as complete only when a successful workflow callback is accepted and `syncProjectConfig()` succeeds. If sync fails, persist the attempt as `FAILED` with a sync-specific failure message.
- **Rationale**: The spec says successful onboarding is not final until configuration is synchronized. Reusing `Project.config` + `Project.configSyncedAt` as the final authority avoids duplicate “onboarded” flags that can drift from the actual synced config state.
- **Alternatives considered**: Mark attempt `COMPLETED` before sync and add a second project flag; rejected because it creates conflicting sources of truth and false-positive success states.

### 3. How should the application prevent duplicate active runs?

- **Decision**: Enforce a single active attempt per project in the setup-start service using a transaction that checks for `PENDING`/`RUNNING` attempts before inserting a new row, with a partial-uniqueness equivalent enforced in application logic and query patterns.
- **Rationale**: Prisma/PostgreSQL in this codebase already relies on transactional integrity rules for multi-step workflow state. This preserves one authoritative active attempt without losing historical rows.
- **Alternatives considered**: Reuse `Job` rows; rejected because setup is project-scoped, not ticket-scoped, and requires separate lifecycle semantics and summaries.

### 4. How should workflow callbacks be authenticated?

- **Decision**: Reuse the existing workflow Bearer-token pattern via `validateWorkflowAuth()` on a dedicated setup-attempt status endpoint.
- **Rationale**: The app already authenticates GitHub Actions callbacks with `WORKFLOW_API_TOKEN` in `app/api/jobs/[id]/status/route.ts` and `app/api/internal/credentials/route.ts`. Reusing that mechanism keeps the design consistent and minimizes operational changes.
- **Alternatives considered**: Per-attempt callback secrets or signed payloads; rejected as unnecessary complexity for this ticket’s minimal workflow.

### 5. How should the selected setup agent map to credentials?

- **Decision**: Reuse the existing provider-aware owner credential lookup in `lib/ai-credentials/workflow.ts`, mapping `CLAUDE -> ANTHROPIC` and `CODEX -> OPENAI` from the already-established agent/credential infrastructure.
- **Rationale**: The import/setup flow should not invent new credential readiness logic when project workflows already resolve owner credentials by provider.
- **Alternatives considered**: Setup-specific credential checks in the route/UI; rejected because they would duplicate provider mapping and drift from workflow dispatch behavior.

### 6. Where should setup gating happen in navigation?

- **Decision**: Add a canonical `/projects/[projectId]` entry page that redirects to `/setup` or `/board`, and also guard `/projects/[projectId]/board` directly so existing hardcoded links cannot bypass setup.
- **Rationale**: `app/api/projects/import/route.ts` already redirects imports to `/projects/{id}/setup`, but there is no setup page today and `components/projects/project-card.tsx` hardcodes `/board`. Both the canonical entry path and direct board access need protection.
- **Alternatives considered**: Only add `/setup`; rejected because existing project-card and deep links would still land on `/board`.

### 7. How should status visibility work for owners vs members?

- **Decision**: Expose latest setup state through a read endpoint authorized with `verifyProjectAccess()`, but restrict start/retry mutations to owners via `verifyProjectOwnership()`.
- **Rationale**: FR-002 and FR-018 split control from visibility. The codebase already has that access distinction in `lib/db/auth-helpers.ts`.
- **Alternatives considered**: Owner-only access to all setup surfaces; rejected because the spec explicitly allows collaborators to view latest status.

### 8. What should the onboarding workflow do for this ticket?

- **Decision**: Define a minimal `project-onboarding.yml` workflow that fetches the owner credential, checks out the target repo, creates or preserves the expected onboarding files, posts `RUNNING`, then posts `COMPLETED` or `FAILED` back to the app.
- **Rationale**: FR-020 only requires an end-to-end exercise of the lifecycle, not a production-complete repository bootstrap engine.
- **Alternatives considered**: Reuse `speckit.yml`; rejected because setup is project-scoped and not ticket/stage-driven.

## Existing Files

### Source Files To Extend

| File | What it covers | Extend or create? |
|------|----------------|-------------------|
| `app/api/projects/import/route.ts` | Import flow already syncs config and redirects to `/projects/{id}/setup` when config is missing | Extend |
| `app/api/projects/[projectId]/route.ts` | Project detail endpoint used by project navigation and settings | Extend |
| `app/projects/[projectId]/board/page.tsx` | Direct board entry point that currently never checks setup-required state | Extend |
| `components/projects/project-card.tsx` | Main project entry click target, currently hardcoded to `/projects/{id}/board` | Extend |
| `components/projects/import-project-modal.tsx` | Client import flow that pushes the API’s `redirectTo` and displays import errors | Extend |
| `lib/db/auth-helpers.ts` | Existing owner-only vs member-capable project authorization helpers | Reuse |
| `lib/db/projects.ts` | Shared project data loading patterns for project pages and API routes | Extend/reuse |
| `lib/config-sync.ts` | Authoritative config synchronization logic that should run after successful onboarding | Reuse |
| `lib/ai-credentials/workflow.ts` | Owner credential resolution and provider-aware error messaging | Reuse |
| `app/lib/workflow-auth.ts` | Workflow callback Bearer-token validation | Reuse |
| `app/api/internal/credentials/route.ts` | Existing workflow-side credential fetch endpoint used by GitHub Actions | Reuse |
| `.github/workflows/speckit.yml` | Existing pattern for workflow-token callbacks, owner-credential fetch, and double checkout | Reuse as pattern |
| `.github/workflows/ai-board-assist.yml` | Existing pattern for agent-specific provider selection and callback posting | Reuse as pattern |
| `prisma/schema.prisma` | Existing `Project`, `UserCredential`, `Agent`, and config-sync source of truth | Extend |

### Source Files That Do Not Exist Yet But Are Needed

| Planned file | Why a new file is justified |
|--------------|-----------------------------|
| `app/projects/[projectId]/page.tsx` | No canonical project-entry route currently exists; a new page is needed to centralize setup-vs-board redirect behavior. |
| `app/projects/[projectId]/setup/page.tsx` | The setup redirect target already exists conceptually but the page file is missing. |
| `app/api/projects/[projectId]/setup/route.ts` | No current endpoint returns project-scoped setup status/read-model data. |
| `app/api/projects/[projectId]/setup/attempts/route.ts` | No existing owner-only endpoint starts or retries project onboarding. |
| `app/api/projects/[projectId]/setup/attempts/[attemptId]/status/route.ts` | No callback route exists for setup-attempt lifecycle updates. |
| `lib/project-setup/*` | Setup orchestration is a new domain and should not be mixed into ticket/job services. |
| `.github/workflows/project-onboarding.yml` | No workflow currently represents project-scoped onboarding. |

## Existing Test Files

### Test Files To Extend

| File | What it covers | Extend or create? |
|------|----------------|-------------------|
| `tests/integration/projects/import.test.ts` | Import redirect behavior and import endpoint validation | Extend |
| `tests/integration/projects/config-sync.test.ts` | Config sync persistence and `/config/sync` endpoint behaviors | Extend |
| `tests/integration/projects/crud.test.ts` | Project detail endpoint and project access basics | Extend |
| `tests/integration/credentials/workflow-credential.test.ts` | Workflow-side owner credential lookup and provider mapping | Extend |
| `tests/integration/jobs/status.test.ts` | Existing workflow-authenticated callback/status update pattern | Reuse pattern, extend only if callback helpers are shared |
| `tests/unit/components/projects/import-project-modal.test.tsx` | Import modal redirect and auth-state UI behavior | Extend |
| `tests/unit/components/default-agent-card.test.tsx` | Existing agent selection UI patterns with shadcn Select | Reuse pattern |
| `tests/unit/auth-helpers.test.ts` | Authorization helper semantics for owner vs member access | Extend if helper behavior changes |
| `tests/helpers/workflow-auth.ts` | Shared workflow-token helper for integration tests | Reuse |
| `tests/helpers/db-setup.ts` | Project/user seeding helpers for project-scoped integration tests | Reuse/extend |

### New Test File Justified

| File | Why a new file is justified |
|------|-----------------------------|
| `tests/integration/projects/setup.test.ts` | The setup flow introduces a cohesive new matrix of owner-only starts, member-visible reads, duplicate prevention, retry history, and workflow callbacks that would overcrowd unrelated import/crud tests. |

## Additional Design Constraints

- `Project.config` and `Project.configSyncedAt` already exist and should remain the only authoritative indicator that setup can be skipped.
- `Project.defaultAgent` is not sufficient for setup start because the spec requires explicit owner selection at onboarding time.
- The repo already supports provider-aware credentials and workflow-side credential fetching; setup should consume that path rather than inventing secret handling.
- Project cards, project detail pages, and sidebar-linked views currently assume the board is always reachable; the setup plan must guard those entry paths explicitly.
