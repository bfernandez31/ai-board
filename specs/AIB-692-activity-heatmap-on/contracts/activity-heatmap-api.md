# API Contract: Activity Heatmap

## GET `/api/projects/activity-heatmap`

Returns daily activity data for the authenticated user across all their projects, aggregated for heatmap rendering.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `year` | `string` | No | `'rolling'` | `'rolling'` for last 12 months, or 4-digit year (e.g., `'2025'`) between 1970 and the current year |
| `agent` | `string` | No | `'all'` | `'all'` or a valid agent identifier matching the Prisma `Agent` enum (`'CLAUDE'`, `'CODEX'`, `'MISTRAL'`, `'GEMINI'`) |

### Response: `200 OK`

```typescript
interface ActivityHeatmapResponse {
  /** Map of YYYY-MM-DD date strings to daily activity data */
  days: Record<string, ActivityDayData>;

  /** Quantile-based thresholds for intensity mapping */
  thresholds: IntensityThresholds;

  /** Summary counters for the selected period */
  summary: {
    totalJobs: number;
    ticketsShipped: number;
  };

  /** Period boundaries */
  period: {
    startDate: string;  // YYYY-MM-DD
    endDate: string;    // YYYY-MM-DD
  };

  /** Available filter options (for populating dropdowns) */
  availableYears: string[];       // e.g., ['rolling', '2024', '2025', '2026']
  availableAgents: AgentOption[]; // e.g., [{ value: 'all', label: 'All' }, { value: 'CLAUDE', label: 'Claude' }]

  /** Active filters (echoed back for cache key matching) */
  filters: {
    year: string;
    agent: string;
  };
}

interface ActivityDayData {
  jobCount: number;
  shippedCount: number;
  costUsd: number | null; // null when no jobs have recorded cost
}

interface IntensityThresholds {
  q25: number;
  q50: number;
  q75: number;
  q90: number;
}

interface AgentOption {
  value: string; // 'all' | Prisma Agent enum value (e.g., 'CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI')
  label: string; // Display name
}
```

### Response: `401 Unauthorized`

```json
{ "error": "Authentication required" }
```

### Response: `400 Bad Request`

```json
{ "error": "Invalid year parameter" }
```

### Notes

- Only COMPLETED jobs are counted in `jobCount`
- Only tickets with a COMPLETED `ship` command job are counted in `shippedCount`
- `costUsd` is the sum of non-null `Job.costUsd` values; `null` if all jobs for the day have null cost
- `availableYears` is derived from user's `createdAt` year through current year
- `availableAgents` is derived from distinct effective agents across user's jobs
- Days with zero activity are omitted from `days` (client treats missing keys as empty)
- Thresholds are computed from the distribution of non-zero daily job counts in the selected period
- When all non-zero days have the same count, all thresholds equal that count (client renders at mid-intensity)
