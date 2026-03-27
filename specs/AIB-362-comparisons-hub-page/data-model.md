# Data Model: Comparisons Hub Page With Project List, Inline Detail, and VERIFY Launch

## Overview

This feature reuses existing Prisma models. No schema migration is planned. The new page works from project-scoped projections of current comparison, ticket, comment, and job records.

## Entity: ProjectComparisonSummary

- Source: `ComparisonRecord` joined with `winnerTicket`, `sourceTicket`, and ordered `participants`
- Purpose: Paginated browsing row for `/projects/[projectId]/comparisons`
- Fields:
  - `id: number`
  - `projectId: number`
  - `generatedAt: string`
  - `sourceTicketId: number`
  - `sourceTicketKey: string`
  - `winnerTicketId: number`
  - `winnerTicketKey: string`
  - `winnerTicketTitle: string`
  - `participantTicketIds: number[]`
  - `participantTicketKeys: string[]`
  - `summary: string`
  - `overallRecommendation: string`
  - `keyDifferentiators: string[]`
  - `markdownPath: string`
- Validation rules:
  - Ordered newest-first by `generatedAt DESC`
  - `keyDifferentiators` must normalize JSON to a string array with safe fallbacks when partially missing
  - Pagination bounds must be positive and capped

## Entity: ProjectComparisonDetail

- Source: `ComparisonRecord` plus `participants.metricSnapshot`, `decisionPoints`, `complianceAssessments`, and live verify-job enrichments
- Purpose: Inline dashboard payload for one selected comparison
- Fields:
  - All summary fields above
  - `participants: ComparisonParticipantDetail[]`
  - `decisionPoints: ComparisonDecisionPoint[]`
  - `complianceRows: ComparisonComplianceRow[]`
  - `overallRecommendation: string`
  - `summary: string`
- Relationships:
  - One `ComparisonRecord` has many `ComparisonParticipant`
  - One `ComparisonRecord` has many `DecisionPointEvaluation`
  - One `ComparisonParticipant` has one optional `TicketMetricSnapshot`
  - One `ComparisonParticipant` has many `ComplianceAssessment`
- Validation rules:
  - The selected comparison must belong to the requested project
  - Authorization is by project access, not by an arbitrary participant ticket
  - Missing comparison rows return `404`

## Entity: VerifyComparisonCandidate

- Source: `Ticket` in stage `VERIFY` plus latest verify `Job`
- Purpose: Selectable candidate row in the launch flow
- Fields:
  - `id: number`
  - `ticketKey: string`
  - `title: string`
  - `stage: "VERIFY"`
  - `updatedAt: string`
  - `branch: string | null`
  - `qualityScore: { state: "available" | "pending" | "unavailable"; value: number | null }`
- Validation rules:
  - Candidate ticket must belong to the requested project
  - Candidate ticket must currently be in `VERIFY`
  - Tickets remain eligible even when `qualityScore.state !== "available"`
  - Candidate list is ordered by `updatedAt DESC`, then `id DESC`

## Entity: ComparisonLaunchRequest

- Source: Derived from newly created `Comment` + `Job` records and selected VERIFY tickets
- Purpose: Tracks a hub-initiated comparison while the workflow is running
- Fields:
  - `jobId: number`
  - `commentId: number`
  - `projectId: number`
  - `sourceTicketId: number`
  - `sourceTicketKey: string`
  - `selectedTicketIds: number[]`
  - `selectedTicketKeys: string[]`
  - `status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED"`
  - `commentContent: string`
  - `createdAt: string`
- Validation rules:
  - Request must include 2-5 unique ticket IDs
  - Every selected ticket must be in the same project and currently in `VERIFY`
  - The deterministic source ticket is chosen from the selected set by `updatedAt DESC`, then `id ASC`
  - Remaining selected ticket keys become `/compare` references in `commentContent`

## State Transitions

### ComparisonLaunchRequest

1. `VALIDATING`
   - Server-only transient state while checking auth, project membership, uniqueness, and stage eligibility
2. `PENDING`
   - `Job` created with command `comment-verify`
   - Workflow dispatch requested
3. `RUNNING`
   - Existing workflow updates the job status
4. `COMPLETED`
   - Workflow persisted a durable `ComparisonRecord`; hub should invalidate list/detail queries
5. `FAILED` or `CANCELLED`
   - Hub keeps the failed request visible with an actionable error state

## Derived Relationships

- A hub-launched comparison is visible to all selected tickets because `ComparisonRecord` history checks both `sourceTicketId` and participant membership.
- The project hub does not require a new persistence table because durable history is represented by `ComparisonRecord`, while in-flight work is represented by `Job`.
- Existing ticket-detail comparison history remains valid because the same durable comparison records continue to back both entry points.
