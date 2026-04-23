# Research: Capture and display agent execution logs

## Existing Files

### Source files

| Path | What it covers today | Extend or Create |
|------|----------------------|------------------|
| `prisma/schema.prisma` | `Job` persistence, telemetry fields, workflow run id, existing nullable `logs` string | Extend with dedicated log relation and explicit availability enum; do not expand `Job.logs` into the full transcript store |
| `app/api/jobs/[id]/status/route.ts` | Workflow-authenticated status callback, atomic transition guard, terminal completion hooks | Extend for terminal log coordination and idempotent interactions with the new log upload path |
| `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` | Ticket-scoped job list with telemetry fields for the ticket modal/stats tab | Extend with summary/availability metadata for readable previews |
| `app/api/projects/[projectId]/tickets/[id]/timeline/route.ts` | Unified timeline read path combining comments and job lifecycle events | Extend so job events include preview-safe log summary data |
| `app/lib/utils/conversation-events.ts` | Converts `Job` rows into timeline events and message labels | Extend to attach summary payload and preserve sorting semantics |
| `app/lib/types/conversation-event.ts` | Typed discriminated union for timeline items | Extend with log preview fields instead of adding ad hoc objects in components |
| `app/lib/hooks/queries/use-conversation-timeline.ts` | Timeline query/polling contract | Extend to consume the richer job event shape |
| `app/lib/query-keys.ts` | Query key registry for project/ticket data | Extend with a dedicated job-log detail key |
| `components/board/ticket-detail-modal.tsx` | Existing ticket modal tabs, nested dialogs, comments/files/stats surfaces | Extend to host the full-log dialog and route entry points through existing ticket UI |
| `components/ticket/jobs-timeline.tsx` | Job rows with telemetry, cancel action, and collapsible details | Extend with preview summary and `View full logs` actions |
| `components/timeline/job-event-timeline-item.tsx` | Job start/complete timeline rendering | Extend to show condensed log preview and retained/unavailable state |
| `components/ticket/ticket-stats.tsx` | Merges polled job status with full job payloads | Extend only through `TicketJobWithTelemetry` additions; keep current merge pattern |
| `.github/scripts/run-agent.sh` | Multi-agent installation/authentication/invocation plus provider-specific telemetry capture | Extend to synthesize terminal log bundles from provider-native output |
| `.github/workflows/speckit.yml` | Main stage workflow with status callbacks and OTLP env wiring | Extend to upload terminal logs before success/failure/cancel callbacks |
| `.github/workflows/quick-impl.yml` | Quick-impl workflow with the same status callback pattern | Extend with the same upload ordering |
| `.github/workflows/iterate.yml` | Iteration workflow with status callbacks | Extend with log upload ordering |
| `.github/workflows/verify.yml` | Verify workflow with terminal quality-score callback | Extend so log upload happens before the final status patch |
| `.github/workflows/ai-board-assist.yml` | AI assist workflow with ticket job lifecycle callbacks | Extend for upload ordering and multi-agent parity |
| `lib/telemetry/otlp-processor.ts` | Provider-agnostic telemetry aggregation for tokens, tools, cost, duration | Reuse parsing knowledge/patterns; keep metrics ingestion separate from full log artifact storage |
| `lib/db/tickets.ts` | Ticket duplication copies `Job` rows including `job.logs` | Extend so heavy detailed log artifacts are not duplicated with cloned jobs |
| `app/lib/db/notifications.ts` | Existing 30-day retention cleanup example | Reuse pruning pattern semantics for job logs |

### Test files

| Path | What it covers today | Extend or Create |
|------|----------------------|------------------|
| `tests/integration/jobs/status.test.ts` | Status callback semantics, idempotence, terminal state handling | Extend for upload sequencing and terminal callback interactions |
| `tests/integration/jobs/ticket-jobs.test.ts` | Ticket job payload shape and telemetry fields | Extend for summary metadata and log availability states |
| `tests/integration/tickets/timeline.test.ts` | Timeline merge behavior, access, BigInt serialization | Extend for summary preview data on job events |
| `tests/unit/components/ticket-detail-modal.test.tsx` | Ticket modal action visibility and modal reactivity | Extend for full-log CTA visibility and dialog behavior |
| `tests/unit/components/ticket-stats.test.tsx` | Stats tab and jobs timeline rendering | Extend for preview summaries and unavailable/pruned states |
| `tests/integration/telemetry/agent-agnostic.test.ts` | Provider telemetry parsing across Claude/Codex/Gemini/Mistral | Extend only if shared parsing utilities move; otherwise keep isolated |
| `tests/integration/tickets/duplicate.test.ts` | Ticket duplication semantics | Extend to assert full log artifacts are not copied during clone |
| `tests/integration/jobs/logs.test.ts` | No existing coverage | Create because upload + full retrieval + retention does not fit cleanly in the status or ticket-jobs suites |
| `tests/unit/job-log-normalizer.test.ts` | No existing coverage | Create because provider transcript normalization is a new pure-function domain |

