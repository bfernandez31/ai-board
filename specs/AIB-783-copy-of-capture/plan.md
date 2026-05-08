# Implementation Plan: Capture native Claude Code session JSONL alongside normalized logs

**Branch**: `AIB-783-copy-of-capture` | **Date**: 2026-05-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-783-copy-of-capture/spec.md`

## Summary

When a Claude Code agent finishes a job, AI-Board today builds a *normalized* JSONL transcript (`.github/scripts/capture-agent-logs.sh`) and uploads it as a single gzipped artifact. The normalization is lossy: `parentUuid`, `sessionId`, `isSidechain`, `usage`, `cwd`, `gitBranch`, `version`, and summary events are dropped — fields that a future Admin Insights feature needs for full replay.

This plan persists a **second** artifact per Claude job: the aggregated, redacted, native Claude Code session JSONL — gzipped, stored at `raw-logs/<projectId>/<ticketId>/<jobId>.jsonl.gz`, served by a sibling endpoint `/logs/raw-native`. The normalized pipeline is unchanged; the new pipeline is gated on `agent === CLAUDE`, runs **after** normalized success, and never affects the job's terminal status on failure. Redaction parity with the normalized pipeline is mandatory (FR-003); retention parity (30 days) is mandatory (FR-011); the existing AIB-724 canonical-key re-derivation hardening is replicated at retrieval time.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) for app code, Bash + ESM JavaScript for runner scripts (Node 22.20.0).
**Primary Dependencies**: Next.js 16 (App Router), Prisma 6.x, `@vercel/blob` 2.3.x, Zod (existing in `app/lib/logs/schema.ts`).
**Storage**: PostgreSQL 14+ (Prisma) for the `JobLog` row metadata; Vercel Blob (`access: 'private'`) for both normalized and raw gzipped artifacts.
**Testing**: Vitest (unit + integration), Playwright (E2E — extending one existing spec, not adding a new file).
**Target Platform**: Vercel Node runtime for API routes; Ubuntu GitHub Actions runner for `capture-agent-logs.sh`.
**Project Type**: web (Next.js monorepo, single project).
**Performance Goals**: Raw artifact processing must complete within the existing job-completion budget. At ≈500 bytes/native-event a 5 MB gzipped artifact is ≈80k events — line-by-line redact + serialize stays well under the existing 30s normalized capture budget. No new SLOs introduced.
**Constraints**:
- Compressed artifact size cap: 25 MB (reuses `ARTIFACT_MAX_BYTES` from `app/lib/logs/schema.ts`).
- Storage doubling for Claude jobs is accepted (spec assumption #3).
- Raw upload MUST NOT block job terminal-status reporting (FR-010).
- Redaction patterns MUST stay in sync between `app/lib/logs/redactor.ts` and `.github/scripts/lib/redactor.mjs` (existing dual-copy invariant).
**Scale/Scope**: ≈one extra Blob object per Claude job per terminal run; nightly prune runs at the same volume. Database delta: 2 nullable columns on existing `JobLog` table.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan satisfies it |
|-----------|----------------------------|
| **I. TypeScript-First** | All new server code (route handlers, schema extension, key builders, redactor extension) is TypeScript with explicit types. The runner script extension is Bash + ESM JS (matching the existing `.github/scripts/lib/*.mjs` convention; Bash is the existing runner-side language and not a TypeScript-vs-JS regression). No `any` introduced. |
| **II. Component-Driven Architecture** | No UI components added. API routes follow the existing `app/api/[resource]/route.ts` shape exactly. Shared utilities (`buildJobLogRawArtifactKey`, `redactNativeJsonl`) added next to their existing siblings (single-responsibility). No new dependency added. |
| **III. Test-Driven Development** | Test plan extends existing files first (logs-post.test.ts, prune-logs.test.ts, redactor.test.ts, capture-and-display-logs.spec.ts). Two new test files (`logs-raw-artifact-put.test.ts`, `logs-raw-native-route.test.ts`) created **only** because the existing files would mix concerns or force every case to switch on a kind — explicitly justified per constitution §III ("Search existing tests FIRST — extend, don't duplicate. Create a new test file only when no existing file covers the domain, or when adding would mix unrelated concerns."). Decision tree: API endpoints → Vitest integration tests; redactor → Vitest unit; UI ↔ artifact retrieval → existing Playwright extension. |
| **IV. Security-First** | Same redaction pipeline (every nested string field) is applied to the raw artifact before it leaves the runner (FR-003). Workflow-token auth on PUT/DELETE; `verifyTicketAccess` (project-owner OR member) on GET. AIB-724 canonical-key re-derivation hardening replicated. No new secrets, no new env vars. New Zod refine() rule enforces `rawArtifactKey ⇔ rawArtifactSize` and `rawArtifactKey ⇒ captureStatus === 'CAPTURED'`. |
| **V. Database Integrity** | Migration adds two nullable columns with no defaults — zero risk to existing rows. The single-upsert pattern in `POST /api/jobs/:id/logs` is preserved (P5 in research.md). Pruning extends the existing batch loop with the same idempotency contract. No raw SQL except the one trivial `ALTER TABLE`. |
| **V. Spec Clarification Guardrails** | The CONSERVATIVE-resolved decisions in spec.md are preserved verbatim in this plan: redaction parity (D6/P11), separate artifact key (D1), Claude-only gate (D2/D3), failure isolation (D5/P3), full native fidelity (D6 inferred), retention parity (D7), empty-data info logging (D8), retrieval API mirroring (D3 + contracts/raw-native-get.md). |

**Initial gate**: PASS — no violations.

**Post-design gate** (re-evaluated after Phase 1): PASS. The migration is additive-only, the new Zod rules don't tighten any existing rule, the new endpoints are pure mirrors of existing ones, and the runner-side extension is appended (not interleaved). Complexity Tracking section below is intentionally empty.

## Project Structure

### Documentation (this feature)

```
specs/AIB-783-copy-of-capture/
├── plan.md                                  # This file
├── research.md                              # Phase 0 output
├── data-model.md                            # Phase 1 output
├── contracts/
│   ├── raw-artifact-put.md                  # PUT/DELETE /api/jobs/:id/logs/raw-artifact
│   ├── raw-native-get.md                    # GET /api/projects/:projectId/tickets/:id/jobs/:jobId/logs/raw-native
│   ├── job-log-summary-extension.md         # Schema additions to JobLogSubmissionSchema
│   └── redactor-extension.md                # redactNativeJsonl helper
├── workflows/
│   ├── raw-capture-process.md               # Runner-side Phase 5b extension
│   └── retention-pruning-extension.md       # Extension to prune-logs handler
├── checklists/                              # (existing — reused as-is)
└── tasks.md                                 # Phase 2 output (NOT created by this command)
```

### Source Code (repository root)

This feature touches the existing Next.js monorepo. All paths below are real (verified during research).

```
app/
├── api/
│   ├── jobs/[id]/logs/
│   │   ├── artifact/route.ts                # EXISTING — pattern reference (P2, P7)
│   │   ├── raw-artifact/route.ts            # NEW — PUT + DELETE for raw artifact
│   │   └── route.ts                         # EXTEND — POST adds optional rawArtifactKey/Size handling
│   ├── projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/
│   │   ├── raw/route.ts                     # EXISTING — pattern reference (P1, P8)
│   │   └── raw-native/route.ts              # NEW — GET for raw native artifact
│   └── maintenance/prune-logs/route.ts      # EXTEND — additionally delete raw blobs
└── lib/
    ├── blob/client.ts                       # REUSE AS-IS — generic key, generic helpers
    └── logs/
        ├── artifact-key.ts                  # EXTEND — add buildJobLogRawArtifactKey + buildJobLogRawNativeUrl
        ├── redactor.ts                      # EXTEND — add redactNativeJsonl
        └── schema.ts                        # EXTEND — add rawArtifactKey/Size to JobLogSubmissionSchema + new refine()

.github/scripts/
├── capture-agent-logs.sh                    # EXTEND — append Phase 5b (Claude-only raw capture)
└── lib/redactor.mjs                         # EXTEND — add redactNativeJsonl (mirror of TS)

prisma/
├── schema.prisma                            # EXTEND — JobLog.rawArtifactKey, JobLog.rawArtifactSize
└── migrations/<timestamp>_add_job_log_raw_artifact/migration.sql  # NEW — additive ALTER TABLE

tests/
├── unit/logs/
│   └── redactor.test.ts                     # EXTEND — cases for redactNativeJsonl
├── integration/api/jobs/
│   ├── logs-artifact-put.test.ts            # UNCHANGED
│   ├── logs-raw-artifact-put.test.ts        # NEW — PUT/DELETE raw-artifact (Claude gate, 415, 413, etc.)
│   ├── logs-post.test.ts                    # EXTEND — optional rawArtifactKey/Size validation paths
│   ├── logs-raw-route.test.ts               # UNCHANGED
│   └── logs-raw-native-route.test.ts        # NEW — GET raw-native (auth, agent-gate 404, key-mismatch 500, stream)
├── integration/api/maintenance/
│   └── prune-logs.test.ts                   # EXTEND — both-keys deletion + raw-only-failure cases
└── e2e/
    └── capture-and-display-logs.spec.ts     # EXTEND — assert raw-native reachable for Claude job, 404 for Codex
```

**Structure Decision**: This is a **single-project Next.js app** (Option 1 with Web App framing). All extensions live within the existing top-level layout — no new top-level directories, no relocation of existing files.

## Implementation Phases

The phases below are scoped for the future `/speckit.tasks` command. They are NOT part of `/speckit.plan`'s output beyond outline.

### Phase A — Schema + key builders (foundation, parallelizable)
1. Migration `prisma/migrations/<timestamp>_add_job_log_raw_artifact/migration.sql` adding `rawArtifactKey VARCHAR(300)` and `rawArtifactSize INT` to `JobLog`. Update `prisma/schema.prisma` model. Run `bunx prisma generate`.
2. Add `buildJobLogRawArtifactKey(projectId, ticketId, jobId): string` and `buildJobLogRawNativeUrl(...)` to `app/lib/logs/artifact-key.ts`.
3. Add `rawArtifactKey?: string`, `rawArtifactSize?: number` to `JobLogSubmissionSchema` in `app/lib/logs/schema.ts` plus a NEW `.refine()` enforcing the joint-presence and `captureStatus === 'CAPTURED'` rules per `contracts/job-log-summary-extension.md`.
4. Add `redactNativeJsonl(line)` to BOTH `app/lib/logs/redactor.ts` AND `.github/scripts/lib/redactor.mjs`. Implementation in research.md D6 + contracts/redactor-extension.md.

### Phase B — Server endpoints
5. Create `app/api/jobs/[id]/logs/raw-artifact/route.ts` implementing PUT + DELETE per `contracts/raw-artifact-put.md`. Server-side agent gate (defensive 409 `AGENT_NOT_CLAUDE`) joins `Job → Ticket.agent`.
6. Create `app/api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/raw-native/route.ts` per `contracts/raw-native-get.md`. **MUST** replicate the canonical-key check (P1) and the verbatim `verifyTicketAccess` error mapping (P8).
7. Extend `app/api/jobs/[id]/logs/route.ts` (POST handler) to set `rawArtifactKey`/`rawArtifactSize` in the upsert `data` object and to include `rawNativeUrl`/`rawArtifactSize` in the response.
8. Extend `app/api/maintenance/prune-logs/route.ts` per `workflows/retention-pruning-extension.md` — extra SELECT field, sequential per-row delete (normalized first, raw second, both inside the same iteration), updateMany clears both column pairs.

### Phase C — Runner extension
9. Extend `.github/scripts/capture-agent-logs.sh` per `workflows/raw-capture-process.md`:
   - Phase 5b.0: gate on `AGENT_UPPER == CLAUDE` AND `CAPTURE_STATUS == CAPTURED` AND non-empty `${CLAUDE_AGGREGATED}`.
   - Phase 5b.1: redact each line via `redactNativeJsonl` (Node ESM inline script).
   - Phase 5b.2: gzip into `${RAW_ARTIFACT}`.
   - Phase 5b.3: PUT to `/api/jobs/:id/logs/raw-artifact` with the same 3× retry pattern as `put_artifact()`.
   - Phase 5b.4: structured info/error logs.
   - Phase 6 summary builder: include `rawArtifactKey`/`rawArtifactSize` when set.
   - `delete_orphan_artifact()`: extend to also DELETE the raw artifact when summary submission fails permanently.
   - `cleanup()`: extend trap to remove raw temp files.

### Phase D — Tests (TDD: write failing first, then implement)
10. Extend `tests/unit/logs/redactor.test.ts` with `redactNativeJsonl` cases (per contracts/redactor-extension.md): top-level token, nested tool_input, summary event with KEY=VALUE env, malformed line passthrough, non-string scalars unchanged.
11. Create `tests/integration/api/jobs/logs-raw-artifact-put.test.ts`: 401 (no token), 400 (bad ID), 415 (wrong content-type), 413 (oversized), 404 (job missing), 409 `AGENT_NOT_CLAUDE` for Codex/Mistral/Gemini ticket, 502 (Blob mocked failure), 201 happy path with response shape, overwrite-logging assertion, DELETE happy path + idempotent 200 with `deleted: false`.
12. Extend `tests/integration/api/jobs/logs-post.test.ts`: submission with both raw fields succeeds; one-without-other rejected with VALIDATION_ERROR; raw fields with `captureStatus !== CAPTURED` rejected; submission without raw fields succeeds (back-compat); response includes `rawNativeUrl` when raw fields are persisted.
13. Create `tests/integration/api/jobs/logs-raw-native-route.test.ts`: 400 (bad path), 401 (no session), 403 (non-member), 404 (Codex job), 404 (Claude job no JobLog), 404 (Claude job JobLog with rawArtifactKey null), 500 ARTIFACT_KEY_MISMATCH, 502 BLOB_UNREACHABLE, 200 streamed gzip with correct Content-Type/Content-Length/no Content-Encoding, `?format=jsonl` adds Content-Disposition with `-raw` infix.
14. Extend `tests/integration/api/maintenance/prune-logs.test.ts`: row with both keys → both deleted, both columns nulled; raw-delete failure → row stays unpruned; row with raw-only (defensive — not normally produced) → both columns cleared on confirm; non-Claude row (no rawArtifactKey) → unchanged behavior.
15. Extend `tests/e2e/capture-and-display-logs.spec.ts`: seed a JobLog row with both `artifactKey` and `rawArtifactKey` set; navigate as project member; assert the new raw-native endpoint returns 200 with gzipped Content-Type. Add a second seeded row for a Codex job and assert raw-native returns 404. (No new spec file — keeps E2E count flat.)

### Phase E — Verification
16. Run `bun run type-check` and `bun run lint` — must pass without `--no-verify`.
17. Run `bun run test:unit` and `bun run test:integration` (auto-server) — all new+extended cases green.
18. Run `bun run test:e2e` for the extended spec — green.
19. Manual verification: trigger a Claude Code job (e.g. `quick-impl` on a [e2e] ticket), confirm both Blob objects exist (one under `logs/`, one under `raw-logs/`), confirm both retrieval endpoints serve them, confirm a Codex job produces only the normalized one with no error logs.

## Testing Strategy

Per constitution §III decision tree:
- **Pure functions** (`buildJobLogRawArtifactKey`, `redactNativeJsonl`): Vitest unit. Extend `tests/unit/logs/redactor.test.ts` (existing); no new file for the key builder (covered by route integration tests where it's actually used).
- **API routes**: Vitest integration with `auto-server`. Extend `logs-post.test.ts`; create new `logs-raw-artifact-put.test.ts` and `logs-raw-native-route.test.ts` (justified by mixed-concerns rule).
- **Background jobs**: Extend `prune-logs.test.ts` (existing).
- **Browser-required behavior**: One existing E2E spec extended (no new spec). Constitution: "E2E is expensive — default to integration when unsure."
- **Runner script**: No dedicated test harness for `capture-agent-logs.sh` — its inline Node fragments delegate to `redactor.mjs`, which is unit-tested. End-to-end correctness is verified by the manual phase E step + production observation against SC-001…SC-007.

**Search-first compliance**: Phase 0 enumerated existing test files in `tests/integration/api/jobs/`, `tests/integration/api/maintenance/`, `tests/unit/logs/`, `tests/e2e/`. Each new file decision is documented in research.md "Existing Files" with the mixing-of-concerns rationale.

## Rollout Notes

- **Migration**: zero-risk additive-only (data-model.md). Apply as part of the normal Vercel deploy — no separate migration ticket.
- **Backwards compatibility**: Old runners continue to upload only the normalized artifact. Old API consumers ignore the new fields. The first Claude job that runs the new runner script begins producing raw artifacts.
- **Observability**: A new grep-target for operators — `capture-agent-logs: raw_capture FAILED` — should be added to whatever existing log-search dashboard tracks the normalized `capture-agent-logs:` lines (out of scope for this ticket; covered by ad-hoc grep until the follow-up Insights ticket surfaces it).

## Complexity Tracking

*Empty — no constitutional violations to justify. The plan strictly mirrors existing patterns and adds two columns + two endpoints + one runner phase + one redactor helper.*
