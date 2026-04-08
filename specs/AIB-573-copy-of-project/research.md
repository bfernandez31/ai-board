# Research: Project Setup Page and Hybrid Initialization Workflow

**Branch**: `AIB-573-copy-of-project` | **Date**: 2026-04-08

## Existing Files

### Source files

- `/home/runner/work/ai-board/ai-board/target/app/api/projects/import/route.ts`
  What it covers: imported project creation, initial config sync attempt, and redirect selection.
  Plan: extend. It already returns `/projects/{id}/setup` when config sync fails, so it is the entrypoint for onboarding-required imports.

- `/home/runner/work/ai-board/ai-board/target/lib/config-sync.ts`
  What it covers: GitHub-backed `.ai-board/config.yml` fetch, validation, storage, and optimistic locking.
  Plan: extend. The onboarding completion path should reuse this module after the workflow commits generated config.

- `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/workflow.ts`
  What it covers: provider-aware owner credential lookup, secret decryption, and missing-credential messaging.
  Plan: extend. Setup readiness checks should reuse provider lookup and messaging instead of inventing a parallel credential layer.

- `/home/runner/work/ai-board/ai-board/target/app/api/internal/credentials/route.ts`
  What it covers: workflow-authenticated credential secret resolution for GitHub Actions.
  Plan: extend only if onboarding needs richer provider/readiness metadata in workflow callbacks; otherwise reuse as-is.

- `/home/runner/work/ai-board/ai-board/target/lib/db/auth-helpers.ts`
  What it covers: project owner/member authorization helpers.
  Plan: extend or reuse. `verifyProjectOwnership` is the correct baseline for owner-only setup initiation.

- `/home/runner/work/ai-board/ai-board/target/lib/db/projects.ts`
  What it covers: project fetch/update data access for owner/member contexts.
  Plan: extend. Setup-required resolution likely belongs in a new onboarding helper invoked alongside these accessors.

- `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/layout.tsx`
  What it covers: shared project shell for board/settings/analytics routes.
  Plan: extend. This is the best choke point for redirecting owners into setup before board/settings access when config is missing.

- `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/board/page.tsx`
  What it covers: project board page load and project existence validation.
  Plan: extend or simplify after layout gating so missing-config imports stop bypassing setup.

- `/home/runner/work/ai-board/ai-board/target/components/projects/project-card.tsx`
  What it covers: project card navigation from the projects dashboard.
  Plan: extend. It currently hardcodes `/board`; it should route through a setup-aware project entry path.

- `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/settings/page.tsx`
  What it covers: project settings screen with default agent, constitution, and config review.
  Plan: extend. This is the natural place to review and adjust generated onboarding artifacts after completion.

- `/home/runner/work/ai-board/ai-board/target/components/settings/config-card.tsx`
  What it covers: synced config display and manual sync trigger.
  Plan: extend or compose alongside a new artifact review card.

- `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/route.ts`
  What it covers: project GET/PATCH API.
  Plan: extend if setup metadata must be exposed in general project payloads; otherwise keep setup APIs separate.

- `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/jobs/status/route.ts`
  What it covers: polling for ticket jobs.
  Plan: use as pattern only. Setup jobs are project-scoped and need their own API contract.

- `/home/runner/work/ai-board/ai-board/target/app/api/jobs/[id]/status/route.ts`
  What it covers: workflow-authenticated job status callbacks with state transitions and telemetry.
  Plan: use as pattern only. The setup workflow needs equivalent callback semantics for a new project-scoped job type.

- `/home/runner/work/ai-board/ai-board/target/app/lib/query-keys.ts`
  What it covers: client-side query key registry.
  Plan: extend with setup state, setup status, and onboarding artifact keys.

- `/home/runner/work/ai-board/ai-board/target/app/lib/schemas/agent.ts`
  What it covers: `CLAUDE` and `CODEX` enum validation.
  Plan: reuse. Setup agent selection should not introduce a duplicate enum source.

- `/home/runner/work/ai-board/ai-board/target/.github/workflows/speckit.yml`
  What it covers: repo checkout, owner credential fetch, service input wiring, workflow status callbacks.
  Plan: extend pattern. The new onboarding workflow should reuse the same cross-repo double-checkout and callback approach.

