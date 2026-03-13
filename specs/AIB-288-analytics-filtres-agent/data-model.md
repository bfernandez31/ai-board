# Data Model: Analytics Filters by Agent and Status

## Overview

This feature introduces no new database tables. It extends the derived analytics domain model built from existing `Project`, `Ticket`, and `Job` records.

## Entities

### AnalyticsFilterState

- **Purpose**: Canonical filter combination applied to the analytics dashboard.
- **Fields**:
  - `timeRange`: enum `7d | 30d | 90d | all`
  - `statusScope`: enum `shipped | closed | shipped+closed`
  - `agentScope`: string enum value `all | CLAUDE | CODEX`
  - `periodLabel`: user-facing label derived from `timeRange` such as `Last 7 days`, `Last 30 days`, `Last 90 days`, `All time`
- **Validation rules**:
  - `timeRange` must match the existing analytics range enum.
  - `statusScope` must match one of the three specification-defined options.
  - `agentScope` must be `all` or one of the project's available effective agents.

### AgentOption

- **Purpose**: Stable set of agents that can be selected for the project.
- **Fields**:
  - `value`: enum `CLAUDE | CODEX`
  - `label`: display label
  - `jobCount`: non-negative integer representing project-wide jobs attributed to that agent
- **Relationships**:
  - Derived from `Job` records joined through `Ticket` and `Project`.
- **Validation rules**:
  - Only include agents with at least one recorded job in the project.
  - Do not prune options when the date range changes.

### EffectiveJobAnalyticsRecord

- **Purpose**: Internal derived record used to decide whether a job contributes to filtered analytics.
- **Fields**:
  - `jobId`: integer
  - `projectId`: integer
  - `ticketId`: integer
  - `status`: enum `COMPLETED | FAILED | PENDING | RUNNING | CANCELLED`
  - `completedAt`: nullable datetime
  - `ticketStage`: enum `SHIP | CLOSED | ...`
  - `effectiveAgent`: enum `CLAUDE | CODEX`
  - `costUsd`, `durationMs`, `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheCreationTokens`, `toolsUsed`
- **Relationships**:
  - `Job.ticketId -> Ticket.id`
  - `Ticket.projectId -> Project.id`
- **Validation rules**:
  - `effectiveAgent = ticket.agent ?? project.defaultAgent`
  - The record contributes only when `ticketStage` is included by `statusScope`
  - Time filtering uses `completedAt` for job-derived metrics

### TicketStatusSummary

- **Purpose**: Summary-card projection for shipped and closed counts.
- **Fields**:
  - `shippedCount`: non-negative integer
  - `closedCount`: non-negative integer
  - `label`: same `periodLabel` string from `AnalyticsFilterState`
- **Relationships**:
  - Derived from `Ticket` records constrained by project, date range, status scope, and effective agent.
- **Validation rules**:
  - `shippedCount` counts only tickets in `SHIP`
  - `closedCount` counts only tickets in `CLOSED`
  - Date filtering uses the ticket stage timestamp already represented by `updatedAt` / `closedAt` according to implementation choice documented in code
  - Counts return `0` instead of omitting the card when no tickets match

### AnalyticsResponse

- **Purpose**: Filter-aware API payload returned to the dashboard.
- **Fields**:
  - Existing analytics collections: `overview`, `costOverTime`, `costByStage`, `tokenUsage`, `cacheEfficiency`, `topTools`, `workflowDistribution`, `velocity`, `generatedAt`, `jobCount`, `hasData`
  - New metadata: `filters`, `availableAgents`
- **Validation rules**:
  - `filters` always reflects the normalized values actually applied by the server
  - `availableAgents` is always returned, including empty/zero-data states
  - All metric collections must be calculated from the same normalized `AnalyticsFilterState`

## State Transitions

### Dashboard filter transitions

1. Initial load:
   - `timeRange = query param or 30d`
   - `statusScope = shipped`
   - `agentScope = all`
2. User changes any filter:
   - Normalize query param
   - Recompute all analytics collections and summary cards from the same filter state
   - Preserve the other filter values
3. No-match state:
   - Keep `filters` and `availableAgents`
   - Return zeroed summaries and empty arrays where appropriate
   - Set `hasData` to `false` only when no job-derived analytics remain for the active scope
