# Research: Token saving via RTK + unified per-ticket Run settings

## Existing Files

- `prisma/schema.prisma` - Source of truth for `Project`, `Ticket`, and `Job`. Extend these models with project token-saving default, ticket override, and job run-captured status fields. Add Prisma enums for token-saving override/status.
- `lib/db/projects.ts` - Project retrieval/update logic. Extend returned project fields and update filtering; token-saving project default must be owner-only even though current `updateProject` allows owner or member for other settings.
- `app/api/projects/[projectId]/route.ts` - Project GET/PATCH contract with Zod validation. Extend validation/response with `tokenSavingEnabled` and enforce owner-only authorization for this field.
- `app/lib/schemas/clarification-policy.ts` - Existing project update schema. Add `tokenSavingEnabled: z.boolean().optional()`.
- `app/projects/[projectId]/settings/page.tsx` - Server-rendered project settings surface. Add a token-saving settings card next to default agent, policy, and model cards.
- `components/settings/clarification-policy-card.tsx` - Pattern reference for simple project setting card using local state, PATCH, and `router.refresh()`. Extend pattern for token-saving card.
- `components/settings/default-agent-card.tsx` - Pattern reference for project default selects. Reuse layout/state handling for the token-saving switch/segmented control.
- `lib/validations/ticket.ts` - Inline ticket PATCH schema. Extend with `tokenSavingOverride` if the unified dialog saves ticket token-saving override through the ticket PATCH route.
- `lib/db/tickets.ts` - Ticket inline update, creation, duplication, full clone, board select, and job mapping. Extend ticket select/response shape, enforce INBOX-stage editability for token-saving override, preserve overrides during duplication, and copy run status during full clone job snapshots.
- `app/api/projects/[projectId]/tickets/[id]/route.ts` - Ticket GET/PATCH contract. Extend response with token-saving settings and allow authorized updates to `tokenSavingOverride` with optimistic version checks.
- `app/api/projects/[projectId]/tickets/[id]/model-config/route.ts` - Existing per-stage model override endpoint. Keep behavior available to the unified dialog; do not duplicate model validation.
- `lib/workflows/model-resolution.ts` - Pattern reference for `ticket override -> project default -> fallback` resolution. Add a similar resolver for token-saving effective settings.
- `lib/workflows/transition.ts` - Critical workflow dispatch path. Resolve effective token-saving state at job creation, persist it on `Job`, and pass a captured input to core workflows only.
- `lib/tickets/transition.ts` - Higher-level transition orchestration with stale-snapshot guards and orphan job cleanup. Keep token-saving resolution within this sequencing.
- `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` - Job telemetry API for Stats tab. Include token-saving status/reason fields in the job select.
- `lib/types/job-types.ts` - Shared job telemetry type consumed by Stats components. Extend with token-saving status/reason fields.
- `components/ticket/jobs-timeline.tsx` - Expanded per-job telemetry display. Add run-level token-saving status beside existing runtime version rows.
- `components/ticket/ticket-stats.tsx` - Stats tab wrapper. Ensure merged jobs preserve token-saving fields when polling status updates arrive.
- `components/board/ticket-detail-modal.tsx` - Existing ticket detail menu, status strip, optimistic saves, and modal ownership. Replace `Edit Policy`, `Edit Agent`, and `Edit Models` actions with `Run settings`; keep Simple copy and Full clone eligibility unchanged. Add compact token-saving header indicator when effectively on.
- `components/tickets/agent-edit-dialog.tsx` - Pattern reference for ticket agent override controls. Reuse logic inside unified Run settings rather than keeping a standalone menu action.
- `components/tickets/policy-edit-dialog.tsx` - Pattern reference for ticket clarification-policy controls. Reuse logic inside unified Run settings.
- `components/tickets/model-override-dialog.tsx` - Pattern reference for per-stage model rows, reset-all behavior, and non-configurable-agent messaging. Reuse inside unified Run settings.
- `.github/workflows/speckit.yml` - Core SPECIFY/PLAN/IMPLEMENT workflow. Add token-saving workflow input and ensure only core `ai-board.specify`, `ai-board.plan`, and `ai-board.implement` runs can activate RTK.
- `.github/workflows/quick-impl.yml` - Core QUICK implementation workflow. Add token-saving input and route it into `ai-board.quick-impl`.
- `.github/workflows/verify.yml` - Core VERIFY workflow. Add token-saving input for the main `ai-board.verify` invocation only; skip code review, simplifier, and sync-specifications auxiliary invocations.
- `.github/scripts/run-agent.sh` - Central agent invocation script. Install/init RTK only for `AGENT_TYPE=CLAUDE`, captured setting enabled, and core commands; report active/fallback status via job status PATCH without failing the run.
- `app/api/jobs/[id]/status/route.ts` - Workflow status callback. Extend Zod/update logic for token-saving status and fallback reason using the existing idempotent first-write-wins approach.
- `app/lib/job-update-validator.ts` - Status PATCH schema. Add token-saving status enum and reason validation.
- `tests/integration/projects/settings.test.ts` - Extend for project token-saving default, owner-only update behavior, validation, and response shape.
- `tests/integration/tickets/model-override.test.ts` - Keep as existing model override coverage; do not create a duplicate model settings test unless unified API replaces this endpoint.
- `tests/integration/tickets/transitions.test.ts` - Extend for run-captured token-saving status on job creation, core-command scoping, and non-Claude not-applicable behavior.
- `tests/integration/tickets/duplicate.test.ts` - Extend to verify simple copy preserves ticket run settings and full clone copies job token-saving status as point-in-time telemetry.
- `tests/integration/jobs/status.test.ts` - Extend status callback tests for active/fallback updates, idempotent RUNNING backfill, validation, and not-recorded compatibility.
- `tests/integration/jobs/ticket-jobs.test.ts` - Extend job telemetry API response assertions for token-saving fields.
- `tests/unit/workflows/model-resolution.test.ts` - Add or mirror a token-saving resolver unit test file if resolver is split; this existing file is the pattern for override/default resolution tests.
- `tests/unit/job-update-validator.test.ts` - Extend schema tests for token-saving status and fallback reason length.
- `tests/unit/components/ticket-detail-modal.test.tsx` - Extend existing menu tests to assert a single `Run settings` action replaces policy/agent/model actions and copy/clone options remain.
- `tests/unit/components/model-override-dialog.test.tsx` - Keep for model section behavior; add unified dialog component tests rather than duplicating model-only assertions.
- `tests/unit/components/jobs-timeline.test.tsx` - Extend for token-saving status rendering, fallback reason, and not-recorded placeholder.
- `tests/unit/components/ticket-stats.test.tsx` - Extend fixtures to include token-saving fields and verify merged job data retains them.

