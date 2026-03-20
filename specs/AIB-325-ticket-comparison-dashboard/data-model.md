# Data Model: Ticket Comparison Dashboard

## Overview

This feature adds durable comparison history to the existing ticket comparison system. The persistence layer stores only comparison-specific facts created by a `/compare` run and links back to existing `Project`, `Ticket`, and `Job` data for live enrichment.

## Entity: ComparisonRecord

Represents one completed `/compare` run.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `id` | `Int` | Yes | Primary key |
| `projectId` | `Int` | Yes | FK to `Project`; all participants must belong to this project |
| `sourceTicketId` | `Int` | Yes | FK to `Ticket`; provenance for the initiating context |
| `winnerTicketId` | `Int` | Yes | FK to `Ticket`; saved winner for this run |
| `markdownPath` | `String` | Yes | Relative path to backward-compatible markdown artifact |
| `summary` | `String` | Yes | Short saved summary of the comparison outcome |
| `overallRecommendation` | `String` | Yes | Saved recommendation text |
| `keyDifferentiators` | `Json` | Yes | Ordered list of differentiators displayed in the dashboard |
| `generatedAt` | `DateTime` | Yes | Time the comparison run completed |
| `createdAt` | `DateTime` | Yes | Record creation timestamp |

**Validation rules**:
- `projectId`, `sourceTicketId`, and all participant tickets must belong to the same project.
- `markdownPath` must point to the markdown report generated for the same run.
- Record is immutable after creation for normal users.

**Relationships**:
- belongs to one `Project`
- belongs to one source `Ticket`
- belongs to one winner `Ticket`
- has many `ComparisonParticipant`
- has many `DecisionPointEvaluation`

## Entity: ComparisonParticipant

Join entity linking a comparison record to each participating ticket.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `id` | `Int` | Yes | Primary key |
| `comparisonRecordId` | `Int` | Yes | FK to `ComparisonRecord` |
| `ticketId` | `Int` | Yes | FK to `Ticket` |
| `rank` | `Int` | Yes | 1-based ranking order |
| `score` | `Int` | Yes | Saved overall score for this comparison |
| `workflowTypeAtComparison` | `WorkflowType` | Yes | Snapshot for display consistency |
| `agentAtComparison` | `Agent?` | No | Snapshot of selected agent if available |
| `rankRationale` | `String` | Yes | Concise reason for rank placement |
| `createdAt` | `DateTime` | Yes | Record creation timestamp |

**Validation rules**:
- Unique on (`comparisonRecordId`, `ticketId`)
- `rank` must be positive and unique within a comparison
- `score` stored as integer percentage 0-100

**Relationships**:
- belongs to one `ComparisonRecord`
- belongs to one `Ticket`
- has one `TicketMetricSnapshot`
- has many `ComplianceAssessment`

## Entity: TicketMetricSnapshot

Stores comparison-time code metrics that are not authoritative elsewhere.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `id` | `Int` | Yes | Primary key |
| `comparisonParticipantId` | `Int` | Yes | Unique FK to `ComparisonParticipant` |
| `linesAdded` | `Int?` | No | Nullable when unavailable |
| `linesRemoved` | `Int?` | No | Nullable when unavailable |
| `linesChanged` | `Int?` | No | Nullable when unavailable |
| `filesChanged` | `Int?` | No | Nullable when unavailable |
| `testFilesChanged` | `Int?` | No | Nullable when unavailable |
| `changedFiles` | `Json` | Yes | Array of changed file paths; may be empty |
| `bestValueFlags` | `Json` | Yes | Per-metric flags for UI highlighting where meaningful |
| `createdAt` | `DateTime` | Yes | Record creation timestamp |

**Validation rules**:
- One snapshot per participant per comparison
- Nullable numeric values represent unavailable data, never zero-by-default

## Entity: DecisionPointEvaluation

Captures one saved implementation choice analysis within the comparison.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `id` | `Int` | Yes | Primary key |
| `comparisonRecordId` | `Int` | Yes | FK to `ComparisonRecord` |
| `title` | `String` | Yes | Decision point label |
| `verdictTicketId` | `Int?` | No | FK to `Ticket` when one approach wins |
| `verdictSummary` | `String` | Yes | Short verdict statement |
| `rationale` | `String` | Yes | Comparative rationale |
| `participantApproaches` | `Json` | Yes | Ordered per-ticket approach summaries |
| `displayOrder` | `Int` | Yes | Stable UI order |
| `createdAt` | `DateTime` | Yes | Record creation timestamp |

**Validation rules**:
- `displayOrder` unique within one comparison
- `participantApproaches` must include each participating ticket once

## Entity: ComplianceAssessment

Stores per-principle comparison compliance for one participant.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `id` | `Int` | Yes | Primary key |
| `comparisonParticipantId` | `Int` | Yes | FK to `ComparisonParticipant` |
| `principleKey` | `String` | Yes | Stable identifier such as `typescript-first-development` |
| `principleName` | `String` | Yes | Display label from constitution |
| `status` | `String` | Yes | `pass`, `mixed`, or `fail` |
| `notes` | `String` | Yes | Saved justification shown in the grid |
| `displayOrder` | `Int` | Yes | Stable row order |
| `createdAt` | `DateTime` | Yes | Record creation timestamp |

**Validation rules**:
- Unique on (`comparisonParticipantId`, `principleKey`)
- `status` constrained to UI-supported values

## Relationships

```text
Project 1 --- * ComparisonRecord
Ticket 1 --- * ComparisonParticipant
ComparisonRecord 1 --- * ComparisonParticipant
ComparisonParticipant 1 --- 1 TicketMetricSnapshot
ComparisonRecord 1 --- * DecisionPointEvaluation
ComparisonParticipant 1 --- * ComplianceAssessment
```

## Read-Time Enrichment Model

The comparison detail response joins these persisted entities with live data from existing tables:

- `Ticket`: current title, stage, branch, preview URL, and closure/shipping state
- `Job`: latest available telemetry and verify quality score for each participant

These live fields are nullable in the response and represented as:

- `available`: value is present
- `pending`: data may arrive later
- `unavailable`: data is absent and not expected from current state

## State Transitions

Comparison records are append-only.

1. `/compare` completes successfully.
2. Markdown artifact is generated.
3. `ComparisonRecord` and child entities are inserted transactionally.
4. Record becomes read-only history available from every participating ticket.

No update or delete path is planned for normal users.
