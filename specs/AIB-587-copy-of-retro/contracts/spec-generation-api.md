# API Contracts: Spec Generation

---

## POST `/api/projects/:projectId/spec-generation/jobs`

Create a new spec generation job and dispatch the retro-spec workflow.

### Authentication
- Session-based (NextAuth.js)
- **Owner-only** (via `verifyProjectOwnership`)

### Request Body

```typescript
{
  agent: 'CLAUDE' | 'CODEX';        // Required
  depth: 'QUICK' | 'STANDARD' | 'COMPREHENSIVE'; // Required
  documentationUrl?: string;         // Optional, valid URL, max 2000 chars
  additionalContext?: string;        // Optional, max 5000 chars
}
```

### Zod Schema

```typescript
const createSpecGenJobSchema = z.object({
  agent: z.enum(['CLAUDE', 'CODEX']),
  depth: z.enum(['QUICK', 'STANDARD', 'COMPREHENSIVE']),
  documentationUrl: z.string().url().max(2000).optional().or(z.literal('')),
  additionalContext: z.string().max(5000).optional(),
});
```

### Success Response (201)

```typescript
{
  id: number;
  projectId: number;
  agent: string;
  depth: string;
  status: 'PENDING';
  documentationUrl: string | null;
  additionalContext: string | null;
  createdAt: string; // ISO datetime
}
```

### Error Responses

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid body |
| 401 | — | Not authenticated |
| 403 | — | Not project owner |
| 404 | — | Project not found |
| 409 | `JOB_ACTIVE` | PENDING or RUNNING job already exists |
| 409 | `NOT_CONFIGURED` | Project `configSyncedAt` is null |
| 422 | `CREDENTIAL_MISSING` | Owner lacks AI provider credential |
| 500 | `DISPATCH_FAILED` | GitHub workflow dispatch failed |

---

## GET `/api/projects/:projectId/spec-generation/jobs`

Poll the latest spec generation job status.

### Authentication
- Session-based (NextAuth.js)
- **Owner OR member** (via `verifyProjectAccess`)

### Success Response (200)

```typescript
{
  job: {
    id: number;
    projectId: number;
    agent: string;
    depth: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    workflowRunId: number | null;
    errorMessage: string | null;
    artifactSummary: Record<string, unknown> | null;
    documentationUrl: string | null;
    additionalContext: string | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
  } | null;
  specsGeneratedAt: string | null;
}
```

---

## PATCH `/api/projects/:projectId/spec-generation/jobs/:jobId/status`

Update job status (called by workflow).

### Authentication
- **Workflow token only** (via `validateWorkflowAuth()`)

### Request Body

```typescript
{
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'; // Required
  workflowRunId?: number;
  errorMessage?: string;      // Max 2000 chars
  artifactSummary?: Record<string, unknown>;
}
```

### Zod Schema

```typescript
const updateStatusSchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED']),
  workflowRunId: z.number().optional(),
  errorMessage: z.string().max(2000).optional(),
  artifactSummary: z.record(z.unknown()).optional(),
});
```

### Valid State Transitions

| From | To |
|------|----|
| PENDING | RUNNING, FAILED |
| RUNNING | COMPLETED, FAILED |
| COMPLETED | COMPLETED (idempotent) |
| FAILED | FAILED (idempotent) |

### Side Effects

- **RUNNING**: Set `startedAt = now()` if not already set
- **COMPLETED/FAILED**: Set `completedAt = now()`
- **COMPLETED**: Set `project.specsGeneratedAt = now()`

### Success Response (200)

```typescript
{
  id: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
}
```

### Error Responses

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid body |
| 401 | — | Invalid workflow token |
| 404 | — | Job not found |
| 409 | `INVALID_TRANSITION` | Invalid state transition |
