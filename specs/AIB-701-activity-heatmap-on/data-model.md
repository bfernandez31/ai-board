# Data Model: Activity Heatmap on Projects Page

## Overview

This feature introduces no new Prisma models. It derives a read-only heatmap payload from existing `User`, `Project`, `Ticket`, and `Job` records.

## Derived Entities

### 1. Heatmap Period Option

Represents one selectable reporting range in the UI.

| Field | Type | Source | Notes |
|------|------|--------|------|
| `value` | `'last-12-months' \| string` | Derived | Calendar years are encoded as four-digit strings such as `2026`. |
| `label` | `string` | Derived | Examples: `Last 12 months`, `2026`. |
| `startDate` | `string` | Derived | Inclusive UTC date in `YYYY-MM-DD`. |
| `endDate` | `string` | Derived | Inclusive UTC date in `YYYY-MM-DD`. |
| `isDefault` | `boolean` | Derived | True only for `last-12-months`. |

**Validation rules**
- Always include `last-12-months`.
- Include calendar-year options from `User.createdAt` year through the current year only when more than one distinct year is available.
- Reject any selected year outside that range.

### 2. Effective Agent Option

Represents one selectable agent filter.

| Field | Type | Source | Notes |
|------|------|--------|------|
| `value` | `'all' \| Agent` | Derived | Uses existing supported-agent enum values. |
| `label` | `string` | Derived | `All agents`, `Claude`, `Codex`, `Mistral`, `Gemini`. |
| `jobCount` | `number` | Derived | Count of jobs represented by that effective agent in the selected data set. |
| `isDefault` | `boolean` | Derived | True only for `all`. |

**Validation rules**
- Always include `all`.
- Resolve effective agent as `ticket.agent ?? project.defaultAgent`.
- Hide the selector when the distinct effective-agent count is `<= 1`.

### 3. Daily Activity Summary

Represents one in-period day cell in the heatmap.

| Field | Type | Source | Notes |
|------|------|--------|------|
| `date` | `string` | Derived from `Job.completedAt` | UTC `YYYY-MM-DD`. |
| `weekIndex` | `number` | Derived | Column index relative to the selected period start week. |
| `dayOfWeek` | `0-6` | Derived | Sunday-first or repo-standard fixed ordering used consistently by the UI. |
| `jobCount` | `number` | Derived from jobs | Count of completed/failed jobs completing on this date after filters. |
| `shippedTicketCount` | `number` | Derived from successful `ship` jobs | Deduped by `(ticketId, date)`. |
| `totalCostUsd` | `number \| null` | Derived from jobs | Null when no represented job on that day has recorded cost. |
| `hasCostData` | `boolean` | Derived | Controls tooltip cost-line visibility. |
| `intensityLevel` | `0-4` | Derived | Computed from daily `jobCount` relative to the selected period’s max job count. |
| `isInSelectedMonth` | `boolean` | Derived | Supports month-label layout if needed. |

**Validation rules**
- Include only dates inside the selected period.
- Preserve partial first and last weeks; do not emit filler cells for out-of-period dates.
- `totalCostUsd` is omitted from tooltip display when `hasCostData === false`.

### 4. Heatmap Summary

Represents the headline totals shown above the grid.

| Field | Type | Source |
|------|------|--------|
| `jobCount` | `number` | Sum of all daily `jobCount` values in the selected period |
| `shippedTicketCount` | `number` | Sum of all daily `shippedTicketCount` values |
| `periodLabel` | `string` | Derived from selected period |

**Validation rules**
- `shippedTicketCount` only includes tickets with at least one successful `ship` workflow completion in the selected period.
- Never infer shipped totals from ticket stage alone.

### 5. Activity Heatmap Payload

Returned by the dedicated route and consumed by the projects page heatmap component.

| Field | Type |
|------|------|
| `summary` | `HeatmapSummary` |
| `periods` | `HeatmapPeriodOption[]` |
| `agents` | `EffectiveAgentOption[]` |
| `cells` | `DailyActivitySummary[]` |
| `monthLabels` | `{ label: string; weekIndex: number }[]` |
| `selectedPeriod` | `HeatmapPeriodOption['value']` |
| `selectedAgent` | `EffectiveAgentOption['value']` |
| `hasActivity` | `boolean` |
| `generatedAt` | `string` |

**Validation rules**
- `hasActivity === false` when all `jobCount` and `shippedTicketCount` values are zero for the selected period.
- Filters in the payload must match the validated request filters actually applied.

## Relationship Rules

- `User` determines the lower bound for valid calendar-year options through `createdAt`.
- `Project` contributes visibility via owner/member access and default-agent inheritance.
- `Ticket` contributes explicit agent overrides.
- `Job` is the authoritative event source for daily activity totals and shipped counting.

## State Transitions

### Filter state

1. Initial state defaults to `selectedPeriod = 'last-12-months'` and `selectedAgent = 'all'`.
2. When the user changes the period:
   - Keep grid boundaries aligned to the newly selected period.
   - Recompute available agent options from the new data set.
   - If the prior specific agent no longer exists, reset to `all`.
3. When the user changes the agent:
   - Keep the selected period boundaries fixed.
   - Recompute only aggregated values, not the calendar range.

### Empty-state state

1. If `hasActivity === true`, render the full grid and tooltips.
2. If `hasActivity === false`, replace the grid with the specified empty-state copy while preserving summary controls and legend.

## Non-Goals

- No persistent storage for heatmap preferences.
- No per-project breakdown inside a day cell.
- No drill-through from a cell into project or ticket details.
