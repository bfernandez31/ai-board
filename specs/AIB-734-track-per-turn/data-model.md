# Data Model: Track Per-Turn Context Size On Jobs

## Entity: Job Context Metrics

**Stored on**: `Job`

| Field | Type | Nullable | Source | Notes |
|------|------|----------|--------|-------|
| `peakContextSize` | `Int` | Yes | derived from supported turn-level telemetry | Primary risk signal |
| `averageContextSize` | `Int` | Yes | derived from supported turn-level telemetry | Supporting metric shown beside peak |
| `turnCount` | `Int` | Yes | derived from supported turn-level telemetry | Number of model turns used to compute the aggregate |

### Validation rules

- All three fields are nullable.
- Persist the set only for jobs whose telemetry includes compatible turn-level context measurements.
- Do not backfill historical jobs.
- Do not infer zeros for unsupported agents or partial payloads.
- Values must be non-negative integers.
- `turnCount` must be greater than zero when the context metric set is present.
- `averageContextSize` should not exceed `peakContextSize` after normalization.

### Lifecycle

1. Job starts with all context metric fields `null`.
2. Supported telemetry arrives through `POST /api/telemetry/v1/logs`.
3. OTLP normalization extracts turn-level context sizes and derives peak, average, and turn count.
4. `Job` is updated with the context metric set alongside existing telemetry fields.
5. Unsupported or unusable telemetry leaves the context metric set `null`.

## Derived Entity: Context Risk Band

**Stored**: No, derived from `Job.peakContextSize`

| Value | Meaning |
|-------|---------|
| `HEALTHY` | Peak context stayed below the healthy threshold |
| `WARNING` | Peak context crossed the warning threshold |
| `DANGER` | Peak context crossed the danger threshold |

### Validation rules

- Only derive the band when `peakContextSize` is present.
- Thresholds must be defined in one shared helper so ticket timeline and analytics use the same mapping.
- Average context and turn count never override the band; they only add supporting detail.

## Derived Entity: Quality Score Bucket

**Stored**: No, derived from `Job.qualityScore`

| Bucket | Rule |
|--------|------|
| `HIGH` | score in the top configured band |
| `MEDIUM` | score in the middle configured band |
| `LOW` | score in the lower configured band |
| excluded | `qualityScore` is null |

### Validation rules

- Only jobs with a non-null `qualityScore` can participate in quality-bucket comparisons.
- Jobs lacking a quality score remain visible in other analytics views but must be counted as excluded for this comparison.

## Derived Entity: Context Analytics Slice

**Stored**: No, built at query time

Represents the filtered subset of completed jobs used to render context analytics.

### Inputs

- `projectId`
- time range
- outcome filter
- effective agent filter
- command filter
- workflow type filter
- optional quality-score bucket filter/grouping

### Rules

- Base eligibility requires completed or failed jobs already included by the existing analytics logic.
- Context distribution views only include jobs where `peakContextSize` is not null.
- Quality-bucket comparison excludes jobs with null `qualityScore`.
- Empty slices return valid empty arrays plus counts/messaging metadata rather than errors.

## Relationships

- `Project` 1:N `Ticket`
- `Ticket` 1:N `Job`
- `Job` optionally carries one context metric set
- `Job` optionally carries one quality score used for bucketed comparisons

## Schema impact

Planned Prisma change on `Job`:

```prisma
peakContextSize    Int?
averageContextSize Int?
turnCount          Int?
```

These fields belong beside the existing normalized telemetry fields because the API and analytics already treat `Job` as the queryable telemetry record.
