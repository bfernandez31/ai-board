# Phase 0 Research: Capture Ticket Outcomes at SHIP

**Feature**: AIB-742
**Branch**: `AIB-742-capture-ticket-outcomes`
**Date**: 2026-04-26

## Unknowns from Technical Context

The spec was written with conservative auto-resolutions for all clarification points (see spec.md §"Auto-Resolved Decisions"). No `NEEDS CLARIFICATION` markers remain in the technical context. The remaining open questions for Phase 0 were **technical**, not product:

1. How does the codebase do "do work after a DB write returns to the user, asynchronously"?
2. How does the codebase fetch a list of files changed for a commit on an external repo (we cannot rely on a local git checkout for historical tickets)?
3. Where does project stack metadata (`services`, `testing.framework`, `language`) live at runtime, and is it queryable without a GitHub round-trip on every outcome?
4. What is the canonical idempotency pattern for "write once, never update" rows?
5. Is there an existing classifier or aggregation utility that already partitions jobs by command type, so we don't duplicate effort?

All resolved below.

## Existing Files

Inventory of source and test files in the impacted domains. Each entry says whether to **EXTEND** (add to the existing file) or **CREATE** (no existing file covers this responsibility).

### Source

| Path | Covers | Decision |
|---|---|---|
| `lib/tickets/transition.ts` (executeTicketTransition, lines 135–385; SHIP path uses optimistic update at lines 348–384) | All ticket stage transitions including SHIP | **EXTEND** — add a fire-and-forget capture call after the successful ticket update at line 352. Must NOT block the response (FR-002). |
| `lib/workflows/transition.ts` (`STAGE_COMMAND_MAP`, line 15–23; SHIP maps to `null` at line 21) | Maps stage transitions to workflow commands | **NO CHANGE** — SHIP intentionally has no workflow; outcome capture is in-process, not a dispatched workflow. |
| `lib/config-sync.ts` (`syncProjectConfig`, lines 45–187; `ensureFreshConfig`, lines 193–204) | Fetches & validates `.ai-board/config.yml`, persists into `Project.config` JSON column | **NO CHANGE** — outcome derivation reads `project.config.project.language`, `project.config.project.framework`, `project.config.services`, `project.config.testing.framework` from the DB (no extra GitHub round-trip). Backfill calls `ensureFreshConfig` once per project at start. |
| `lib/github/spec-fetcher.ts` (lines 1–97) | Fetches single files from GitHub via Octokit; test-mode short-circuit; rate-limit string detection | **REUSE AS PATTERN ONLY** (do not extend) — new file `lib/outcomes/github-files.ts` follows the same Octokit-init + test-mode + error-mapping pattern but calls `repos.getCommit` / `repos.compareCommits` instead of `repos.getContent`. |
| `app/api/projects/[projectId]/constitution/diff/route.ts` (Octokit `repos.getCommit({ ref })` at line 81) | Per-commit file diff for constitution-file history | **REUSE AS PATTERN ONLY** — exact API shape we need for outcome derivation. Note `commit.files[]` carries `filename`, `additions`, `deletions`, `status` — which is sufficient for change-shape signals. |
| `app/api/projects/[projectId]/constitution/history/route.ts` (Octokit `repos.listCommits` at line 65) | Lists commits on a path | Reference only; we resolve commits per-job from `Job.commitSha`. |
| `lib/comparison/implementation-metrics.ts` (`extractImplementationMetricsSync`, lines 85–99; uses local `git diff --numstat`) | Local-checkout numstat extraction for the comparison feature | **DO NOT REUSE** — depends on local clone. Backfill has no clone. New `lib/outcomes/derivation.ts` is API-driven instead. The numstat **regex** and test-file pattern (lines 4–14) are useful references but our implementation uses Octokit's typed file objects, not numstat strings. |
| `lib/analytics/aggregations.ts` (`COMMAND_TO_STAGE` at lines 26–39) | Maps commands to stages for analytics aggregation | **REUSE** — read this from the new `lib/outcomes/classification.ts` to pin the canonical command list and avoid drift. |
| `lib/analytics/queries.ts` (job aggregation patterns: `prisma.job.aggregate({ _sum: ... })` and findMany loops) | Aggregates costUsd, durationMs, tokens by project | **REUSE AS PATTERN** — outcome capture uses the same `_sum` aggregation but scoped to a single ticket's jobs. |
| `lib/auth.ts` (`verifyProjectAccess`, `verifyTicketAccess`, `verifyProjectOwnership`) | Authorization helpers used by every route | **REUSE** — new outcome routes wrap these. |
| `lib/db/client.ts` | Prisma singleton | **REUSE** — single instance. |
| `app/api/webhooks/stripe/route.ts` (StripeEvent insert + P2002 catch at lines 67–78) | Webhook idempotency via unique-constraint pattern | **REUSE AS PATTERN** — outcome insert uses identical `try { create } catch P2002 { skip }` shape. |
| `prisma/schema.prisma` (Job model lines 29–75; Ticket lines 162–201; Project lines 102–136; StripeEvent lines 411–418; ComparisonRecord lines 443–465) | All persistence | **EXTEND** — add `model TicketOutcome` and `model BackfillProgress`. No edits to existing models. |

