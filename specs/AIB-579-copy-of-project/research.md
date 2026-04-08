# Research: Project Onboarding Hybrid Workflow

## Resolved Clarifications

### Decision: keep the existing setup API surface and extend it additively
Rationale: AIB-577 already established the setup page, polling route, and workflow callback path. This feature can satisfy FR-014 and FR-020 by keeping the same endpoint/authentication contract while adding optional terminal-state fields for `partial`, `commitSha`, `errorCode`, and `logs`.
Alternatives considered: storing everything inside `artifactSummary` was rejected because the UI and tests need stable, queryable fields for partial-success and failure-category behavior.

### Decision: persist partial-success metadata on `ProjectSetupJob`
Rationale: FR-011, FR-014, FR-015, and FR-016 require the app to distinguish full success, partial success, and stage-specific failures after the workflow exits. Extending `ProjectSetupJob` with `partial`, `commitSha`, `errorCode`, and `logs` keeps terminal-state reporting explicit and lets polling/UI remain simple.
Alternatives considered: deriving partial success only from `artifactSummary.missing` was rejected because it hides an important state transition behind JSON conventions.

### Decision: split onboarding into deterministic analysis, guidance generation, and commit/report orchestration
Rationale: The spec requires deterministic stack detection before any LLM step, and it explicitly allows partial completion when guidance generation fails after deterministic outputs exist. A staged workflow makes that boundary enforceable and testable.
Alternatives considered: a single monolithic script was rejected because it makes failure categorization and partial-success cutover harder to guarantee.

### Decision: deterministic analysis stays static-only and must not install dependencies or start services
Rationale: FR-018 forbids dependency installation and runtime startup during onboarding. The analysis phase should inspect manifests, lockfiles, config files, task definitions, and repository structure only.
Alternatives considered: reusing `/home/runner/work/ai-board/ai-board/target/.github/scripts/setup-environment.sh` was rejected for onboarding because that script validates and prepares runtime/dependency state for later workflows.

### Decision: reuse the existing workflow credential channel instead of introducing new secret plumbing
Rationale: `/api/internal/credentials` already delivers decrypted owner credentials to workflows under workflow-token auth, and existing workflows already use masking and environment export patterns. Reusing that path avoids weaker secret handling.
Alternatives considered: direct repository secrets or workflow-dispatch inputs for credentials were rejected because they would weaken the current BYOK model.

### Decision: preserve user-authored guidance files and regenerate deterministic machine-managed artifacts
Rationale: The spec already explicitly protects `CLAUDE.md`, and the same preservation rule should apply to other user-facing guidance entry points (`AGENTS.md`, `.ai-board/memory/constitution.md`) when present. Deterministic onboarding artifacts such as `.ai-board/config.yml` and generated command/script bundles remain machine-managed and may be created or refreshed as needed.
Alternatives considered: preserving only `CLAUDE.md` was rejected because it creates inconsistent rerun behavior across the guidance surface.

### Decision: extend config validation to cover all supported onboarding languages and package managers
Rationale: FR-019 includes Ruby and PHP in supported primary stacks. Current config validation already supports TypeScript, JavaScript, Python, Go, Rust, Java, and Kotlin, but it does not yet admit Ruby or PHP values, so the schema and related tests must expand.
Alternatives considered: limiting onboarding to currently supported config enums was rejected because it would violate the feature spec.

## Existing Files

