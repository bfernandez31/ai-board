# Contract: Trigger Health Scan Endpoint

## POST `/api/projects/[projectId]/health/scans`

Triggers a new health scan for the specified module type.

### Authentication
- Session cookie OR Bearer token (PAT)
- Requires project access (owner or member) via `verifyProjectAccess(projectId)`

### Request

- **Path params**: `projectId` (integer, required)
- **Body** (JSON):

```json
{
  "scanType": "SECURITY"
}
```

**Validation** (Zod):
- `scanType`: Required, enum `["SECURITY", "COMPLIANCE", "TESTS", "SPEC_SYNC"]`

### Response 201 (Scan Created)

```json
{
  "scan": {
    "id": 42,
    "projectId": 1,
    "scanType": "SECURITY",
    "status": "PENDING",
    "baseCommit": "abc1234567890abcdef1234567890abcdef123456",
    "headCommit": null,
    "createdAt": "2026-03-28T10:00:00Z"
  }
}
```

### Behavior

1. Validate `scanType` against allowed enum values
2. Check for existing PENDING/RUNNING scan of same type for this project
3. Look up the latest COMPLETED scan of this type for incremental base commit
4. Create `HealthScan` record with PENDING status
5. Dispatch scan workflow via GitHub Actions
6. Return the created scan record

### Incremental Scan Logic

- **First scan** (no prior COMPLETED scan of this type): `baseCommit = null` → full scan
- **Subsequent scans**: `baseCommit = headCommit` from latest COMPLETED scan of same type

### Error Responses

| Status | Body | When |
|--------|------|------|
| 400 | `{ "error": "Invalid project ID" }` | Non-numeric or <= 0 projectId |
| 400 | `{ "error": "Invalid scan type", "code": "VALIDATION_ERROR" }` | Invalid scanType value |
| 401 | `{ "error": "Unauthorized" }` | No session/token |
| 403 | `{ "error": "Forbidden" }` | Not project owner or member |
| 409 | `{ "error": "A SECURITY scan is already running", "code": "SCAN_IN_PROGRESS" }` | Concurrent scan prevention |
