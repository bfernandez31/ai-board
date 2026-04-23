# Phase 0 Research — AIB-715 Capture and display agent execution logs

**Branch**: `AIB-715-capture-and-display`
**Date**: 2026-04-22

## 1. Decisions

### 1.1 Durable external storage provider
- **Decision**: Use **Vercel Blob** (`@vercel/blob`) with `access: 'public'` at the blob level combined with **obscured per-job pathnames** AND mandatory proxying through an authenticated ai-board endpoint. The transcript object is **never** handed to the browser as a raw blob URL.
- **Rationale**:
  - Ai-board is deployed on Vercel; Blob is first-party, requires a single env var (`BLOB_READ_WRITE_TOKEN`), and has no additional account/vendor onboarding. Matches the repo's established pattern of one external provider (Cloudinary) with client helpers under `app/lib/`.
  - The spec's CONSERVATIVE clarification explicitly requires "signed URLs or proxied through the ai-board API — never publicly readable." Proxying through `GET .../logs/raw` lets `verifyTicketAccess()` enforce authorization on every fetch with the same rules as the rest of the ticket — retained owner/member parity out-of-the-box.
  - Keeps the blast radius of a misconfigured public ACL to zero: even if a Blob URL leaks, the **proxy endpoint** is the only sanctioned path, and we never render the blob URL to clients.
- **Alternatives considered**:
  - **AWS S3 / Cloudflare R2**: More operational surface (IAM, bucket policy, lifecycle rules), two new env vars (key + secret), no existing repo scaffolding. Deferred until/unless Vercel Blob proves insufficient.
  - **Reuse Cloudinary**: It is image-centric and its resource_type='raw' path is brittle for multi-MB text blobs; keeping it image-only preserves the single-responsibility boundary.
  - **Keep transcript in Postgres `TEXT`**: Violates FR-006 and SC-005 (no row bloat); rejected.

### 1.2 Schema shape: new `JobLog` sibling vs. reusing `Job.logs`
- **Decision**: Introduce a **new `JobLog` model** with a 1:1 relation to `Job`. Do not populate the legacy `Job.logs String?` field.
- **Rationale**:
  - The spec treats the Log Record as a distinct entity (FR-004, FR-005) with its own lifecycle (capture status, artifact pointer, pruning). Mixing summary metadata onto `Job` would bloat the hot Job row queried by the 2s timeline poller.
  - The legacy `Job.logs` field is never written by any API route (confirmed by grep). The only reference is `lib/db/tickets.ts:717`, which copies it verbatim in full-clone. Leaving it in place avoids a schema change for clone logic.
  - A separate table lets retention pruning run a bounded `deleteMany` without ever touching the Job row, and lets index `(captureStatus, createdAt)` support the prune query efficiently.

### 1.3 Schema version & normalized event format
- **Decision**: Version the normalized event stream with an explicit integer `schemaVersion = 1`. Event types: `message`, `tool_invocation`, `tool_result`, `error`, `lifecycle`. Every event carries `ts` (ISO 8601), `type`, `agent` (CLAUDE | CODEX | MISTRAL | GEMINI), and a typed `payload`.
- **Rationale**: Spec FR-026 requires this; baking it in from day one avoids the notoriously painful retrofit of versioning into stored artifacts later.
- **Alternatives considered**: Implicit versioning by file path. Rejected — it forces migration-by-rename instead of forward-compatible readers.

### 1.4 Capture mechanism inside GitHub Actions
- **Decision**: Extend `.github/scripts/run-agent.sh` to tee each agent's stdout to a `$RUNNER_TEMP/agent-raw-<agent>-<job_id>.log` file, then invoke a new **`.github/scripts/capture-agent-logs.sh`** after the agent exits. The capture script normalizes, redacts, uploads to Vercel Blob via the ai-board API, and POSTs the summary to `POST /api/jobs/:id/logs`. The capture script is invoked **unconditionally** (success, failure, cancel) via a trap / `if: always()` in every calling workflow.
- **Rationale**:
  - Centralizing in `run-agent.sh` guarantees coverage of all four agents in all five agent-invoking workflows (`speckit.yml`, `quick-impl.yml`, `verify.yml`, `ai-board-assist.yml`, `iterate.yml`) with a single touch-point.
  - The capture script is deliberately independent of the status-report step so an upload failure cannot suppress the terminal-status PATCH (FR-016).
  - Running normalization/redaction on the runner (not the API) means secrets never cross the wire in plaintext form.
