# Data Model: Activity Heatmap on Projects Page

## Overview

The feature is read-only. It derives a workspace-wide heatmap from existing `Project`, `ProjectMember`, `Ticket`, and `Job` records. No Prisma schema changes are required.

## Source Entities

### Project

- Source: `prisma/schema.prisma`
- Relevant fields:
  - `id`
  - `userId`
  - `defaultAgent`
- Relevant relationship:
  - `members`

Usage:
- Determines workspace visibility (owner or member access).
- Supplies fallback agent identity when `Ticket.agent` is null.

### Ticket

- Source: `prisma/schema.prisma`
- Relevant fields:
  - `id`
  - `projectId`
  - `stage`
  - `updatedAt`
  - `agent`

Usage:
- Supplies shipped-ticket counts by day when `stage = 'SHIP'`.
- Contributes effective agent scope using `ticket.agent ?? project.defaultAgent`.

Validation / rules:
- A shipped ticket contributes to the selected day when its shipped completion timestamp is inferred from `updatedAt`.
- A ticket contributes to an agent scope when its effective agent matches the selected filter.

### Job

- Source: `prisma/schema.prisma`
- Relevant fields:
  - `id`
  - `ticketId`
  - `projectId`
  - `startedAt`
  - `costUsd`
  - `status`

Usage:
- Supplies daily activity intensity by counting jobs started that day.
- Supplies per-day total recorded cost by summing non-null `costUsd`.

Validation / rules:
- Every qualifying job counts toward `jobCount`, even when `costUsd` is null.
- Job status does not exclude the job from activity if it started in range; the source-of-truth rule is execution start.

## Derived Read Models

### ProjectsActivityHeatmapResponse

Represents the full workspace heatmap payload returned to the page and client refetches.

Fields:
- `view`: `YearViewOption`
- `availableViews`: `YearViewOption[]`
- `filters`:
  - `agent`: `AgentScopeValue`
- `availableAgents`: `AgentScopeOption[]`
- `summary`:
  - `jobCount: number`
  - `ticketsShipped: number`
  - `costUsd: number`
  - `hasAnyActivity: boolean`
  - `rangeLabel: string`
- `legend`: `HeatmapLegendBucket[]`
- `days`: `HeatmapDay[]`
- `generatedAt: string`

Relationships:
- Contains one `HeatmapDay` per calendar day in the selected full-year grid.
- Contains selector metadata for both year view and agent scope.

### HeatmapDay

Represents one rendered cell in the grid.

Fields:
- `date: string`
- `weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6`
- `weekIndex: number`
- `monthLabel: string | null`
- `jobCount: number`
- `ticketsShipped: number`
- `costUsd: number`
- `intensityLevel: 0 | 1 | 2 | 3 | 4`
- `isInPrimaryRange: boolean`

Validation / rules:
- Exactly one record exists for every day in the selected year grid, including zero-activity days.
- `intensityLevel` is derived from relative job-count buckets for the active dataset.
- `monthLabel` is present only for the first rendered day of a displayed month label boundary.

### YearViewOption

Represents a selectable reporting period.

Fields:
- `value: 'rolling-12m' | \`year-${number}\``
- `label: string`
- `startDate: string`
- `endDate: string`
- `isDefault: boolean`

Validation / rules:
- The default option is always `rolling-12m`.
- Historical year options are full calendar years derived from the user’s accessible activity history.

### AgentScopeOption

Represents one selectable agent filter.

Fields:
- `value: 'all' | 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI'`
- `label: string`
- `jobCount: number`
- `isDefault: boolean`

Validation / rules:
- `all` is always present and default.
- Named agents appear only when the selected view contains qualifying workspace history for that effective agent.

### HeatmapLegendBucket

Represents the visible intensity legend.

Fields:
- `level: 0 | 1 | 2 | 3 | 4`
- `label: string`
- `minJobs: number`
- `maxJobs: number | null`

Validation / rules:
- Level `0` always represents zero jobs.
- Higher levels map to non-overlapping job-count ranges derived from the active dataset.

## State Transitions

### Year View

`rolling-12m` -> `year-2025` -> `year-2024` ...

Rules:
- Changing the year view recalculates `days`, `summary`, `legend`, `availableAgents`, and tooltip values.
- The grid shape remains a full-year weekly matrix regardless of view.

### Agent Scope

`all` -> named agent -> `all`

Rules:
- Changing the agent scope recalculates daily job counts, daily cost totals, shipped-ticket totals, header summary, and legend buckets.
- A named-agent scope with zero activity still returns a complete day grid and zero totals.

## Derived Business Rules

1. Workspace scope is the set of projects visible on `/projects`: owner access plus membership access.
2. Daily intensity is based on `jobCount`, not cost or shipped tickets.
3. `costUsd` totals sum only available job costs; missing costs do not remove the job from counts.
4. Shipped-ticket counts come from tickets whose effective agent matches the active filter and whose shipped timestamp is inferred from `Ticket.updatedAt`.
5. The API never returns partial grids; zero-activity days are explicit records, not omitted rows.
