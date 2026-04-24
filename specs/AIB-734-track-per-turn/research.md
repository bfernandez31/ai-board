# Research: Track Per-Turn Context Size On Jobs To Analyze Context Rot Impact On Quality

## Research Notes

The workflow asked for research-agent dispatch. I completed the research locally because this environment does not permit spawning sub-agents without an explicit user request. The resulting decisions below resolve the design unknowns and tie them to existing code paths.

## Existing Files

### Telemetry ingestion and job persistence

- `prisma/schema.prisma`
  Covers the canonical `Job` telemetry schema today. Extend this model with three nullable context fields rather than creating a separate table because the existing telemetry fields already live directly on `Job`.
- `lib/telemetry/otlp-processor.ts`
  Owns provider-specific OTLP parsing, normalization, merge semantics, and `prisma.job.update()` persistence. Extend this file for supported turn-level context extraction and merge behavior.
- `app/api/jobs/[id]/status/route.ts`
  Owns terminal job completion updates, idempotent transitions, and quality-score persistence. Reuse as a pattern reference for state safety, but context metrics should still be derived from telemetry instead of this endpoint because FR-002 forbids new manual runner instrumentation.

### Ticket timeline / job details

- `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`
  Returns the job payload consumed by the ticket modal. Extend its Prisma `select` shape so context metrics flow to the client.
- `lib/types/job-types.ts`
  Declares `TicketJobWithTelemetry`. Extend this interface with nullable context fields and a typed risk band.
- `components/ticket/jobs-timeline.tsx`
  Renders job rows, expandable telemetry details, and missing-data handling. Extend this component for per-job context metrics and the healthy/warning/danger indicator.

### Analytics

- `app/api/projects/[projectId]/analytics/route.ts`
  Public analytics API entrypoint with Zod-validated filters and `verifyProjectAccess()`. Extend its query schema and response contract for context analytics filters/grouping.
- `lib/analytics/queries.ts`
  Central analytics query and aggregation layer. Extend here for peak-context distribution, workflow/command filters, and quality-bucket logic.
- `lib/analytics/types.ts`
  Source of truth for analytics request/response types consumed by the dashboard.
- `components/analytics/analytics-dashboard.tsx`
  Existing filter UI and chart composition. Extend this file to surface context analytics filters and render new context-specific charts/empty states.
- `components/analytics/empty-state.tsx`
  Shared empty-state card already used by the dashboard. Reuse rather than creating another empty-state component.

### Pattern-reference tests to extend

- `tests/integration/telemetry/agent-agnostic.test.ts`
  Existing provider-ingestion integration suite. Extend for supported turn-level context parsing and unsupported/missing-context null behavior.
- `tests/integration/jobs/ticket-jobs.test.ts`
  Existing API suite for ticket job telemetry fields. Extend for new nullable context fields and omission behavior.
- `tests/integration/analytics/analytics-route.test.ts`
  Existing analytics route suite covering filters, mixed providers, costs incomplete, and `hasData`. Extend for context filters, segmentation, and empty-state slices.
- `tests/integration/analytics/quality-score.test.ts`
  Existing quality-score analytics suite. Extend for quality-bucket segmentation and exclusion of jobs lacking a quality score.
- `tests/unit/components/analytics-dashboard.test.tsx`
  Existing dashboard render/filter suite. Extend for new context controls and no-context empty states.

### Verified gaps where new files are justified

- No existing analytics chart component specifically covers context-size distribution or quality-bucket context comparison. New files are justified at:
  - `components/analytics/context-peak-distribution-chart.tsx`
  - `components/analytics/context-quality-bucket-chart.tsx`
- No existing helper centralizes context-risk band thresholds or quality-bucket labeling. A new helper is justified at `lib/analytics/context-metrics.ts` so API shaping and UI rendering do not duplicate classification logic.

## Patterns To Follow

### Error handling patterns

- `lib/telemetry/otlp-processor.ts:200`
  When a correlated job does not exist, telemetry ingestion logs context and returns `404` instead of mutating anything else.
- `lib/telemetry/otlp-processor.ts:300`
  Unsupported or unparseable provider events do not fail the request; the handler returns accepted/no-op so telemetry never invents data.
- `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts:41`
  Route parameters are validated first, with structured `400/401/403/404/500` responses. The job-context API extension should preserve this exact failure envelope.
- `app/api/projects/[projectId]/analytics/route.ts:37`
  Invalid analytics filters produce `400`, auth failures map to `403/404`, and unexpected errors are logged once. Any new context filter must stay inside this schema-driven validation path.

### Security patterns

- `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts:69`
  Dual auth is explicit: workflow token for automation, session-based `verifyProjectAccess()` for UI. New context fields inherit the same protected route instead of opening a parallel endpoint.
- `app/api/projects/[projectId]/analytics/route.ts:25`
  Project access is enforced before filter parsing or query execution. Context analytics must remain project-scoped only.
- `app/api/jobs/[id]/status/route.ts:49`
  Workflow callbacks are authenticated with `validateWorkflowAuth()` before any state mutation. New context persistence must continue to originate from existing telemetry-authenticated paths only.

### State management and integrity patterns

