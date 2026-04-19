# Data Model: Activity Heatmap

## Overview

No new database models are introduced (FR-024). The heatmap is computed from existing `Job`, `Ticket`, `Project`, and `User` models. This document defines the computed entities and their derivation from the schema.

## Computed Entities

### ActivityDay

An aggregation of all job completions for a specific calendar day across the user's projects.

| Field | Type | Source |
|-------|------|--------|
| `date` | `string` (YYYY-MM-DD) | `DATE(Job.completedAt)` |
| `jobCount` | `number` | `COUNT(Job.id)` where `Job.status = COMPLETED` and `Job.completedAt` falls on this date |
| `shippedCount` | `number` | `COUNT(DISTINCT Ticket.id)` where a Job with `command = 'ship'` and `status = COMPLETED` has `completedAt` on this date |
| `costUsd` | `number \| null` | `SUM(Job.costUsd)` where `costUsd IS NOT NULL`; `null` if all jobs have null cost |

**Derivation query**:
- Join: `Job → Ticket → Project`
- Filter: `Project.userId = currentUser OR ProjectMember.userId = currentUser`
- Filter: `Job.status = COMPLETED`
- Filter: `Job.completedAt >= periodStart AND Job.completedAt < periodEnd`
- Optional: `Ticket.agent = selectedAgent OR (Ticket.agent IS NULL AND Project.defaultAgent = selectedAgent)`
- Group by: `DATE(Job.completedAt)`

### HeatmapPeriod

Defines the time boundaries for the heatmap grid.

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'rolling' \| 'year'` | Rolling 12-month window or specific calendar year |
| `year` | `number \| null` | Calendar year (if type is 'year') |
| `startDate` | `Date` | First day of the period |
| `endDate` | `Date` | Last day of the period (inclusive) |
| `gridStartDate` | `Date` | Sunday of the week containing `startDate` (grid alignment) |
| `gridEndDate` | `Date` | Saturday of the week containing `endDate` (grid alignment) |

**Rolling 12-month**: `startDate` = same day last year + 1 day, `endDate` = today.
**Calendar year**: `startDate` = Jan 1, `endDate` = Dec 31 (or today if current year).

### IntensityThresholds

Quantile-based breakpoints computed from the user's activity distribution.

| Field | Type | Description |
|-------|------|-------------|
| `q25` | `number` | 25th percentile of non-zero daily job counts |
| `q50` | `number` | 50th percentile (median) |
| `q75` | `number` | 75th percentile |
| `q90` | `number` | 90th percentile |

**Intensity mapping**:
- Level 0 (empty): `jobCount = 0`
- Level 1 (low): `jobCount > 0 && jobCount <= q25`
- Level 2 (medium): `jobCount > q25 && jobCount <= q50`
- Level 3 (high): `jobCount > q50 && jobCount <= q75`
- Level 4 (max): `jobCount > q75`

**Edge case**: When all non-zero days have the same count, all active cells render at level 2 (mid-intensity).

### EffectiveAgent

Resolved agent for filtering purposes.

| Source | Priority | Description |
|--------|----------|-------------|
| `Ticket.agent` | 1 (explicit) | Agent explicitly set on the ticket |
| `Project.defaultAgent` | 2 (inherited) | Falls back to project default when `Ticket.agent` is null |

**Agent enum values**: `CLAUDE`, `CODEX`, `MISTRAL`, `GEMINI`

## Existing Model References

### Job (prisma/schema.prisma)

Key fields used:
- `completedAt: DateTime?` — date grouping key
- `costUsd: Float?` — nullable cost for aggregation
- `status: JobStatus` — filter for `COMPLETED` only
- `command: String` — filter for `'ship'` to count shipped tickets
- `ticketId: Int` — join to Ticket

### Ticket (prisma/schema.prisma)

Key fields used:
- `agent: Agent?` — explicit agent override (nullable)
- `projectId: Int` — join to Project

### Project (prisma/schema.prisma)

Key fields used:
- `userId: String` — ownership check
- `defaultAgent: Agent` — fallback for `Ticket.agent IS NULL`

### User (prisma/schema.prisma)

Key fields used:
- `createdAt: DateTime` — determines available year range for period selector

## Validation Rules

- `year` parameter: must be `'rolling'` or a 4-digit year string between user's account creation year and current year
- `agent` parameter: must be `'all'` or a valid `Agent` enum value
- Period must not extend before user's account creation date (for data availability, not grid rendering — the grid still shows the full period)
