# Implementation Plan: Track and display plugin/agent CLI versions per job (AIB-775)

**Branch**: `AIB-775-tracer-et-afficher` | **Date**: 2026-05-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-775-tracer-et-afficher/spec.md`

## Summary

Today, when an operator opens a Job's detail panel they see the model, tokens,
duration and cost of the run, but they cannot tell **which plugin version** and
**which agent CLI version** were active when that run executed. This makes it
impossible to correlate observed agent behavior with the stack that produced
it, and blocks any future comparative analysis between runs.

This plan introduces a tightly-scoped, four-piece change:

1. **Schema** — two new optional `String?` columns on `Job` (`pluginVersion`,
   `agentCliVersion`), each `@db.VarChar(100)`. No backfill, no new index, no
   new entity.
2. **Endpoint** — a new `POST /api/jobs/:id/versions` route, workflow-token
   authenticated, idempotent, first-write-wins (mirroring the
   `workflowRunId` pattern in `app/api/jobs/[id]/status/route.ts:204-206`).
3. **Runner** — a new `.github/scripts/capture-versions.sh` invoked from a new
   workflow step that runs immediately after the existing "Update Job Status -
   Running" PATCH and after the sparse checkout of `.claude-plugin/`. The
   script always exits 0, probes the plugin version (`plugin.json` first,
   short-SHA fallback) and the agent CLI version (`<cli> --version`, 5 s
   timeout), and POSTs whatever it captured to the new endpoint. The five
   agent-CLI-running workflows (`verify`, `speckit`, `quick-impl`, `iterate`,
   `ai-board-assist`) gain that one new step.
4. **UI** — `components/ticket/jobs-timeline.tsx` extends its existing
   expanded-breakdown grid with two metric rows ("Plugin Version", "CLI
   Version") that render either the captured string or `'-'` with a native
   `title="Non disponible"` tooltip. The shared `TicketJobWithTelemetry`
   interface gains the two `string | null` fields.

The pattern is drawn directly from AIB-715's capture-and-display feature: a
runner-side best-effort script that can never block the job, paired with a
read-mostly TanStack Query payload extension that flows through the existing
ticket-jobs GET. No new providers, no new TanStack Query hooks, no new
component primitives — only the smallest extension points the constitution
allows.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0; Bash 5 for the runner script.
**Primary Dependencies**: Next.js 16 (App Router server route + React component), Prisma 6.x + PostgreSQL 14+, Zod (payload validation), TanStack Query v5.95.2 (already wired through `useTicketJobs` — no new hook), shadcn/ui (no new primitive needed; native `title` attribute is sufficient).
**Storage**: PostgreSQL — two new nullable `VarChar(100)` columns on `Job`. No new table, no new enum.
**Testing**: Vitest unit tests (one new RTL test extending the existing `jobs-timeline.test.tsx`), Vitest integration tests (one new file `tests/integration/api/jobs/versions-post.test.ts` for the new endpoint, plus one extension to `tests/integration/jobs/ticket-jobs.test.ts` for the GET round-trip). No Playwright E2E required — UI behavior is fully covered at unit level.
**Target Platform**: Next.js app on Vercel + self-hosted; GitHub Actions ubuntu-latest runner for capture.
**Project Type**: Web — backend API route + frontend React component + shared TS types.
**Performance Goals**: SC-005 — version capture must add < 1 s to perceived job startup in steady state. Worst-case install miss bounded at ~72 s by hard timeouts (analyzed in `workflows/version-capture-workflow.md` §"Performance budget").
**Constraints**:
- Capture failure MUST NOT fail the job (FR-004); script always exits 0 (`set -o pipefail` only, no `set -e`).
- First-write-wins on the endpoint (FR-009); subsequent writes are no-ops on already-set columns.
- No backfill (FR-008); existing rows stay `null` and the UI placeholder handles them.
- All four agents covered (FR-003); single `case "$AGENT_TYPE"` block in the script.
- No new gating or visibility rules (FR-011); reuses `verifyTicketAccess` for read, workflow-token auth for write.
**Scale/Scope**: ~200 jobs/day on the self-hosted ai-board, four agents, five touched workflow files. Two columns × `VarChar(100)` ≈ negligible storage growth.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Outcome | Notes |
|---|---|---|
| **I. TypeScript-First Development** | PASS | Endpoint, validator, types: strict TS, fully typed. No `any`. The runner script is bash (out of TS scope, same convention as `run-agent.sh` and `capture-agent-logs.sh`). |
| **II. Component-Driven Architecture** | PASS | UI change is two new rows inside the existing breakdown grid in `jobs-timeline.tsx` — no new component file, no extracted sub-component (the rows are <40 lines, single use, no own state — the constitution's extraction heuristic explicitly forbids splitting). Native `title` attribute used in lieu of shadcn `Tooltip` because it requires zero new wiring and matches existing placeholder conventions. Color tokens match surrounding rows (`text-ctp-overlay0` / `text-foreground`). |
| **III. Test-Driven Development** | PASS | (a) UI tests extend `tests/unit/components/jobs-timeline.test.tsx` with three cases — three render paths: both set, both null, partial. (b) Endpoint tests live in a new file `tests/integration/api/jobs/versions-post.test.ts` because no existing file owns the `versions` API domain (verified — `tests/integration/jobs/ticket-jobs.test.ts` only owns the GET shape; mixing POST writes there would mix concerns per constitution §III). (c) GET round-trip extends `tests/integration/jobs/ticket-jobs.test.ts`. (d) No assertions inside conditionals. (e) Mocks unnecessary — the integration tests hit real Prisma + the real route handler. |
| **IV. Security-First Design** | PASS | Zod validation matches DB column constraints (`max(100)` ↔ `@db.VarChar(100)`). Workflow-token auth via the existing `validateWorkflowAuth` helper. No secrets exposed in API responses (only the captured strings, which are already public version identifiers). No new env var on the workflow side beyond the existing `WORKFLOW_API_TOKEN`. |
| **V. Database Integrity** | PASS | Prisma migration via `bunx prisma migrate dev`. Both columns `String?` with explicit `null` semantics — constitution forbids "optional fields without default values or explicit null handling"; `null` IS the explicit handling here, with the UI placeholder as the user-facing contract. First-write-wins prevents stale-write races. The endpoint reads-then-writes within a single request handler, but because the columns are immutable once set, a concurrent second writer can only no-op (it cannot "win" a race against a previous successful write). External call (the runner POST) is post-DB-mutation only in the trivial sense — endpoint reads, decides, writes; no orphaned-PENDING risk. |
| **V (clarification guardrails)** | PASS | Spec was resolved under CONSERVATIVE policy (low-confidence AUTO fallback). Every Auto-Resolved Decision in spec §"Auto-Resolved Decisions" maps 1:1 to a research-resolved decision in `research.md` §1. Reviewer notes (canonical version source, CLI `--version` safety, capture cannot block startup, placeholder convention reuse, log channel) are each addressed by name. |

**Development Standards**:
- **Error handling**: new endpoint follows the `app/api/jobs/[id]/status/route.ts:46-326` recipe — try/catch, structured `{ error, details? }`, 401/404/400/500 with logged context, never falls through to a generic 500 from an auth/validation error.
- **State management**: TanStack Query — no new hook; the existing `useTicketJobs` payload widens by two fields and propagates through `TicketStats` → `JobsTimeline` → `JobRow`.
- **Optimistic updates**: N/A — versions are workflow-written, not user-written.

**Gate result**: PASS pre-Phase-0; PASS post-Phase-1. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```
specs/AIB-775-tracer-et-afficher/
├── plan.md                              # This file
├── research.md                          # Phase 0 — decisions, existing files, patterns
├── data-model.md                        # Phase 1 — Job schema extension
├── spec.md                              # Input
├── checklists/                          # Pre-existing
├── contracts/
│   ├── job-versions-api.yaml            # OpenAPI 3.1 — POST /api/jobs/:id/versions
│   └── ticket-jobs-api.md               # GET extension (additive nullable fields)
├── workflows/
│   ├── version-capture-workflow.md      # Workflow-step internal-process spec
│   └── version-capture-script.md        # capture-versions.sh contract & outline
└── tasks.md                             # Phase 2 (NOT created by /plan)
```

### Source Code (repository root)

```
app/
├── api/
│   └── jobs/[id]/versions/
│       └── route.ts                     # NEW: POST handler — workflow-token auth, first-write-wins
├── lib/
│   ├── job-versions-validator.ts        # NEW: Zod schema (length 1..100, both optional, refine non-empty)
│   └── auth/workflow-auth.ts            # REUSED: validateWorkflowAuth (no edit)