- `/home/runner/work/ai-board/ai-board/target/.github/workflows/ai-board-assist.yml`
  What it covers: workflow-authenticated comment workflow, selected-agent credential loading, and callback handling.
  Plan: extend pattern. It shows the provider-resolution and workflow token conventions most similar to onboarding.

- `/home/runner/work/ai-board/ai-board/target/.github/workflows/verify.yml`
  What it covers: callback-first workflow lifecycle, owner credential fetch, target repo checkout, and longer-running job orchestration.
  Plan: extend pattern. It is the closest operational template for a multi-step onboarding workflow.

### Existing test files

- `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/import.test.ts`
  What it covers: import validation, auth/scope checks, duplicate import behavior.
  Plan: extend. This is the existing owner for import redirect behavior.

- `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/config-sync.test.ts`
  What it covers: config sync DB storage, staleness logic, and sync endpoint error handling.
  Plan: extend. This is the right place to validate post-onboarding config sync and bypass-on-future-visits behavior.

- `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/settings.test.ts`
  What it covers: project settings API behavior.
  Plan: extend. This should absorb onboarding artifact review/update coverage to satisfy "extend, don't duplicate."

- `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/workflow-credential.test.ts`
  What it covers: workflow token credential resolution for `ANTHROPIC` and `OPENAI`.
  Plan: extend. Onboarding workflow credential handoff belongs here.

- `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/credentials-api.test.ts`
  What it covers: user credential CRUD and readiness metadata.
  Plan: extend. Setup readiness and actionable blocking guidance should leverage the same credential semantics.

- `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/credential-validation.test.ts`
  What it covers: provider-specific credential format validation.
  Plan: reuse. No new file needed for provider gating rules.

- `/home/runner/work/ai-board/ai-board/target/tests/integration/jobs/status.test.ts`
  What it covers: workflow-authenticated callback transitions and persisted state changes.
  Plan: use as a pattern; create a new `projects/setup.test.ts` only because existing file ownership is ticket-job specific.

- `/home/runner/work/ai-board/ai-board/target/tests/unit/components/projects/import-project-modal.test.tsx`
  What it covers: import modal auth gating and redirect flow into imported projects.
  Plan: extend. This already owns the UI handoff into project setup.

- `/home/runner/work/ai-board/ai-board/target/tests/unit/components/config-card.test.tsx`
  What it covers: settings config card rendering and sync interactions.
  Plan: extend if onboarding artifact review is colocated in settings.

- `/home/runner/work/ai-board/ai-board/target/tests/unit/credential-dispatch-guard.test.ts`
  What it covers: owner-credential dispatch guards and provider-aware workflow selection.
  Plan: extend. The setup workflow should reuse the same guard philosophy.

- `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-schema.test.ts`
  What it covers: valid agent selection schema values.
  Plan: reuse. No separate enum validation file is needed.

## Decision 1: Use a dedicated `ProjectSetupJob` model instead of reusing ticket `Job`

**Decision**: Add a new Prisma model for project-scoped onboarding runs, with its own status enum and JSON result payload.

**Rationale**: Existing `Job` rows are tied to `ticketId` and represent ticket workflow stages. The setup flow is project-scoped, starts before any ticket exists, and needs fields specific to onboarding such as selected agent, artifact summary, commit SHA, failure details, and config sync outcome. Reusing `Job` would either require a fake ticket or overload the meaning of `command` and `ticketId`.

**Alternatives considered**:
- Reuse `Job`: rejected because setup is not ticket-owned and would create ambiguous authorization and polling behavior.
- Store setup state directly on `Project`: rejected because retries and historical failure details require multiple runs, not a single mutable project status.

## Decision 2: Gate project entry through a setup-aware resolver

**Decision**: Introduce a project entry resolver used by the project layout and dashboard navigation so owners land on `/projects/{projectId}/setup` whenever config is still absent and setup remains required.

**Rationale**: The import API already redirects missing-config imports to `/setup`, but current project cards always navigate straight to `/board`, and there is no `setup` route today. Routing logic must become centralized; otherwise refreshes and revisits will bypass the authoritative onboarding state.

**Alternatives considered**:
- Only redirect from import responses: rejected because refreshes, bookmarks, and project dashboard clicks would remain inconsistent.
- Put all logic only in `board/page.tsx`: rejected because settings and other project entry points would still bypass setup.

