# API Contracts: Project Onboarding Setup

**Feature Branch**: `AIB-574-project-onboarding-setup`
**Date**: 2026-04-08

## GET /api/projects/[projectId]/setup

Returns the current setup state for a project.

**Auth**: Session (owner or member)

### Response 200

```typescript
{
  setupState: 'NEEDS_SETUP' | 'IN_PROGRESS' | 'COMPLETED' | 'SYNC_FAILED' | 'FAILED' | 'CONFIGURED';
  latestJob: {
    id: number;
    agent: 'CLAUDE' | 'CODEX';
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    logs: string | null;
    artifactSummary: unknown | null;
    startedAt: string;       // ISO 8601
    completedAt: string | null;
  } | null;
  configSyncedAt: string | null;  // ISO 8601
}
```

### Response 403

```typescript
{ error: "Access denied" }
```

---

## POST /api/projects/[projectId]/setup

Dispatches the onboarding workflow for a project.

**Auth**: Session (owner only)

### Request Body

```typescript
{
  agent: 'CLAUDE' | 'CODEX';
}
```

### Response 201

```typescript
{
  jobId: number;
  status: 'PENDING';
  agent: 'CLAUDE' | 'CODEX';
}
```

### Response 403

```typescript
{ error: "Only the project owner can dispatch setup" }
```

### Response 409 — Already configured

```typescript
{ error: "Project is already configured", code: "ALREADY_CONFIGURED" }
```

### Response 409 — Job in progress

```typescript
{ error: "A setup job is already in progress", code: "JOB_IN_PROGRESS" }
```

### Response 422 — Missing credential

```typescript
{ error: "No {provider} credential configured. Please add your key in Settings → AI Credentials.", code: "MISSING_CREDENTIAL" }
```

---

## PATCH /api/projects/[projectId]/setup/status

Workflow callback to update setup job status.

**Auth**: Bearer token (`WORKFLOW_API_TOKEN`)

### Request Body

```typescript
{
  jobId: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  logs?: string;
  artifactSummary?: unknown;  // JSON array of file paths (stub: empty array)
}
```

### Response 200

```typescript
{
  id: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  completedAt: string | null;
  configSynced: boolean;  // true if config sync succeeded on COMPLETED
}
```

### Response 400 — Invalid transition

```typescript
{ error: "Invalid status transition from {from} to {to}" }
```

### Response 401 — Auth failure

```typescript
{ error: "Unauthorized" }
```

### Response 404 — Job not found

```typescript
{ error: "Setup job not found" }
```
