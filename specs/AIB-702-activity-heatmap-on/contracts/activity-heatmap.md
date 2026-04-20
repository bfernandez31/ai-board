# API Contract: Activity Heatmap

## GET `/api/activity/heatmap`

Returns activity heatmap data for the current user.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `year` | `string` | `last-12-months` | Calendar year (e.g., `2025`) or `last-12-months`. |
| `agent` | `string` | (none) | Filter by AI agent (e.g., `CLAUDE`). |

### Response (200 OK)

```json
{
  "days": [
    {
      "date": "2026-04-20",
      "jobCount": 5,
      "shippedTicketCount": 1,
      "totalCost": 0.12
    }
  ],
  "stats": {
    "totalJobs": 450,
    "totalShippedTickets": 85,
    "period": {
      "start": "2025-04-21",
      "end": "2026-04-20"
    }
  },
  "filters": {
    "availableAgents": ["CLAUDE", "GEMINI"],
    "availableYears": [2025, 2026],
    "currentAgent": null,
    "currentYear": "last-12-months"
  }
}
```

### Error Responses

- **401 Unauthorized**: User is not authenticated.
- **500 Internal Server Error**: Database or aggregation failure.