The constitution requirement "Search existing tests FIRST - extend, don't duplicate" is satisfied by extending the five established job/timeline/modal files above before introducing only two new test files for genuinely new domains.

## Patterns to Follow

### Error handling patterns

1. **Atomic transition before side effects**
   - Reference: `app/api/jobs/[id]/status/route.ts:220-287`
   - Pattern: use a conditional `updateMany` gate on the current status, re-read when a race loses, and run terminal side effects only after the winning update succeeds.
   - Apply here: `POST /api/jobs/[id]/logs` should be idempotent per job and must not create duplicate detail artifacts if workflows retry terminal callbacks.

2. **External dispatch failure cleanup**
   - Reference: `lib/workflows/transition.ts:349-367`
   - Pattern: if the external GitHub dispatch fails after the app creates a `Job`, delete/repair the orphaned DB row before returning the error.
   - Apply here: if a future combined status+upload flow creates placeholder log state before upload succeeds, failed external steps must not leave the UI falsely claiming logs are available.

3. **Non-blocking telemetry/log side work**
   - Reference: `.github/scripts/run-agent.sh:537-621`
   - Pattern: provider-specific collection runs after command execution, logs failures, and does not mask the job's primary outcome.
   - Apply here: terminal log upload can improve observability but must not rewrite a genuine `FAILED` or `CANCELLED` job into an application-level error state.

4. **Structured route errors with auth-specific codes**
   - Reference: `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts:69-180`
   - Pattern: validate input first, branch auth failures into 401/403/404 explicitly, log context, and use structured `{ error, code }` bodies.
   - Apply here: the new read route must distinguish unauthorized access, missing logs, and pruned logs without leaking project existence.

### Security patterns

1. **Project-member read authorization**
   - Reference: `lib/db/auth-helpers.ts:30-86`
   - Pattern: reuse owner-or-member helpers rather than hand-rolled checks in each route.
   - Apply here: `GET /api/projects/[projectId]/jobs/[jobId]/logs` should verify project access through existing helpers and confirm the job belongs to the requested project.

2. **Workflow bearer-token write authorization**
   - Reference: `app/api/jobs/[id]/status/route.ts:55-65` and `app/api/telemetry/v1/logs/route.ts:39-44`
   - Pattern: all workflow-originated writes are gated by `validateWorkflowAuth()` before any payload work occurs.
   - Apply here: `POST /api/jobs/[id]/logs` must use the same bearer-token path and never accept session auth.

3. **Secret material stays in env or credential files, not payloads**
   - Reference: `.github/workflows/quick-impl.yml:214-241` and `.github/scripts/run-agent.sh:691-699`
   - Pattern: credentials are loaded into env or provider config files and masked immediately.
   - Apply here: provider transcript capture must exclude auth material, raw headers, and credential files from persisted events and summaries.

### State management and UI patterns

1. **Timeline payload built server-side, serialized once**
   - Reference: `app/api/projects/[projectId]/tickets/[id]/timeline/route.ts:108-148`
   - Pattern: fetch related records, enrich them once, and serialize `BigInt` safely before returning a single query payload.
   - Apply here: preview summaries should be joined server-side with job events instead of requiring client-side waterfall fetches for each row.

2. **Lightweight polling data merged into richer cached objects**
   - Reference: `components/ticket/ticket-stats.tsx:157-184`
   - Pattern: merge fast-changing status fields from polling into stable, richer job payloads rather than replacing full objects.
   - Apply here: log summary availability should live on the full job payload; 2-second status polling should not become the transport for the full preview/detail artifact.

3. **Nested modal inside ticket detail modal**
   - Reference: `components/board/ticket-detail-modal.tsx:1381-1445`
   - Pattern: child viewers are conditionally rendered only while the parent dialog is open.
   - Apply here: the full-log dialog should follow the same hosting pattern as `DocumentationViewer` and `ComparisonViewer`.