### Tests

Per constitution §III ("Search existing tests FIRST — extend, don't duplicate"):

| Path | Covers | Decision |
|---|---|---|
| `tests/integration/ticket-transition.test.ts` (existing — owns SHIP transition path tests) | Stage transitions including SHIP | **EXTEND** — add a scenario "SHIP completes even when outcome capture rejects" to verify FR-019 non-regression. Adding here keeps SHIP-transition concerns colocated. |
| `tests/unit/analytics/queries.test.ts` (existing) | Analytics query helpers | **EXTEND ONLY IF** the optional `getOutcomeAggregates` helper is added in `lib/analytics/queries.ts`. |
| `tests/integration/api-tickets.test.ts`, `api-projects.test.ts` (existing) | Existing ticket/project routes | **DO NOT EXTEND** — outcome routes are a new resource family (`/outcome`, `/outcomes`, `/backfill-outcomes`); mixing them in the existing files would conflate unrelated concerns (constitution §III). New file `api-outcomes.test.ts`. |
| `tests/unit/outcomes/*` | Pure logic for classification, derivation, lookup, capture orchestration | **CREATE** — no existing unit-test file covers outcome-domain pure logic. |
| `tests/integration/outcome-capture-on-ship.test.ts`, `outcome-immutability.test.ts`, `outcome-partial-paths.test.ts`, `backfill-outcomes.test.ts`, `backfill-resume.test.ts` | New end-to-end scenarios | **CREATE** — outcome persistence is a new domain; keeping it in dedicated files improves discoverability. |

**Search confirmed**: `Grep "TicketOutcome|ticketOutcome|StackIndicator|BackfillProgress"` returns only the spec.md and historical analytics specs (`specs/AIB-289-...`) — no existing source or test file claims any of these names.

## Patterns to Follow

These are concrete reference implementations from the codebase that the new code MUST mirror, not just "follow general best practices."

### Error handling: dispatch-then-rollback for transitions

**Reference**: `lib/tickets/transition.ts:309-384`

The SHIP transition path:
1. Re-reads the ticket immediately before any external action (lines 309–320) to detect concurrent mutations.
2. Calls `handleTicketTransition()` which would dispatch a workflow if the target stage required one (lines 322–334). For SHIP this returns `{ success: true }` without dispatch (per `STAGE_COMMAND_MAP[SHIP] = null` at `lib/workflows/transition.ts:21`).
3. Performs the optimistic ticket update with `where: { id, version: currentVersion }` (lines 348–352).
4. On Prisma `P2025` (no row matched the version filter), cleans up any orphaned dispatched job and returns 409 (lines 367–381).

**Why this matters for outcome capture**: Outcome capture is the **opposite end** of this pattern — it runs **after** the ticket update commits. We must NEVER:
- Hold the SHIP request open while awaiting outcome derivation.
- Make outcome capture's success a precondition of the SHIP response.
- Roll back the SHIP update if capture fails.

Concrete rule for the new code: in `lib/tickets/transition.ts`, after line 352 (successful update) and before the `return` at line 354, fire `captureOutcomeOnShip(ticket.id).catch(persistAsPartial)`. Do NOT `await` it. Wrapping in `.catch` ensures unhandled-rejection telemetry but never propagates back to the request handler.

### Security: idempotency via unique constraint + P2002 catch

**Reference**: `app/api/webhooks/stripe/route.ts:67-78`

```ts
try {
  await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
} catch (e) {
  if (e.code === 'P2002') return ok();   // duplicate event — already processed
  throw e;
}
```

**For TicketOutcome**: schema declares `ticketId Int @unique` (one outcome per ticket). Both the live-capture writer and the backfill writer call `prisma.ticketOutcome.create()`. On `P2002` (the row already exists), the writer treats it as success (no-op) — this is exactly FR-001, FR-021, SC-009 (concurrent live + backfill produce no duplicates). **No `upsert`** — upsert can update, which would violate immutability (FR-022).

