# API Contract: GET /api/projects/{projectId}/health/scans

## Change Summary

Add optional `scanId` query parameter to the existing scan history endpoint to support fetching a single scan by ID with its report.

## Existing Contract (unchanged fields)

```
GET /api/projects/{projectId}/health/scans
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | `HealthScanType` enum | No | Filter by scan type |
| `status` | `HealthScanStatus` enum | No | Filter by scan status |
| `limit` | `int (1-100)` | No (default: 20) | Page size |
| `cursor` | `int (positive)` | No | Cursor for pagination (scan ID, descending) |
| `includeReport` | `"true" \| "false"` | No | Include report JSON blob |

## New Parameter

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `scanId` | `int (positive)` | No | Fetch a specific scan by ID. When present, `type`/`status`/`limit`/`cursor` are ignored. |

## Behavior

### When `scanId` is provided:

1. Query: `prisma.healthScan.findFirst({ where: { id: scanId, projectId } })`
2. Always includes report field (ignores `includeReport` param — assumed true)
3. Response shape unchanged:

```json
{
  "scans": [{ ...ScanHistoryItemWithReport }],
  "nextCursor": null,
  "hasMore": false
}
```

4. If scan not found or doesn't belong to project: returns `{ "scans": [], "nextCursor": null, "hasMore": false }`

### When `scanId` is NOT provided:

Existing behavior unchanged.

## Authorization

Same as existing: session auth via `verifyProjectAccess(projectId)` OR workflow token via `verifyWorkflowToken(request)`.

## Zod Schema Update

```typescript
const scanHistorySchema = z.object({
  type: z.enum([...]).optional(),
  status: z.enum([...]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.coerce.number().int().positive().optional(),
  includeReport: z.enum(['true', 'false']).optional(),
  scanId: z.coerce.number().int().positive().optional(),  // NEW
});
```

## Error Responses (unchanged)

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Invalid project ID" }` | Non-numeric or ≤0 projectId |
| 400 | `{ "error": "Invalid filters", "code": "VALIDATION_ERROR" }` | Zod validation failure |
| 401 | `{ "error": "Unauthorized" }` | No valid session or workflow token |
| 403 | `{ "error": "Forbidden" }` | User lacks project access |
| 500 | `{ "error": "Internal server error" }` | Unexpected error |