4. **Query hook polling defaults**
   - Reference: `app/lib/hooks/queries/use-conversation-timeline.ts:56-74`
   - Pattern: stable query keys, explicit `staleTime`, and polling only on the list route, not on-demand detail views.
   - Apply here: full log retrieval should be a fetch-on-open query with no background polling.

## Decisions

### Decision 1: Store full logs in a dedicated compressed artifact model, not on `Job`

- Decision: Add a dedicated `JobExecutionLog` relation with compressed payload bytes, summary metadata, and retention fields; keep `Job` focused on status/telemetry and query-friendly summary fields only.
- Rationale:
  - `prisma/schema.prisma` already shows `Job` is the hot operational row for polling and status updates.
  - The spec explicitly forbids letting full transcripts cause disproportionate growth in the primary transactional database surface.
  - A separate relation allows summary joins without loading full payload bytes and enables pruning without rewriting job history.
- Alternatives considered:
  - Reuse `Job.logs`: rejected because it turns the hot row into the transcript store and collides with existing duplication behavior in `lib/db/tickets.ts`.
  - External object storage: rejected for now because this codebase has no existing blob-store integration to reuse in the current stack.

### Decision 2: Capture logs post-execution in the workflow runner, not via live UI polling

- Decision: Extend `.github/scripts/run-agent.sh` to collect provider-native execution output during the run and upload a normalized terminal bundle before the workflow sends the final success/failure/cancel status patch.
- Rationale:
  - The spec explicitly scopes this feature to post-completion observability.
  - `run-agent.sh` is already the single abstraction point for Claude/Codex/Mistral/Gemini invocation and provider telemetry differences.
  - Existing workflows already have well-defined terminal callback steps where upload ordering can be enforced consistently.
- Alternatives considered:
  - Real-time streaming into the app: rejected because it is out of scope and would complicate partial consistency.
  - Derive full logs later from OTLP telemetry alone: rejected because current telemetry focuses on metrics/tools and does not preserve readable message/output context.

### Decision 3: Normalize provider output into ordered events plus a small summary

- Decision: Define a common event model for message, tool, warning, error, and terminal status records; generate a compact `logSummary` for previews and keep provider-specific metadata on detailed events.
- Rationale:
  - The spec requires a consistent multi-agent display model while preserving provider context when normalization is imperfect.
  - Existing timeline and job-row components need lightweight preview data, not a full transcript blob.
- Alternatives considered:
  - Store and render raw provider text only: rejected because the UI cannot provide a consistent cross-agent reading experience.
  - Strip all provider-specific metadata: rejected because it would hide debugging context that the spec explicitly preserves in detail view.

### Decision 4: Use existing ticket surfaces, with timeline preview plus on-demand dialog

- Decision: Surface summaries in existing ticket job views and open the full transcript from a nested dialog in the ticket detail modal.
- Rationale:
  - The spec requires reuse of the current ticket inspection experience.
  - `components/board/ticket-detail-modal.tsx`, `components/ticket/jobs-timeline.tsx`, and `components/timeline/job-event-timeline-item.tsx` already own the relevant UI.
- Alternatives considered:
  - Add a new top-level ticket tab just for logs: rejected because it would split job context away from existing timeline and telemetry surfaces.
  - Inline the full transcript directly in the timeline: rejected because it harms scanability and contradicts the summary-first requirement.

### Decision 5: Prune detailed payloads after 30 days but preserve audit metadata

- Decision: Keep summary metadata and prune only compressed detail bytes after the retention threshold, marking the artifact `PRUNED`.
- Rationale:
  - This satisfies the 30-day minimum while preserving clear user-facing audit state.
  - `app/lib/db/notifications.ts` already establishes the project's retention-cleanup pattern.
- Alternatives considered:
  - Hard-delete the entire record: rejected because the UI could no longer distinguish pruned logs from failed capture.
  - Retain all detail indefinitely: rejected because it conflicts with the storage-growth constraint.

### Decision 6: Do not duplicate retained log artifacts when tickets are cloned

- Decision: Full ticket clone may continue copying `Job` telemetry snapshots, but it must not duplicate the new detailed log artifact rows.
- Rationale:
  - `lib/db/tickets.ts` already copies jobs as point-in-time snapshots; cloning large detailed logs would multiply storage without adding operational value.
  - The feature is about reviewing the original execution, not replaying that transcript on derived tickets.
- Alternatives considered:
  - Copy all log artifacts into cloned jobs: rejected because it inflates storage and muddies provenance.
  - Delete job telemetry too: rejected because existing clone behavior intentionally preserves job snapshots.

