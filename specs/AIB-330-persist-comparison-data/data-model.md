# Data Model: Persist comparison data to database via workflow

## Overview

This feature introduces a workflow handoff layer between `/compare` artifact generation and the existing durable comparison persistence service. No new end-user domain is added; instead, the design formalizes the ephemeral JSON artifact and the workflow persistence request that create an existing `ComparisonRecord` tree safely and repeatably.

## Entity: Comparison JSON Artifact

Ephemeral file written at `specs/{branch}/comparisons/comparison-data.json` for one compare run and deleted after workflow submission.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `compareRunKey` | `String` | Yes | Unique idempotency key for this generated compare run |
| `projectId` | `Int` | Yes | Target project scope for persistence |
| `sourceTicketId` | `Int` | Yes | Database ID for the ticket that initiated `/compare` |
| `sourceTicketKey` | `String` | Yes | Human-readable provenance; must match the source ticket |
| `markdownPath` | `String` | Yes | Relative path to the markdown artifact from the same run |
| `participantTicketIds` | `Int[]` | Yes | Ordered participant ticket IDs for server-side resolution |
| `report` | `ComparisonReport` | Yes | Existing structured compare output |

**Validation rules**:
- `compareRunKey` must be non-empty and unique per generated compare run.
- `markdownPath` must point to the same comparison artifact directory as the current markdown output.
- `participantTicketIds` must contain at least one ticket and must not include tickets outside the scoped project.
- `report.metadata.sourceTicket` and `sourceTicketKey` must align.

## Entity: Comparison Persistence Request

Workflow-authenticated `POST` body submitted to the app.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `compareRunKey` | `String` | Yes | Copied from JSON artifact for retry-safe ingestion |
| `markdownPath` | `String` | Yes | Durable provenance link |
| `participantTicketIds` | `Int[]` | Yes | Used to resolve participant ticket snapshots for persistence |
| `report` | `ComparisonReport` | Yes | Structured comparison payload to persist |

**Validation rules**:
- Path params `projectId` and `ticketId` must match the request body’s scoped source ticket context.
- The source ticket and every participant ticket must exist and belong to the same project.
- The request must be rejected if the payload is malformed, stale, empty, or inconsistent with the scoped ticket.

## Durable Entity: ComparisonRecord

Existing immutable saved compare run created by the persistence service.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `id` | `Int` | Yes | Durable record identifier returned to workflow |
| `projectId` | `Int` | Yes | FK to `Project` |
| `sourceTicketId` | `Int` | Yes | FK to source `Ticket` |
| `winnerTicketId` | `Int` | Yes | Derived from the saved report |
| `markdownPath` | `String` | Yes | Original markdown provenance |
| `summary` | `String` | Yes | Saved summary from report |
| `overallRecommendation` | `String` | Yes | Recommendation text |
| `keyDifferentiators` | `Json` | Yes | Saved differentiators derived from report |
| `generatedAt` | `DateTime` | Yes | Compare-run timestamp from report metadata |

**Validation rules**:
- Created transactionally with participants, metrics, decision points, and compliance rows.
- Never created from malformed or project-mismatched JSON.
- Must remain append-only from normal user flows.

## Durable Entity: ComparisonParticipant

Existing participant row created for each compared ticket.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `ticketId` | `Int` | Yes | FK to participant `Ticket` |
| `rank` | `Int` | Yes | Derived ranking order |
| `score` | `Int` | Yes | Derived comparison score |
| `workflowTypeAtComparison` | `WorkflowType` | Yes | Snapshot of workflow type |
| `agentAtComparison` | `Agent?` | No | Optional snapshot |
| `rankRationale` | `String` | Yes | Saved rationale |

## Durable Entity: TicketMetricSnapshot

Existing comparison-time metric snapshot attached to one participant.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `linesAdded` | `Int?` | No | Nullable when unavailable |
| `linesRemoved` | `Int?` | No | Nullable when unavailable |
| `linesChanged` | `Int?` | No | Nullable when unavailable |
| `filesChanged` | `Int?` | No | Nullable when unavailable |
| `testFilesChanged` | `Int?` | No | Nullable when unavailable |
| `changedFiles` | `Json` | Yes | Array of changed file paths |
| `bestValueFlags` | `Json` | Yes | UI-highlight flags |

## Durable Entity: DecisionPointEvaluation

Existing saved decision analysis row.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `title` | `String` | Yes | Decision point label |
| `verdictTicketId` | `Int?` | No | Winning participant for this point |
| `verdictSummary` | `String` | Yes | Short verdict |
| `rationale` | `String` | Yes | Reasoning summary |
| `participantApproaches` | `Json` | Yes | Ordered per-ticket approach summaries |
| `displayOrder` | `Int` | Yes | Stable rendering order |

## Durable Entity: ComplianceAssessment

Existing per-principle compliance assessment row.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `principleKey` | `String` | Yes | Stable identifier |
| `principleName` | `String` | Yes | Display label |
| `status` | `String` | Yes | `pass`, `mixed`, or `fail` |
| `notes` | `String` | Yes | Saved explanation |
| `displayOrder` | `Int` | Yes | Stable order |

## Relationships

```text
Workflow compare run
  -> Comparison JSON Artifact
  -> Comparison Persistence Request
  -> ComparisonRecord
       -> ComparisonParticipant*
            -> TicketMetricSnapshot?
            -> ComplianceAssessment*
       -> DecisionPointEvaluation*
```

## State Transitions

1. `/compare` generates markdown successfully.
2. `/compare` attempts to serialize `comparison-data.json`.
3. Workflow checks for the JSON artifact.
4. If absent, workflow logs skip and exits successfully.
5. If present, workflow `POST`s the payload to the persistence endpoint.
6. Endpoint validates auth, scope, and payload consistency.
7. Endpoint creates one durable comparison record transactionally, or rejects without writes.
8. Workflow deletes `comparison-data.json`.
9. Workflow logs success or failure category and still completes successfully for the markdown artifact.
