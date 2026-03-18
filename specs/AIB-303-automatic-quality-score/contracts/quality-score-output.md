# Contract: Quality Score JSON Output (Workflow Artifact)

## File

`quality-score.json` written to the workspace root by the code review command during verify workflow execution.

## Schema

```json
{
  "version": 1,
  "qualityScore": 83,
  "threshold": "Good",
  "dimensions": [
    {
      "name": "Bug Detection",
      "agentId": "bug-detection",
      "score": 90,
      "weight": 0.30,
      "weightedScore": 27.0
    },
    {
      "name": "Compliance",
      "agentId": "compliance",
      "score": 80,
      "weight": 0.30,
      "weightedScore": 24.0
    },
    {
      "name": "Code Comments",
      "agentId": "code-comments",
      "score": 70,
      "weight": 0.20,
      "weightedScore": 14.0
    },
    {
      "name": "Historical Context",
      "agentId": "historical-context",
      "score": 85,
      "weight": 0.10,
      "weightedScore": 8.5
    },
    {
      "name": "PR Comments",
      "agentId": "pr-comments",
      "score": 95,
      "weight": 0.10,
      "weightedScore": 9.5
    }
  ],
  "computedAt": "2026-03-17T10:30:00Z"
}
```

## Computation Rules

- Each agent returns a score 0-100 for its dimension
- `qualityScore = round(sum(dimension.score * dimension.weight))` for all dimensions
- `threshold` is derived from `qualityScore`: 90+ = "Excellent", 70-89 = "Good", 50-69 = "Fair", 0-49 = "Poor"
- Weights are fixed (not configurable) and must sum to 1.0
- `computedAt` is the ISO 8601 timestamp when computation completed

## Workflow Integration

1. Code review command writes `quality-score.json` to workspace
2. Verify workflow reads the file after code review step
3. Verify workflow includes `qualityScore` and `qualityScoreDetails` (JSON string of the full object) in the PATCH request to `/api/jobs/:id/status`
4. If the file does not exist (e.g., no issues found, command failed), no quality score is sent
