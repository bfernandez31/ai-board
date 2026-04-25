# Contract: Analytics API — Peak Context Distribution

**Endpoint**: `GET /api/projects/:projectId/analytics?range=&outcome=&agent=`
**Source**: `app/api/projects/[projectId]/analytics/route.ts` → `lib/analytics/queries.ts::getAnalyticsData`

## Response (existing `AnalyticsData` + new field)

```ts
interface AnalyticsData {
  // ...existing fields unchanged (overview, costOverTime, costByStage, tokenUsage,
  //     cacheEfficiency, topTools, workflowDistribution, velocity, qualityScore,
  //     filters, availableAgents, generatedAt, jobCount, hasData)...

  /** New — AIB-725: per-project peak-context-size distribution */
  peakContextDistribution: PeakContextDistribution;
}

interface PeakContextDistribution {
  /** Per-job records, already filtered by the dashboard-level filters (range, outcome, agent). */
  jobs: PeakContextJob[];
  /**
   * True when at least one job in the filtered set has a non-null peakContextTokens.
   * Lets the chart decide between the histogram and the empty state (FR-012).
   */
  hasData: boolean;
}

interface PeakContextJob {
  /** Completed Job ID within the filtered range. */
  jobId: number;
  /** Integer peak context tokens observed during the job. Null means the job had no per-turn data (Mistral / pre-feature) — filtered out of `hasData` but kept here so the chart's client-side bucketing stays O(n) without refetching. May be excluded entirely server-side; see "Filtering" below. */
  peakContextTokens: number | null;
  /** Model used for the job — drives the per-job percentage bucket via the model's context window. */
  model: string | null;
  /** Job command (specify/plan/implement/quick-impl/verify/ship/iterate). Used for client-side command filter. */
  command: string;
  /** Workflow type of the parent ticket (FULL | QUICK | CLEAN). Used for client-side workflow filter. */
  workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  /** Quality score integer 0-100 or null. Used for client-side quality-bucket filter (poor/fair/good/excellent). */
  qualityScore: number | null;
}
```

## Filtering semantics (D-006)

Dashboard-level filters (`range`, `outcome`, `agent`) apply server-side via `buildJobWhere`, identical to every other analytics field — this is why the rows returned are already scoped.

The **chart-local** filters (`command`, `workflowType`, `qualityBucket`) are applied **client-side** in the new chart component over `peakContextDistribution.jobs[]`. Rationale in research.md D-006: these filters are scoped to this chart only and do not ripple through the rest of the dashboard.

Server response size is bounded by `buildJobWhere` + range; typical project ranges produce tens to low hundreds of jobs, not thousands — client-side filtering is appropriate.

## Histogram bucketing (computed in the chart)

The chart component renders fixed percent-of-context-window buckets:

| Bucket | Percent of context window |
|--------|----------------------------|
| `<20%` | [0, 20) |
| `20-40%` | [20, 40) |
| `40-60%` | [40, 60) |
| `60-80%` | [60, 80) — warning styling |
| `80-95%` | [80, 95) — danger styling |
| `≥95%` | [95, ∞) — danger styling |
| `unknown` | model not in the context-window registry |

Each job is assigned to a bucket using `getContextWindow(job.model)` and `peakContextTokens / contextWindow`. Jobs with null peak or null model are excluded from the histogram but still counted toward `hasData == false` only when **every** filtered job is excluded.

## Empty states (FR-012)

- No jobs match filters after dashboard- and chart-local filtering → card shows "No matching jobs" message.
- Jobs exist but all have null peak (Mistral-only / pre-feature) → card shows "No per-turn data for this selection yet".

## Back-compat

- `AnalyticsData` shape is additive: existing consumers (`AnalyticsDashboard`, `fetchAnalytics`, query cache key) read existing fields unchanged.
- The new chart slot plugs into the existing `<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">` without disturbing the other chart layouts (FR-013).

## Authorization & caching

- Session-based project access (`verifyProjectAccess`) — unchanged.
- 15 s polling on the client via TanStack Query — unchanged (`analytics-dashboard.tsx:98`). The new field is fetched in the same response; no additional network trips.
