# Contract: Projects Activity Heatmap API

## Endpoint

### `GET /api/projects/activity-heatmap`

Returns the cross-project activity heatmap payload for the signed-in user’s accessible projects.

## Authentication

- Session auth or PAT auth, matching existing `/api/projects` behavior.
- Unauthorized requests return `401` or `403` using the app’s standard structured error responses.

## Query Parameters

- `activityPeriod`: optional
  - Allowed values:
    - `last-12-months`
    - `YYYY` for any valid calendar year from the user account creation year through the current year
  - Default: `last-12-months`
- `activityAgent`: optional
  - Allowed values:
    - `all`
    - `CLAUDE`
    - `CODEX`
    - `MISTRAL`
    - `GEMINI`
  - Default: `all`

Invalid parameter values return `400`.

## Response Shape

```json
{
  "summary": {
    "jobCount": 142,
    "shippedTicketCount": 17,
    "periodLabel": "last year"
  },
  "periods": [
    {
      "value": "last-12-months",
      "label": "Last 12 months",
      "startDate": "2025-04-21",
      "endDate": "2026-04-20",
      "isDefault": true
    },
    {
      "value": "2026",
      "label": "2026",
      "startDate": "2026-01-01",
      "endDate": "2026-12-31",
      "isDefault": false
    }
  ],
  "agents": [
    {
      "value": "all",
      "label": "All agents",
      "jobCount": 142,
      "isDefault": true
    },
    {
      "value": "CODEX",
      "label": "Codex",
      "jobCount": 48,
      "isDefault": false
    }
  ],
  "monthLabels": [
    { "label": "Apr", "weekIndex": 0 },
    { "label": "May", "weekIndex": 2 }
  ],
  "cells": [
    {
      "date": "2026-04-20",
      "weekIndex": 52,
      "dayOfWeek": 1,
      "jobCount": 4,
      "shippedTicketCount": 1,
      "totalCostUsd": 2.34,
      "hasCostData": true,
      "intensityLevel": 3,
      "isInSelectedMonth": true
    }
  ],
  "selectedPeriod": "last-12-months",
  "selectedAgent": "all",
  "hasActivity": true,
  "generatedAt": "2026-04-20T12:00:00.000Z"
}
```

## Semantics

- Aggregate activity across all projects the current user can access as owner or member.
- Attribute activity by `Job.completedAt` date.
- Count shipped tickets only from successful `ship` jobs.
- Resolve agent filtering with `ticket.agent ?? project.defaultAgent`.
- Preserve the exact period boundaries; the response must not fabricate out-of-period filler cells.
- Include `totalCostUsd` only when at least one represented job for that day has recorded cost. When no cost data exists for that day, set `hasCostData=false` and omit the tooltip cost line in the UI.
- When the selected period has no activity, return `hasActivity=false` and still include filter/period metadata so the UI can render controls and legend.

## Response Codes

- `200`: Successful response
- `400`: Invalid query parameters
- `401`/`403`: Unauthorized access
- `500`: Unexpected server error
