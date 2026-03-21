# Research: AIB-333 Enrich Comparison Dialog

## R1: Telemetry Aggregation Strategy

**Decision**: Aggregate telemetry across ALL completed jobs per ticket (sum for tokens/cost/duration, count for jobs)

**Rationale**: The current `getComparisonDetailForTicket()` only fetches the *latest* job per ticket via `distinct: ['ticketId']`. The spec requires aggregating across ALL jobs. This requires changing the query from `distinct` single-job fetch to a full aggregation using Prisma `aggregate` or manual summation.

**Alternatives considered**:
1. Prisma `groupBy` with `_sum`/`_count` — Clean but requires separate query per aggregate
2. Fetch all jobs per ticket and sum in application code — More flexible, handles mixed states (partial indicator)
3. Raw SQL with SUM/COUNT — Avoided per constitution (Prisma parameterized queries only)

**Resolution**: Use Prisma `groupBy` with `_sum` and `_count` for tokens, cost, duration, and job count. This is the most efficient approach and stays within Prisma's type-safe query system.

## R2: Primary AI Model Identification

**Decision**: Show the most frequently used model across all jobs for a ticket

**Rationale**: Most tickets use a single model. For multi-model edge cases, the mode (most frequent) provides a clear single identifier. The current Job schema has a `model` field (String?).

**Alternatives considered**:
1. Show latest job's model — Simpler but may miss the dominant model
2. Show comma-separated list — Clutters the column header
3. Show mode (most frequent) — Best balance of clarity and accuracy

**Resolution**: Query all jobs per ticket, group by model, pick the one with highest count. If tied, pick the model from the most recent job.

## R3: Quality Score Popover Implementation

**Decision**: Use shadcn/ui Popover component with adapted QualityScoreSection layout

**Rationale**: The existing `QualityScoreSection` uses a Collapsible pattern. For the comparison grid, a Popover triggered by clicking the quality score cell is more appropriate. The dimension data structure (`QualityScoreDetails`) and rendering logic can be reused.

**Alternatives considered**:
1. Reuse QualityScoreSection directly — Layout doesn't fit popover context
2. Create entirely new component — Duplicates logic unnecessarily
3. Extract shared dimension rendering, compose into Popover — Best reuse with correct UX

**Resolution**: Create a `QualityScorePopover` component that extracts the dimension rendering from `QualityScoreSection` patterns and wraps it in a shadcn Popover. Requires fetching `qualityScoreDetails` JSON from the latest verify job.

## R4: Quality Score Details Data Flow

**Decision**: Extend the comparison detail API to include `qualityScoreDetails` JSON for FULL workflow participants that passed VERIFY

**Rationale**: Currently, `getComparisonDetailForTicket()` only fetches `qualityScore` (integer) from verify jobs. The popover needs the full `qualityScoreDetails` JSON string to display dimension breakdowns. This requires adding `qualityScoreDetails` to the verify job select clause.

**Alternatives considered**:
1. Separate API call to fetch details on popover open — Extra round trip, poor UX
2. Include in existing comparison detail response — Minimal payload increase, immediate availability

**Resolution**: Add `qualityScoreDetails` to the verify job query in `getComparisonDetailForTicket()`. Extend `ComparisonParticipantDetail` type with a `qualityScoreDetails` field.

## R5: Horizontal Scroll with Sticky Column

**Decision**: Use CSS `overflow-x-auto` with `position: sticky; left: 0` on the label column

**Rationale**: Native CSS sticky positioning is well-supported and requires no JS. The metric labels column stays fixed while ticket columns scroll horizontally.

**Alternatives considered**:
1. JS-based scroll synchronization — Over-engineered for this use case
2. CSS sticky positioning — Simple, performant, well-supported
3. Virtualized table — Overkill for max 6 columns + 7 rows

**Resolution**: Wrap the table in a `div` with `overflow-x-auto`. Apply `sticky left-0 bg-card z-10` to the first column cells.

## R6: Best Value Highlighting for Operational Metrics

**Decision**: Compute best-value flags client-side from the enrichment data

**Rationale**: The existing implementation metrics already use `bestValueFlags` computed at persistence time. For operational metrics (telemetry), the data is enriched at query time, so best-value computation should happen client-side to avoid storing volatile telemetry snapshots.

**Alternatives considered**:
1. Compute server-side in the API — Adds complexity to enrichment logic
2. Compute client-side from available enrichment values — Simple, reactive, no storage needed

**Resolution**: Client-side utility function that takes all participants' telemetry and returns best-value flags per metric. Lowest wins for tokens/cost/duration/job count; highest wins for quality. Ties: highlight all tied values or omit indicator.

## R7: Mixed Job States (Partial Indicator)

**Decision**: Show aggregated data from completed jobs with a "Partial" indicator when some jobs are still in progress

**Rationale**: The spec edge case requires handling mixed states. A ticket may have 3 completed jobs and 1 running job. Show the sum of completed jobs but indicate data is incomplete.

**Resolution**: Check if any job for the ticket has status PENDING or RUNNING. If yes and completed jobs exist, mark telemetry state as 'available' but add a `partial` flag. The UI shows values with a "Partial" suffix/indicator.

## R8: Section Ordering Change

**Decision**: Insert Operational Metrics between Implementation Metrics and Decision Points

**Rationale**: Spec FR-014 requires order: Ranking → Implementation Metrics → Operational Metrics → Decision Points → Compliance Grid. Currently: Ranking → Metrics → Decision Points → Compliance. Just need to insert the new section.

**Resolution**: Add `<ComparisonOperationalMetrics>` component between `<ComparisonMetricsGrid>` and `<ComparisonDecisionPoints>` in `comparison-viewer.tsx`.
