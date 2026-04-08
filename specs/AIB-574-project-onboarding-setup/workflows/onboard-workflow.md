# Workflow: Project Onboarding (Stub)

**Feature Branch**: `AIB-574-project-onboarding-setup`
**Date**: 2026-04-08

## Overview

This document specifies the onboarding workflow that runs when a project owner initializes a new project. **This ticket implements only the app-layer infrastructure**; the workflow itself is a stub that completes immediately. A follow-up ticket will implement the real workflow logic.

## Workflow Definition

**Name**: `onboard.yml`
**Trigger**: `workflow_dispatch`

### Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | number | Yes | Target project ID |
| `setupJobId` | number | Yes | Setup job ID for status callbacks |
| `githubRepository` | string | Yes | Target repo in `owner/repo` format |
| `agent` | string | Yes | Selected agent CLI: `claude` or `codex` |
| `callbackUrl` | string | Yes | Base URL for status callbacks (e.g., `https://app.example.com`) |
| `workflowToken` | string | Yes | Auth token for callback API |

### Environment

- Runs on `ubuntu-latest`
- Requires `GH_PAT` secret for cross-repo access
- Agent credential injected as environment variable (resolved from `AGENT_PROVIDER_MAP`)

### Stub Behavior

1. Call back RUNNING: `PATCH {callbackUrl}/api/projects/{projectId}/setup/status`
   ```json
   { "jobId": <setupJobId>, "status": "RUNNING" }
   ```

2. Sleep 5 seconds (simulate work)

3. Call back COMPLETED: `PATCH {callbackUrl}/api/projects/{projectId}/setup/status`
   ```json
   { "jobId": <setupJobId>, "status": "COMPLETED", "artifactSummary": [] }
   ```

### Error Handling

If any step fails, the workflow calls back FAILED with error details:
```json
{ "jobId": <setupJobId>, "status": "FAILED", "logs": "<error message>" }
```

## Dispatch from App

The app dispatches via GitHub Actions API using `@octokit/rest`:

```typescript
await octokit.actions.createWorkflowDispatch({
  owner: 'ai-board-org',  // ai-board repo owner
  repo: 'ai-board',       // ai-board repo
  workflow_id: 'onboard.yml',
  ref: 'main',
  inputs: {
    projectId: String(project.id),
    setupJobId: String(setupJob.id),
    githubRepository: `${project.githubOwner}/${project.githubRepo}`,
    agent: agent.toLowerCase(),
    callbackUrl: process.env.NEXT_PUBLIC_APP_URL,
    workflowToken: process.env.WORKFLOW_API_TOKEN,
  },
});
```

## Config Sync (App-Side, on COMPLETED)

When the callback reports COMPLETED, the app triggers config sync:

```typescript
import { syncProjectConfig } from '@/lib/config-sync';

// In the PATCH /setup/status handler:
if (status === 'COMPLETED') {
  try {
    await syncProjectConfig(project);
    // configSyncedAt is now set — project bypasses setup on next visit
  } catch (error) {
    // Job stays COMPLETED but project remains in setup state
    // Log error for debugging; user can retry sync manually
  }
}
```

## Test Mode

When `WORKFLOW_TEST_MODE=true` (detected via `isWorkflowTestMode()` from `app/lib/workflows/test-mode.ts`), dispatch is skipped and the job immediately transitions to COMPLETED. This allows integration tests to validate the full flow without GitHub Actions.
