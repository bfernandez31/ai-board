# Contract: Analytics API Extension

## Endpoint

`GET /api/projects/{projectId}/analytics?range=30d&outcome=shipped&agent=all`

## Response Extension

Add `qualityScore` section to the `AnalyticsData` response:

```json
{
  "overview": { "..." },
  "costOverTime": [],
  "qualityScore": {
    "scoreTrend": [
      { "date": "2026-03-10", "averageScore": 78, "count": 3 },
      { "date": "2026-03-11", "averageScore": 82, "count": 2 },
      { "date": "2026-03-14", "averageScore": 85, "count": 4 }
    ],
    "dimensionComparison": [
      { "dimension": "Bug Detection", "averageScore": 85, "weight": 0.3 },
      { "dimension": "Compliance", "averageScore": 80, "weight": 0.3 },
      { "dimension": "Code Comments", "averageScore": 72, "weight": 0.2 },
      { "dimension": "Historical Context", "averageScore": 88, "weight": 0.1 },
      { "dimension": "PR Comments", "averageScore": 90, "weight": 0.1 }
    ],
    "overallAverage": 82,
    "totalScoredJobs": 9
  }
}
```

## Aggregation Logic

### Score Trend
- Group COMPLETED verify jobs with non-null `qualityScore` by date (using same granularity as `costOverTime`)
- Compute AVG(`qualityScore`) per period
- Return count of scored jobs per period

### Dimension Comparison
- Fetch all `qualityScoreDetails` JSON from scored jobs in range
- Parse dimension scores, compute AVG per dimension across all jobs
- Return with fixed weights

### Overall Average
- Simple AVG of all `qualityScore` values in range
- `null` if no scored jobs in range

## Team Plan Gating

- Quality score analytics data is only computed and returned for Team plan subscriptions
- For Free/Pro plans, the `qualityScore` field is omitted from the response (or set to `null`)
- Individual ticket-level quality scores (on cards and Stats tab) are visible to all plans