## Patterns to Follow

- Error handling: `lib/workflows/transition.ts:356` catches GitHub dispatch failures, logs context, deletes the pending job at `lib/workflows/transition.ts:365`, and returns a structured error. Token-saving setup failures must be non-blocking and must not delete or fail jobs; only GitHub dispatch failure remains transition-blocking.
- Error handling: `app/api/jobs/[id]/status/route.ts:109` validates workflow callback bodies with Zod and returns structured 400 responses. Token-saving callback fields must be added to the same schema rather than parsed ad hoc.
- Security: `app/api/jobs/[id]/status/route.ts:74` requires workflow-token auth before mutating jobs. RTK activation status must report through this endpoint or an equivalently authenticated callback, never a public route.
- Security: `lib/db/auth-helpers.ts:97` provides `verifyProjectOwnership` for owner-only settings. Use this for project token-saving default because FR-001 says it is controlled by the project owner.
- Security: `.github/scripts/run-agent.sh:409` reports runtime versions without logging secrets and treats failures as non-fatal. Token-saving reporting must follow the same secret-free, non-fatal pattern.
- State management: `lib/tickets/transition.ts:307` re-reads the ticket immediately before dispatch to avoid stale workflow inputs. Token-saving resolution must use this fresh ticket and project snapshot.
- State management: `lib/workflows/transition.ts:214` creates the `Job` before workflow dispatch; `lib/workflows/transition.ts:278` passes immutable workflow inputs to GitHub. Persist the resolved token-saving request/status on the created `Job` and pass only the job-captured value to workflows.
- State management: `app/api/jobs/[id]/status/route.ts:166` treats same-status RUNNING PATCHes as idempotent and `app/api/jobs/[id]/status/route.ts:170` uses guarded `updateMany` for first-write-wins metadata. Token-saving `ACTIVE`/`FALLBACK` updates should use the same guarded approach when the runner reports setup after RUNNING.
- State management: `lib/db/tickets.ts:718` uses a Prisma transaction to full-clone a ticket and its jobs. Copy token-saving job fields inside the existing transaction so full clone remains an atomic snapshot.
- UI optimistic updates: `components/board/ticket-detail-modal.tsx:297` adds an optimistic duplicate ticket and rolls back at `components/board/ticket-detail-modal.tsx:365`; `components/board/ticket-detail-modal.tsx:494` does the same for policy. Unified Run settings should retain this rollback/toast pattern.
- UI dialog pattern: `components/tickets/model-override-dialog.tsx:112` resets dialog state only on open to avoid wiping in-progress edits during polling. The unified dialog should use the same reset guard.

