# Contract: Ticket-level Codex Model Override

**Feature**: AIB-830
**Date**: 2026-05-29

## Endpoint

### PATCH `/api/projects/:projectId/tickets/:id/model-config` (extend existing)

Extends the existing endpoint (`app/api/projects/[projectId]/tickets/[id]/model-config/route.ts`) to accept Codex per-stage overrides in addition to the existing Claude ones. Same route, same authorization, same `resetAll` contract.

**Auth**: existing — `verifyTicketAccess(ticketId, request)` (owner OR member via parent project). No change.

**Request body** — one of three valid shapes:

**Shape A: Claude per-stage override** (unchanged from AIB-678):

```json
{
  "specifyModel": "claude-opus-4-7" | null,
  "planModel": …,
  "implementModel": …,
  "quickImplModel": …,
  "verifyModel": …
}
```
At least one of the 5 fields must be present.

**Shape B: Codex per-stage override** (new):

```json
{
  "codexSpecifyModel": "gpt-5.5" | null,
  "codexPlanModel": …,
  "codexImplementModel": …,
  "codexQuickImplModel": …,
  "codexVerifyModel": …
}
```
At least one of the 5 Codex fields must be present.

**Shape C: Reset all** (agent-agnostic, clears BOTH Claude AND Codex columns):

```json
{ "resetAll": true }
```

**Invalid combinations**:
- Mixed Claude and Codex fields in the same body (e.g., `specifyModel` AND `codexSpecifyModel`) — rejected. See `MIXED_AGENT_PAYLOAD` below.
- `resetAll: true` combined with any individual stage field — already rejected by existing Zod refine.
- Empty body — already rejected.

**Responses**:

- `200 OK` — returns the updated overrides + computed flags. Body shape extended to include Codex columns:

  ```json
  {
    "ticketId": 42,
    "specifyModel": null,
    "planModel": null,
    "implementModel": null,
    "quickImplModel": null,
    "verifyModel": null,
    "codexSpecifyModel": "gpt-5.5",
    "codexPlanModel": null,
    "codexImplementModel": null,
    "codexQuickImplModel": null,
    "codexVerifyModel": null,
    "hasAnyOverride": true,
    "overriddenStages": ["SPECIFY"]
  }
  ```

  `overriddenStages` is computed from whichever agent's columns have at least one non-null value. If both agents' columns are populated (possible across agent switches), all populated stages are listed once each (no de-duplication needed because stage labels are the same — SPECIFY/PLAN/IMPLEMENT/QUICK-IMPL/VERIFY).

  `hasAnyOverride` is `true` if ANY of the 10 columns are non-null.

- `400 Bad Request` — validation failures:
  - Unknown Codex model ID:
    ```json
    { "error": "Unknown model ID. Allowed: gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.3-codex, gpt-5.2", "code": "INVALID_MODEL_ID", "issues": [...] }
    ```
  - Unknown Claude model ID (unchanged):
    ```json
    { "error": "Unknown model ID. Allowed: claude-opus-4-7, claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001", "code": "INVALID_MODEL_ID", "issues": [...] }
    ```
  - Mixed-agent payload:
    ```json
    { "error": "Request mixes Claude and Codex model fields. Submit one agent's overrides at a time.", "code": "MIXED_AGENT_PAYLOAD" }
    ```
  - Empty body / resetAll-with-fields (unchanged from AIB-678).

- `401 Unauthorized` — no session.
- `404 Not Found` — ticket not in project, or caller has no access.

**Semantics**:
- Writing a Codex field updates ONLY the matching `codex*Model` column on the ticket. Claude columns remain untouched.
- Writing `null` on a Codex field clears that ticket-level override (resolver then falls through to project default).
- `resetAll: true` clears all 10 columns in one update (Decision D8 in research.md). This is the "I want a clean slate regardless of which agent I'm currently using" affordance.

**Schema definitions** (Phase 2 implementation; documented here for contract clarity):

```ts
// app/lib/schemas/model-config.ts (extend)

export const codexModelIdSchema = z.string().refine(isCodexModelId, {
  message: `Unknown model ID. Allowed: ${CODEX_MODEL_IDS.join(', ')}`,
});

export const ticketCodexModelOverrideSchema = z
  .object({
    codexSpecifyModel:   codexModelIdSchema.nullable().optional(),
    codexPlanModel:      codexModelIdSchema.nullable().optional(),
    codexImplementModel: codexModelIdSchema.nullable().optional(),
    codexQuickImplModel: codexModelIdSchema.nullable().optional(),
    codexVerifyModel:    codexModelIdSchema.nullable().optional(),
    resetAll: z.boolean().optional(),
  })
  .refine(
    (d) => d.resetAll === true ||
      d.codexSpecifyModel !== undefined ||
      d.codexPlanModel !== undefined ||
      d.codexImplementModel !== undefined ||
      d.codexQuickImplModel !== undefined ||
      d.codexVerifyModel !== undefined,
    { message: 'At least one field must be provided' }
  )
  .refine(
    (d) => d.resetAll !== true || (
      d.codexSpecifyModel === undefined &&
      d.codexPlanModel === undefined &&
      d.codexImplementModel === undefined &&
      d.codexQuickImplModel === undefined &&
      d.codexVerifyModel === undefined
    ),
    { message: 'resetAll cannot be combined with individual stage fields' }
  );
```

**Route handler logic** (Phase 2):

1. Parse raw body once.
2. Detect agent shape by inspecting which keys are present:
   - Has any Claude key → Claude branch.
   - Has any Codex key → Codex branch.
   - Has both → return `400 MIXED_AGENT_PAYLOAD`.
   - Has `resetAll: true` only → resetAll branch (no Zod refine needed beyond existing).
3. Run the appropriate Zod schema.
4. Build `updateData` containing ONLY the active agent's columns (or both columns sets nulled for resetAll).
5. `prisma.ticket.update({ where: { id, projectId }, data: updateData, select: { … all 10 columns, id … } })`.
6. Compute `hasAnyOverride` and `overriddenStages` from the resulting row.
