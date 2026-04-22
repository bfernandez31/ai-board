# Tasks: Capture and display agent execution logs (Claude/Codex/Mistral/Gemini)

**Input**: Design documents from `/specs/AIB-715-capture-and-display/`
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/job-logs-api.yaml`, `contracts/normalized-event-schema.md`, `workflows/agent-log-capture.md`, `workflows/log-retention-pruning.md`

**Tests**: Included by default (constitution §III). Unit + integration for all new logic; one E2E for the P1 story.

**Organization**: Tasks are grouped by user story so each story can be delivered and validated independently.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Different file, no dependency on an incomplete task → parallelizable.
- **[Story]**: User story the task belongs to (`[US1]`, `[US2]`, `[US3]`). Setup / Foundational / Polish tasks omit the story label.

## Path Conventions

Web application (Next.js): `app/api/**` server routes, `app/lib/**` shared helpers, `components/**` React UI, `prisma/**` schema + migrations, `.github/scripts/**` runner-side helpers, `.github/workflows/**` workflow definitions, `tests/unit/**`, `tests/integration/**`, `tests/e2e/**`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project-wide prerequisites that must land before any schema, module, or route is authored.

- [ ] T001 Install `@vercel/blob` dependency and pin to a compatible range in `package.json`
- [ ] T002 [P] Document new env vars (`BLOB_READ_WRITE_TOKEN`, `LOG_RETENTION_DAYS`) in `.env.example` and add the "Agent log capture" section to `CLAUDE.md` under Tech Stack so future AI agents know the storage backend

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, shared modules, and runner-side libraries used by every user story.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Add `JobLog` model, `CaptureStatus` enum, and `log JobLog?` relation on `Job` to `prisma/schema.prisma` (fields and indexes per `data-model.md` §1.1–1.3)
- [ ] T004 Generate Prisma migration `<timestamp>_add_job_log` via `bunx prisma migrate dev --name add_job_log` and regenerate the Prisma client with `bunx prisma generate`
- [ ] T005 [P] Create Zod schemas `JobLogSubmissionSchema` + `NormalizedEventSchema` + `ArtifactHeaderSchema` in `app/lib/logs/schema.ts` (payload rules per `contracts/job-logs-api.yaml` §components.schemas and `contracts/normalized-event-schema.md`)
- [ ] T006 [P] Create Vercel Blob client wrapper in `app/lib/blob/client.ts` exposing `isConfigured()`, `uploadJobLogArtifact(key, body, size)`, `streamJobLogArtifact(key)`, `deleteJobLogArtifact(key)` — mirrors the shape of `app/lib/cloudinary/client.ts`
- [ ] T007 Extend `app/lib/query-keys.ts` with `jobLog(projectId, ticketId, jobId)` and `jobLogRaw(projectId, ticketId, jobId)` key factories
- [ ] T008 [P] Create shared secret redactor in `app/lib/logs/redactor.ts` with `redactString(value)` + `redactEvents(events)` deep-visitor; placeholder format `[REDACTED:<kind>]`; patterns per `research.md` §1.6
- [ ] T009 [P] Create per-agent TypeScript normalizers `normalizeClaude`, `normalizeCodex`, `normalizeMistral`, `normalizeGemini` in `app/lib/logs/normalizer.ts`, each returning a `NormalizedEvent[]` plus the v1 header per `contracts/normalized-event-schema.md`
- [ ] T010 [P] Create `derivePreview(events, status): string` in `app/lib/logs/preview.ts` covering `FAILED`, `COMPLETED`, `CANCELLED`, `UNAVAILABLE`, `PRUNED` branches with a 280-char hard cap and trailing `…` truncation (rules per `research.md` §1.7)
- [ ] T011 [P] Create runner-side redactor sibling in `.github/scripts/lib/redactor.mjs` (plain ESM, same pattern table as `app/lib/logs/redactor.ts`) — required because the capture script runs on Ubuntu runners before the artifact leaves the machine

**Checkpoint**: Schema, shared libraries, and runner-side helpers available — user stories can begin.

---

## Phase 3: User Story 1 - Self-service failure diagnosis from the ai-board UI (Priority: P1) 🎯 MVP

**Goal**: A project member opens a `FAILED` job's ticket, sees an inline preview in the timeline explaining the failure, and can click "View full logs" to read the normalized event stream — without GitHub Actions access.

**Independent Test**: Seed a `FAILED` job with a captured `JobLog` + blob artifact, open the ticket as a non-owner project member, assert the inline preview appears on the Stats tab and the full-log Sheet renders the normalized events in readable form.

### Tests for User Story 1 (write first, confirm they fail)

- [ ] T012 [P] [US1] Create redactor unit tests in `tests/unit/logs/redactor.test.ts` covering every pattern in `research.md §1.6`, placeholder format, and nested deep-visitor over `tool_invocation.input` / `tool_result.output`
- [ ] T013 [P] [US1] Create normalizer unit tests in `tests/unit/logs/normalizer.test.ts` with one captured fixture per agent (Claude / Codex / Mistral / Gemini) asserting event ordering, header schema version, and lifecycle bookends
- [ ] T014 [P] [US1] Create preview derivation unit tests in `tests/unit/logs/preview.test.ts` covering the `FAILED` branch (terminal error excerpt preferred, fallback to last message, 280-char truncation) and the `UNAVAILABLE` literal string
- [ ] T015 [P] [US1] Create `POST /logs` integration test in `tests/integration/api/jobs/logs-post.test.ts` covering workflow-token auth (401 on missing/invalid), Zod 400 on bad body, idempotent upsert, and the `UNAVAILABLE` branch rejecting `artifactKey`
- [ ] T016 [P] [US1] Create `GET /logs` integration test in `tests/integration/api/jobs/logs-get.test.ts` covering session auth + `verifyTicketAccess` (owner + member pass, non-member 403), `rawUrl` null when `captureStatus !== CAPTURED`, and `Cache-Control: no-store`
- [ ] T017 [P] [US1] Create `GET /logs/raw` integration test in `tests/integration/api/jobs/logs-raw-get.test.ts` covering the gzip stream passthrough, `?format=jsonl` Content-Disposition, 404 when no artifact exists, and Blob client mocked at `@/app/lib/blob/client`
- [ ] T018 [P] [US1] Create `PUT /logs/artifact` integration test in `tests/integration/api/jobs/logs-artifact-put.test.ts` covering 415 on wrong Content-Type, 413 on oversize (> 25 MB), and the `{ artifactKey, artifactSize }` response on success

### Implementation for User Story 1

- [ ] T019 [P] [US1] Implement `POST /api/jobs/[id]/logs/route.ts` with `validateWorkflowAuth`, Zod validation of `JobLogSubmission`, server-side re-redaction of `preview`, and Prisma upsert keyed on `jobId`
- [ ] T020 [P] [US1] Implement `PUT /api/jobs/[id]/logs/artifact/route.ts` with `validateWorkflowAuth`, Content-Type/length guards, derive `artifactKey = logs/<projectId>/<ticketId>/<jobId>.jsonl.gz`, call `uploadJobLogArtifact()`, and return `{ artifactKey, artifactSize }`
- [ ] T021 [P] [US1] Implement `GET /api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/route.ts` with session auth + `verifyTicketAccess`, return `JobLogReadable` shape with `rawUrl` populated only when `captureStatus === CAPTURED`, and `Cache-Control: no-store`
- [ ] T022 [P] [US1] Implement `GET /api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/raw/route.ts` with session auth + `verifyTicketAccess`, stream via `streamJobLogArtifact()`, preserve gzip Content-Encoding, set `Content-Disposition` only when `?format=jsonl`, 502 on Blob backend unreachable
- [ ] T023 [US1] Extend `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` to include `log: { captureStatus, preview }` in the select (depends on T004 migration; returned shape consumed by the extended hook in T025)
- [ ] T024 [P] [US1] Create `app/lib/hooks/queries/useJobLog.ts` — TanStack Query hook keyed on `jobLog(projectId, ticketId, jobId)` for the summary endpoint
- [ ] T025 [US1] Extend `app/lib/hooks/queries/useTicketJobs.ts` row shape with `log: { captureStatus, preview } | null` (depends on T023)
- [ ] T026 [P] [US1] Create `app/lib/hooks/queries/useJobLogRaw.ts` — conditional-fetch hook keyed on `jobLogRaw(...)`, enabled only when the viewer sheet is open (mirrors `useQualityGateDetails` pattern at `components/health/drawer/quality-gate-drawer.tsx`)
- [ ] T027 [P] [US1] Create `components/ticket/log-event-row.tsx` rendering one `NormalizedEvent` with a timestamp, event-type header, and monospace payload body (type-specific styling deferred to US3; US1 only needs readable, non-JSON output)
- [ ] T028 [US1] Create `components/ticket/log-viewer-sheet.tsx` wrapping `components/ui/sheet.tsx` — opens on trigger, calls `useJobLogRaw`, parses the streamed NDJSON, renders `<LogEventRow>` per event, and shows a skeleton + 502 error state (depends on T026, T027)
- [ ] T029 [US1] Extend `components/ticket/jobs-timeline.tsx` `JobRow` to (a) render the `log.preview` line below the command/status header with `line-clamp-2`, (b) render a "View full logs" button that opens the sheet for `CAPTURED` status, and (c) render a disabled trigger with explanatory copy for `UNAVAILABLE`
- [ ] T030 [P] [US1] Create `.github/scripts/lib/normalize-claude.mjs` parsing `claude-stream-json` plus `~/.claude/projects/**` session metadata → v1 event stream (delegates redaction to `redactor.mjs` from T011)
- [ ] T031 [P] [US1] Create `.github/scripts/lib/normalize-codex.mjs` parsing Codex stdout + `~/.codex/sessions/*` → v1 event stream
- [ ] T032 [P] [US1] Create `.github/scripts/lib/normalize-mistral.mjs` parsing Mistral/vibe output + `~/.vibe/sessions/*` → v1 event stream
- [ ] T033 [P] [US1] Create `.github/scripts/lib/normalize-gemini.mjs` parsing Gemini stdout → v1 event stream
- [ ] T034 [US1] Create `.github/scripts/capture-agent-logs.sh` implementing the 7-phase pipeline from `workflows/agent-log-capture.md` (collect → normalize → redact → derive preview → gzip + `PUT /logs/artifact` with 3/1-2-4 s backoff → `POST /logs` with same retry → cleanup) (depends on T011, T030–T033, T019, T020)
- [ ] T035 [US1] Extend `.github/scripts/run-agent.sh` to tee agent stdout into `$RUNNER_TEMP/agent-raw-<jobId>.log` and install a trap that calls `capture-agent-logs.sh` on agent exit (depends on T034)
- [ ] T036 [P] [US1] Add `if: always()` capture step immediately after `run-agent.sh` and before the status PATCH in `.github/workflows/speckit.yml`
- [ ] T037 [P] [US1] Add the same capture step in `.github/workflows/quick-impl.yml`
- [ ] T038 [P] [US1] Add the same capture step in `.github/workflows/verify.yml` — single call after the last agent invocation (both `fix-tests` and `code-review` tee into the same raw log file)
- [ ] T039 [P] [US1] Add the same capture step in `.github/workflows/ai-board-assist.yml`
- [ ] T040 [P] [US1] Add the same capture step in `.github/workflows/iterate.yml`
- [ ] T041 [US1] Create E2E in `tests/e2e/capture-and-display-logs.spec.ts` — seeds a `[e2e]`-prefixed project + ticket + `FAILED` job with a `JobLog` fixture and a small stubbed artifact via the Blob mock, authenticates as a member (not owner), asserts the preview is visible on the Stats tab, clicks "View full logs", asserts the sheet renders the seeded events (no real workflow run)

**Checkpoint**: US1 MVP is functional — a member can diagnose a failed job end-to-end from ai-board.

---

## Phase 4: User Story 2 - Glance-able log preview inline in the timeline (Priority: P2)

**Goal**: Every terminated job — `COMPLETED`, `FAILED`, `CANCELLED`, plus `UNAVAILABLE` and `PRUNED` — shows a distinct, contextually appropriate one-line preview in the timeline without user interaction.

**Independent Test**: Seed five jobs on one ticket (one per terminal state + `UNAVAILABLE` + `PRUNED`) and verify each timeline row shows a distinct, readable preview without clicking — the member can form a hypothesis about every outcome from the preview alone.

### Tests for User Story 2

- [ ] T042 [P] [US2] Extend `tests/unit/logs/preview.test.ts` with cases for the `COMPLETED` branch (final agent message / tool-usage recap), `CANCELLED` branch (lifecycle `kind` surfaces as cause), and `PRUNED` literal string; assert the 280-char cap holds on every branch
- [ ] T043 [P] [US2] Extend `tests/unit/components/ticket-stats.test.tsx` with assertions that rows render distinct previews across `COMPLETED` / `CANCELLED` / `UNAVAILABLE` / `PRUNED` statuses via the hook's mocked data (file already exists — extending avoids duplicating the ticket-stats render setup)

### Implementation for User Story 2

- [ ] T044 [US2] Refine `components/ticket/jobs-timeline.tsx` `JobRow` preview styling — use Catppuccin tokens to color-tint the preview line per status (`text-ctp-red` for `FAILED`, `text-ctp-blue` for `COMPLETED`, `text-ctp-yellow` for `CANCELLED`, `text-ctp-overlay-0` for `UNAVAILABLE` / `PRUNED`), keep class strings as static literals (no dynamic class construction per `CLAUDE.md`), and ensure `UNAVAILABLE` / `PRUNED` rows render the "View full logs" trigger in a disabled state
- [ ] T045 [US2] Extend `.github/scripts/capture-agent-logs.sh` to synthesize the minimal `lifecycle:started` + `lifecycle:cancelled` pair when the raw log is empty (covers the "job cancelled before any agent output" edge case — `workflows/agent-log-capture.md` Phase 1)

**Checkpoint**: Timeline is glance-ably useful across every terminated-job outcome.

---

## Phase 5: User Story 3 - Drill-down full log viewer for deeper investigation (Priority: P3)

**Goal**: Full log viewer renders each event with type-specific icon/color, supports per-entry copy-to-clipboard, and provides a "Download raw" affordance that streams the normalized artifact through the authenticated proxy.

**Independent Test**: Open the viewer on a captured log, verify every event type (`message`, `tool_invocation`, `tool_result`, `error`, `lifecycle`) renders with its distinct icon/color; click copy on one entry and verify clipboard contents; click "Download raw" and verify the browser downloads the gzipped JSONL via `/logs/raw?format=jsonl`.

### Tests for User Story 3

- [ ] T046 [P] [US3] Create RTL test `tests/unit/components/log-viewer-sheet.test.tsx` covering the five event types rendering with distinct icons, per-entry copy calling `useCopyToClipboard`, and the "Download raw" `<a>` emitting the correct `href` + `download` attributes; uses `renderWithProviders()` from `tests/utils/component-test-utils.tsx`

### Implementation for User Story 3

- [ ] T047 [US3] Enhance `components/ticket/log-event-row.tsx` with a static `const EVENT_ICON: Record<EventType, {icon, tone}>` map using lucide-react icons + Catppuccin tokens per `research.md §3.9` (`MessageSquare`/`text-ctp-blue`, `Wrench`/`text-ctp-mauve`, `CheckCheck`/`text-ctp-green` (or `text-ctp-red` on error), `XCircle`/`text-ctp-red`, `Clock`/`text-ctp-overlay-0`); add a per-row copy button wired to `app/lib/hooks/useCopyToClipboard.ts`
- [ ] T048 [US3] Extend `components/ticket/log-viewer-sheet.tsx` footer with a "Download raw" `<a download>` element pointing at `/api/projects/[projectId]/tickets/[ticketId]/jobs/[jobId]/logs/raw?format=jsonl` (session cookie carries auth — no blob token exposure)

**Checkpoint**: Power users have the full drill-down experience.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Retention pruning (required by FR-019/FR-020 but independent of the P1–P3 user-visible slices), scheduled workflow wiring, and documentation.

- [ ] T049 [P] Create `tests/integration/api/maintenance/prune-logs.test.ts` — seeds N records with `createdAt = now - 31d`, asserts `prunedCount === N` and rows removed; asserts second run is a no-op; asserts Blob 404 is treated as success; Blob client mocked at `@/app/lib/blob/client`
- [ ] T050 Create `app/api/maintenance/prune-logs/route.ts` with `verifyWorkflowToken`, bounded batching (500 rows/loop, 50 k/cycle cap), Blob-delete-before-DB ordering, idempotent `where: { createdAt: { lt: cutoff }, captureStatus: { not: 'PRUNED' } }` filter, and `{ prunedCount, skippedCount, durationMs }` response
- [ ] T051 Create scheduled `.github/workflows/nightly-log-prune.yml` with `cron: '15 1 * * *'`, `workflow_dispatch: {}` trigger, and the `curl POST /api/maintenance/prune-logs` invocation matching the template in `workflows/log-retention-pruning.md` §Scheduled workflow
- [ ] T052 [P] Run `bun run type-check` and `bun run lint` end-to-end, confirm no regression in existing telemetry tests (FR-018 / SC-007), and verify the constitution gate documented in `plan.md` §Constitution Check still holds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Phase 1 completion; blocks all user stories.
- **User Story 1 (Phase 3)**: depends on Phase 2; delivers the MVP.
- **User Story 2 (Phase 4)**: depends on Phase 2 + the preview rendering surface from T029 (US1). Logic-only preview branches in T042 / T044 can start as soon as T010 lands but cannot finish integration testing until T029 is merged.
- **User Story 3 (Phase 5)**: depends on Phase 2 + the viewer surface from T028 (US1). T047 / T048 extend US1 components.
- **Polish (Phase 6)**: depends on T003 (schema) and T006 (blob client); does not block any user story and can be scheduled whenever resources allow.

### Within Each User Story

- Tests (T012–T018 for US1, T042–T043 for US2, T046 for US3) are authored before the implementation tasks they cover; they MUST fail before implementation and pass after.
- Within US1, the API routes (T019–T023) depend on T003/T004; the workflow scripts (T034–T040) depend on T011 and T019/T020; the UI (T027–T029) depends on T024–T026.

### Parallel Opportunities

- All `[P]` tasks in Phase 2 can run concurrently once T004 (Prisma client regenerated) completes.
- Within US1 the six test authoring tasks (T012–T018) are parallel; the four route implementations (T019–T022) are parallel; the four agent normalizers (T030–T033) are parallel; the five workflow extensions (T036–T040) are parallel.
- Phases 4, 5, and 6 can run in parallel once their respective dependencies (T029, T028, T003/T006) have landed.

---

## Parallel Example: User Story 1

```bash
# Tests for US1 — all independent files:
Task: "Redactor unit tests in tests/unit/logs/redactor.test.ts"
Task: "Normalizer unit tests in tests/unit/logs/normalizer.test.ts"
Task: "Preview unit tests in tests/unit/logs/preview.test.ts"
Task: "logs-post integration tests in tests/integration/api/jobs/logs-post.test.ts"
Task: "logs-get integration tests in tests/integration/api/jobs/logs-get.test.ts"
Task: "logs-raw-get integration tests in tests/integration/api/jobs/logs-raw-get.test.ts"
Task: "logs-artifact-put integration tests in tests/integration/api/jobs/logs-artifact-put.test.ts"

# API routes for US1 — all independent files:
Task: "POST /api/jobs/[id]/logs/route.ts"
Task: "PUT /api/jobs/[id]/logs/artifact/route.ts"
Task: "GET …/logs/route.ts"
Task: "GET …/logs/raw/route.ts"

# Agent-specific normalizer scripts — all independent files:
Task: ".github/scripts/lib/normalize-claude.mjs"
Task: ".github/scripts/lib/normalize-codex.mjs"
Task: ".github/scripts/lib/normalize-mistral.mjs"
Task: ".github/scripts/lib/normalize-gemini.mjs"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational — schema, shared modules, runner-side redactor).
3. Complete Phase 3 (User Story 1 — end-to-end capture + FAILED preview + viewer).
4. **STOP and VALIDATE**: Trigger a failing workflow against a seeded project, confirm a non-owner member can see the preview and open the viewer.
5. Ship US1 to production; retention is not on the critical path because nothing has aged 30 d yet.

### Incremental Delivery

1. Phase 1 → Phase 2 → Phase 3 → **MVP shipped** (US1).
2. Phase 4 (US2) — richer previews across all terminal states; no schema change.
3. Phase 5 (US3) — drill-down UX; frontend-only.
4. Phase 6 (Polish) — retention pruning + scheduled workflow must land before day 30 of production usage.

### Parallel Execution Strategy

After Foundational (Phase 2) completes, the three user-story phases can be developed in parallel by separate agents because they touch disjoint files:

- US1 authors routes, hooks, sheet skeleton, and capture pipeline.
- US2 authors preview branches + styling in `jobs-timeline.tsx`.
- US3 authors the rich viewer affordances in `log-event-row.tsx` and `log-viewer-sheet.tsx`.

US2 and US3 merge conflict-free with US1's JobRow / Sheet skeletons because the US1 files define the extension points (preview line, icon map, footer slot) that US2 / US3 extend.

---

## Notes

- `[P]` tasks = different files, no dependency on an incomplete task.
- `[Story]` label maps each user story task to `spec.md` priorities for traceability.
- Tests are written before implementation and must fail before and pass after — this is the constitution §III TDD gate.
- Commit after each task or logical group; run `bun run type-check` and `bun run lint` before each commit per `CLAUDE.md`.
- Legacy `Job.logs String?` is intentionally untouched — `lib/db/tickets.ts:717` still copies it during full-clone; the new feature lives entirely in `JobLog`.
- Storage is proxied through the ai-board API on every read and write — the runner never holds `BLOB_READ_WRITE_TOKEN` and Blob URLs are never rendered client-side (spec CONSERVATIVE reviewer note).