app/api/projects/[projectId]/tickets/[id]/jobs/
└── route.ts                             # EXTENDED: include pluginVersion + agentCliVersion in select

components/
└── ticket/
    └── jobs-timeline.tsx                # EXTENDED: two new rows in the breakdown grid + canExpand predicate update

lib/types/
└── job-types.ts                         # EXTENDED: TicketJobWithTelemetry gains 2 string|null fields

prisma/
├── schema.prisma                        # EXTENDED: Job.pluginVersion + Job.agentCliVersion (VarChar(100))
└── migrations/<timestamp>_add_job_versions/
    └── migration.sql                    # NEW

.github/
├── scripts/
│   └── capture-versions.sh              # NEW: runner script (bash, exits 0 unconditionally)
└── workflows/
    ├── verify.yml                       # EXTENDED: insert "Capture Plugin/CLI Versions" step
    ├── speckit.yml                      # EXTENDED: same
    ├── quick-impl.yml                   # EXTENDED: same
    ├── iterate.yml                      # EXTENDED: same
    └── ai-board-assist.yml              # EXTENDED: same

tests/
├── unit/
│   └── components/jobs-timeline.test.tsx       # EXTENDED: 3 new RTL cases for version rows
└── integration/
    ├── api/jobs/versions-post.test.ts          # NEW: workflow auth, validation, first-write-wins, all 4 agent labels
    └── jobs/ticket-jobs.test.ts                # EXTENDED: GET returns pluginVersion + agentCliVersion after POST
