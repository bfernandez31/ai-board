# Implementation Plan: Capture and display agent execution logs (Claude/Codex/Mistral/Gemini)

**Branch**: `AIB-715-capture-and-display` | **Date**: 2026-04-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-715-capture-and-display/spec.md`

## Summary

Today the `Job.logs` column exists but is never populated, so project members
who can't read GitHub Actions runs have no way to diagnose workflow failures
from the ai-board UI. This plan introduces an end-to-end capture → normalize →
redact → store → render → prune pipeline:

- Every agent-invoking workflow tees the agent's stdout, normalizes it into a
  v1 agent-agnostic event stream (message / tool_invocation / tool_result /
  error / lifecycle), applies secret redaction on the runner, gzips the
  artifact, and POSTs it through the ai-board API to Vercel Blob. A short
  preview lands in a new `JobLog` Postgres row. Capture runs in parallel to
  the existing job-status callback and can never block it.
- The ticket timeline's Stats tab renders the preview inline for every
  terminated job and exposes a "View full logs" action that opens a shadcn
  Sheet rendering the normalized events with type-specific styling,
  per-entry copy-to-clipboard, and "Download raw" streaming through the
  same authenticated proxy endpoint.
- A daily GitHub Actions scheduled workflow triggers a pruning endpoint that
  hard-deletes the Blob object first and then the Postgres row once any log
  crosses the 30-day retention window, matching the `nightly-health.yml`
  pattern.

All four agents (Claude Code, Codex, Mistral/vibe, Gemini) and both
self-managed and external projects are covered via a single touch-point in
`.github/scripts/run-agent.sh`. No regression to existing telemetry
(`inputTokens`, `costUsd`, `toolsUsed`, `qualityScore`, …) because telemetry
and log capture are strictly separate code paths.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0; Bash 5 for runner scripts; Node ESM `.mjs` normalizers invoked from Bash
**Primary Dependencies**: Next.js 16 (App Router, server routes + React components), Prisma 6.x + PostgreSQL 14+, Zod (payload validation), TanStack Query v5.95.2 (client state), shadcn/ui `Sheet`, lucide-react icons, **new**: `@vercel/blob` for durable artifact storage
**Storage**:
- Postgres: new `JobLog` table + `CaptureStatus` enum; `Job.logs String?` field left untouched for clone compatibility
- Vercel Blob: gzipped JSONL artifacts at `logs/<projectId>/<ticketId>/<jobId>.jsonl.gz`, accessed only through the authenticated proxy endpoint
**Testing**: Vitest (unit + integration) — normalizer, redactor, preview derivation, all four new routes, pruning. Playwright (E2E) — single scenario (FAILED job → preview + viewer). No mocks of the DB; integration tests hit the same Postgres used by the dev server.
**Target Platform**: Next.js app on Vercel (production) + self-hosted (dev); GitHub Actions ubuntu-latest runners for capture + pruning
**Project Type**: Next.js monorepo — single app with `app/api/*` server routes, `components/*` client UI, `lib/*` shared helpers, `.github/workflows/*` workflow definitions, and `.github/scripts/*` runner helpers
**Performance Goals**:
- Preview visible in UI ≤ 60 s after job terminal status (SC-001)
- Ticket Stats tab render unchanged — preview arrives in the existing `GET .../jobs` payload
- Full-log Sheet load: lazy-fetch only on open; stream a gzipped 5 MB artifact through the proxy in < 2 s on a decent connection
**Constraints**:
- Artifact ≤ 25 MB gzipped (per job); truncate with a `lifecycle:upstream_error:transcript_truncated` marker if exceeded
- `preview` capped at 280 chars (DB column 320 for unicode slack) — no visual ballooning of the timeline
- Capture step MUST run with `if: always()` and MUST NOT cause `PATCH /api/jobs/:id/status` to be skipped
- Secret redaction applied **on the runner**; placeholders are visible as `[REDACTED:<kind>]`
- No feature flag, no gradual rollout — feature must behave identically for all four agents and for self-managed vs. external projects (FR-021)
**Scale/Scope**:
- ~200 jobs/day across self-hosted ai-board (ticket: "jobs today" ~ small hundreds); a few MB to a few tens of MB per run
- 30-day window → at most ~6 k records / a few hundred GB of blob at steady state (well within Vercel Blob limits)
- Pruning batch = 500 rows, ≤ 50 k rows/day cap — single serverless invocation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Outcome | Notes |
|---|---|---|
| **I. TypeScript-First Development** | PASS | All new server/client code in strict TypeScript. Runner Node scripts use `.mjs` ESM with JSDoc types; not production runtime so strict TS not mandatory, but the shared redactor is authored in TS and compiled for the runner. No `any` except at the unknown-JSON boundary of normalizer parsers where it is narrowed with Zod immediately. |
| **II. Component-Driven Architecture** | PASS | `LogViewerSheet` composes shadcn `Sheet` + lucide icons; event rows are a <40-line JSX block extracted only because reused per-event — meets the extraction heuristic (reused ≥ 2 places). Colors use Catppuccin tokens (`text-ctp-red` / `text-ctp-blue` / …), no hex. |
| **III. Test-Driven Development** | PASS | Unit tests for normalizer-per-agent, redactor (pattern coverage against fixture inputs), preview derivation. Integration tests for all four new API routes + pruning. One E2E for the P1 user story (FAILED job → preview + viewer). No tests inside conditionals. Mocks target the exact Blob client path (`@/app/lib/blob/client`). |
| **IV. Security-First Design** | PASS | Zod on every write payload, matching DB column constraints (`preview` varchar 320 ↔ Zod `.max(280)`). Runner never holds Blob credentials. Access control reuses `verifyTicketAccess`. Redaction with visible placeholders. No new `.env` secret leaked to workflows beyond what's already there (`WORKFLOW_API_TOKEN`). New blob token (`BLOB_READ_WRITE_TOKEN`) lives only in Vercel env vars. |
| **V. Database Integrity** | PASS | Prisma migration via `prisma migrate dev`. Cascade on `Job→JobLog` parallels existing ticket cascades. `POST /logs` is an idempotent upsert (FR-004). Prune deletes Blob first, then row. No soft delete — FR-020 requires hard delete. Indexes sized to the prune scan. |
| **V (clarification guardrails)** | PASS | Spec was resolved under CONSERVATIVE policy with documented trade-offs. The plan preserves every reviewer note (proxy over signed URL, 30 days confirmed, redaction patterns reviewable, hard-delete in prune, size cap for preview). |

**Development Standards**:
- Error handling: every new API route has try/catch, 401 on auth failure, structured `{ error, code? }` on all other errors — mirrors `app/api/jobs/[id]/status/route.ts`.
- State management: TanStack Query v5 for `useJobLog` / `useJobLogRaw`; lazy fetch on Sheet open.
- Optimistic updates: N/A (read-mostly; the single write path is workflow-triggered, not user-triggered).

**Gate result**: PASS on both pre-Phase-0 and post-Phase-1 re-evaluation. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```
specs/AIB-715-capture-and-display/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output
├── spec.md                              # Input
├── checklists/                          # Pre-existing
├── contracts/
│   ├── job-logs-api.yaml                # OpenAPI 3.1 for all new routes
│   └── normalized-event-schema.md       # v1 event stream contract
├── workflows/
│   ├── agent-log-capture.md             # Per-run capture internal process
│   └── log-retention-pruning.md         # Scheduled retention internal process
└── tasks.md                             # Phase 2 output (NOT created by /plan)
```

### Source Code (repository root)

```
app/
├── api/
│   ├── jobs/[id]/logs/
│   │   ├── route.ts                          # POST summary (workflow-token auth)
│   │   └── artifact/route.ts                 # PUT raw artifact -> Vercel Blob (workflow-token auth)
│   ├── projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/
│   │   ├── route.ts                          # GET summary (session auth)
│   │   └── raw/route.ts                      # GET raw stream; supports ?format=jsonl (session auth)
│   ├── maintenance/prune-logs/route.ts       # POST retention prune (workflow-token auth)
│   └── projects/[projectId]/tickets/[id]/jobs/route.ts  # EXTENDED: include log { captureStatus, preview }
└── lib/
    ├── blob/client.ts                        # NEW: Vercel Blob wrapper (mirrors app/lib/cloudinary/client.ts)
    ├── logs/
    │   ├── normalizer.ts                     # NEW: per-agent normalizers -> v1 event stream
    │   ├── redactor.ts                       # NEW: shared secret redaction module (runner + API)
    │   ├── preview.ts                        # NEW: derivePreview(events, status) <= 280 chars
    │   └── schema.ts                         # NEW: Zod schemas for JobLogSubmission + NormalizedEvent
    ├── hooks/queries/
    │   ├── useJobLog.ts                      # NEW: TanStack Query hook — summary
    │   ├── useJobLogRaw.ts                   # NEW: TanStack Query hook — parses streamed events
    │   └── useTicketJobs.ts                  # EXTENDED: row shape includes log { captureStatus, preview }
    └── query-keys.ts                         # EXTENDED: jobLog / jobLogRaw keys

components/
└── ticket/
    ├── jobs-timeline.tsx                     # EXTENDED: preview line + "View full logs" button in JobRow
    ├── log-viewer-sheet.tsx                  # NEW: shadcn Sheet with the full-log renderer
    └── log-event-row.tsx                     # NEW: one normalized event's visual treatment + copy button

prisma/
├── schema.prisma                             # EXTENDED: JobLog model + CaptureStatus enum + Job.log relation
└── migrations/<timestamp>_add_job_log/
    └── migration.sql                         # NEW

.github/
├── scripts/
│   ├── run-agent.sh                          # EXTENDED: tee agent stdout; call capture-agent-logs.sh on exit
│   ├── capture-agent-logs.sh                 # NEW: normalize -> redact -> upload -> POST summary
│   └── lib/
│       ├── normalize-claude.mjs              # NEW
│       ├── normalize-codex.mjs               # NEW
│       ├── normalize-mistral.mjs             # NEW
│       ├── normalize-gemini.mjs              # NEW
│       └── redactor.mjs                      # NEW: compiled/bundled sibling of app/lib/logs/redactor.ts
└── workflows/
    ├── speckit.yml                           # EXTENDED: call capture-agent-logs.sh before status PATCH
    ├── quick-impl.yml                        # EXTENDED: same
    ├── verify.yml                            # EXTENDED: same (one capture call after last agent step)
    ├── ai-board-assist.yml                   # EXTENDED: same
    ├── iterate.yml                           # EXTENDED: same
    └── nightly-log-prune.yml                 # NEW: daily retention cron

tests/
├── unit/
│   ├── logs/
│   │   ├── normalizer.test.ts                # NEW (per-agent fixtures)
│   │   ├── redactor.test.ts                  # NEW (secret patterns + placeholder format)
│   │   └── preview.test.ts                   # NEW
│   └── components/
│       └── log-viewer-sheet.test.tsx         # NEW (RTL — renders events, copy button, download affordance)
├── integration/
│   └── api/
│       ├── jobs/
│       │   ├── logs-post.test.ts             # NEW (workflow auth, upsert, UNAVAILABLE branch)
│       │   ├── logs-get.test.ts              # NEW (ticket access, PRUNED branch, no-store cache)
│       │   ├── logs-raw-get.test.ts          # NEW (stream + download format)
│       │   └── logs-artifact-put.test.ts     # NEW (413 on oversize, 415 on wrong content-type)
│       └── maintenance/
│           └── prune-logs.test.ts            # NEW (idempotent re-run, Blob-404 tolerance)
└── e2e/
    └── capture-and-display-logs.spec.ts      # NEW: single P1 scenario
```

**Structure Decision**: Option 2 (Web application — backend Next.js API routes + React components). The feature spans workflow-side capture, server-side API, and frontend rendering; the layout above uses the repo's existing convention of `app/api/` + `app/lib/` + `components/` rather than introducing a new module system. Runner-side code lives under `.github/` alongside existing workflow scripts.

## Testing Strategy

Follows the constitution (§III) and the "Existing Files" inventory in
`research.md §2`. Every new testable unit has a test; no E2E beyond the one
that verifies the P1 unblocking value.

### Unit (Vitest)

| File | Covers |
|---|---|
| `tests/unit/logs/normalizer.test.ts` | One fixture per agent (captured once, replayed). Verifies event ordering, schema-version header, lifecycle bookends. |
| `tests/unit/logs/redactor.test.ts` | All documented secret patterns; asserts placeholder string format `[REDACTED:<kind>]`; asserts deep-visitor redacts nested tool_invocation.input. |
| `tests/unit/logs/preview.test.ts` | Per-status derivation rules (FAILED, COMPLETED, CANCELLED, UNAVAILABLE, PRUNED); 280-char truncation. |
| `tests/unit/components/log-viewer-sheet.test.tsx` | RTL: renders 5 event types with distinct icons; copy button calls `useCopyToClipboard`; "Download raw" triggers an `<a>` with correct `href` & `download` attributes. Uses `renderWithProviders()` from `tests/utils/component-test-utils.tsx`. |

### Integration (Vitest — preferred per constitution §III)

| File | Covers |
|---|---|
| `tests/integration/api/jobs/logs-post.test.ts` | Workflow auth (401 when missing/invalid), Zod 400 on bad body, upsert behavior (second POST replaces, no dup), UNAVAILABLE branch rejects artifactKey. |
| `tests/integration/api/jobs/logs-get.test.ts` | Session auth + ticket access (owner + member pass; non-member 403). Preview returned; `rawUrl` null when status != CAPTURED. `Cache-Control: no-store` asserted. |
| `tests/integration/api/jobs/logs-raw-get.test.ts` | Streams the artifact; sets Content-Disposition only when `?format=jsonl`; 404 when no artifact exists; Blob client is mocked at `@/app/lib/blob/client`. |
| `tests/integration/api/jobs/logs-artifact-put.test.ts` | 415 on wrong Content-Type; 413 on oversize; derived artifactKey returned on success. |
| `tests/integration/api/maintenance/prune-logs.test.ts` | Seeds N records with `createdAt = now - 31d`, runs endpoint, asserts prunedCount = N and rows removed; re-runs and asserts second cycle is a no-op; asserts Blob 404 is treated as success. |

**No file duplicates an existing domain.** `tests/integration/api/jobs/` does
not exist today (verified via glob); it is the natural home for these new
tests — adding them to an unrelated existing file would mix concerns.

### E2E (Playwright) — minimal

| File | Covers |
|---|---|
| `tests/e2e/capture-and-display-logs.spec.ts` | Seeds a FAILED job with a `JobLog` fixture (no real workflow run — E2E is about UI wiring). Opens the ticket as a member (not owner), asserts the inline preview is visible on the Stats tab, clicks "View full logs", asserts the Sheet renders events with type-specific icons and that "Download raw" triggers a download. `[e2e]` prefix on the test project/ticket name. |

E2E is expensive (~5 s per test); the P2 / P3 user stories are covered by
integration + unit — no additional browser tests required.

### What does NOT get a new test

- `app/api/jobs/[id]/status/route.ts` is untouched by this feature, so its
  existing test coverage suffices.
- Normalizer scripts `.github/scripts/lib/normalize-*.mjs` — these are thin
  wrappers over `app/lib/logs/normalizer.ts` (the TypeScript module tested by
  `normalizer.test.ts`). A duplicate runner-side fixture test would be
  brittle and would mix concerns (build pipeline vs. logic).

## Complexity Tracking

*No Constitution Check violations — no entries.*

---

## Phase Summary

- **Phase 0 — Research**: Complete. See [`research.md`](./research.md). All NEEDS CLARIFICATION markers resolved.
- **Phase 1 — Design & Contracts**: Complete. See [`data-model.md`](./data-model.md), [`contracts/`](./contracts/), [`workflows/`](./workflows/). Agent context updated via `update-agent-context.sh`.
- **Phase 2 — Tasks**: **Not produced by `/plan`.** Run `/ai-board.tasks` to generate `tasks.md`.
