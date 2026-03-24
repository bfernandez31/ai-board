# Research: Enrich comparison dialog with operational metrics and quality data

## Decision 1: Keep the feature on the existing comparison detail endpoint

- Decision: Expand `GET /api/projects/{projectId}/tickets/{ticketId}/comparisons/{comparisonId}` instead of adding a new endpoint.
- Rationale: The dialog already depends on one comparison-detail fetch. Extending that payload keeps authorization, caching, and UI orchestration unchanged while leveraging the current read-time enrichment seam in `lib/comparison/comparison-detail.ts`.
- Alternatives considered:
  - Add a second operational-metrics endpoint: rejected because it would introduce an extra client dependency and split one dialog into multiple failure modes.
  - Persist the new data into comparison tables and read it from the existing payload: rejected because operational telemetry already lives on `Job` and does not need a new snapshot layer for this scope.

## Decision 2: Aggregate operational metrics across all jobs per participant

- Decision: Compute total tokens, input tokens, output tokens, duration, cost, and job count from all jobs associated with each compared ticket.
- Rationale: The spec explicitly rejects latest-job-only behavior. Repo inspection shows the current implementation uses `distinct: ['ticketId']` latest jobs, so this is the main functional gap to close.
- Alternatives considered:
  - Latest completed job only: rejected because it violates FR-007 and misrepresents tickets with multiple jobs.
  - Only terminal jobs: rejected because the spec needs `Pending` when related work exists but aggregates are not final.

## Decision 3: Use explicit per-metric availability states

- Decision: Model each operational metric with `available`, `pending`, or `unavailable` state and surface them as `value`, `Pending`, or `N/A` in the dialog.
- Rationale: The spec distinguishes incomplete telemetry from absent telemetry. The current comparison enrichment already uses similar state values for minimal telemetry and quality.
- Alternatives considered:
  - Null/blank display: rejected because it obscures whether data is missing permanently or still in flight.
  - One shared ticket-level status for all operational metrics: rejected because different metrics can finalize at different times.

## Decision 4: Derive primary model from total token share

- Decision: Choose the model responsible for the largest share of total ticket tokens across included jobs, breaking ties with the most recently completed contributing model.
- Rationale: This matches the spec’s explicit rule and can be implemented from existing `Job.model`, `inputTokens`, `outputTokens`, and `completedAt` fields without schema changes.
- Alternatives considered:
  - Latest job’s model: rejected because it is unstable and can overweight a minor follow-up job.
  - Most frequent model by job count: rejected because a model with many small jobs can still consume fewer tokens overall.

## Decision 5: Enforce stricter comparison-specific quality breakdown eligibility

- Decision: Only expose the inline quality breakdown when the participant is `FULL`, has a completed verify job with a non-null score, and `qualityScoreDetails` parses into all five dimensions defined in `DIMENSION_CONFIG`.
- Rationale: The ticket details UI is more permissive, but the comparison dialog spec is stricter and must prevent partial breakdowns from looking authoritative.
- Alternatives considered:
  - Reuse the ticket page rule (`dimensions.length > 0`): rejected because it allows incomplete or legacy payloads that do not satisfy FR-014 and FR-016.
  - Hide the quality score entirely when details are incomplete: rejected because the spec allows showing summary quality even when the detailed breakdown is unavailable.

## Decision 6: Add a dedicated operational metrics table with a sticky label column

- Decision: Introduce a new `ComparisonOperationalMetricsGrid` component after the existing implementation metrics section.
- Rationale: Existing comparison tables already use horizontal overflow, but they do not support sticky labels, extra ticket-header metadata, interactive quality cells, or the required set of operational rows.
- Alternatives considered:
  - Extend `comparison-metrics-grid.tsx` into a single large component: rejected because it would mix persisted implementation metrics with live operational state and complicate maintenance.
  - Replace the table with stacked cards on mobile: rejected because the spec prioritizes side-by-side comparison for up to six tickets.

## Decision 7: Keep persistence and schema unchanged for this ticket

- Decision: Do not add Prisma schema changes or new comparison snapshot tables in this planning scope.
- Rationale: Repo inspection shows operational fields already exist on `Job`, and comparison records are intentionally persisted with implementation/compliance facts only. The feature is naturally read-side enrichment.
- Alternatives considered:
  - Snapshot operational metrics into `ComparisonParticipant`: rejected because it adds migration cost and historical consistency questions not required by the spec.
  - Add a new materialized summary table: rejected as unnecessary complexity for a dialog-level read path.
