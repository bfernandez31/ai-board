# Contract: Projects Activity Heatmap API

## Endpoint

- Method: `GET`
- Path: `/api/projects/activity`
- Auth: required authenticated user session or existing supported project-auth mechanism

## Purpose

Return the aggregate projects-page heatmap payload for all projects the current user is authorized to access.

## Query Parameters

### `period`

- Type: string
- Allowed values:
  - `last-12-months`
  - `year`
- Default: `last-12-months`

### `year`

- Type: integer
- Required when `period=year`
- Constraints:
  - must be between the authenticated user’s account creation year and the current year inclusive

### `agent`

- Type: string
- Allowed values:
  - `all`
  - `CLAUDE`
  - `CODEX`
  - `MISTRAL`
  - `GEMINI`
- Default: `all`
- Notes:
  - unsupported values return `400`
  - selecting a supported agent with no activity is valid and returns zero-count days

## Response: `200 OK`

```json
{
  "filters": {
    "period": "last-12-months",
    "year": null,
    "agent": "all"
  },
  "periodOptions": [
    {
      "value": "last-12-months",
      "label": "Last 12 months",
      "kind": "rolling",
      "rangeStart": "2025-04-15",
      "rangeEnd": "2026-04-15"
    },
    {
      "value": "year:2026",
      "label": "2026",
      "kind": "calendar-year",
      "rangeStart": "2026-01-01",
      "rangeEnd": "2026-12-31"
    }
  ],
  "agentOptions": [
    { "value": "all", "label": "All" },
    { "value": "CLAUDE", "label": "Claude" },
    { "value": "CODEX", "label": "Codex" }
  ],
  "summary": {
    "totalJobs": 184,
    "totalShippedTickets": 12,
    "summaryLabel": "184 jobs · 12 tickets shipped in the last 12 months"
  },
  "days": [
    {
      "date": "2026-04-15",
      "weekIndex": 52,
      "weekdayIndex": 3,
      "monthLabel": "Apr",
      "jobCount": 4,
      "shippedTicketCount": 1,
      "costUsd": 2.31,
      "intensityLevel": 3,
      "shippedTickets": [
        { "ticketId": 188, "ticketKey": "AIB-653", "title": "Copy of activity heatmap" }
      ]
    }
  ],
  "legendLevels": [0, 1, 2, 3, 4],
  "hasActivity": true,
  "generatedAt": "2026-04-15T12:00:00.000Z"
}
```

## Response Rules

- `days` contains one entry per calendar day inside the selected period only.
- Days outside the selected period are omitted entirely; no placeholder cells are returned.
- `jobCount` aggregates all matching jobs across all accessible projects for that day.
- `shippedTicketCount` only counts `ship` jobs where `status === "COMPLETED"`.
- `costUsd` is `null` when no matching job for the day has a recorded cost.
- `agentOptions` are derived from effective-agent activity present in the selected period, plus the synthetic `all` option.
- The UI may hide the agent selector when `agentOptions` contains only `all` plus at most one real agent.

## Error Responses

### `400 Bad Request`

```json
{
  "error": "Invalid query parameters",
  "code": "VALIDATION_ERROR"
}
```

Returned when:

- `period` is unsupported
- `year` is missing or out of range for `period=year`
- `agent` is unsupported

### `401 Unauthorized`

```json
{
  "error": "Unauthorized",
  "code": "AUTH_ERROR"
}
```

### `500 Internal Server Error`

```json
{
  "error": "Failed to fetch projects activity heatmap",
  "code": "DATABASE_ERROR"
}
```

## Notes

- The route is read-only and introduces no database writes.
- Initial page render may call the same shared aggregation helper directly on the server instead of round-tripping through HTTP, but the HTTP response contract remains the source of truth for client refetches.