- `lib/telemetry/otlp-processor.ts:205`
  Existing telemetry updates merge into the current persisted job state, dedupe tools, and build one `updateData` object before `prisma.job.update()`. Context metrics should be merged in the same update pass.
- `lib/telemetry/otlp-processor.ts:311`
  Delta and cumulative provider paths are applied conditionally and in order, with early return on non-200 results. New context logic must not break current provider-specific merge ordering.
- `lib/telemetry/otlp-processor.ts:670`
  Provider normalization happens before persistence. Codex already transforms total input into non-cached input to keep cross-provider semantics aligned; context metrics should similarly normalize supported providers before storage.
- `app/api/jobs/[id]/status/route.ts:223`
  Job status transitions use `updateMany(where: { id, status: currentStatus })` to prevent duplicate terminal callbacks from racing. Context metrics should not introduce a second competing completion-write path.
- `lib/analytics/queries.ts:147`
  Analytics builds one reusable `buildJobWhere()` filter and composes specialized aggregations on top. Context analytics should extend these shared filters rather than forking a separate access/query model.
- `lib/analytics/queries.ts:527`
  Quality-score analytics already excludes jobs without `qualityScore` rather than coercing them into a fake bucket. The new quality-bucket context analysis must preserve that exclusion pattern.

## Decisions

### Decision: Persist context metrics directly on `Job`

- Rationale: The existing telemetry design already stores normalized job-level metrics on `Job`, and both the ticket jobs API and analytics queries read from that table directly. Keeping context metrics on `Job` avoids an unnecessary join table and matches the current product shape.
- Alternatives considered:
  - Separate `JobContextMetrics` table: rejected because the feature adds only three nullable scalar fields and would complicate every existing query path.
  - Store raw turn arrays in `Job.logs` or `JobLog`: rejected because the feature requires queryable analytics, not just forensic access to raw logs.

### Decision: Derive context metrics inside `lib/telemetry/otlp-processor.ts`

- Rationale: FR-002 explicitly forbids new manual runner instrumentation, and the OTLP processor is already the normalization point for provider telemetry before `Job` persistence.
- Alternatives considered:
  - Derive metrics in `PATCH /api/jobs/[id]/status`: rejected because that callback is status-focused and should remain independent from provider-specific telemetry parsing.
  - Backfill from `JobLog` artifacts after completion: rejected because it delays visibility and introduces a second asynchronous consistency path.

### Decision: Supported-provider parsing should be opt-in and null-safe

- Rationale: The spec requires empty values for unsupported agents, historical jobs, and partial telemetry. Existing telemetry behavior already favors accepted/no-op over fabricated values.
- Alternatives considered:
  - Default zeros for unsupported jobs: rejected because it would distort analytics and violate FR-004/FR-005.
  - Reject jobs lacking full context payloads: rejected because telemetry failures must not block job completion.

### Decision: Introduce a shared context-risk classifier helper

- Rationale: The same healthy/warning/danger thresholds will be needed in API shaping, analytics summaries, and ticket timeline rendering. Centralizing the classifier prevents drift and keeps threshold tuning isolated.
- Alternatives considered:
  - Compute risk only in the UI: rejected because analytics contracts also need consistent bucket semantics.
  - Hardcode thresholds in multiple files: rejected because it creates silent divergence risk.

### Decision: Extend the existing analytics contract instead of adding a new route

- Rationale: The spec explicitly scopes the feature into the current analytics experience. The dashboard already polls `/api/projects/[projectId]/analytics` every 15 seconds and already handles gated charts, filters, and empty states.
- Alternatives considered:
  - New `/context-analytics` endpoint: rejected because it duplicates access control, polling, and dashboard state.
  - Post-hoc exported report only: rejected because the primary use case is in-product trend analysis.

### Decision: Model quality comparison as explicit buckets plus excluded counts

- Rationale: FR-011 requires that jobs without quality scores are not merged into a misleading bucket. The existing quality-score analytics already uses exclusion semantics.
- Alternatives considered:
  - Treat null quality as an `"Unknown"` comparison bucket: rejected because it would imply comparability where none exists.
  - Omit excluded counts entirely: rejected because users need to understand why some jobs disappear from that slice.

### Decision: Default initial risk bands from peak context size only

- Rationale: The spec explicitly states that peak context controls the indicator while average and turn count remain supporting metrics. A peak-based band keeps the indicator understandable and stable.
- Alternatives considered:
  - Combine peak and average into one composite score: rejected because it obscures the direct causal signal the spec asks users to inspect.
  - Use turn count alone as the risk indicator: rejected because turn count is only supporting context, not the risk definition.

## Resolved Clarifications

- Supported telemetry source handling: only providers that already emit compatible turn-level context values participate; unsupported providers leave all context fields null.
- Partial payload behavior: persist only when all fields required for the display are trustworthy; otherwise leave the context set null and keep all other telemetry.
- Historical data behavior: no backfill; analytics and timeline treat missing values as unavailable, not zero.
- Analytics surface choice: add context analysis to the existing project analytics page and current ticket jobs timeline.
- Empty-state behavior: when the selected analytics slice has completed jobs but none with context metrics, return a valid empty dataset plus explanatory messaging instead of an error.
