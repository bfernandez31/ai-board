# Setup Status Callback Contract

## Purpose

Define how the onboarding workflow reports authoritative state changes back to the app.

## Endpoint

- Proposed route: `PATCH /api/projects/{projectId}/setup/status`

## Authentication

- Bearer token via `WORKFLOW_API_TOKEN`
- Same validation style as `/home/runner/work/ai-board/ai-board/target/app/api/jobs/[id]/status/route.ts`

## Request payload

| Field | Required | Notes |
|------|------|------|
| `jobId` | yes | `ProjectSetupJob.id` |
| `status` | yes | `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| `workflowRunId` | no | GitHub run id, first-write-wins |
| `defaultBranch` | no | resolved repo default branch |
| `commitSha` | no | required on success |
| `analysisSummary` | no | structured deterministic detection output |
| `artifactManifest` | no | file summary array |
| `configPreview` | no | sanitized config payload or sync summary |
| `errorCode` | no | stable machine-readable failure code |
| `errorMessage` | no | actionable error details |

## Callback sequencing

1. `RUNNING`
   - sent immediately after checkout starts
   - records `startedAt` and `workflowRunId`

2. `COMPLETED`
   - sent only after:
     - atomic repo commit succeeds
     - app-side config sync succeeds
   - includes `commitSha`, `artifactManifest`, and `analysisSummary`

3. `FAILED`
   - sent for any terminal failure
   - includes `errorCode` and `errorMessage`
   - may include partial `analysisSummary` for debugging but not partial success semantics

## Response

```json
{
  "job": {
    "id": 12,
    "projectId": 3,
    "selectedAgent": "CLAUDE",
    "status": "RUNNING"
  }
}
```

## Invariants

- The callback endpoint must reject updates for non-authoritative or terminal jobs that are no longer current when appropriate.
- `COMPLETED` cannot be accepted without `commitSha`.
- `FAILED` cannot clear prior error details with an empty payload.
- A workflow must not report `COMPLETED` before config sync has succeeded; otherwise the project could still require setup on next visit.