### Security: GitHub credential reuse

**Reference**: `lib/config-sync.ts:67-72` and `lib/github/spec-fetcher.ts:38-68`

Both pass `process.env.GITHUB_TOKEN` to `new Octokit({ auth: token })`. No new env var, no per-request credential lookup, no encryption needed at this layer (the token is the existing platform credential). `lib/outcomes/github-files.ts` MUST follow this pattern verbatim — accept an optional `accessToken` arg, fall back to `process.env.GITHUB_TOKEN`, return a typed error code on missing token. This satisfies FR-016 ("backfill MUST NOT introduce any new credentials, secrets, or environment variables").

### Security: TEST_MODE short-circuit

**Reference**: `lib/github/spec-fetcher.ts:42-57`, `lib/config-sync.ts:50-65`

Both check `process.env.TEST_MODE === 'true'` and return mock data without touching GitHub. `lib/outcomes/github-files.ts` must do the same to keep integration tests offline. Mock payload: a small typed `{ files: [{ filename, additions, deletions, status }] }` object.

### State management: optimistic locking for shared writes

**Reference**: `lib/tickets/transition.ts:348-352` (Prisma `where: { id, version: X }` pattern), `lib/config-sync.ts:151-179` (`updateMany` with `OR: [{ configSyncedAt: X }, null]` and re-read on miss)

`BackfillProgress` rows are written by the backfill workflow only — but the workflow may have multiple concurrent invocations if an operator triggers it twice. Apply optimistic locking via a `version` column: each progress update is `updateMany({ where: { projectId, version }, data: { ..., version: { increment: 1 } } })`. If `count === 0`, re-read and retry the increment. This is the same pattern config-sync uses.

### State management: ordering of operations on outcome insert

The outcome write is the terminal step of the capture pipeline. Order strictly:
1. Compute the full DerivedOutcome object in memory (pure functions; no I/O).
2. Compute the `partial` flag and `partialReason` based on which sub-derivations failed.
3. Single `prisma.ticketOutcome.create()` call, wrapped in the P2002 try/catch.
4. No follow-up operations after the create — the row IS the deliverable.

This means there's no "external call after DB mutation" risk (constitution §V). It also means there's no opportunity for a partial write to leak into the table.

## Decisions Log

For each design choice the spec left to implementation, the chosen approach, why, and what was rejected.

### Decision 1: Trigger mechanism for live outcome capture

- **Decision**: In-process fire-and-forget call inside the SHIP-transition route handler, **after** the ticket optimistic update commits. On capture failure (after retries), persist a `partial = true` row with a `partialReason` code. Use a wrapping function that catches all errors so the SHIP response is never affected.
- **Rationale**:
  - Matches FR-002 ("MUST NOT block the SHIP transition itself if outcome computation fails").
  - SHIP-transition route is already on the Vercel serverless runtime; outcome computation reads the DB and makes 1–2 Octokit calls — bounded latency, fits the same function instance.
  - No new infrastructure (no new workflow file for the live path; no queue table; no cron).
  - Idempotency is enforced by the unique constraint, so even if Vercel terminates the invocation mid-capture and a manual retry is triggered, only one row ever lands.
- **Alternatives considered**:
  - **Dispatch a GitHub workflow per SHIP** (matches existing pattern for SPECIFY/PLAN/BUILD/VERIFY). Rejected: outcome capture is read-mostly and short — a full workflow run (queueing, container spinup, checkout, callback) is ~30–60s overhead just to do a couple of DB queries and one Octokit call. ~50/day × overhead = noisy GitHub Actions usage with no proportional benefit. The dispatch pattern is justified for SPECIFY/PLAN/BUILD because they need to run the Claude agent on a real checkout — not the case here.
  - **Vercel cron picking up "pending capture" rows**. Rejected: introduces a poll loop with another piece of state to manage and adds latency vs the in-process path.
  - **Next.js `after()` / `waitUntil()`**: Available in Next.js 16 but the codebase has no precedent for it. Future iteration may migrate to it; for now an unawaited promise with a `.catch` is sufficient and matches no-precedent test expectations.

### Decision 2: Trigger mechanism for backfill

