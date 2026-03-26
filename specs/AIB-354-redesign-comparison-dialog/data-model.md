# Data Model: Redesign Comparison Dialog

## Overview

This is a **UI-only redesign** — no database schema changes, no API changes, no new types. All data is sourced from the existing `ComparisonDetail` interface and its nested types.

## Existing Entities (No Changes)

### ComparisonDetail
The root data object for the dialog. Contains all metadata, participants, decision points, and compliance rows.

| Field | Type | Usage in Redesign |
|-------|------|-------------------|
| `id` | `number` | Internal reference |
| `generatedAt` | `string` | Displayed as muted text in hero card |
| `sourceTicketKey` | `string` | Displayed as muted text in hero card |
| `summary` | `string` | Not directly displayed (absorbed into recommendation) |
| `overallRecommendation` | `string` | Hero card recommendation summary |
| `keyDifferentiators` | `string[]` | Hero card badges |
| `winnerTicketId` | `number` | Determines hero card participant + verdict dot colors |
| `winnerTicketKey` | `string` | Hero card prominent ticket key |
| `participants` | `ComparisonParticipantDetail[]` | All sections |
| `decisionPoints` | `ComparisonDecisionPoint[]` | Decision points section |
| `complianceRows` | `ComparisonComplianceRow[]` | Compliance heatmap |

### ComparisonParticipantDetail
Per-participant data. Winner is identified by matching `ticketId === detail.winnerTicketId`.

| Field | Type | Used In |
|-------|------|---------|
| `ticketId` | `number` | Winner identification, key prop |
| `ticketKey` | `string` | Hero card, participant cards, table headers |
| `title` | `string` | Participant cards |
| `workflowType` | `WorkflowType` | Participant card badges |
| `agent` | `string \| null` | Participant card badges |
| `rank` | `number` | Participant cards |
| `score` | `number` | Score gauge/ring, stat pills |
| `rankRationale` | `string` | Participant card rationale text |
| `quality` | `ComparisonEnrichmentValue<number>` | Stat cards, quality popover trigger |
| `qualityBreakdown` | `ComparisonEnrichmentValue<QualityScoreDetails>` | Quality popover content |
| `telemetry.costUsd` | `ComparisonEnrichmentValue<number>` | Hero stat pills, stat cards, unified table |
| `telemetry.durationMs` | `ComparisonEnrichmentValue<number>` | Hero stat pills, stat cards, unified table |
| `telemetry.totalTokens` | `ComparisonEnrichmentValue<number>` | Unified table |
| `telemetry.inputTokens` | `ComparisonEnrichmentValue<number>` | Unified table |
| `telemetry.outputTokens` | `ComparisonEnrichmentValue<number>` | Unified table |
| `telemetry.jobCount` | `ComparisonEnrichmentValue<number>` | Unified table |
| `metrics.linesChanged` | `number \| null` | Unified table |
| `metrics.filesChanged` | `number \| null` | Stat cards, unified table |
| `metrics.testFilesChanged` | `number \| null` | Unified table |
| `metrics.bestValueFlags` | `Record<string, boolean>` | Unified table best highlighting |

### ComparisonDecisionPoint
Structured evaluation for each decision point.

| Field | Type | Used In |
|-------|------|---------|
| `id` | `number` | Key prop |
| `title` | `string` | Accordion title |
| `verdictTicketId` | `number \| null` | Verdict dot color (compare to winnerTicketId) |
| `verdictSummary` | `string` | Visible without expanding |
| `rationale` | `string` | Expanded content |
| `displayOrder` | `number` | Sort order, first accordion default open |
| `participantApproaches` | `ComparisonDecisionPointApproach[]` | Expanded content with ticket key pills |

### ComparisonComplianceRow
Principle-level compliance assessment.

| Field | Type | Used In |
|-------|------|---------|
| `principleKey` | `string` | Key prop |
| `principleName` | `string` | Heatmap row label |
| `displayOrder` | `number` | Sort order |
| `assessments` | `ComparisonComplianceCell[]` | Heatmap cell colors and tooltip content |

### ComparisonComplianceCell
Per-participant assessment within a compliance row.

| Field | Type | Used In |
|-------|------|---------|
| `participantTicketId` | `number` | Match to participant column |
| `status` | `'pass' \| 'mixed' \| 'fail'` | Cell background color |
| `notes` | `string` | Tooltip content |

## Derived Data (Computed Client-Side)

These values are computed in component logic, not stored:

| Derived Value | Source | Computation |
|---------------|--------|-------------|
| Winner participant | `participants`, `winnerTicketId` | `participants.find(p => p.ticketId === winnerTicketId)` |
| Non-winner participants | `participants`, `winnerTicketId` | `participants.filter(p => p.ticketId !== winnerTicketId)` |
| Score gauge color | `participant.score` | Threshold-based: green >=85, blue 70-84, yellow 50-69, red <50 |
| Metric bar width % | Metric value, max across participants | `(value / maxValue) * 100` |
| Best metric value | All participant values for a metric | `Math.min()` or `Math.max()` depending on metric direction |
| Verdict dot color | `decisionPoint.verdictTicketId`, `winnerTicketId` | Match → green, non-null mismatch → yellow, null → neutral |
| Stat card values | Winner participant fields | Direct field access from winner participant |

## Validation Rules

No new validation — all data arrives pre-validated from the API via existing Zod schemas in `lib/comparison/comparison-payload.ts`.

## State Transitions

No state transitions — this is a read-only display component. The only interactive state is:
- Accordion open/close (local component state)
- Tooltip visibility (handled by shadcn Tooltip)
- Quality popover open/close (handled by shadcn Popover)
