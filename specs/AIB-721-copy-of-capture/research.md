# Research: Capture and Display Agent Execution Logs

**Branch**: `AIB-721-copy-of-capture` | **Date**: 2026-04-23

## Existing Files

### Source Files — Will Be Modified

| File | What It Covers | Action |
|------|---------------|--------|
| `prisma/schema.prisma` (lines 29-68) | Job model with existing `logs` field (unused TEXT) | Add `JobLog` model, `LogStatus` enum, new fields on Job |
| `app/lib/job-update-validator.ts` (lines 20-25) | Zod schema for job status updates | No change — log upload uses a separate endpoint |
| `app/api/jobs/[id]/status/route.ts` | PATCH job status (workflow auth) | Minor: trigger log summary generation after status update if logs were uploaded first |
| `app/api/projects/[projectId]/tickets/[id]/timeline/route.ts` (lines 110-119) | Timeline API — fetches jobs excluding SHIP | Include `logSummary` and `logStatus` in job select clause |
| `app/lib/types/conversation-event.ts` | ConversationEvent types (Job, Comment) | No change needed — Job type from Prisma already includes new fields |
| `app/lib/utils/conversation-events.ts` | Merge/sort timeline events | No change — job events already carry the full Job object |
| `components/timeline/job-event-timeline-item.tsx` (lines 1-159) | Renders job start/complete events | Extend completion events to show log preview and "View full logs" link |
| `lib/types/job-types.ts` (lines 45-68) | TicketJobWithTelemetry interface | Add `logStatus`, `logSummary` fields |
| `.github/scripts/run-agent.sh` (line 384) | Agent execution — stdout goes to console | Wrap agent invocation with `tee` to capture output to file |
| `.github/workflows/speckit.yml` (lines 425-512) | Execute Spec-Kit Command step | Add "Upload Agent Logs" step after execution |
| `.github/workflows/quick-impl.yml` | Quick-impl workflow | Add log capture and upload step |
| `.github/workflows/verify.yml` | Verify workflow | Add log capture and upload step |
| `.github/workflows/iterate.yml` | Iterate workflow | Add log capture and upload step |
| `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` | GET ticket jobs with telemetry | Include `logStatus` in select |

### Source Files — New

| File | What It Will Cover |
|------|-------------------|
| `app/api/jobs/[id]/logs/route.ts` | POST (upload logs, workflow auth) + GET (retrieve logs, session auth) |
| `lib/logs/log-parser.ts` | Agent-specific output parsers → common LogEntry format |
| `lib/logs/log-summarizer.ts` | Generate condensed preview from normalized entries |
| `lib/logs/log-truncator.ts` | Size-aware truncation preserving beginning + end |
| `lib/logs/types.ts` | LogEntry, NormalizedLog, LogSummary type definitions |
| `components/timeline/log-preview.tsx` | Inline log preview in timeline completion events |
| `components/logs/log-viewer.tsx` | Full log detail view (drawer/dialog) |
| `components/logs/log-entry-row.tsx` | Individual log entry rendering with icon + timestamp |
| `app/lib/hooks/queries/use-job-logs.ts` | TanStack Query hook for fetching full logs |
| `lib/logs/prune-expired-logs.ts` | Pruning logic for logs older than 30 days |
| `app/api/cron/prune-logs/route.ts` | CRON endpoint for scheduled pruning |

### Test Files — Will Be Extended

| File | Current Coverage | Extension |
|------|-----------------|-----------|
| `tests/integration/jobs/status.test.ts` (~22 tests) | Job status transitions, quality score | Add: log status reflects correctly after upload |
| `tests/integration/tickets/timeline.test.ts` (~7 tests) | Timeline events, BigInt serialization | Add: log summary appears in timeline response, logStatus filtering |
| `tests/integration/jobs/ticket-jobs.test.ts` (~6 tests) | Telemetry fields retrieval | Add: logStatus field in response |

### Test Files — New

| File | Coverage |
|------|----------|
| `tests/integration/jobs/job-logs.test.ts` | POST/GET log endpoints, size limits, truncation, auth, pruning |
| `tests/unit/log-parser.test.ts` | Agent-specific parsing for all 4 agents |
| `tests/unit/log-summarizer.test.ts` | Summary generation from normalized entries |
| `tests/unit/log-truncator.test.ts` | Truncation boundary preservation |
| `tests/unit/components/log-preview.test.tsx` | Inline preview rendering, empty/pruned states |
| `tests/unit/components/log-viewer.test.tsx` | Full log viewer rendering, scroll, formatting |

## Patterns to Follow

### 1. Workflow Auth + Atomic Update Pattern (from `app/api/jobs/[id]/status/route.ts`)

**Error handling**: The status endpoint validates workflow auth first (line 57-64), then validates request body with Zod (line 91), then does an atomic conditional update with `updateMany` + `where: { id, status: currentStatus }` (lines 223-226) to prevent race conditions. The log upload endpoint MUST follow this same pattern:
- Validate workflow auth via `validateWorkflowAuth(request)`
- Validate body with Zod schema
- Use conditional `updateMany` or check job exists before creating log record

**Resilience**: Status update failures are logged but don't crash the workflow (curl uses `|| echo "⚠️ Failed..."` at speckit.yml:690). Log upload MUST use the same resilience pattern — failure must not block status reporting.

### 2. Timeline Data Flow Pattern (from `app/api/.../timeline/route.ts`)

**Job select**: Timeline fetches all jobs with `prisma.job.findMany()` (line 110-119) without specifying a `select` clause — returns ALL fields. For the log feature, this means `logSummary` and `logStatus` will automatically be included once added to the Job model. The full log content lives in `JobLog` (separate table), so timeline queries remain lightweight.

