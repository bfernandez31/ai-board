# Contract — `GET /api/projects/:projectId/health/scans/:scanId`

## Summary

Returns one `HealthScan` by id with its parsed `report` JSON. Powers the historic-row selection in the health drawer (US1, FR-002, FR-014).

## Path

```
GET /api/projects/{projectId}/health/scans/{scanId}
```

## Path parameters

| Name | Type | Constraints |
|------|------|-------------|
| `projectId` | integer | `> 0` |
| `scanId` | integer | `> 0` |

Invalid → `400 { error: "Invalid project ID" }` or `400 { error: "Invalid scan ID" }`.

## Authentication

Session auth via `verifyProjectAccess(projectId, request)`. No workflow-token bypass — workflows do not call this route.

| Failure | Status | Body |
|---------|--------|------|
| No session | `401` | `{ error: "Unauthorized" }` |
| Session valid but caller is neither owner nor member of project | `403` | `{ error: "Forbidden" }` |

## Authorization defence-in-depth

After `verifyProjectAccess`, the handler MUST verify that the looked-up scan's `projectId` equals the URL `projectId`. On mismatch, return `404` (NOT `403`) — do not reveal that the scan exists in another project.

## Responses

### `200 OK`

```json
{
  "scan": {
    "id": 1234,
    "scanType": "COMPLIANCE",
    "status": "COMPLETED",
    "score": 87,
    "issuesFound": 2,
    "issuesFixed": 1,
    "baseCommit": "abc1234",
    "headCommit": "def5678",
    "durationMs": 5421,
    "tokensUsed": 12345,
    "costUsd": 0.0234,
    "errorMessage": null,
    "startedAt": "2026-04-29T10:00:00.000Z",
    "completedAt": "2026-04-29T10:00:05.421Z",
    "createdAt": "2026-04-29T10:00:00.000Z",
    "report": "{\"type\":\"COMPLIANCE\",\"issues\":[…],\"generatedTickets\":[…]}"
  }
}
```

The `scan` object is identical in shape to one item from `GET …/scans?type=…&includeReport=true` (i.e., `ScanHistoryItemWithReport` from `lib/health/types.ts`). The `report` field is the raw JSON-stringified column. The client (new `useScanById` hook) calls `parseScanReport(moduleType, scan.report)` to decode it — same pattern as `useScanReport`.

### `404 Not Found`

```json
{ "error": "Scan not found" }
```

Returned when:
- Scan id does not exist in `HealthScan`, OR
- Scan exists but `scan.projectId !== :projectId` (do not distinguish — leak nothing).

### `400 Bad Request`

Path-parameter parse failure.

### `500 Internal Server Error`

Unexpected error. Body: `{ error: "Internal server error" }`. Server logs `[Health Scan By Id] Error:` with the original error.

## Database query

```ts
const scan = await prisma.healthScan.findUnique({
  where: { id: scanId },
  select: {
    id: true,
    projectId: true,        // for cross-project guard, NOT in response
    scanType: true,
    status: true,
    score: true,
    issuesFound: true,
    issuesFixed: true,
    baseCommit: true,
    headCommit: true,
    durationMs: true,
    tokensUsed: true,
    costUsd: true,
    errorMessage: true,
    startedAt: true,
    completedAt: true,
    createdAt: true,
    report: true,           // stringify-ed before sending
  },
});
```

The `projectId` is selected for the auth guard but stripped from the JSON body to keep response shape parallel to the list endpoint.

## Caching

Client (TanStack Query):
- Query key: `queryKeys.health.scan(projectId, scanId)` (NEW key — to be added in `app/lib/query-keys.ts`).
- `staleTime: 30_000`, `gcTime: 5 * 60 * 1000` (matches `useScanReport`).
- `enabled: scanId !== null`.

Server: `Cache-Control` header is not set explicitly. `fetch` is called with `cache: 'no-store'` per the existing `useScanReport` pattern (`app/lib/hooks/useScanReport.ts:23`).

## Test surface (integration test)

`tests/integration/health/scan-by-id.test.ts` MUST cover:

1. `200` — owner of project requests own scan → returns scan with `report` field set.
2. `200` — scan with `report = null` (legacy / SKIPPED) → `report` field returned as `null`. The drawer surfaces the FR-014 empty state from this signal.
3. `401` — unauthenticated → `Unauthorized`.
4. `403` — authenticated, non-member of project → `Forbidden` (raised by `verifyProjectAccess`).
5. `404` — scan id does not exist.
6. `404` — scan exists but belongs to a different project (cross-project guard).
7. `400` — non-numeric `scanId`.

## Out of scope for this contract

- `PATCH` / `DELETE` on this resource — not part of AIB-759.
- Bulk fetch by ids — list endpoint already supports paged retrieval.
- Workflow-token auth — workflows do not need to fetch single historical scans.
