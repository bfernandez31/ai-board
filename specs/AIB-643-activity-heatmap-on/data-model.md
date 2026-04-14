# Data Model: Activity Heatmap

**Ticket**: AIB-643
**Date**: 2026-04-14

## No New Database Models Required (SC-008)

The heatmap is derived entirely from existing `Job` and `Ticket` tables. All entities below are runtime aggregation types.

## Runtime Entities

### HeatmapDayData
Represents aggregated activity for a single day.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `date` | `string` (YYYY-MM-DD) | Derived from `Job.completedAt` | ISO date string, UTC |
| `jobCount` | `number` | `COUNT(Job.id)` | All terminal jobs (COMPLETED + FAILED) |
| `costUsd` | `number \| null` | `SUM(Job.costUsd)` | Null if no jobs have cost data |
| `ticketsShipped` | `number` | `COUNT(Ticket.id)` where stage=SHIP | Tickets reaching SHIP on this date |

### HeatmapResponse
API response shape.

| Field | Type | Notes |
|-------|------|-------|
| `days` | `HeatmapDayData[]` | One entry per day with any activity |
| `totalJobs` | `number` | Aggregate job count for the period |
| `totalTicketsShipped` | `number` | Aggregate shipped tickets for the period |
| `availableYears` | `number[]` | Years with job activity for year selector |
| `availableAgents` | `AgentOption[]` | Agents with job activity for agent filter |
| `period` | `{ start: string; end: string }` | Date range of the response |

### HeatmapFilters
Client-side filter state sent as query params.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `year` | `'rolling' \| number` | `'rolling'` | "Last 12 months" or specific year |
| `agent` | `NamedAgent \| 'all'` | `'all'` | Agent filter |

### HeatmapCell (client-only)
Computed from HeatmapDayData for rendering.

| Field | Type | Notes |
|-------|------|-------|
| `date` | `Date` | Calendar date |
| `level` | `0 \| 1 \| 2 \| 3 \| 4` | Intensity level (0=empty, 4=max) |
| `data` | `HeatmapDayData \| null` | Null for days with no activity |

## Intensity Level Calculation

Levels are percentile-based relative to the user's max daily job count in the displayed period:

| Level | Range | CSS Class |
|-------|-------|-----------|
| 0 | 0 jobs | `bg-ctp-surface0/50` (transparent) |
| 1 | 1–25th percentile | `bg-ctp-mauve/30` |
| 2 | 26–50th percentile | `bg-ctp-mauve/50` |
| 3 | 51–75th percentile | `bg-ctp-mauve/70` |
| 4 | 76–100th percentile | `bg-ctp-mauve` |

Note: Exact class names will use static Tailwind classes (no dynamic construction per CLAUDE.md rules).

## Relationships to Existing Models

```
User
  ├── Project (owner: userId)
  │     └── Ticket
  │           ├── Job (aggregated by completedAt date)
  │           └── stage = 'SHIP' (shipped tickets)
  └── ProjectMember (member access)
        └── Project
              └── (same Ticket/Job path)
```

## Validation Rules

- `year` query param: Must be `'rolling'` or a 4-digit year between 2020 and current year
- `agent` query param: Must be `'all'` or one of `ALL_AGENTS` values (CLAUDE, CODEX, MISTRAL, GEMINI)
- Date range: Rolling = 365 days back from today; specific year = Jan 1 to Dec 31 (or today if current year)