**BigInt serialization**: Timeline uses a custom JSON replacer for BigInt (workflowRunId) at lines 142-146. This pattern must be preserved when the response includes any BigInt fields.

### 3. Job Event Rendering Pattern (from `components/timeline/job-event-timeline-item.tsx`)

**Structure**: Each timeline item is a `<li className="relative pl-12">` containing a `TimelineBadge` (left icon) and `TimelineContent` (right text). The component is wrapped in `React.memo` for performance (line 133). The log preview should be added INSIDE the `TimelineContent` wrapper, below the existing status text, only for completion events where `logStatus === 'AVAILABLE'`.

**Color mapping**: Status-specific colors use Tailwind classes directly (e.g., `text-green-500`, `text-red-500`). Log previews for failed jobs should use `text-red-500` for error text.

### 4. Telemetry Persistence Pattern (from OTLP processor)

**Separate ingestion**: Telemetry is uploaded via a dedicated OTLP endpoint (`POST /api/telemetry/v1/logs`) independent of the job status update. This validates the design of a separate log upload endpoint — the system already handles auxiliary data arriving asynchronously from the status update.

**Aggregation**: Telemetry aggregates multiple OTLP batches into a single Job record. For logs, we do a simpler write-once: the full output is captured and uploaded once after the agent exits.

### 5. Agent Output Capture Pattern (from `.github/scripts/run-agent.sh`)

**Current state**: Each `invoke_*` function runs the agent CLI directly. Output goes to GitHub Actions console (transient). For capture:
- Claude (line 384): `claude --dangerously-skip-permissions "/$COMMAND ..."` — pipe through `tee`
- Codex (line 508): `echo "$prompt" | codex exec ...` — pipe through `tee`
- Mistral (line 663): `vibe --prompt "..." --agent auto-approve` — pipe through `tee`
- Gemini (line 736): `gemini "--prompt=..." --approval-mode=yolo` — pipe through `tee`

Each invocation must preserve exit codes when piping through `tee` (use `set -o pipefail` — already set via `set -euo pipefail` at line 2).

### 6. Quality Score Upload Pattern (from verify.yml lines 711-758)

The verify workflow parses structured markers from agent output to extract quality scores. This is the closest existing pattern to log upload — extracting data from agent output and sending it to the API. For logs, the workflow will:
1. Read the captured output file
2. Base64-encode or chunk if needed (for safe JSON transport)
3. POST to the log upload endpoint

## Key Decisions

### Decision 1: Separate `JobLog` Table vs. Inline on Job

- **Decision**: Create a separate `JobLog` model for full log content
- **Rationale**: FR-004 requires not degrading job listing performance. Job queries (timeline, status polling, ticket jobs) would fetch multi-MB payloads if stored inline. The existing `Job.logs` field will be repurposed as `logSummary` (short preview text, <2KB).
- **Alternatives considered**: Using the existing `Job.logs` TEXT field for everything. Rejected because timeline API returns all job fields — adding multi-MB content would break the 2s polling performance target.

### Decision 2: Dedicated Log Upload Endpoint vs. Extending Status Update

- **Decision**: New `POST /api/jobs/:id/logs` endpoint for log upload
- **Rationale**: FR-015 requires log capture to be resilient — if upload fails, the job status must still update correctly. A separate endpoint allows the workflow to attempt log upload independently, and failure doesn't block the status PATCH. Also avoids sending multi-MB payloads in the status update curl.
- **Alternatives considered**: Adding `logs` field to `jobStatusUpdateSchema`. Rejected because (1) couples log upload to status transition, (2) multi-MB JSON body in curl is fragile, (3) violates FR-015 resilience requirement.

### Decision 3: Output Capture via `tee` in `run-agent.sh`

- **Decision**: Modify each `invoke_*` function to pipe agent output through `tee` to a file while preserving console output
- **Rationale**: Centralizes capture logic in one script (handles all 4 agents). `tee` preserves real-time console output for debugging while saving to file. `pipefail` already enabled.
- **Alternatives considered**: (1) Workflow-level redirect (`step > file`). Rejected because it would lose console output. (2) Agent-native logging flags. Rejected because not all agents support this consistently.

### Decision 4: Log Normalization at Upload Time (Server-Side)

- **Decision**: Raw agent output is sent to the API; the server normalizes it using agent-specific parsers
- **Rationale**: Keeps workflow changes minimal (just capture + upload raw text). Parser logic is easier to test, iterate, and fix in application code than in bash scripts. The `agentType` field on the upload request tells the parser which format to expect.
- **Alternatives considered**: Client-side (workflow) normalization using bash/jq scripts. Rejected because parsing 4 different agent formats in bash is fragile and hard to test.

### Decision 5: Fixed 30-Day Retention with CRON Pruning

- **Decision**: Automatic pruning via scheduled CRON endpoint, 30-day fixed retention
- **Rationale**: Matches the spec's conservative decision. Simple, predictable, no per-project config needed. The CRON endpoint is idempotent — safe to retry on failure.
- **Alternatives considered**: Per-project configurable retention. Rejected per spec's auto-resolved decision deferring this to a future feature.

### Decision 6: Log Size Limit — 5MB with Boundary-Preserving Truncation

- **Decision**: Maximum 5MB per log payload. Truncation preserves first 25% and last 25%, with a "[truncated]" marker in the middle.
- **Rationale**: Agent runs can produce multi-MB output (especially implement commands). 5MB covers typical runs while preventing storage abuse. Preserving start (setup/context) and end (final status/errors) provides the most diagnostic value per FR-013.
- **Alternatives considered**: 1MB limit. Rejected as too restrictive for implement runs. 10MB limit. Rejected as unnecessary storage cost.
