# Contract: Ticket-level Per-Stage Model Override

**Feature**: AIB-678
**Date**: 2026-04-18

## Endpoint

### PATCH `/api/projects/:projectId/tickets/:ticketId/model-config`

Dedicated endpoint for the ticket's 5 per-stage override columns (FR-009, FR-010, FR-011, FR-013). Kept separate from the generic ticket PATCH so the request shape and "reset all" semantics stay explicit.

**Auth**: `verifyTicketAccess(ticketId, request)` — owner OR member of the parent project (FR-018).

**Request body** (all fields optional):

```json
{
  "specifyModel":   "ClaudeModelId | null (optional) — null means 'inherit project default'",
  "planModel":      "ClaudeModelId | null (optional)",
  "implementModel": "ClaudeModelId | null (optional)",
  "quickImplModel": "ClaudeModelId | null (optional)",
  "verifyModel":    "ClaudeModelId | null (optional)",
  "resetAll":       "boolean (optional) — when true, all 5 columns are set to null, overriding any explicit fields in this payload"
}
```

**Validation**:
- At least one of the 6 fields MUST be present (otherwise `400`).
- Non-null model values MUST be in `CLAUDE_MODEL_IDS`; rejection returns `400 { code: 'INVALID_MODEL_ID' }`.
- `resetAll: true` is equivalent to `{ specifyModel: null, planModel: null, implementModel: null, quickImplModel: null, verifyModel: null }` (FR-011).

**Responses**:

- `200 OK` — returns the updated ticket's 5 model columns and a convenience `hasAnyOverride` flag used by the ticket card:
  ```json
  {
    "ticketId": 456,
    "specifyModel":   null,
    "planModel":      null,
    "implementModel": null,
    "quickImplModel": null,
    "verifyModel":    "claude-opus-4-7",
    "hasAnyOverride": true,
    "overriddenStages": ["VERIFY"]
  }
  ```
- `400 Bad Request` — validation failure (unknown model, empty body).
- `401 Unauthorized` — no session.
- `404 Not Found` — ticket does not exist OR caller is neither owner nor member of the parent project (existing `verifyTicketAccess` pattern).

**Semantics**:
- Partial updates are supported: only the fields present in the body are changed (unless `resetAll: true`, in which case all 5 are nulled regardless of other fields).
- The ticket's stored values are NEVER implicitly deleted when the effective agent switches to non-Claude (FR-013, SC-010). This endpoint never auto-clears.

**Zod schema** (new file `app/lib/schemas/model-config.ts`):

```ts
import { z } from 'zod';
import { CLAUDE_MODEL_IDS, isClaudeModelId } from '@/lib/models/claude-models';

export const claudeModelIdSchema = z.string().refine(isClaudeModelId, {
  message: `Unknown model ID. Allowed: ${CLAUDE_MODEL_IDS.join(', ')}`,
});

export const ticketModelOverrideSchema = z.object({
  specifyModel:   claudeModelIdSchema.nullable().optional(),
  planModel:      claudeModelIdSchema.nullable().optional(),
  implementModel: claudeModelIdSchema.nullable().optional(),
  quickImplModel: claudeModelIdSchema.nullable().optional(),
  verifyModel:    claudeModelIdSchema.nullable().optional(),
  resetAll:       z.boolean().optional(),
}).refine(
  (d) => d.resetAll !== undefined ||
         d.specifyModel !== undefined ||
         d.planModel !== undefined ||
         d.implementModel !== undefined ||
         d.quickImplModel !== undefined ||
         d.verifyModel !== undefined,
  { message: 'At least one field must be provided' }
);
```
