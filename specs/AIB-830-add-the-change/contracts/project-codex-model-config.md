# Contract: Project-level Codex Model Configuration

**Feature**: AIB-830
**Date**: 2026-05-29

## Endpoints

### PATCH `/api/projects/:projectId` (extend existing)

Extends the existing endpoint (`app/api/projects/[projectId]/route.ts`) to accept the 5 new Codex per-stage model fields alongside the existing Claude fields. No new route is introduced.

**Auth**: existing — `verifyProjectAccess(projectId, request)` (owner OR member) via `getProject` / `updateProject`. No change.

**Request body** (all fields optional, at least one must be present per existing PATCH semantics):

```json
{
  "clarificationPolicy": "AUTO | CONSERVATIVE | PRAGMATIC (optional, unchanged)",
  "defaultAgent":        "CLAUDE | CODEX | MISTRAL | GEMINI (optional, unchanged)",
  "deploymentUrl":       "string | null (optional, unchanged)",

  "specifyModel":         "ClaudeModelId | null (optional, unchanged)",
  "planModel":            "ClaudeModelId | null (optional, unchanged)",
  "implementModel":       "ClaudeModelId | null (optional, unchanged)",
  "quickImplModel":       "ClaudeModelId | null (optional, unchanged)",
  "verifyModel":          "ClaudeModelId | null (optional, unchanged)",

  "codexSpecifyModel":    "CodexModelId | null (optional, NEW)",
  "codexPlanModel":       "CodexModelId | null (optional, NEW)",
  "codexImplementModel":  "CodexModelId | null (optional, NEW)",
  "codexQuickImplModel":  "CodexModelId | null (optional, NEW)",
  "codexVerifyModel":     "CodexModelId | null (optional, NEW)"
}
```

Where:
- `CodexModelId` ∈ `{ 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.2' }`
- `ClaudeModelId` (unchanged) ∈ `{ 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001' }`

**Responses**:

- `200 OK` — returns the updated project row. Body includes both agent's column sets:
  ```json
  {
    "id": 123,
    "name": "…",
    "defaultAgent": "CODEX",
    "specifyModel": null,
    "planModel": null,
    "implementModel": null,
    "quickImplModel": null,
    "verifyModel": null,
    "codexSpecifyModel": "gpt-5.5",
    "codexPlanModel": "gpt-5.5",
    "codexImplementModel": "gpt-5.4",
    "codexQuickImplModel": "gpt-5.4-mini",
    "codexVerifyModel": "gpt-5.4-mini"
  }
  ```
- `400 Bad Request` — validation failure on any model field. Body when the failing field is a Codex column:
  ```json
  {
    "error": "Unknown model ID. Allowed: gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.3-codex, gpt-5.2",
    "code": "INVALID_MODEL_ID",
    "issues": [/* Zod issues array */]
  }
  ```
- `401 Unauthorized` — no session.
- `404 Not Found` — caller is neither owner nor member (anti-enumeration; matches AIB-678 behavior).

**Semantics**:
- Writing `null` on any of the 5 new fields resets that stage to "no project-level Codex value" (resolves to fallback).
- Writing a whitelisted Codex ID sets the column.
- Other fields remain unchanged when omitted (existing PATCH semantics).
- Claude and Codex columns are independent: writing a Codex value never touches the corresponding Claude column.

**Schema extension** (Phase 2 implementation; documented here for contract clarity):

```ts
// app/lib/schemas/clarification-policy.ts
export const projectUpdateSchema = z.object({
  // … existing fields …
  codexSpecifyModel:   codexModelIdSchema.nullable().optional(),
  codexPlanModel:      codexModelIdSchema.nullable().optional(),
  codexImplementModel: codexModelIdSchema.nullable().optional(),
  codexQuickImplModel: codexModelIdSchema.nullable().optional(),
  codexVerifyModel:    codexModelIdSchema.nullable().optional(),
});
```

**Route handler error matcher** (`app/api/projects/[projectId]/route.ts:84–95`) MUST include the 5 Codex field names in the `find` predicate so Zod failures on Codex fields return `INVALID_MODEL_ID`:

```ts
const modelFieldIssue = error.issues.find((issue) =>
  typeof issue.path[0] === 'string' &&
  [
    'specifyModel', 'planModel', 'implementModel', 'quickImplModel', 'verifyModel',
    'codexSpecifyModel', 'codexPlanModel', 'codexImplementModel', 'codexQuickImplModel', 'codexVerifyModel',
  ].includes(issue.path[0] as string)
);
```

---

### POST `/api/projects/:projectId/model-config/apply-smart-defaults` (extend existing)

Atomically overwrites the 5 per-stage model columns of the project's CURRENT effective agent (CLAUDE or CODEX) with the corresponding `SMART_DEFAULTS`. Returns the resulting agent-specific column set.

**Auth**: existing — `verifyProjectAccess(projectId, request)` (owner OR member).

**Request body**: empty (or ignored).

**Responses**:

When `project.defaultAgent === CLAUDE` (existing behavior, unchanged):
- `200 OK` —
  ```json
  {
    "specifyModel":   "claude-opus-4-7",
    "planModel":      "claude-opus-4-7",
    "implementModel": "claude-sonnet-4-6",
    "quickImplModel": "claude-sonnet-4-6",
    "verifyModel":    "claude-sonnet-4-6"
  }
  ```

When `project.defaultAgent === CODEX` (new):
- `200 OK` —
  ```json
  {
    "codexSpecifyModel":   "gpt-5.5",
    "codexPlanModel":      "gpt-5.5",
    "codexImplementModel": "gpt-5.4",
    "codexQuickImplModel": "gpt-5.4-mini",
    "codexVerifyModel":    "gpt-5.4-mini"
  }
  ```

When `project.defaultAgent` is anything else (MISTRAL, GEMINI):
- `400 Bad Request` —
  ```json
  { "error": "Smart defaults are only available for Claude or Codex projects.", "code": "UNSUPPORTED_AGENT_FOR_SMART_DEFAULTS" }
  ```

Other responses unchanged:
- `401 Unauthorized` — no session.
- `404 Not Found` — caller is neither owner nor member.

**Semantics**:
- Idempotent within an agent: applying twice yields identical state.
- Implemented as a single `prisma.project.update` writing the 5 fields for the active agent only (Pattern P4 in research.md). The dormant agent's columns are untouched.
- The response only includes the columns of the active agent (mirrors today's response shape exactly when agent is Claude).
- The route fetches `defaultAgent` first to decide which column set to write (one extra `prisma.project.findUnique` of the agent field, then the update). Alternative: a single `update` that reads then writes inside `prisma.$transaction` — acceptable but not required since the agent isn't a concurrency hazard.

---

### POST `/api/projects` (existing — extend)

The existing project-creation endpoint already seeds Claude `SMART_DEFAULTS` inside its `prisma.$transaction`. AIB-830 extends the same `prisma.project.create` data block to ALSO seed `CODEX_SMART_DEFAULTS` into the `codex*Model` columns. The seed happens regardless of the project's `defaultAgent` value (so switching to Codex later activates stored defaults — matches AIB-678's "seed Claude regardless of agent" rule).

**Public request/response shape**: unchanged.

**Behavior change**: newly created projects now have 10 model columns populated (5 Claude + 5 Codex) instead of 5.

**Failure mode**: seed failure rolls back project creation via the existing transaction.
