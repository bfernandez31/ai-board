# Data Model: Activity Heatmap

## API Response Models

### `ActivityHeatmapResponse`
```typescript
interface ActivityHeatmapResponse {
  days: HeatmapDay[];
  stats: HeatmapStats;
  filters: HeatmapFilters;
}
```

### `HeatmapDay`
```typescript
interface HeatmapDay {
  date: string; // ISO 8601 (YYYY-MM-DD)
  jobCount: number;
  shippedTicketCount: number;
  totalCost: number | null;
}
```

### `HeatmapStats`
```typescript
interface HeatmapStats {
  totalJobs: number;
  totalShippedTickets: number;
  period: {
    start: string;
    end: string;
  };
}
```

### `HeatmapFilters`
```typescript
interface HeatmapFilters {
  availableAgents: string[]; // e.g. ["CLAUDE", "GEMINI"]
  availableYears: number[];  // e.g. [2024, 2025, 2026]
  currentAgent: string | null;
  currentYear: string; // "last-12-months" or "YYYY"
}
```

## Internal Data Structures

### `AggregatedActivity`
Intermediate structure used for DB grouping.
```typescript
interface AggregatedActivity {
  date: string;
  jobCount: number;
  shippedTicketCount: number;
  totalCost: number;
  effectiveAgent: string;
}
```
