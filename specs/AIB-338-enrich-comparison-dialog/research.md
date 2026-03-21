# Research: AIB-338 Enrich Comparison Dialog

## R1: Aggregate operational metrics from live job records instead of new snapshot tables

**Decision**: Extend the comparison detail read path to aggregate all jobs for each comparison participant at request time, rather than adding new Prisma tables for telemetry snapshots.

**Rationale**:
- `Job` already stores the raw telemetry needed for totals, duration, cost, model attribution, quality score, and quality details.
- `ComparisonRecord` currently snapshots ranking context and implementation metrics only; adding telemetry snapshot tables would increase schema and migration scope without being required by the spec.
- Request-time aggregation keeps the dialog aligned with the latest ticket execution state, which matters for pending versus unavailable labeling.

**Alternatives considered**:
- Persist aggregated telemetry on `ComparisonParticipant`: rejected because it requires schema changes and risks stale values when jobs continue running after a saved comparison exists.
- Fetch all ticket jobs client-side from `/api/projects/{projectId}/tickets/{id}/jobs`: rejected because the dialog already has a structured comparison detail API and server-side normalization keeps pending-state rules consistent.

## R2: Treat operational metrics as a separate comparison section with server-computed best-value flags

**Decision**: Add a dedicated Operational Metrics section after Implementation Metrics, with best-value flags computed on the server and returned in the comparison detail payload.

**Rationale**:
- The spec requires the existing section order to remain intact while inserting a new section.
- Best-value rules differ by metric direction, so server-side computation avoids duplicating comparison logic across components and tests.
- A separate section keeps the existing implementation-metrics grid stable and makes the operational metrics requirements easier to test in isolation.

**Alternatives considered**:
- Fold operational metrics into `ComparisonMetricsGrid`: rejected because it would blur code-change metrics with job telemetry and complicate the required section ordering.
- Compute best flags in the client: rejected because it increases UI logic and creates risk of inconsistent handling of unavailable or pending values.

## R3: Distinguish pending from unavailable using all jobs, not just the latest job

**Decision**: For each aggregated metric, mark the value as `pending` when at least one relevant job exists but the aggregate is not yet final due to in-progress execution or missing terminal telemetry, and mark it `unavailable` only when no relevant job can ever provide that metric.

**Rationale**:
- The current comparison detail flow only inspects the latest job and cannot satisfy the spec’s “still running” versus “will never exist” distinction.
- Using the full job set is necessary to avoid showing zero or blank values for tickets with mixed completed and running history.
- The same state model can be reused for tokens, duration, cost, job count, model summary, and quality summary/details eligibility.

**Alternatives considered**:
- Treat null telemetry on any job as unavailable: rejected because jobs can still be running or telemetry can be backfilled at completion.
- Treat missing values as zero: rejected because the spec explicitly forbids representing missing or pending values as completed zeroes.

## R4: Determine the primary model by execution-share dominance and otherwise label the ticket as multi-model

**Decision**: Compute model attribution from completed jobs only, using a weighted execution-share heuristic based on total tokens, then duration, then job count; return a single model only when one model is clearly dominant, otherwise return a `"Multiple models"` label.

**Rationale**:
- The existing telemetry extractor chooses the most frequent model, but the spec requires dominance by the largest share of execution activity.
- Tokens are the strongest available proxy for execution activity; duration and job count provide deterministic fallback when token totals are absent.
- A distinct multi-model label avoids misleading users when jobs switched models over time.

**Alternatives considered**:
- Use the latest job’s model: rejected because the feature aggregates across all jobs.
- Use most-frequent model only: rejected because a short burst of jobs could outweigh a smaller number of more expensive or longer runs.

## R5: Reuse existing quality-score parsing and expose detail eligibility explicitly

**Decision**: Reuse `parseQualityScoreDetails()` and `getScoreThreshold()` from `lib/quality-score.ts`, and extend the comparison detail payload with both a quality summary and an explicit detail-availability object.

**Rationale**:
- The repository already stores `qualityScoreDetails` as JSON on verify jobs and already has shared parsing helpers.
- The comparison UI needs to distinguish three states: summary-only, detail available, and detail unavailable/ineligible.
- Returning a normalized detail object from the API keeps the UI simple and enables integration tests to assert eligibility rules directly.

**Alternatives considered**:
- Parse `qualityScoreDetails` in the client: rejected because the client would still need workflow and eligibility logic tied to ticket/job state.
- Show details for any ticket with `qualityScoreDetails`: rejected because the spec limits detail interactivity to eligible FULL workflow tickets with completed verify results.

## R6: Use an inline detail tray inside the Operational Metrics card for quality breakdown

**Decision**: The quality row should open an inline detail tray within the Operational Metrics card, below the comparison table, keyed to the selected ticket.

**Rationale**:
- The spec asks for an in-place detail view inside the comparison dialog, not a second modal.
- An inline tray preserves table context, works for 2-6 ticket comparisons, and avoids nested overlays on mobile.
- The pattern is simpler to test than a nested dialog and matches the card-based comparison layout.

**Alternatives considered**:
- Nested dialog: rejected because it breaks the “in-place” requirement and adds modal stacking complexity.
- Row expansion per cell: rejected because it becomes awkward in horizontally scrolling tables with up to six ticket columns.

## R7: Testing mix should be helper unit tests, component tests, integration route tests, and one targeted E2E for overflow behavior

**Decision**: Cover aggregation and flag logic with unit tests, cover the ranking card and Operational Metrics UI with RTL component tests, extend the comparison detail route integration test for the enriched payload, and add one browser-based E2E for horizontal scrolling behavior.

**Rationale**:
- Aggregation and dominance logic are pure data transformations and belong in unit tests.
- The comparison dialog cards and metrics grid are user-facing React components and fit component tests.
- The enriched API contract is easiest to validate through integration tests against Prisma-backed fixtures.
- Horizontal scrolling/readability across desktop and mobile is genuinely browser-dependent and justifies one focused Playwright test.

**Alternatives considered**:
- E2E-only coverage: rejected because it is slower and weaker at validating aggregation edge cases.
- No E2E coverage: rejected because jsdom cannot reliably validate native mobile/desktop overflow behavior.