- **Decision**: A new manual GitHub workflow `.github/workflows/backfill-outcomes.yml` triggered via `workflow_dispatch` with `project_id` input. The workflow runs a single Node script that loops over the project's shipped tickets without an outcome row, runs the same derivation as live capture, and writes outcomes one-by-one. Progress (last-written ticket id) is persisted to `BackfillProgress` after each row, enabling resume on rerun.
- **Rationale**:
  - Long-running batch (700+ tickets × 1–2 Octokit calls each) does not fit a serverless function's runtime budget.
  - GitHub Actions already supports rate-limit-aware execution and is the codebase's universal long-running compute primitive (cf. `verify.yml`, `health-scan.yml`, `nightly-log-prune.yml`).
  - Uses the existing `WORKFLOW_API_TOKEN` callback pattern for status reporting.
  - Manual dispatch (per FR-013, "Operators trigger it") avoids surprise cost from automatic re-runs (Spec Assumption: "The system will not re-run backfill automatically").
- **Alternatives considered**:
  - **Server-side script run on demand via API endpoint**. Rejected: serverless time limits; backfill of 1000 tickets cannot finish in one request.
  - **Reuse `nightly-log-prune.yml` schedule**. Rejected: backfill is one-shot per project, not nightly. Spec assumption explicitly forbids automatic re-runs.

### Decision 3: Source of truth for files-changed per ticket

