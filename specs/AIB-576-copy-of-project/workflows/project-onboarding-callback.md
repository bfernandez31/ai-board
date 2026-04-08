# Callback Contract: Project Onboarding Status Reporting

## Endpoint

- Proposed endpoint: `PATCH /api/projects/:projectId/setup/attempts/:attemptId`

## Authentication

- Bearer token validated by `/home/runner/work/ai-board/ai-board/target/app/lib/workflow-auth.ts`
- Same `WORKFLOW_API_TOKEN` pattern used by existing job status callbacks

## Callback Payload

```json
{
  "status": "RUNNING",
  "workflowRunId": 123456789,
  "message": "Checking repository for existing AI Board config",
  "failureCode": null,
  "failureMessage": null,
  "artifactSummary": null
}
```

## Required Semantics

- `RUNNING` records start progress and stores `workflowRunId` if present.
- `FAILED` records terminal failure details and leaves setup required.
- `COMPLETED` stores result details and immediately triggers config sync before returning success.
- Callback handlers must reject or ignore stale updates that would overwrite the effective state after a newer retry has started.

## Response Contract

```json
{
  "attemptId": 15,
  "status": "RUNNING",
  "completedAt": null,
  "setupRequired": true
}
```

## Reporting Expectations

- Progress messages should be human-readable because they can surface directly in the setup UI.
- Failure details should be actionable and safe to show to the owner.
- Artifact summaries should be concise and structured; the UI will render them before redirecting to the board.