- **Alternatives considered**:
  - Stream live over WebSocket/SSE. Rejected — spec explicitly marks real-time streaming out of scope; adds two layers of reliability risk and does not change the user story.
  - Have the app pull logs via GitHub Actions API. Rejected — requires workflow artifacts to be uploaded, has a GitHub-side retention window, and would break the moment logs are required for external-project workflows where the action runs on the ai-board repo.

### 1.5 Upload: direct-to-blob from runner vs. through ai-board API
- **Decision**: Upload the transcript artifact to Vercel Blob **through an authenticated ai-board endpoint** (`PUT /api/jobs/:id/logs/artifact`) that streams the body to Blob server-side. The runner never holds `BLOB_READ_WRITE_TOKEN`.
- **Rationale**:
  - The workflow already carries `WORKFLOW_API_TOKEN`. Keeping Blob credentials out of every GitHub Actions job minimizes secret-surface and matches how Cloudinary is currently used (secrets live in the app, not the workflow).
  - The ai-board API is the only process that needs to know blob key conventions (`logs/<projectId>/<ticketId>/<jobId>.jsonl.gz`) — easier to evolve without a workflow rewrite.
- **Alternatives considered**: Presigned upload URLs from the API + direct PUT from runner. A good future optimization for very large transcripts; not needed in v1 where transcripts are typically ≤ a few MB.

### 1.6 Secret redaction patterns
- **Decision**: Apply redaction in a **single TypeScript module** shared between the runner (invoked via Node directly — the runner already has Node/bun) and the API (used as server-side belt-and-suspenders validation before persisting the preview). Patterns covered in v1:
  - GitHub tokens: `gh[pousr]_[A-Za-z0-9_]{20,}`, `github_pat_[A-Za-z0-9_]{22,}`
  - OAuth bearer tokens in `Authorization: Bearer …` headers
  - Private key blocks: `-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----` fenced regions
  - Generic high-entropy `KEY=VALUE` where VALUE ≥ 32 chars of base64/hex entropy and KEY matches `(?i)(token|secret|key|password|auth|credential)`
  - Anthropic / OpenAI / Mistral / Google key prefixes (`sk-ant-`, `sk-`, `AIza`, etc.)
- **Rationale**: Matching the spec's FR-007 and its reviewer note treating the pattern list as a security artifact. A shared module makes adding patterns a one-line change with unit-test coverage.

### 1.7 Preview derivation rules
- **Decision**:
  - **FAILED**: last `error` event's message, then trailing 200 chars of the last `message` payload if the error lacks a message, hard-capped at 280 chars.
  - **CANCELLED**: the `lifecycle` event payload of type `cancelled` (e.g., `user-cancelled`, `timeout`, `upstream-error`), hard-capped at 280 chars.
  - **COMPLETED**: the final `message` event (or short tool-usage recap if no trailing message), hard-capped at 280 chars.
  - **UNAVAILABLE capture**: literal string `"Logs unavailable — capture failed."`
  - **PRUNED (30+ days)**: literal string `"Logs no longer retained (30-day window expired)."`
- **Rationale**: Deterministic rules keep the preview predictable for the upcoming failure-notification feature (P2 note in user stories) that will reuse this string as its "reason" line.