- **Decision**: The union of files reported by `octokit.repos.getCommit({ ref: <Job.commitSha> })` for each COMPLETED job of the ticket that has a non-null `commitSha`. For each unique commit SHA, request once. Aggregate `additions` and `deletions` across the unique set of files (a file touched in multiple commits keeps the union of additions/deletions). If `compareCommits(base..head)` is more efficient and we can identify base/head deterministically (first SHA → last SHA on the ticket's branch), prefer that for tickets with ≥3 commits to reduce API calls.
- **Rationale**:
  - The `Job.commitSha` field is already populated for COMPLETED jobs (verified at `lib/db/tickets.ts:725` — it's part of the snapshot copy logic, meaning it's a stable column).
  - `getCommit` returns a typed `files[]` array with `filename`, `additions`, `deletions`, `status` — exactly the input the derivation needs.
  - This avoids the local-git-only constraint of `lib/comparison/implementation-metrics.ts` (which uses `execSync('git diff')` and won't work in serverless or for historical tickets).
  - Octokit is already in the dependency tree; no new packages.
- **Alternatives considered**:
  - **Local clone via the workflow**. Only works in the backfill workflow, not live capture. Rejected for unification — same derivation logic should run in both paths.
  - **GitHub PR API (`pulls.listFiles`)**. Rejected: not all tickets have a PR (some merge directly), and the ticket → PR mapping is fuzzy.
  - **Re-invoke `lib/comparison/implementation-metrics.ts`**. Rejected: depends on local checkout; uses `execSync`; introduces process-spawn cost; would force backfill into a workflow that does a full clone per ticket.

### Decision 4: Source of truth for project stack metadata

- **Decision**: Read from `Project.config` JSON column (already populated by `lib/config-sync.ts`). The stack-indicator-lookup expects keys `project.language`, `project.framework`, `services[].type`, `testing.framework`. If the column is null or stale (per `isConfigStale`), call `ensureFreshConfig(project)` at the start of capture.
- **Rationale**:
  - `Project.config` is the existing canonical store (`prisma/schema.prisma:115`); `lib/config-sync.ts:45-187` is the existing populator with optimistic locking already in place.
  - Avoids a second GitHub round-trip per outcome (which would add latency and rate-limit consumption).
  - Spec FR-008 explicitly says the lookup must work without a per-project domain config file — the stack-indicator lookup is in-code, parameterised by what's already in `Project.config`.
- **Alternatives considered**:
  - **Re-fetch `.ai-board/config.yml` from GitHub on every capture**. Rejected: rate limits, latency, and unnecessary I/O when the DB already has it.
  - **New columns on Project for language/framework**. Rejected: unnecessary schema change; the JSON column is already typed (validated by Zod via `validateConfig`).

### Decision 5: Stack-indicator lookup storage

- **Decision**: Plain TypeScript const exported from `lib/outcomes/stack-indicator-lookup.ts`, structured as:
  ```ts
  export const STACK_INDICATORS = {
    services: { postgres: { db_schema: ['prisma/schema.prisma', 'migrations/**', '*.sql'] }, ... },
    testing:  { vitest: { tests: ['**/*.test.ts', '**/*.spec.ts', 'tests/**'] }, ... },
    languages:{ python: { db_schema: ['migrations/**', '*.sql'], tests: ['tests/**', '**/test_*.py'] }, ... },
    ci:       { generic: ['.github/workflows/**', '.gitlab-ci.yml', '.circleci/**', 'azure-pipelines.yml'] },
  } as const;
  export const RULE_SET_VERSION = 1;
  ```
- **Rationale**:
  - The spec says "system-maintained generic stack lookup" — keeping it in code lets us evolve detection alongside the codebase, version it cleanly via `RULE_SET_VERSION`, and run it without a DB roundtrip.
  - Five stacks (TypeScript/Next, Python, Go, Rust, Zig) means a small lookup; a DB table would be over-engineered.
  - Constitution §V: "No optional fields without default values" — easier to enforce in TypeScript types than in JSON.
- **Alternatives considered**:
  - **Dedicated `StackIndicatorLookup` Prisma table**. Rejected: adds operational surface area for a static table; updates would require migrations instead of code review.
  - **Per-project YAML in `.ai-board/`**. Spec FR-008 forbids this ("MUST work without any per-project domain configuration file").

### Decision 6: `frictionFree` quality threshold

- **Decision**: Threshold of **75** from spec.md:10–17 ("final verify quality score ≥ 75"). Implemented as `QUALITY_THRESHOLD_FRICTION_FREE = 75` in `lib/outcomes/classification.ts`, exported alongside `RULE_SET_VERSION` for traceability.
- **Rationale**: Spec already auto-resolved this; not relitigating in plan. Plan's job is to record the threshold in code with a stable name and pin it to the rule-set version.

### Decision 7: Glob matching for indicators

- **Decision**: Use `picomatch` (lightweight, dependency-free at runtime, used widely in Node tooling). If picomatch is not already in the dep tree, prefer **micromatch** if it is; otherwise pick `picomatch`. Avoid pulling in a full glob package — we only need pattern → boolean against a string.
- **Rationale**:
  - We need to match patterns like `**/*.test.ts`, `migrations/**`, `prisma/schema.prisma` against a list of file paths returned by Octokit.
  - Test runners (vitest) and bundlers in Node ecosystem already pull in one of these transitively, so the marginal cost is near-zero.
- **Alternatives considered**:
  - **Hand-rolled regex**. Rejected: glob semantics around `**` and brace expansion are surprisingly subtle; reinventing risks bugs that bias the dataset (constitution forbids: "If tagging fails on Python or Rust projects, the resulting dataset is biased").
  - **`minimatch`**. Acceptable fallback if it's already transitively available.
- **Action item for Phase 2**: confirm which glob library is already on the runtime classpath (`bun pm ls picomatch micromatch minimatch`) and pin to one. If none, add `picomatch`.

### Decision 8: Concurrency between live and backfill

- **Decision**: No locking. Backfill skips tickets that already have an outcome row (cheap `findUnique` by `ticketId` before `create`). Both paths use the unique-constraint guard. Result: at-most-one row per ticket regardless of which path reaches it first (FR-017, SC-009).
- **Rationale**: Identical to the StripeEvent pattern. Locking would be overkill given the unique-constraint backstop.
- **Alternatives considered**:
  - **Advisory lock per project**. Rejected: not necessary; adds operational complexity.
  - **Run backfill only when no live SHIP is active**. Rejected: brittle and reduces backfill throughput for no benefit.

### Decision 9: Handling of QUICK-workflow tickets

- **Decision**: Same code path; `qualityScore = null` and `frictionFree = false` are derived correctly by the classifier (per FR-006 — null score → false). `workflowType = 'QUICK'` is recorded so consumers can filter (FR-011). No special branch in capture logic.
- **Rationale**: Single code path is simpler and matches spec FR-011 exactly.

### Decision 10: Rate-limit handling in backfill

- **Decision**: Backfill detects GitHub rate-limit errors (the existing `error.message.includes('rate limit')` check in `lib/github/spec-fetcher.ts:90`) and yields by sleeping until the next reset window, then resumes. Each ticket processed is tracked in `BackfillProgress.lastProcessedTicketId`, so a sleep that exceeds the workflow timeout still leaves a clean resume point.
- **Rationale**: Reuses existing detection; no new credential or quota tracking. Spec FR-016 is satisfied because we're not introducing any rate-limit infrastructure beyond what Octokit already exposes via the existing token.

## Open Questions

None remain. All `NEEDS CLARIFICATION` items in the original spec were resolved by the spec's own auto-resolved decisions; all open technical questions were resolved in this Phase 0 against existing code paths.
