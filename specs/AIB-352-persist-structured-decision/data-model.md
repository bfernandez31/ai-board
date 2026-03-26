# Data Model: Persist Structured Decision Points in Comparison Data

## Overview

This feature does not require a new persistence model. It reuses existing comparison tables and adds a richer typed comparison-report contract so new `DecisionPointEvaluation` rows are saved from decision-specific source data instead of fallback report summaries.

## Persisted Entity: ComparisonRecord

Represents one immutable saved comparison run.

Relevant existing fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `id` | `Int` | Yes | Primary key |
| `projectId` | `Int` | Yes | All participants and decision-point verdict tickets must belong to this project |
| `sourceTicketId` | `Int` | Yes | Ticket that initiated the comparison |
| `winnerTicketId` | `Int` | Yes | Overall winner for the comparison run |
| `compareRunKey` | `String?` | No | Workflow idempotency key |
| `markdownPath` | `String` | Yes | Artifact path for the human-readable report |
| `summary` | `String` | Yes | Report-level summary |
| `overallRecommendation` | `String` | Yes | Report-level recommendation |
| `keyDifferentiators` | `Json` | Yes | Existing alignment-derived differentiators |
| `generatedAt` | `DateTime` | Yes | Run timestamp |

**Role in this feature**:
- Remains the parent entity for saved decision points.
- Continues to store report-level outcome fields separately from per-decision content.

## Persisted Entity: DecisionPointEvaluation

Represents one saved decision point within a comparison.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `id` | `Int` | Yes | Primary key |
| `comparisonRecordId` | `Int` | Yes | FK to `ComparisonRecord` |
| `title` | `String` | Yes | Decision-point label shown in the accordion |
| `verdictTicketId` | `Int?` | No | Winning/preferred ticket for this decision point when one exists |
| `verdictSummary` | `String` | Yes | Decision-specific verdict text |
| `rationale` | `String` | Yes | Decision-specific explanation |
| `participantApproaches` | `Json` | Yes | Ordered per-ticket approach summaries |
| `displayOrder` | `Int` | Yes | Stable order within the comparison |
| `createdAt` | `DateTime` | Yes | Insert timestamp |

**Validation rules**:
- `displayOrder` must remain unique within a comparison.
- New comparisons must populate `title`, `verdictSummary`, and `rationale` from `report.decisionPoints`, not report-level fallback strings.
- `verdictTicketId` may be `null` when the decision point has no single preferred ticket.
- `participantApproaches` may contain fewer entries than total participants only when the generator omitted some tickets; the system must not fabricate the missing rows.

**Legacy compatibility**:
- Existing rows with report-level fallback content remain valid and readable.
- Existing rows with partial or malformed `participantApproaches` continue to normalize through current read-path guards.

## New In-Memory / Payload Entity: ComparisonReportDecisionPoint

New TypeScript and Zod-backed entity added to the comparison-generation contract.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `title` | `string` | Yes | Human-readable decision-point title |
| `verdictTicketKey` | `string \| null` | No | Ticket key for the preferred approach when applicable |
| `verdictSummary` | `string` | Yes | Short decision-specific verdict |
| `rationale` | `string` | Yes | Explanation for the verdict |
| `participantApproaches` | `ComparisonReportDecisionPointApproach[]` | Yes | Ordered list of produced per-ticket summaries |

**Validation rules**:
- Order in the array is the persisted `displayOrder`.
- `verdictTicketKey`, when present, must resolve to one of the compared tickets for the run.
- `participantApproaches[].ticketKey` must resolve to a compared ticket.
- Duplicate participant ticket keys within one decision point should be rejected during normalization.

## New In-Memory / Payload Entity: ComparisonReportDecisionPointApproach

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `ticketKey` | `string` | Yes | Compared ticket identifier |
| `summary` | `string` | Yes | Approach summary scoped to this decision point |

## Relationships

```text
ComparisonRecord 1 --- * DecisionPointEvaluation
DecisionPointEvaluation.verdictTicketId --- 0..1 Ticket
ComparisonReport.decisionPoints[] --- maps directly to --- DecisionPointEvaluation[]
ComparisonReportDecisionPoint.participantApproaches[] --- serialized into --- DecisionPointEvaluation.participantApproaches
```

## State Transitions

### New Comparison

1. Comparison generation produces `ComparisonReport`, including ordered `decisionPoints`.
2. Markdown rendering prints a decision-point section from that same structure.
3. Persistence resolves `verdictTicketKey` and `participantApproaches[].ticketKey` into ticket IDs.
4. `DecisionPointEvaluation` rows are inserted transactionally with the parent `ComparisonRecord`.

### Historical Comparison

1. Existing saved `DecisionPointEvaluation` rows are read as-is.
2. `normalizeDecisionPoints()` filters malformed JSON entries but does not rewrite saved content.
3. Viewer renders the saved fallback content or the empty-state message.

## No Schema Migration Requirement

Current research indicates the existing Prisma schema is already capable of storing the needed decision-point data. Unless implementation discovers a missing column or constraint, this ticket should remain a contract and mapping change rather than a database migration.
