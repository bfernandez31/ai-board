# Data Model: Comparison Mission Control Dashboard

**Feature Branch**: `AIB-355-redesign-comparison-dialog`
**Date**: 2026-03-26

## Overview

This feature does not change the database schema. It formalizes the existing comparison-detail payload and the frontend presentation states the redesigned dashboard will consume.

## Entity Definitions

### Comparison Result

The top-level comparison detail returned by the existing detail endpoint.

| Field | Type | Source | Notes |
|-------|------|--------|------|
| `id` | number | existing API | Comparison record identifier |
| `generatedAt` | string | existing API | Timestamp shown in dialog shell |
| `sourceTicketId` | number | existing API | Source ticket for authorization/history context |
| `sourceTicketKey` | string | existing API | Source ticket label shown in hero metadata |
| `summary` | string | existing API | High-level comparison summary |
| `overallRecommendation` | string | existing API | Recommendation copy for winner hero |
| `keyDifferentiators` | string[] | existing API | Short hero evidence chips |
| `winnerTicketId` | number | existing API | Authoritative winning participant |
| `winnerTicketKey` | string | existing API | Winner label |
| `participants` | `Comparison Participant[]` | existing API | Ranked participants, 2-6 visible in one session |
| `decisionPoints` | `Decision Point[]` | existing API | Ordered accordion sections |
| `complianceRows` | `Compliance Row[]` | existing API | Principle-by-participant matrix |

Validation rules:
- Must include at least 2 participants for the redesigned comparison flow.
- Exactly one `winnerTicketId` must match one participant.
- Participant order is authoritative for ranking and tie-breaking presentation.

### Comparison Participant

A ranked ticket being compared in the dashboard.

| Field | Type | Notes |
|-------|------|------|
| `ticketId` | number | Stable participant identity |
| `ticketKey` | string | Primary visible label |
| `title` | string | Supporting label in hero/card layouts |
| `stage` | enum | Existing ticket stage display context |
| `workflowType` | enum | Existing workflow context |
| `agent` | string \| null | Optional workflow agent label |
| `rank` | number | Determines hero vs non-winner cards |
| `score` | number | Overall comparison score |
| `rankRationale` | string | Short rationale shown in summary areas |
| `quality` | `EnrichmentValue<number>` | Headline and matrix quality score |
| `qualityBreakdown` | `EnrichmentValue<QualityScoreDetails>` | Existing interactive breakdown |
| `telemetry` | `ComparisonTelemetryEnrichment` | Cost, duration, token, and job metrics |
| `metrics` | `ComparisonMetricSnapshot` | Implementation metrics and best-value flags |

Validation rules:
- `rank` must be unique across participants in one result.
- `score` is displayed for every participant and drives score-band styling.
- `quality`, `telemetry`, and detailed metrics must preserve `available`, `pending`, and `unavailable` distinctions.

### Metric Comparison Row

A normalized dashboard row comparing one metric across all participants.

| Field | Type | Notes |
|-------|------|------|
| `key` | string | Stable metric identifier |
| `label` | string | Visible row/header name |
| `category` | `headline` \| `detail` | Headline cards vs unified matrix |
| `bestDirection` | `highest` \| `lowest` \| `none` | How relative emphasis is computed |
| `participantValues` | array | One value per participant in rank order |
| `supportsPopover` | boolean | True for quality score rows |

Metrics included by design:
- Headline: `costUsd`, `durationMs`, `qualityScore`, `filesChanged`
- Detail: `linesChanged`, `filesChanged`, `testFilesChanged`, `totalTokens`, `inputTokens`, `outputTokens`, `durationMs`, `costUsd`, `jobCount`, `qualityScore`

Validation rules:
- All participants must appear in every rendered row, even when values are pending or unavailable.
- Relative emphasis must be stable for zero values, ties, and identical values.
- The row-label column must remain identifiable during horizontal scrolling.

### Compliance Assessment

A principle outcome for one participant.

| Field | Type | Notes |
|-------|------|------|
| `participantTicketId` | number | Participant reference |
| `participantTicketKey` | string | Visible label |
| `status` | `pass` \| `mixed` \| `fail` \| `missing` | `missing` is a UI-derived neutral state when no cell exists |
| `notes` | string | Supporting explanation, visible without hover-only dependency |

Validation rules:
- Stored API rows provide `pass`, `mixed`, or `fail`; the UI must derive `missing` when an assessment is absent for a participant.
- Missing assessments must use neutral treatment, not success/failure treatment.

### Decision Point

An ordered comparison checkpoint with per-participant approaches.

| Field | Type | Notes |
|-------|------|------|
| `id` | number | Stable accordion key |
| `title` | string | Visible summary heading |
| `verdictTicketId` | number \| null | Decision-level winning participant, if any |
| `verdictSummary` | string | Visible before expansion |
| `rationale` | string | Expanded explanatory text |
| `displayOrder` | number | First row opens by default |
| `participantApproaches` | `DecisionPointApproach[]` | Per-ticket summaries |

Validation rules:
- The first decision point by `displayOrder` opens by default when any decision data exists.
- Expanded content must preserve which participant each approach belongs to and whether it aligns with the overall winner.

## State Handling

### Enrichment Value States

| State | Meaning | UI Treatment |
|-------|---------|-------------|
| `available` | Numeric/detail value exists | Eligible for relative emphasis and popovers |
| `pending` | Data may arrive later | Neutral label and copy; never styled as best/worst |
| `unavailable` | Data does not exist | Neutral label and copy; never styled as best/worst |

### Derived Presentation States

| State | Derivation | Purpose |
|-------|------------|---------|
| `winner` | `participant.ticketId === winnerTicketId` | Hero and headline emphasis |
| `nonWinner` | All other participants | Ranked comparison cards |
| `bestValue` | Existing `bestValueFlags` or computed best direction | Relative metric emphasis |
| `missingCompliance` | No compliance cell for participant/row | Neutral compliance cell |
| `supportsWinner` | `verdictTicketId === winnerTicketId` | Decision verdict cue |
| `divergesFromWinner` | `verdictTicketId !== null && verdictTicketId !== winnerTicketId` | Trade-off cue in decision section |

## Relationships

- One `Comparison Result` has many `Comparison Participants`.
- One `Comparison Result` has many `Metric Comparison Rows` derived from participant data.
- One `Comparison Result` has many `Compliance Rows`, each of which maps to many participant assessments.
- One `Comparison Result` has many ordered `Decision Points`.

## State Transitions

Presentation state transitions only; no persisted lifecycle changes:

```text
Dialog closed
  -> check endpoint resolves
  -> detail endpoint resolves
  -> dashboard renders winner hero + participant summaries + matrices
  -> user reviews compliance notes / decision details
  -> history selection swaps comparison detail
```
