# Phase 0 Research — AIB-775 (Track and display plugin/agent CLI versions per job)

**Feature**: Capture, persist, and display the AI-Board plugin version and the agent CLI version on every Job at job start.

**Spec**: [spec.md](./spec.md)

This document resolves every NEEDS CLARIFICATION marker in `plan.md`'s Technical Context, inventories the existing files the feature touches, and extracts the concrete patterns the new code must mirror.

---

## 1. Resolved Decisions (NEEDS CLARIFICATION → resolved)

### 1.1 Source of the plugin version string

- **Decision**: Read `version` from `.claude-plugin/plugin.json` at runner-side capture time. If the file is absent or unparseable, fall back to the short commit SHA (`git rev-parse --short HEAD`) of the `ai-board` sparse checkout that the workflow already does at runtime. Record only one string in the DB; the format `"<semver>"` or `"sha:<short>"` distinguishes the two without a second column.
- **Rationale**: `plugin.json` already declares `"version": "1.0.1"` and is the canonical artifact for the plugin bundle the spec scopes (commands + skills + prompts under `.claude-plugin/`). The runner already sparse-checks out `.claude-plugin/` (`verify.yml:268-271`), so no new git fetch is needed. SHA fallback satisfies the spec's explicit guidance ("SHA short fallback"). Storing both forms in a single column keeps the schema minimal (one nullable `String`).
- **Alternatives considered**:
  - *Read `package.json` from the target repo*: rejected — that's the consuming project's version, not the plugin's.
  - *Compute from a build-time env var*: rejected — would diverge from the file actually shipped to the runner.
  - *Two columns (semver + sha)*: rejected — spec says capture is a single identifier; double column adds schema surface for no observable user benefit.

### 1.2 Source of the agent CLI version string

- **Decision**: At capture time, invoke each CLI's native version affordance and record the first non-empty line of stdout, trimmed:
  - `CLAUDE`: `claude --version`
  - `CODEX`: `codex --version`
  - `GEMINI`: `gemini --version`
  - `MISTRAL`: `vibe --version`
  
  Wrap the call with a 5-second timeout (`timeout 5s …`). If the call fails, times out, or returns empty, persist `null`. Do not parse the string — store it raw (≤ 100 chars). Confirmed each CLI exposes a stable `--version` affordance in the four `install_<agent>` blocks of `run-agent.sh:362-741` (each CLI is npm/curl-installed and behaves like a standard Unix CLI).
- **Rationale**: This is the only authoritative source the spec accepts ("the chaîne brute reportée par le CLI"). Per FR-006/edge-cases, unknown formats are stored as-is. A short timeout protects job startup from a hanging CLI without bloating SC-005's <1 s budget.
- **Alternatives considered**:
  - *Parse the version string into structured fields*: rejected — spec explicitly forbids strict validation ("la chaîne brute est stockée telle quelle").
  - *Read from CLI metadata files (e.g. `~/.claude/version.json`)*: rejected — not all four agents expose such a file; `--version` is the only common contract.
  - *Probe before install*: rejected — capture must happen against the version that will actually run, which is the post-install one.

### 1.3 When and where capture runs

