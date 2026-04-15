# API Contract: Heatmap Endpoint

## GET /api/heatmap

Cross-project heatmap data for the authenticated user.

### Authentication
Session-based (NextAuth.js) — returns 401 if unauthenticated.

### Query Parameters

| Param | Type | Default | Validation |
|-------|------|---------|------------|
| year | `"last-12-months"` \| `"2024"` \| `"2025"` \| ... | `"last-12-months"` | Must be "last-12-months" or a 4-digit year within [user.createdAt year, current year] |
| agent | `"all"` \| `"CLAUDE"` \| `"CODEX"` \| `"MISTRAL"` \| `"GEMINI"` | `"all"` | Must match AGENT_FILTER_VALUES |

### Response: 200 OK

```typescript
interface HeatmapResponse {
  days: Array<{
    date: string;        // "YYYY-MM-DD" (UTC)
    jobCount: number;    // COMPLETED jobs
    costUsd: number | null; // sum of non-null costUsd, or null if no costs recorded
    shippedTickets: string[]; // ticketKeys with completed ship jobs
  }>;
  totalJobs: number;
  totalShipped: number;
  availableAgents: Array<{
    value: string;       // "all" | agent enum value
    label: string;       // "All agents" | display name
    jobCount: number;
    isDefault: boolean;
  }>;
  availableYears: number[];    // e.g., [2024, 2025, 2026]
  userCreatedAt: string;       // ISO 8601
  generatedAt: string;         // ISO 8601
}
```

### Response: 400 Bad Request
```json
{ "error": "Invalid heatmap filters" }
```

### Response: 401 Unauthorized
```json
{ "error": "Unauthorized" }
```

### Response: 500 Internal Server Error
```json
{ "error": "Internal server error" }
```

### Notes
- `days` array is sparse — only days with at least 1 COMPLETED job are included
- Client fills empty days with `{ jobCount: 0, costUsd: null, shippedTickets: [] }`
- `costUsd` is null when zero jobs that day have a recorded cost (avoids "$0" display)
- `shippedTickets` uses ticketKey format (e.g., "AIB-123") for display
- Multiple ship jobs for the same ticket on the same day result in that ticketKey appearing once
- Period boundaries for "last-12-months": today minus 364 days (52 full weeks), Sunday-aligned
- Period boundaries for calendar year: Jan 1 – Dec 31 of that year
