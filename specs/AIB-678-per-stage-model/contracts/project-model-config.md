# Contract: Project-level Model Configuration

**Feature**: AIB-678
**Date**: 2026-04-18

## Endpoints

### PATCH `/api/projects/:projectId`

Extend the existing endpoint to accept the 5 per-stage model fields. Does not introduce a new route.

**Auth**: `verifyProjectAccess(projectId, request)` — owner OR member (FR-018).

**Request body** (all fields optional; at least one must be present per existing schema rules):

```json
{
  "clarificationPolicy": "AUTO | CONSERVATIVE | PRAGMATIC (optional, unchanged)",
  "defaultAgent":        "CLAUDE | CODEX | MISTRAL | GEMINI (optional, unchanged)",
  "deploymentUrl":       "string | null (optional, unchanged)",

  "specifyModel":        "ClaudeModelId | null (optional, NEW)",
  "planModel":           "ClaudeModelId | null (optional, NEW)",
  "implementModel":      "ClaudeModelId | null (optional, NEW)",
  "quickImplModel":      "ClaudeModelId | null (optional, NEW)",
  "verifyModel":         "ClaudeModelId | null (optional, NEW)"
}
```

`ClaudeModelId` ∈ `{ 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001' }`.

**Responses**:

- `200 OK` — returns the updated project row. Body:
  ```json
  {
    "id": 123,
    "name": "…",
    "defaultAgent": "CLAUDE",
    "clarificationPolicy": "AUTO",
    "specifyModel": "claude-opus-4-7",
    "planModel": "claude-opus-4-7",
    "implementModel": "claude-sonnet-4-6",
    "quickImplModel": "claude-sonnet-4-6",
    "verifyModel": "claude-sonnet-4-6"
  }
  ```
- `400 Bad Request` — validation failure. Body: `{ "error": "Unknown model ID \"foo\". Allowed: claude-opus-4-7, claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001", "code": "INVALID_MODEL_ID" }`
- `401 Unauthorized` — no session.
- `403 Forbidden` / `404 Not Found` — caller is neither owner nor member (returned as `404` by `verifyProjectAccess` to avoid enumeration, matching existing pattern).

**Semantics**:
- Writing `null` on any of the 5 new fields resets that stage to "no project-level value" (resolves to fallback).
- Writing a whitelisted ID sets the column.
- Other fields remain unchanged when omitted (existing PATCH semantics).

**Zod schema extension** (`app/lib/schemas/clarification-policy.ts`):

```ts
import { z } from 'zod';
import { claudeModelIdSchema } from '@/app/lib/schemas/model-config';

export const projectUpdateSchema = z.object({
  clarificationPolicy: projectClarificationPolicySchema.optional(),
  defaultAgent: z.nativeEnum(Agent).optional(),
  deploymentUrl: z.string().url().max(500).nullable().optional(),
  specifyModel:   claudeModelIdSchema.nullable().optional(),
  planModel:      claudeModelIdSchema.nullable().optional(),
  implementModel: claudeModelIdSchema.nullable().optional(),
  quickImplModel: claudeModelIdSchema.nullable().optional(),
  verifyModel:    claudeModelIdSchema.nullable().optional(),
});
```

---

### POST `/api/projects/:projectId/model-config/apply-smart-defaults`

Atomically overwrites the project's 5 per-stage model columns with `SMART_DEFAULTS`. Satisfies FR-008.

**Auth**: `verifyProjectAccess(projectId, request)` — owner OR member.

**Request body**: empty (or ignored).

**Responses**:

- `200 OK` — Body:
  ```json
  {
    "specifyModel":   "claude-opus-4-7",
    "planModel":      "claude-opus-4-7",
    "implementModel": "claude-sonnet-4-6",
    "quickImplModel": "claude-sonnet-4-6",
    "verifyModel":    "claude-sonnet-4-6"
  }
  ```
- `401 Unauthorized` — no session.
- `404 Not Found` — caller is neither owner nor member.

**Semantics**:
- Idempotent: applying twice yields identical state.
- Implemented as a single `prisma.project.update` with all 5 fields.

---

### POST `/api/projects` (extend — existing endpoint)

Existing project creation endpoint is extended so that inside its existing `prisma.$transaction` (app/api/projects/route.ts:94–114), the `prisma.project.create` data block includes the `SMART_DEFAULTS` (FR-006). The public request/response shape is unchanged. Only behavior: newly created projects now have the 5 smart-default values persisted.

**Semantics**:
- Seeding happens regardless of the project's `defaultAgent` (FR-006, so switching to Claude later activates stored values).
- Failure of the seed fails project creation (transaction rollback).