- **Decision**: Capture runs on the GitHub Actions runner, in a new workflow step inserted immediately after the existing **"Update Job Status - Running"** step (e.g. `verify.yml:205-218`) and after the **"Checkout ai-board (sparse - plugin only)"** step (e.g. `verify.yml:263-271`). Capture is implemented as a standalone runner script `.github/scripts/capture-versions.sh` that POSTs a single payload to a new endpoint `POST /api/jobs/:id/versions`. The endpoint is workflow-token-authenticated and writes the two columns on the Job row.
- **Rationale**: The "RUNNING" PATCH is the canonical "job has started" signal (FR-001/FR-002 say "before the agent's first turn completes"). Putting capture *after* that PATCH guarantees:
  - Job is already RUNNING before we attempt to write versions (so we never write versions onto a CANCELLED job — the PATCH would have returned 409 first).
  - Capture failure cannot prevent the PATCH from running (the spec's hardest constraint, FR-004 + FR-010).
  - Plugin sparse checkout has happened, so `plugin.json` is on disk.
  - Capture happens before agent install (`install_claude` etc. run inside `run-agent.sh`), so a hanging CLI install can't delay the version write — the agent CLI is installed *during* the capture script via `command -v <cli> || npm install -g …`, mirroring `run-agent.sh`'s own pattern.
- **Alternatives considered**:
  - *Write versions inside the existing PATCH /status route*: rejected — the runner doesn't yet know the plugin/agent CLI version at PATCH time; the PATCH is fired by the workflow step before sparse checkout. Mixing the two writes onto one route also couples failure modes (a version-capture failure must NOT mark the job RUNNING-failed).
  - *Capture inside `run-agent.sh`*: rejected — that script runs `set -euo pipefail` and any failure in capture would fail the agent dispatch. Decoupling into its own step keeps the spec's "capture failure must not affect the job" invariant trivially satisfied.
  - *Capture at job-create time (before workflow dispatch)*: rejected — the plugin version on the runner can differ from the app's view (the runner uses the latest `.claude-plugin/` from `main`, not what was at create time). Capture must be where the agent actually runs.

### 1.4 Single endpoint vs. extending the existing PATCH

- **Decision**: A new dedicated endpoint `POST /api/jobs/:id/versions` (workflow-token auth). It MUST be idempotent: subsequent calls with the same `jobId` are no-ops on already-set columns (first-write-wins, mirroring `workflowRunId` at `app/api/jobs/[id]/status/route.ts:204-206`). It returns minimal JSON `{ id, pluginVersion, agentCliVersion }`.
- **Rationale**: Keeps the `/status` route's surface unchanged (low blast radius). FR-009 demands version columns are immutable once written — first-write-wins gives that for free. A dedicated endpoint also lets the integration test seed jobs without manipulating state-machine transitions.
- **Alternatives considered**:
  - *Extend the existing `jobStatusUpdateSchema` with optional version fields*: rejected — versions can be sent even when status isn't transitioning, so this would force callers to mirror the current status into the body. Also worsens the failure coupling described in 1.3.

### 1.5 Display in the Job detail panel

- **Decision**: Render two compact metric rows inside the existing `JobRow` expanded breakdown grid in `components/ticket/jobs-timeline.tsx:201-244` (the `<div className="grid grid-cols-2 gap-4 text-sm">` block). Each row uses the same label/value pattern as "Input Tokens" / "Output Tokens": label `Plugin Version` and `CLI Version`, value is the captured string or the existing `'-'` placeholder convention used in that file (`text-ctp-overlay0` label / `text-foreground` value). When a value is null, the rendered string is `'-'` and the row's outer container gets a `title="Non disponible"` for the tooltip required by Auto-Resolved Decision #4.
- **Rationale**: The breakdown grid is the same zone the spec calls "la zone des métriques d'exécution (modèle, tokens, durée, coût, contexte par turn)". Reusing the existing 2-col grid pattern satisfies FR-005 (same zone), FR-007 (visual coherence), FR-006 (em-dash placeholder, native HTML `title` for accessible tooltip — no new shadcn primitive needed). No badge/pill component is required because the surrounding tokens are plain rows, not badges.
- **Alternatives considered**:
  - *Add a third column or a separate "Versions" section*: rejected — visually inconsistent with FR-007.
  - *Use shadcn `Tooltip` for the "Non disponible" hint*: rejected — `Tooltip` is a Radix component requiring `TooltipProvider` setup; the native `title` attribute satisfies the accessibility need with zero new wiring and matches how the team has handled placeholder hover affordances in similar single-line metric displays.

### 1.6 Auto-resolved spec decisions — alignment

| Auto-Resolved Decision (spec §1) | How this plan implements it |
|---|---|
| Plugin version = release id, fallback to short SHA | Reads `.claude-plugin/plugin.json` `version`; on miss, `git rev-parse --short HEAD` from the sparse checkout. Stored as one nullable string. |
| Agent CLI version = string the CLI itself reports | `<cli> --version` per agent, raw first line, trimmed. |
| Capture once at job start | New workflow step right after `"Update Job Status - Running"`; first-write-wins via the new endpoint. |
| Missing version = em-dash placeholder + "Non disponible" tooltip | `JobRow` renders `'-'` and a `title` attribute; row never produces "undefined". |
| Capture failure = warning log + job continues | Capture script always exits 0; the runner step has no `if: failure()` consumer. The endpoint logs `[Job Versions] capture warning` (matches `console.warn`-equivalent style of `app/api/jobs/[id]/status/route.ts`). |
| No new visibility gating | Endpoint reuses workflow-token auth (write side) and the existing `verifyTicketAccess` chain (read side, via the existing `GET /api/projects/:projectId/tickets/:id/jobs` route). |

---

## 2. Existing Files (inventory — every path is real, verified)

### 2.1 Database & Prisma

| Path | Coverage | Action |
|---|---|---|
| `prisma/schema.prisma` (`Job` model lines 29-75) | Job entity with telemetry columns. | **Extend**: add `pluginVersion String? @db.VarChar(100)` and `agentCliVersion String? @db.VarChar(100)`. No new index — the columns are read in the same selects that already exist for the job detail panel; not used as filters. |
| `prisma/migrations/` | Existing migration history. | **New migration** `<timestamp>_add_job_versions/migration.sql` via `bunx prisma migrate dev` (constitution §V). |

### 2.2 API routes

| Path | Coverage | Action |
|---|---|---|
| `app/api/jobs/[id]/status/route.ts` (PATCH) | Job status transitions + first-write-wins for `workflowRunId`. | **Pattern reference only** — do not modify. New versions route mirrors its workflow-auth + idempotent-update + structured-error patterns. |
| `app/lib/job-update-validator.ts` | Zod schema for status PATCH body. | **Pattern reference only** — new versions endpoint defines its own Zod schema in `app/lib/job-versions-validator.ts` (parallel structure). |
| `app/lib/auth/workflow-auth.ts` (used by status route) | `validateWorkflowAuth(request)` — workflow-token auth. | **Reuse as-is** — versions endpoint calls the same helper. |
| `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` | GET endpoint that returns jobs with telemetry to the UI. | **Extend select**: add `pluginVersion` and `agentCliVersion` to whatever Prisma `select` (or implicit shape) it uses for `TicketJobWithTelemetry`. |

### 2.3 Workflows & runner scripts

| Path | Coverage | Action |
|---|---|---|
| `.github/scripts/run-agent.sh` (lines 362-741) | Per-agent install + invoke (CLAUDE/CODEX/MISTRAL/GEMINI). Each agent has a stable `<cli> --version` affordance after install. | **Pattern reference** — version capture script mirrors the per-agent dispatch (case statement on `AGENT_TYPE`). Do not modify this file. |
| `.github/scripts/capture-agent-logs.sh` (AIB-715) | Runner-side capture script that always exits 0, never blocks the job, retries the API write 3× with 1/2/4 s backoff. | **Closest analog** — new `.github/scripts/capture-versions.sh` follows the exact same shape (REQUIRED_VARS guard, exits 0 on any branch, retry/backoff loop on the POST). |
| `.github/workflows/verify.yml` (steps "Update Job Status - Running" lines 205-218; "Checkout ai-board (sparse - plugin only)" lines 263-271) | The two anchor steps surrounding the new capture step. | **Extend**: insert a new "Capture Plugin/CLI Versions" step after sparse checkout and before "Run Unit Tests" (line 384). |
| `.github/workflows/speckit.yml` | Same anchors, different stage. | **Extend**: same insertion. |
| `.github/workflows/quick-impl.yml` | Same. | **Extend**: same. |
| `.github/workflows/iterate.yml` | Same. | **Extend**: same. |
| `.github/workflows/ai-board-assist.yml` | Same. | **Extend**: same. |
| `.github/workflows/health-scan.yml`, `inbox-analysis.yml`, `onboard.yml`, `retro-spec.yml`, `deploy-preview.yml`, `rollback-reset.yml`, `auto-ship.yml`, `nightly-health.yml`, `nightly-log-prune.yml` | Workflows that either don't run an agent CLI (deploy, prune, rollback) or operate on `ProjectSetupJob` not `Job` (onboard, retro-spec). | **No change** — these don't have a `Job` row to write versions onto. The capture step only goes into agent-CLI-running workflows that own a `Job`. |

### 2.4 Plugin metadata source

| Path | Coverage | Action |
|---|---|---|
| `.claude-plugin/plugin.json` (`"version": "1.0.1"`) | Canonical plugin version (semver). | **Read-only source** for the plugin version. |
| `.claude-plugin/` (entire dir) | Source of truth for the plugin bundle (commands + skills + prompts + scripts). | **Fallback source** — `git rev-parse --short HEAD` against the sparse checkout when `plugin.json` is absent or unparseable. |

### 2.5 UI components & types

| Path | Coverage | Action |
|---|---|---|
| `components/ticket/jobs-timeline.tsx` (`JobRow` lines 81-308; expanded grid lines 201-244) | Renders one job and the expanded breakdown of execution metrics. | **Extend**: add two rows ("Plugin Version", "CLI Version") to the breakdown grid; expand `hasTelemetry` (line 100) so the row stays expandable when versions exist even if no telemetry does. |
| `components/ticket/ticket-stats.tsx` | Wraps `JobsTimeline` and merges polled status. | **No change** — it pipes `TicketJobWithTelemetry` straight through. |
| `lib/types/job-types.ts` (`TicketJobWithTelemetry` lines 55-76) | Shared TS interface used by `JobsTimeline`, `TicketStats`, `useTicketJobs`. | **Extend**: add `pluginVersion: string \| null;` and `agentCliVersion: string \| null;`. |
| `app/lib/schemas/agent.ts` | `Agent` enum (CLAUDE/CODEX/MISTRAL/GEMINI). | **No change** — read-only reference for the four-agent fan-out. |

### 2.6 Tests (existing — extend before creating)

| Path | What it covers | Plan for AIB-775 |
|---|---|---|
| `tests/unit/components/jobs-timeline.test.tsx` (90 lines, 3 cases for context/turn rows) | RTL tests for `JobsTimeline` expanded breakdown. | **Extend** with three cases: both versions rendered; both null show `-` with `title="Non disponible"`; one set, one null. Reuses the local `makeJob()` factory; just add the two new fields to the override surface. |
| `tests/integration/jobs/ticket-jobs.test.ts` (209 lines, telemetry round-trip) | GET jobs endpoint returns telemetry fields. | **Extend** with a case that updates the job (via the new versions endpoint) and asserts `pluginVersion` / `agentCliVersion` come back through GET. |
| `tests/helpers/job-helpers.ts` (26 lines, factory utils) | Test helpers for jobs. | **No interface change** — the integration test uses the new POST endpoint to set versions, so the helper need not learn about them. (Adding optional fields is fine if convenient but not required.) |
| `tests/unit/job-snapshots.test.ts` | Snapshots transformations. | **No change** — versions are extra columns, not a new snapshot dimension. |
| `tests/unit/job-filtering.test.ts`, `job-label-transformer.test.ts`, `job-display-names.test.ts`, `job-cache.test.ts`, `job-type-classifier.test.ts`, `useJobPolling.test.ts` | Each owns a distinct slice of job logic. | **No change** — versions don't influence command/label/type/cache-key/poll surface. |

### 2.7 Tests (new — only where no existing file owns the domain)

| New path | Domain | Why a new file (vs. extending) |
|---|---|---|
| `tests/integration/api/jobs/versions-post.test.ts` | The new `POST /api/jobs/:id/versions` endpoint. | No existing file covers this route's domain (the closest, `tests/integration/jobs/ticket-jobs.test.ts`, covers the GET shape — putting POST writes in there would mix concerns and break the "search existing tests FIRST — extend, don't duplicate; create new only when adding mixes concerns" rule from constitution §III. The file naming mirrors the AIB-715 convention `tests/integration/api/jobs/logs-post.test.ts`. |

> **No other new test file is required.** The four-agent fan-out (FR-003) is covered at the integration level by exercising the endpoint with the four agent labels — no per-agent E2E. Per constitution §III ("E2E is expensive"), there is no new Playwright spec; the UI behavior is covered by the extended `jobs-timeline.test.tsx` cases.

---

## 3. Patterns to Follow

### 3.1 Pattern: workflow-token authenticated, idempotent first-write endpoint

**Reference**: `app/api/jobs/[id]/status/route.ts:46-326`.

The new `POST /api/jobs/:id/versions` MUST mirror the following shape from the status route:

- **Auth gate**: call `validateWorkflowAuth(request)` first; on failure return `401 { error: 'Unauthorized' }` and `console.error('[Job Versions] Authentication failed', authResult.error)` — same log prefix discipline as the status route's `[Job Status Update]`.
  - Reference: `app/api/jobs/[id]/status/route.ts:57-64`.
- **Param validation**: parse `id` with `parseInt(jobIdString, 10)`; on `isNaN`, return `400 { error: 'Invalid job ID' }`.
  - Reference: `app/api/jobs/[id]/status/route.ts:66-77`.
- **Body parse + Zod**: try/catch around `request.json()` then `safeParse`. On Zod failure return `400 { error: 'Invalid request', details: [{ message, path }] }` — same shape as status route line 100-109.
  - Reference: `app/api/jobs/[id]/status/route.ts:79-110`.
- **Job-lookup pre-check**: `prisma.job.findUnique({ select: { id, pluginVersion, agentCliVersion } })`; 404 if missing.
  - Reference: `app/api/jobs/[id]/status/route.ts:115-132`.
- **First-write-wins semantics** (the critical pattern for FR-009 immutability):
  ```ts
  const updateData: { pluginVersion?: string; agentCliVersion?: string } = {};
  if (body.pluginVersion && !job.pluginVersion) updateData.pluginVersion = body.pluginVersion;
  if (body.agentCliVersion && !job.agentCliVersion) updateData.agentCliVersion = body.agentCliVersion;
  ```
  Mirrors the `workflowRunId` first-write-wins at `app/api/jobs/[id]/status/route.ts:204-206`.
- **Idempotent no-op**: if `Object.keys(updateData).length === 0`, return 200 with the current values — mirroring the idempotent-status branch at lines 146-164.
- **Atomic `updateMany` guard**: not strictly required here (versions don't compete with another writer), but use `prisma.job.update({ where: { id: jobId }, data: updateData })` and rely on the lookup-then-write being acceptably small (no terminal state machine).
- **Error envelope**: catch-all returns `500 { error: 'Internal server error' }` and logs with `console.error('[Job Versions] Unexpected error', { jobId, error: ... })` — same context object discipline as the status route's catch.
  - Reference: `app/api/jobs/[id]/status/route.ts:299-325`.

**Why this matters**: any deviation from the above (e.g. returning the full Job row, swallowing Zod errors, allowing later overwrites) would either inflate the response cache surface, violate the spec's first-write-wins requirement, or leak unredacted DB internals to the workflow. The status route is the recipe the team has committed to for workflow-token endpoints.

### 3.2 Pattern: runner-side capture script that "always exits 0"

**Reference**: `.github/scripts/capture-agent-logs.sh:1-47` (specifically the early-exit-0 guard, the trap-based cleanup, and the `set -o pipefail` *without* `-e`).

The new `.github/scripts/capture-versions.sh` MUST follow this shape:

- **Header invariant**: `set -o pipefail` only — never `set -e`. Any individual command failure must NOT abort the script (FR-004, FR-010).
  - Reference: `capture-agent-logs.sh:16`.
- **Required-vars guard**: declare `REQUIRED_VARS=(JOB_ID APP_URL WORKFLOW_API_TOKEN AGENT_TYPE)`; if any is missing, log to stderr and `exit 0`. Plugin version capture has no PROJECT_ID/TICKET_ID dependency.
  - Reference: `capture-agent-logs.sh:18-24`.
- **Per-agent dispatch**: a single `case "$AGENT_UPPER" in CLAUDE|CODEX|MISTRAL|GEMINI)` block, each branch calls `<cli> --version` with a 5 s `timeout`. Mirrors the `case "$AGENT_TYPE"` in `run-agent.sh:760-794`.
- **Plugin version resolution**: prefer `jq -r '.version' .claude-plugin/plugin.json 2>/dev/null` then fall back to `git -C .claude-plugin rev-parse --short HEAD` (or `git rev-parse --short HEAD` from the sparse checkout dir). Both branches must tolerate missing files / non-git states without erroring out.
- **Retry on POST**: 3 attempts, 1/2/4 s backoff, mirrored from `capture-agent-logs.sh`'s upload retry. Use `curl -s -o /dev/null -w "%{http_code}"` and treat `200`/`409` as success (`409` reserved if the spec evolves; for now only `200` is expected).
- **Cleanup with `trap`**: `trap cleanup EXIT` for any temp files created during version probing.
- **Final exit**: always `exit 0` so the surrounding workflow step never cascades failure into the job's success path. This is the *single most important* invariant — the spec's FR-004 fails the moment this script can `exit 1`.

**Why this matters**: the team's hard rule from AIB-715 is "capture must be invisible to job success/failure semantics". A new capture script that doesn't follow this contract risks marking jobs as failed because the version probe timed out, which would directly violate FR-004 and SC-005.

### 3.3 Pattern: Workflow step ordering that matches the spec's "before first turn" requirement

**Reference**: `.github/workflows/verify.yml:205-218` ("Update Job Status - Running") and lines 263-271 ("Checkout ai-board (sparse - plugin only)").

The new step MUST be inserted at the *exact* position satisfying:

1. AFTER the sparse checkout of `.claude-plugin/` (so `plugin.json` is on disk).
2. AFTER the `RUNNING` PATCH (so we never write versions onto a CANCELLED job).
3. BEFORE any agent invocation (`run-agent.sh` calls), because FR-001/002 say "before the first productive interaction".
4. With `if: ${{ inputs.job_id }}` only — NEVER `if: env.SKIP_EXECUTION != 'true'`. The `[e2e]` skip path must still record the versions on the seeded job (testing of capture is a deliberate goal, not a side effect).

A typical insertion (verify.yml schema):

```yaml
- name: Capture Plugin/CLI Versions
  if: ${{ inputs.job_id }}
  env:
    JOB_ID: ${{ inputs.job_id }}
    APP_URL: ${{ vars.APP_URL }}
    WORKFLOW_API_TOKEN: ${{ secrets.WORKFLOW_API_TOKEN }}
    AGENT_TYPE: ${{ inputs.agent }}
  run: bash ai-board/.github/scripts/capture-versions.sh
```

**Why this matters**: the AIB-715 capture step lives at `if: always()` because it's terminal-only and must run after the agent. The versions capture is the opposite — it's preconditional and must run before the agent. Putting it in the wrong slot violates the spec's ordering invariants.

### 3.4 Pattern: Schema-aligned Zod validation

**Reference**: constitution §IV ("Zod schema constraints (min, max, string length) MUST match corresponding database column constraints in prisma/schema.prisma").

```ts
// app/lib/job-versions-validator.ts
export const jobVersionsUpdateSchema = z.object({
  pluginVersion: z.string().trim().min(1).max(100).optional(),
  agentCliVersion: z.string().trim().min(1).max(100).optional(),
}).refine(d => d.pluginVersion !== undefined || d.agentCliVersion !== undefined, {
  message: 'At least one of pluginVersion or agentCliVersion must be provided',
});
```

`.max(100)` mirrors `@db.VarChar(100)` on both new columns. Empty strings are rejected (`.min(1)`) to keep the "absent vs. zero-length-but-present" distinction unambiguous — the runner sends one or both fields only when it actually has a value. Both fields are optional so the runner can send a partial payload (FR-004's "if either fails, persist the one that succeeded").

**Why this matters**: any drift between Zod and Prisma constraints is a silent corruption vector — the constitution treats this as a non-negotiable rule.

### 3.5 Pattern: UI render with native `title` placeholder + em-dash

**Reference**: `components/ticket/jobs-timeline.tsx:144-151` (existing `'-'` placeholder for `durationMs`/`costUsd` in the row header), and lines 201-244 (the breakdown grid that owns labeled metric pairs).

The two new metric cells inside the existing breakdown grid:

```tsx
<div title={job.pluginVersion ? undefined : 'Non disponible'}>
  <span className="text-ctp-overlay0">Plugin Version:</span>
  <span className="ml-2 text-foreground font-medium">
    {job.pluginVersion ?? '-'}
  </span>
</div>
<div title={job.agentCliVersion ? undefined : 'Non disponible'}>
  <span className="text-ctp-overlay0">CLI Version:</span>
  <span className="ml-2 text-foreground font-medium">
    {job.agentCliVersion ?? '-'}
  </span>
</div>
```

- **Em-dash convention**: the file uses ASCII `'-'` (line 145, 150) — match it; do NOT introduce the Unicode em-dash to keep grep-ability and linting consistent.
- **`title` attribute**: the *only* time it's set is when the value is null. When both are null, the row still renders inside the breakdown grid (no skip), so the placeholder is visible — matches Auto-Resolved Decision #4.
- **Color tokens**: `text-ctp-overlay0` for label and `text-foreground` for value — mirrors the surrounding rows exactly. No new color additions.
- **Expansion gate**: extend the `hasTelemetry` predicate at `jobs-timeline.tsx:100-105` to also include `job.pluginVersion != null || job.agentCliVersion != null`, so the row remains expandable on jobs that have versions even with no telemetry yet (e.g. a job that is RUNNING but has just had versions captured). Without this, the UI would silently hide a successful capture for an in-flight job.

**Why this matters**: shadcn `Tooltip` would require new provider wiring and adds runtime cost for what is a strictly informational hover. The native `title` is the minimum viable affordance and matches what the file does today for empty cells; reaching for a heavier abstraction would violate the constitution's "extract a sub-component only when …" guidance and CLAUDE.md's "don't add abstractions beyond what the task requires".

### 3.6 Pattern: Existing-test extension over duplication

**Reference**: constitution §III ("Search existing tests FIRST — extend, don't duplicate") — applied below.

- `tests/unit/components/jobs-timeline.test.tsx` already owns `JobsTimeline` rendering. The three new RTL cases (versions present, both null, partial) are appended to its existing `describe`. The local `makeJob()` factory already handles partial overrides via `Partial<TicketJobWithTelemetry>`; the only change is that the factory grows two more nullable fields with `null` defaults so all existing tests continue to pass without edits.
- `tests/integration/jobs/ticket-jobs.test.ts` already owns the GET shape. A new `it('should expose pluginVersion and agentCliVersion through the GET payload', …)` is added inside its existing `describe('GET /api/projects/:projectId/tickets/:id/jobs')`. Versions are seeded through the new POST route so the test exercises both endpoints in the natural order.

**Why this matters**: a parallel `versions-display.test.tsx` would duplicate the `renderWithProviders` boilerplate and split future maintenance — exactly the antipattern the constitution forbids.

---

## 4. Out of scope (explicit)

These are NOT in this plan. Each is called out so a reader doesn't expand scope by accident:

- **Backfill**: FR-008 forbids it. No script, no migration data. Existing rows stay `NULL` and the UI placeholder handles them.
- **Per-agent CLI version normalization**: edge-case bullet "Format de version reportée par un CLI inconnu / non parsable" is explicit — store the raw string. No regex, no validator beyond Zod's length cap.
- **Surfaced metrics / analytics**: SC-002 is a measurement target on the deployed system, not a new dashboard widget. The existing analytics surface is untouched.
- **Push notifications / log lines for capture failure beyond the warning**: FR-010 says "warning, no alert". We use `console.warn` (or equivalent `console.log` at the `[Job Versions Capture] warning:` prefix) — no email, no PushSubscription, no toast.
- **Cancelling captures or backfilling on retry**: capture happens once per job at start (FR-009). A retried workflow run on the same job is rare but handled by first-write-wins (no overwrite, no error).