## Decision 3: Credential readiness is validated in-app before dispatch and secrets are fetched only inside the workflow

**Decision**: The setup UI/API should check selected-agent readiness using existing credential metadata, while the GitHub Actions workflow continues to fetch the actual secret through `/api/internal/credentials`.

**Rationale**: This preserves the current separation of concerns. Browser clients and setup APIs need only readiness, provider, verification code/message, and actionable guidance. The workflow already owns secret retrieval with workflow-token auth and base64 transport. This keeps secrets out of setup page responses while preventing doomed dispatches.

**Alternatives considered**:
- Browser/API retrieves decrypted credential: rejected on security grounds.
- Skip pre-dispatch readiness checks and let the workflow fail: rejected because the spec explicitly requires blocking guidance before dispatch.

## Decision 4: The onboarding workflow is hybrid: deterministic config generation first, agent-authored guidance second

**Decision**: Split onboarding into two sequential workflow phases: deterministic repository detection generates `.ai-board/config.yml` and a structured analysis summary, then the selected agent generates governance and instruction artifacts from that summary plus repository context.

**Rationale**: The spec explicitly separates deterministic configuration from repository-aware guidance. This makes config generation testable and predictable while still allowing agent-authored documents to reflect repository conventions. The structured analysis summary becomes the contract between both phases.

**Alternatives considered**:
- Pure agent generation for all files: rejected because config detection must be predictable across common stacks.
- Pure deterministic generation for all files: rejected because guidance quality depends on repository-specific conventions and narrative context.

## Decision 5: Preserve the existing primary instruction file; generate a shared alias as a symbolic link

**Decision**: If a primary agent instruction file already exists, preserve it and generate the remaining onboarding artifacts around it. When an alias file is missing, create a symbolic link to the primary instruction file so supported agents share one runtime guidance source.

**Rationale**: The repo already uses `AGENTS.md -> CLAUDE.md`, and the spec requires preservation of existing primary instruction content plus a linked alias file. A symlink keeps one source of truth and avoids content drift between `AGENTS.md` and a selected-agent file.

**Alternatives considered**:
- Copy the instruction file into multiple aliases: rejected because later edits would drift.
- Always overwrite the primary file with generated content: rejected because the spec forbids it.

## Decision 6: Persist artifact summaries in the setup job, but treat repository files as the source of truth

**Decision**: Store a compact artifact manifest and commit metadata on `ProjectSetupJob`, while settings review reads and updates the actual repository files through dedicated onboarding artifact APIs.

**Rationale**: The app needs a durable success summary to render completion states and retry history even if GitHub fetches are temporarily unavailable. But the authoritative artifact content lives in the repository because onboarding commits files atomically to the default branch and settings edits must modify those same files.

**Alternatives considered**:
- Store full artifact contents in the database: rejected because repo files would then diverge from the app’s copy.
- Store nothing in the database beyond status: rejected because success/failure summaries and completion metadata would be too thin for resume and review UX.

## Decision 7: Review and adjustment APIs belong under project settings, not under the initial setup route

**Decision**: Add onboarding artifact read/update endpoints scoped under project settings or project onboarding settings APIs, separate from setup dispatch/status endpoints.

**Rationale**: The spec defines the setup page as the initialization flow and project settings as the long-term review/edit surface. Keeping those APIs separate preserves clear lifecycle boundaries and avoids keeping setup-only state mounted after completion.

**Alternatives considered**:
- Reuse the setup route for post-completion editing: rejected because it blurs one-time onboarding with ongoing settings management.
- Force users to rerun onboarding to edit artifacts: rejected by FR-023.

## Decision 8: Add a new setup integration test file, but extend every adjacent existing suite first

**Decision**: Create `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup.test.ts` only for setup-job lifecycle behavior; extend the existing import, config sync, settings, credentials, and unit component tests for adjacent domains.

**Rationale**: No existing integration file owns setup-job lifecycle semantics, but several adjacent files already own surrounding behavior. This satisfies the constitution rule to search and extend existing tests first.

**Alternatives considered**:
- Put all setup tests into `import.test.ts`: rejected because it would mix import auth/quota behavior with long-running onboarding lifecycle concerns.
- Create many new narrowly scoped test files: rejected as unnecessary duplication.