```

**Structure Decision**: Web-app layout — backend Next.js API routes + shared TS types + React component + runner-side bash. Mirrors the AIB-715 layout directly: extension points are in their natural directories, the new endpoint follows the `app/api/jobs/[id]/<resource>/route.ts` convention already used by `app/api/jobs/[id]/status/route.ts` and `app/api/jobs/[id]/logs/route.ts`. No new top-level directory introduced.

## Testing Strategy

Follows constitution §III (Testing Trophy: integration > E2E) and the
"Existing Files" inventory in `research.md` §2.

### Unit (Vitest + RTL) — extension only

| File | What's added |
|---|---|
| `tests/unit/components/jobs-timeline.test.tsx` (existing) | Three new cases inside the existing `describe`: (1) both versions set → values render with no `title` attr; (2) both null → `'-'` x2 with `title="Non disponible"`; (3) one set / one null → mixed render. The local `makeJob()` factory grows two more `null`-defaulted fields. |

No new RTL file is introduced — extending the existing one keeps `JobRow`
rendering knowledge in one place (constitution: "search existing tests
FIRST — extend, don't duplicate").

### Integration (Vitest) — one new file + one extension

| File | What's added |
|---|---|
| `tests/integration/api/jobs/versions-post.test.ts` (new) | 401 on missing/invalid token; 400 on Zod violation (empty string, >100 chars, neither field); 404 on unknown job id; 200 on success returns `{ id, pluginVersion, agentCliVersion }`; first-write-wins (second POST with different values returns the original); accepts the four agent-label flows (CLAUDE/CODEX/MISTRAL/GEMINI — same payload, different agent on the underlying Job). |
| `tests/integration/jobs/ticket-jobs.test.ts` (existing) | One new `it(…)` inside the existing `describe('GET /api/projects/:projectId/tickets/:id/jobs')` — POST versions then GET, asserts both fields appear on the returned `TicketJobWithTelemetry`. |

The `tests/integration/api/jobs/` folder does not yet exist (verified — only
AIB-715's `logs-*.test.ts` files plan to live there). Creating the file
is justified per constitution §III ("create a new test file only when no
existing file covers the domain"); putting endpoint POST tests inside
`tests/integration/jobs/ticket-jobs.test.ts` (which owns the GET shape)
would mix concerns.

### E2E (Playwright)

**None.** The constitution treats E2E as expensive (~5 s/test). All three
spec user stories' acceptance criteria are reachable from unit + integration:

- US-1 (visible on a fresh job) — unit RTL on `JobRow` + integration GET round-trip.
- US-2 (placeholder for missing) — unit RTL on `JobRow` (both-null case).
- US-3 (data exists for future analysis on all 4 agents) — integration POST exercises each agent label.

A new Playwright spec would only re-prove what the unit + integration
layers already cover, in exchange for ~5 s of CI time per test. Skipping
it matches the "default to integration" rule.

### What does NOT get a new test

- `app/api/jobs/[id]/status/route.ts` is untouched — no test edit.
- The runner script `capture-versions.sh` — bash, no Vitest harness; the integration tests cover the API surface it depends on, and the script's contract is documented in `workflows/version-capture-script.md` for human review and for the implementation phase. No `bash -n` step added to CI; existing review covers it.
- Workflow YAML changes — there is no automated test infra for workflow files in this repo; correctness is verified by running one PR through the modified workflow once after merge (operational verification).

## Phase Summary

- **Phase 0 — Research**: Complete. See [`research.md`](./research.md). All NEEDS CLARIFICATION markers resolved (1.1 plugin source, 1.2 CLI source, 1.3 capture position, 1.4 dedicated endpoint, 1.5 UI placement, 1.6 alignment with auto-resolved spec decisions). "Existing Files" inventory and "Patterns to Follow" sections complete.
- **Phase 1 — Design & Contracts**: Complete. See [`data-model.md`](./data-model.md) (two-column extension, no new entity), [`contracts/`](./contracts/) (`job-versions-api.yaml` for the new endpoint; `ticket-jobs-api.md` for the additive GET extension), [`workflows/`](./workflows/) (`version-capture-workflow.md` for the new workflow step; `version-capture-script.md` for the runner-side bash contract).
- **Phase 2 — Tasks**: **Not produced by `/plan`.** Run `/ai-board.tasks` to generate `tasks.md`.

## Complexity Tracking

*No Constitution Check violations — no entries.*
