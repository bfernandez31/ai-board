# Workflow Artifact: Project Context Analytics Aggregation

## Workflow Definition

### Input

- Authenticated request to `GET /api/projects/{projectId}/analytics`
- existing analytics filters (`range`, `outcome`, `agent`)
- new context filters/groupings (`command`, `workflowType`, `qualityBucket`)
- completed-job telemetry stored on `Job`

### Phases

1. Verify project access with the existing analytics route guard.
2. Parse query parameters with Zod, extending the current analytics filter schema.
3. Build a shared `JobWhereInput` using the existing project/outcome/range/agent logic.
4. Apply additional command and workflow-type constraints for the context slice.
5. Build context aggregates from jobs where `peakContextSize` is present.
6. For quality-bucket comparisons, exclude jobs with null `qualityScore` and report excluded counts separately.
7. Return a single analytics payload that includes the existing analytics sections plus a new `context` section and filter echo.
8. Preserve valid empty responses when the selected slice has no eligible context metrics.

### Environment requirements

- authenticated user with project access
- migrated `Job` schema with nullable context fields
- completed jobs in the selected project

## Agent Command Specification

Not applicable. This process is request-time analytics aggregation, not an agent command.

## Callback / Reporting Contract

- Response remains a single JSON payload from the existing analytics endpoint.
- `generatedAt` continues to mark response freshness.
- Context analytics uses the same 15-second polling cadence already configured by the dashboard.
- Empty-state messaging distinguishes:
  - no completed jobs in the slice
  - completed jobs exist but none have compatible context metrics
  - quality-bucket slice excludes jobs with null `qualityScore`

## Error Behavior

- `400` on invalid filter values
- `403` on project access denial
- `404` when the project does not exist
- `200` with empty arrays and counts for valid but empty slices
- `500` only for unexpected query or serialization failures
