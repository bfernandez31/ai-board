# Data Model: Copy of Activity Heatmap on Projects Page

## Overview

The feature introduces no new Prisma models. It derives a user-scoped heatmap view model from existing `User`, `Project`, `ProjectMember`, `Ticket`, and `Job` records.

## Source Entities

### User

- Source: `prisma/schema.prisma`
- Relevant fields:
  - `id`
  - `createdAt`
- Usage:
  - determines the first calendar year shown in the period selector
  - scopes aggregation to the signed-in user

### Project

- Source: `prisma/schema.prisma`
- Relevant fields:
  - `id`
  - `userId`
  - `defaultAgent`
- Relationships:
  - owner access through `userId`
  - member access through `ProjectMember`
  - tickets through `Ticket.projectId`
- Usage:
  - contributes accessible projects to the aggregate
  - provides inherited agent when `Ticket.agent` is null

### ProjectMember

- Source: `prisma/schema.prisma`
- Relevant fields:
  - `projectId`
  - `userId`
- Usage:
  - expands access beyond project ownership

### Ticket

- Source: `prisma/schema.prisma`
- Relevant fields:
  - `id`
  - `projectId`
  - `ticketKey`
  - `agent`
- Usage:
  - provides ticket-level agent overrides
  - provides ticket identity for shipped-ticket counting and tooltip detail

### Job

- Source: `prisma/schema.prisma`
- Relevant fields:
  - `id`
  - `projectId`
  - `ticketId`
  - `command`
  - `status`
  - `startedAt`
  - `completedAt`
  - `costUsd`
- Usage:
  - every matching job contributes to a day’s job-count intensity using its activity date
  - successful `ship` jobs contribute shipped-ticket counts using `completedAt`
  - optional `costUsd` values contribute daily cost totals

## Derived Entities

### HeatmapFilters

- Fields:
  - `period: "last-12-months" | "year"`
  - `year: number | null`
  - `agent: "all" | Agent`
- Validation rules:
  - `year` is required when `period === "year"`
  - `year` must fall between the user account creation year and the current year
  - `agent` must be `"all"` or one of the effective agents present in the selected period
- State transitions:
  - default state is `period="last-12-months"` and `agent="all"`
  - changing `period` may change available year options and visible agent options
  - changing `agent` never changes day boundaries

### PeriodOption

- Fields:
  - `value: string`
  - `label: string`
  - `rangeStart: string`
  - `rangeEnd: string`
  - `kind: "rolling" | "calendar-year"`
- Validation rules:
  - always includes `"Last 12 months"`
  - includes calendar-year options only when the user account predates the current year

### AgentFilterOption

- Fields:
  - `value: "all" | Agent`
  - `label: string`
- Validation rules:
  - always includes `"all"` in API responses
  - UI hides the selector when the selected period yields zero or one real agents

### ActivityDay

- Fields:
  - `date: string`
  - `weekIndex: number`
  - `weekdayIndex: number`
  - `monthLabel: string | null`
  - `jobCount: number`
  - `shippedTicketCount: number`
  - `costUsd: number | null`
  - `intensityLevel: 0 | 1 | 2 | 3 | 4`
  - `shippedTickets: Array<{ ticketId: number; ticketKey: string; title: string }>`
- Validation rules:
  - one record per in-period calendar day
  - out-of-period days are omitted, never padded
  - `costUsd` is `null` when no contributing job on that day has a recorded cost
  - `intensityLevel` is derived from `jobCount`, not shipped tickets

### HeatmapSummary

- Fields:
  - `totalJobs: number`
  - `totalShippedTickets: number`
  - `summaryLabel: string`
- Validation rules:
  - `totalShippedTickets` only counts jobs where `command === "ship"` and `status === "COMPLETED"`
  - label wording changes with the selected period

### ProjectsActivityHeatmapResponse

- Fields:
  - `filters: HeatmapFilters`
  - `periodOptions: PeriodOption[]`
  - `agentOptions: AgentFilterOption[]`
  - `summary: HeatmapSummary`
  - `days: ActivityDay[]`
  - `legendLevels: number[]`
  - `hasActivity: boolean`
  - `generatedAt: string`
- Validation rules:
  - `days` spans the selected period boundaries even when all counts are zero
  - `hasActivity` is true when any in-period day has `jobCount > 0`

## Derived Relationships

- Accessible projects:
  - a user can see heatmap activity from projects they own or where they appear in `ProjectMember`
- Effective agent:
  - `Ticket.agent ?? Project.defaultAgent`
- Job activity date:
  - use `Job.startedAt` day bucket for job-count intensity
- Shipped-ticket date:
  - use `Job.completedAt` day bucket for successful `ship` jobs

## State and Interaction Rules

- Initial server render uses URL-derived filters when valid; otherwise falls back to default filters.
- Agent filtering recalculates counts within the same day grid and period boundaries.
- Period changes can alter the available agent options because they are derived from activity in the selected period.
- Empty state replaces the grid body only; header controls and legend remain rendered.

## Non-Changes

- No Prisma schema change
- No migration
- No new persisted settings for filter state; URL search params remain the source of truth for shareable state