### 1.8 Retention pruning trigger
- **Decision**: New scheduled GitHub Actions workflow **`.github/workflows/nightly-log-prune.yml`** at `cron: '15 1 * * *'` (01:15 UTC, offset from nightly-health.yml's 00:30 to avoid API pile-ups). It calls `POST /api/maintenance/prune-logs` with `Authorization: Bearer $WORKFLOW_API_TOKEN`. The endpoint deletes Blob objects first, then deletes Postgres rows whose artifact delete succeeded or was already absent.
- **Rationale**:
  - The repo already has exactly one precedent (`nightly-health.yml`) for GitHub-Actions-driven cron. Adding a second follows the same mental model and reuses the same auth primitive.
  - Deleting Blob **before** Postgres avoids orphaned artifacts if the Postgres delete fails.
  - Idempotent: a re-run of the prune skips already-pruned records via a `where: { createdAt: { lt: cutoff }, captureStatus: { not: 'PRUNED' } }` query combined with a per-row Blob `del()` whose "already absent" is non-fatal.

### 1.9 Access control
- **Decision**: Reuse `verifyTicketAccess(ticketId)` (owner OR project member) on `GET .../logs` and `GET .../logs/raw`. The `POST /api/jobs/:id/logs` and `PUT .../logs/artifact` endpoints authenticate with `validateWorkflowAuth` (same as the existing `PATCH /api/jobs/:id/status`). The prune endpoint uses `verifyWorkflowToken`.
- **Rationale**: Spec FR-008 + reviewer note requires "same rule as other ticket data"; the existing helper already encodes that rule with a deep call-site history (nothing new to reinvent).

### 1.10 Download & copy UX
- **Decision**: The "Download raw" action in the full-log viewer triggers a standard `<a download>` pointing at `GET .../logs/raw?format=jsonl` — the browser downloads through the proxy so the auth cookie is used; no blob token exposure. Individual entry copy uses the existing `useCopyToClipboard` hook.

## 2. Existing Files

Identified via Glob+Grep during research. Listed by domain; each item states whether the implementation will **Extend** or **Add new** (and where) — no new files without justification.

### 2.1 Database
| Path | Covers | Plan |
|---|---|---|
| `prisma/schema.prisma` | `Job`, `Ticket`, `Project`, all models | **Extend**: add new `JobLog` model + `CaptureStatus` enum; add relation `job.log JobLog?`. Leave legacy `Job.logs String?` alone. |
| `prisma/migrations/` | Existing migrations | **Add new**: one migration for `JobLog` + enum. |
| `lib/db/tickets.ts` (`ticketId`=717) | Full clone of Job including `logs` | **Do not touch** — legacy `Job.logs` still copies. Full-clone does NOT copy `JobLog` (Log Records are per-run artifacts, not ticket content). |

### 2.2 API routes
| Path | Covers | Plan |
|---|---|---|
| `app/api/jobs/[id]/status/route.ts` | PATCH job status with workflow token | **Do not touch**. Log capture is a separate endpoint so capture failure cannot regress status reporting (FR-016). |
| `app/lib/auth/workflow-auth.ts` | `validateWorkflowAuth`, `verifyWorkflowToken` | **Reuse as-is**. |
| `app/lib/auth/*` (session auth, `verifyTicketAccess`) | Session + ticket authorization | **Reuse as-is** in new GET endpoints. |
| `app/lib/job-update-validator.ts` | Zod schemas for job updates | **Do not touch**. New schemas for log submission live next to the new route. |
| `app/api/telemetry/v1/logs/route.ts` | OTLP telemetry POST | **Reuse as pattern reference** for body shape + auth. Do not touch. |
| `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` | GET ticket jobs with telemetry | **Extend**: include `log { captureStatus, preview }` in the selection so the timeline renders previews without a second round-trip. |
| `app/api/projects/[projectId]/health/scans/route.ts` | Pattern: scheduled POST with workflow-token-or-session auth | **Pattern reference** for the new prune endpoint. |
| *new*: `app/api/jobs/[id]/logs/route.ts` | POST summary; workflow-token auth | **Add new**. |
| *new*: `app/api/jobs/[id]/logs/artifact/route.ts` | PUT artifact upload → Vercel Blob; workflow-token auth | **Add new**. |
| *new*: `app/api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/route.ts` | GET summary (session auth) | **Add new**. |
| *new*: `app/api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/raw/route.ts` | GET raw transcript; streams from Blob; session auth; supports `?format=jsonl` for download | **Add new**. |
| *new*: `app/api/maintenance/prune-logs/route.ts` | POST workflow-token auth; 30-day prune | **Add new**. |

### 2.3 Shared libraries (`lib/` and `app/lib/`)
| Path | Covers | Plan |
|---|---|---|
| `app/lib/cloudinary/client.ts` | External storage client pattern (singleton config, `isConfigured()` guard) | **Pattern reference**. |
| *new*: `app/lib/blob/client.ts` | Vercel Blob client helper: `uploadJobLogArtifact`, `deleteJobLogArtifact`, `streamJobLogArtifact` | **Add new** (mirrors Cloudinary helper shape). |
| *new*: `app/lib/logs/normalizer.ts` | Agent-agnostic normalization: `normalizeClaude`, `normalizeCodex`, `normalizeMistral`, `normalizeGemini` → v1 event stream | **Add new**. Unit-tested. |
| *new*: `app/lib/logs/redactor.ts` | Secret redaction patterns + `redactEvents(events)` | **Add new**. Unit-tested. Importable by both the API and the workflow script. |
| *new*: `app/lib/logs/preview.ts` | `derivePreview(events, status)` returning a ≤280-char string | **Add new**. Unit-tested. |
| *new*: `app/lib/logs/schema.ts` | Zod schemas for the v1 normalized event + API payloads | **Add new**. |
| `app/lib/query-keys.ts` | TanStack Query key registry | **Extend**: add `jobLog(projectId, ticketId, jobId)` + `jobLogRaw(...)` keys. |

### 2.4 UI
| Path | Covers | Plan |
|---|---|---|
| `components/ticket/jobs-timeline.tsx` (`JobRow`, lines 56–199) | Per-job row rendering in Stats tab | **Extend**: add a preview line below the command/status header, capped visually with `line-clamp-2`, color-tinted by status. Add "View full logs" trigger button that opens the sheet. Surface the "logs unavailable / pruned" state when `captureStatus !== 'CAPTURED'`. |
| `components/ticket/ticket-stats.tsx` | Wraps `JobsTimeline` | **Do not touch** (data flows through unchanged; the new fields come with the existing job object). |
| `components/board/ticket-detail-modal.tsx` | Top-level ticket modal | **Do not touch** directly. The new sheet is rendered from within `JobRow`, which already lives inside this modal. |
| `components/ui/sheet.tsx` | shadcn Sheet primitive | **Reuse as-is** for the full-log viewer. |
| `components/health/drawer/quality-gate-drawer.tsx` | Pattern reference for a Sheet that fetches data conditionally when opened | **Pattern reference**. |
| `app/lib/hooks/useCopyToClipboard.ts` | Copy-to-clipboard with toast | **Reuse as-is**. |
| `app/lib/hooks/queries/useTicketJobs.ts` | Job data hook | **Extend**: adjust the row shape to include `log { captureStatus, preview }` (mirrors route change). |
| `app/lib/hooks/useJobPolling.ts` | 2s polling of job status | **Do not touch** (summary appears in `useTicketJobs`, not in the status poller). |
| *new*: `components/ticket/log-viewer-sheet.tsx` | Full-log Sheet; renders normalized events | **Add new**. Uses `useCopyToClipboard`, `useQuery`. |
| *new*: `components/ticket/log-event-row.tsx` | One event row (icon, ts, type-specific body, per-entry copy button) | **Add new**. Pure; unit-tested with RTL. |
| *new*: `app/lib/hooks/queries/useJobLog.ts` | TanStack Query hook, only fetches when sheet opens | **Add new**. |
| *new*: `app/lib/hooks/queries/useJobLogRaw.ts` | Fetches the normalized event stream when sheet opens | **Add new**. |

### 2.5 Workflows & runner scripts
| Path | Covers | Plan |
|---|---|---|
| `.github/scripts/run-agent.sh` (1-line `tee` plus post-run capture call) | Unified agent invocation for all 4 agents | **Extend**: (a) tee agent stdout into `$RUNNER_TEMP/agent-raw.log`; (b) on exit (trap), call `capture-agent-logs.sh`. |
| `.github/scripts/setup-environment.sh` | Ensures `jq` / basic shell tooling | **Do not touch** (already has what we need). |
| *new*: `.github/scripts/capture-agent-logs.sh` | Normalizes raw stdout, runs redaction, uploads, POSTs summary | **Add new**. Bounded retry (3 attempts, exponential 1/2/4s) around the upload + summary submission. |
| *new*: `.github/scripts/lib/normalize-<agent>.mjs` (4 files) | Agent-specific parsers (Claude stream-json, Codex stdout, Mistral `~/.vibe/sessions/*`, Gemini stdout) | **Add new**. Each ≤ 80 lines. Share the redactor module via `require('../../app/lib/logs/redactor.ts')` compiled to JS (or a tiny duplicated lookup table — decide during implementation). |
| `.github/workflows/speckit.yml`, `quick-impl.yml`, `verify.yml`, `ai-board-assist.yml`, `iterate.yml` | Five agent-invoking workflows | **Extend**: add `if: always()` step calling `capture-agent-logs.sh` AFTER the agent step but BEFORE the final status-report step so capture can attempt upload before status closes out. (Capture failure MUST NOT block status.) |
| `.github/workflows/nightly-health.yml` | Pattern reference for scheduled cron + workflow-token POST | **Pattern reference**. |
| *new*: `.github/workflows/nightly-log-prune.yml` | Daily retention prune | **Add new**. Mirrors `nightly-health.yml` exactly. |

### 2.6 Tests
| Path | Covers | Plan |
|---|---|---|
| `tests/unit/job-cache.test.ts` | Job cache unit tests | **Pattern reference** for job-shape tests. |
| `tests/unit/components/ticket-detail-modal.test.tsx` | Ticket modal component tests | **Extend if** the modal itself needs a test for the new preview rendering, otherwise add a new file for `JobRow` preview. |
| `tests/integration/api/jobs/*` | (none today — directory would be new) | **Add new** under `tests/integration/api/jobs/` for `POST /logs`, `GET /logs`, `GET /logs/raw`. |
| `tests/integration/api/maintenance/prune-logs.test.ts` | *new* | **Add new**. |
| `tests/unit/logs/normalizer.test.ts`, `redactor.test.ts`, `preview.test.ts` | *new* | **Add new**. |
| `tests/e2e/capture-and-display-logs.spec.ts` | *new* — one scenario only: FAILED job shows preview + viewer opens | **Add new**. E2E is expensive; one is enough (P1 user story). |

## 3. Patterns to Follow

The new code parallels several existing systems. Each rule below cites the reference so the reviewer and implementer stay aligned.

### 3.1 Dispatch-before-mutation ordering (external call, then DB)
- **Reference**: `app/api/jobs/[id]/status/route.ts:223-226` uses a **conditional `updateMany`** so a concurrent terminal callback cannot overwrite a fresh terminal state. The prune endpoint MUST use the same pattern: `deleteMany({ where: { id: { in: ids }, captureStatus: { not: 'PRUNED' } } })` so a concurrent repeat run is a no-op.
- **Why**: Constitution V (Database Integrity) and the explicit spec note that pruning must be idempotent.

### 3.2 Structured error responses with explicit 401 for auth
- **Reference**: `app/api/jobs/[id]/status/route.ts:57-64` and `app/api/telemetry/v1/logs/route.ts:40-44` — 401 is returned early, logged, never masked as 500. All four new routes MUST follow this.
- **Why**: Constitution "Error Handling" — "Authentication/authorization errors MUST return 401/403, never fall through to a generic 500."

### 3.3 External-storage client shape
- **Reference**: `app/lib/cloudinary/client.ts` — one module exposing `isConfigured()`, upload, delete, plus a folder-cleanup helper; config read once from env; callers always check `isConfigured()` before calling upload. The new `app/lib/blob/client.ts` MUST mirror this shape exactly (same function naming convention, same early-return on unconfigured).
- **Why**: Repo consistency + makes test mocking trivial (`vi.mock('@/app/lib/blob/client')`).

### 3.4 Workflow telemetry-batch POST
- **Reference**: `.github/scripts/run-agent.sh` `collect_mistral_telemetry()` (lines ~537-621) already posts JSON to an ai-board endpoint with `Authorization: Bearer $WORKFLOW_API_TOKEN` and retries on transient failure. The capture script MUST reuse the same curl invocation style and the same bounded-retry loop.
- **Why**: One failure model across telemetry and logs — means one runbook.

### 3.5 Scheduled cron workflow structure
- **Reference**: `.github/workflows/nightly-health.yml` — `on: schedule: - cron: '30 0 * * *'`, uses `${{ vars.APP_URL }}` + `${{ secrets.WORKFLOW_API_TOKEN }}`, iterates and tolerates 409 "already in progress." The new `nightly-log-prune.yml` MUST use the same header, same auth, same `continue-on-error: true` per-shard if we ever shard the prune (v1: single shard).
- **Why**: Shared operational mental model.

### 3.6 Idempotent terminal updates with `updateMany`
- **Reference**: `app/api/jobs/[id]/cancel/route.ts:77-86` and `status/route.ts:223-226`. `POST /api/jobs/:id/logs` MUST be idempotent: a duplicate call for the same `jobId` MUST `upsert` rather than error, so a bounded retry from the runner never produces duplicates.
- **Why**: FR-004 ("exactly one log record per terminated job").

### 3.7 Polling & cache-busting
- **Reference**: `app/api/projects/[projectId]/jobs/status/route.ts:133-135` sets `Cache-Control: no-store`. `GET .../logs` MUST do the same (so a just-captured FAILED preview doesn't sit stale in CDN edge for minutes).
- **Why**: Matches the existing polling expectation.

### 3.8 shadcn Sheet with conditional-fetch-on-open
- **Reference**: `components/health/drawer/quality-gate-drawer.tsx` — `useQualityGateDetails(projectId, isOpen)` only fires when `isOpen === true`. `useJobLogRaw(projectId, ticketId, jobId, isOpen)` MUST follow this so closed sheets never consume network/memory.
- **Why**: Per-job log transcripts can be multi-MB; lazy fetch is mandatory.

### 3.9 Timeline event icon/color vocabulary
- **Reference**: `components/activity/activity-item.tsx` `EventIcon()` (lines 116-137) and `components/timeline/job-event-timeline-item.tsx`. Normalized event types in the full-log viewer MUST reuse the same icon family (lucide-react) and the same Catppuccin color tokens for consistency:
  - `message` → `MessageSquare` / `text-ctp-blue`
  - `tool_invocation` → `Wrench` / `text-ctp-mauve`
  - `tool_result` → `CheckCheck` / `text-ctp-green` (or `text-ctp-red` on error)
  - `error` → `XCircle` / `text-ctp-red`
  - `lifecycle` → `Clock` / `text-ctp-overlay-0`
- **Why**: Constitution II (Component-Driven Architecture) — no ad-hoc styling; reuse the token palette.

### 3.10 Never construct Tailwind classes dynamically
- **Reference**: `CLAUDE.md` under "Tailwind Classes". The per-type color mapping MUST be a `const MAP: Record<EventType, string>` returning full literal class strings.

### 3.11 Redaction placeholder visibility
- **Reference**: Spec FR-007 reviewer note. The redactor MUST emit the literal string `[REDACTED:<kind>]` (e.g., `[REDACTED:github_token]`) rather than empty-stringing the match — reviewers see what was elided.

## 4. Open Questions

None. All NEEDS CLARIFICATION markers from the spec's Auto-Resolved Decisions are resolved by decisions 1.1–1.10 above.