| Path | What it covers | Extend or create new | Notes |
|------|----------------|----------------------|-------|
| `/home/runner/work/ai-board/ai-board/target/.github/workflows/onboard.yml` | Existing stub onboarding workflow with RUNNING/COMPLETED callbacks | Extend | Replace the stub with real staged onboarding while preserving trigger inputs and callback path |
| `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/route.ts` | Owner-only setup job creation and latest-job polling | Extend | Needs additive response fields for richer terminal-state summaries |
| `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts` | Workflow callback state machine and non-blocking config sync | Extend | Needs additive callback fields and stricter failure-category handling |
| `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/setup/page.tsx` | Setup page auth, ownership gate, redirect when configured | Extend | May need to pass richer initial job state to the client |
| `/home/runner/work/ai-board/ai-board/target/components/setup/setup-page-client.tsx` | Setup UX for dispatch, polling, errors, and redirect | Extend | Must surface partial success, artifact summary, and failure category clearly |
| `/home/runner/work/ai-board/ai-board/target/lib/workflows/dispatch-onboard.ts` | Workflow dispatch and owner-credential preflight | Extend | Keep dispatch inputs stable; no new dispatch auth path needed |
| `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/workflow.ts` | Owner credential lookup and workflow payload building | Reuse as-is | Existing credential resolution flow already fits onboarding |
| `/home/runner/work/ai-board/ai-board/target/app/api/internal/credentials/route.ts` | Workflow-authenticated credential retrieval/update | Reuse as-is | Onboarding workflow should consume this instead of adding new secret transport |
| `/home/runner/work/ai-board/ai-board/target/lib/config-sync.ts` | Config fetch, validation, credential stripping, optimistic DB update | Extend | Generated configs must continue to validate and sync through this path |
| `/home/runner/work/ai-board/ai-board/target/lib/validations/config.ts` | Zod schema for `.ai-board/config.yml` | Extend | Needs enum expansion for Ruby/PHP and any new generated command fields |
| `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` | `Project`, `ProjectSetupJob`, credential, and config schema | Extend | `ProjectSetupJob` needs richer terminal-state persistence |
| `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh` | Shared Claude/Codex workflow runner | Reuse as-is | Guidance generation should call through this script instead of inventing agent-specific workflow logic |
| `/home/runner/work/ai-board/ai-board/target/.github/scripts/setup-environment.sh` | Runtime/dependency setup for execution workflows | Reuse as pattern only | Do not call during onboarding because FR-018 forbids setup/install execution |
| `/home/runner/work/ai-board/ai-board/target/.claude-plugin/commands/` | Existing agent command definitions | Create new file | No onboarding-specific command exists yet; add one instead of overloading `ai-board.plan` or `ai-board.specify` |
| `/home/runner/work/ai-board/ai-board/target/specs/AIB-577-project-onboarding-setup/contracts/setup-jobs-api.md` | Prior setup API contract | Extend conceptually | Use as formatting and compatibility reference for new contract docs |
| `/home/runner/work/ai-board/ai-board/target/specs/AIB-577-project-onboarding-setup/workflows/onboard-workflow.md` | Stub onboarding workflow spec | Extend conceptually | New workflow spec should preserve the stable setup callback contract |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts` | Integration coverage for setup-job POST/GET/PATCH behavior | Extend | Required by constitution; add partial success, error-code, commit-failure, and artifact-summary assertions here |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/components/setup/setup-page.test.tsx` | Setup UI rendering and dispatch behavior | Extend | Add partial-success and artifact-summary display cases instead of creating a duplicate component test |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-redirect.test.ts` | Redirect behavior around configured/unconfigured projects | Reuse as-is | Existing coverage still applies; only extend if setup terminal states alter redirect conditions |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/config-sync.test.ts` | Config-sync behavior and stripping rules | Extend | Add onboarding-generated config compatibility coverage rather than creating a parallel sync suite |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/credential-dispatch-guard.test.ts` | Workflow dispatch blocked when owner credential is missing | Extend | Add onboard-specific assertions here; no new credential-guard file needed |
| `/home/runner/work/ai-board/ai-board/target/lib/onboarding/` | No existing onboarding analysis/generation module | Create new | This is the correct place for deterministic analysis and artifact-assembly code because no current module owns that responsibility |
| `/home/runner/work/ai-board/ai-board/target/.github/scripts/onboard/` | No existing onboarding workflow helper scripts | Create new | Use for workflow-only entrypoints such as report-status, detect-stack, and assemble-artifacts |

## Patterns To Follow

### Error handling patterns

- Dispatch failures must be caught, logged with context, and converted into explicit user-visible errors. Follow `/home/runner/work/ai-board/ai-board/target/lib/workflows/dispatch-onboard.ts:49-66` for wrapper-level error translation and `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/route.ts:103-125` for persisting failure state before returning.
- State callbacks should stay idempotent and reject invalid transitions rather than attempting recovery. Follow `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts:67-83`.
- External follow-up work after a terminal callback should be non-blocking, with errors logged but not silently swallowed as success. Follow `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts:116-128`.
- DB writes that can race must use optimistic locking and re-read on contention. Follow `/home/runner/work/ai-board/ai-board/target/lib/config-sync.ts:137-167`.

### Security patterns

- Workflow callbacks must use `validateWorkflowAuth()` and timing-safe token comparison. Follow `/home/runner/work/ai-board/ai-board/target/app/lib/workflow-auth.ts:17-35`.
- Owner credentials must be fetched through the workflow-authenticated internal credential API and base64-decoded in workflow memory only. Follow `/home/runner/work/ai-board/ai-board/target/app/api/internal/credentials/route.ts:18-72`.
- Workflow inputs that may contain user-controlled strings must be copied into environment variables before shell use to reduce injection risk. Follow `/home/runner/work/ai-board/ai-board/target/.github/workflows/health-scan.yml:142-150`.
- Secret material must be masked before logging and exported via `GITHUB_ENV` or process env instead of command arguments. Follow `/home/runner/work/ai-board/ai-board/target/.github/workflows/health-scan.yml:191-219` and `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh:107-146`.
- Generated configs stored in the DB must strip service credentials and the `env` section. Follow `/home/runner/work/ai-board/ai-board/target/lib/config-sync.ts:133-174`.

### State management patterns

- Setup-job creation must remain atomic: check configuration state, check active jobs, then create the row in one transaction. Follow `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/route.ts:62-91`.
- Callback processing should use first-write-wins semantics for `workflowRunId` and `startedAt`, and only set terminal timestamps once. Follow `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts:85-114`.
- Workflow dispatch should preserve the stable `owner/repo` target-repo input shape already used by other workflows. Follow `/home/runner/work/ai-board/ai-board/target/lib/workflows/dispatch-onboard.ts:49-60` and `/home/runner/work/ai-board/ai-board/target/.github/workflows/speckit.yml:59-68`.

## Best-Practice Decisions

### Decision: implement deterministic detection in repo code with workflow wrappers
Rationale: Keeping the detection engine in `/home/runner/work/ai-board/ai-board/target/lib/onboarding/` makes it unit-testable, while thin `.github/scripts/onboard/` wrappers keep the workflow readable.
Alternatives considered: a workflow-only bash implementation was rejected because stack precedence, artifact summaries, and config validation need stronger typing and tests.

### Decision: generate guidance through a dedicated onboarding agent command
Rationale: `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh` already normalizes Claude and Codex invocation. A dedicated command file can constrain onboarding output without changing the runner.
Alternatives considered: embedding large prompts directly in workflow YAML was rejected because it is harder to version, test, and review.

### Decision: keep setup polling tests as integration tests and add new pure-unit coverage for stack detection
Rationale: The constitution prefers integration tests for API/database behavior and unit tests for pure functions. Stack detection is a pure repository-inspection function; setup callback and polling behavior are not.
Alternatives considered: Playwright coverage for onboarding internals was rejected because the workflow logic does not require browser-only validation.