## Decisions

### Decision: Use nullable ticket override plus boolean project default

Rationale: Existing ticket run settings use nullable overrides (`clarificationPolicy`, `agent`, model columns) where `null` means inherit. `Project.tokenSavingEnabled Boolean @default(false)` and `Ticket.tokenSavingOverride TokenSavingOverride?` keep the same precedence: ticket override, project default, system fallback false.

Alternatives considered: A non-null ticket enum with `INHERIT`, `FORCE_ON`, and `FORCE_OFF` was rejected because it does not match existing override storage semantics and adds migration churn for an explicit inherited value.

### Decision: Capture run state on `Job`, not only on ticket/project

Rationale: The spec requires project/ticket changes to affect only future runs. Persisting `Job.tokenSavingRequested`, `Job.tokenSavingStatus`, and `Job.tokenSavingFallbackReason` at job creation/status callback preserves auditability and lets cloned tickets show historic telemetry accurately.

Alternatives considered: Deriving job status from the current ticket/project settings was rejected because it would make historic runs change meaning after settings are edited.

### Decision: Scope activation to Claude core commands in `run-agent.sh`

Rationale: Workflows already centralize agent CLI invocation through `.github/scripts/run-agent.sh`. RTK docs state Claude Code supports shell-hook integration and fail-open graceful degradation. Gating on `AGENT_TYPE=CLAUDE`, captured token-saving input, and core commands (`ai-board.specify`, `ai-board.plan`, `ai-board.implement`, `ai-board.quick-impl`, `ai-board.verify`) keeps auxiliary Claude commands out of scope.

Alternatives considered: Editing each command prompt to prefer `rtk` was rejected because prompt-level guidance is weaker than Claude shell-hook interception and would risk inconsistent adoption.

### Decision: Use workflow status PATCH for activation/fallback reporting

Rationale: The job status route is already workflow-token protected, idempotent, and accepts non-terminal metadata. Extending it avoids a separate callback endpoint and follows the first-write-wins runtime version pattern.

Alternatives considered: Adding a separate `/api/jobs/:id/token-saving` callback was rejected because it would duplicate auth, validation, and idempotency logic.

### Decision: Build one Run settings dialog while preserving existing save paths

Rationale: The user-facing requirement is one dialog/action, not necessarily one backend mutation. The dialog can reuse the current ticket PATCH and model-config endpoint semantics while adding token-saving override support. If implementation chooses a new `run-settings` endpoint, it must still delegate to the same validation and editability rules.

Alternatives considered: Keeping three separate menu actions plus adding token saving was rejected because FR-007 requires a single Run settings entry.

### Decision: Extend existing tests instead of adding broad E2E

Rationale: The constitution prioritizes integration and component tests. Existing integration tests already cover project settings, ticket overrides, transitions, duplication, job status, and job telemetry APIs. Existing RTL tests cover the ticket detail menu and job timeline.

Alternatives considered: A Playwright end-to-end workflow test was rejected for Phase 1 planning because the behavior can be verified faster through integration tests and targeted component tests; only add E2E if a browser-only regression appears during implementation.

## Resolved Clarifications

- Token saving applies only to Claude core stage-transition workflow commands in this phase.
- Ticket override states are inherit, force on, and force off; storage should use nullable override for inheritance.
- Project default changes and ticket override changes affect future runs only.
- Measurement uses existing job telemetry plus job token-saving status; no savings estimator is introduced.
- RTK setup/activation failures fail open and are reported as fallback, never as workflow failures by themselves.
