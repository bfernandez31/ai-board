# Data Model: Per-Stage Model Configuration (AIB-678)

**Date**: 2026-04-18
**Branch**: `AIB-678-per-stage-model`

## Overview

No new Prisma models are introduced. Ten new nullable columns are added: 5 on `Project` and 5 on `Ticket`. The existing `Job.model` column is reused. A code-owned whitelist and smart-defaults constant live in `lib/models/claude-models.ts`.

---

## Prisma schema changes

### `Project` (extend — `prisma/schema.prisma` L70–99)

Add five nullable columns in the same group as `defaultAgent` and `defaultBranch`:

```prisma
model Project {
  // ... existing fields ...
  defaultBranch       String              @default("main") @db.VarChar(100)
  // NEW: per-stage Claude model configuration (null → resolves to CLAUDE_GLOBAL_FALLBACK_MODEL)
  specifyModel        String?             @db.VarChar(50)
  planModel           String?             @db.VarChar(50)
  implementModel      String?             @db.VarChar(50)
  quickImplModel      String?             @db.VarChar(50)
  verifyModel         String?             @db.VarChar(50)
  // ... rest unchanged ...
}
```

### `Ticket` (extend — `prisma/schema.prisma` L125–159)

Add five nullable columns in the same group as `agent` and `clarificationPolicy`:

```prisma
model Ticket {
  // ... existing fields ...
  clarificationPolicy    ClarificationPolicy?
  agent                  Agent?
  // NEW: per-stage Claude model override (null → inherit project default, which is live at dispatch time)
  specifyModel           String?                   @db.VarChar(50)
  planModel              String?                   @db.VarChar(50)
  implementModel         String?                   @db.VarChar(50)
  quickImplModel         String?                   @db.VarChar(50)
  verifyModel            String?                   @db.VarChar(50)
  // ... rest unchanged ...
}
```

### `Job` (no schema change)

`Job.model: String? @db.VarChar(50)` already exists at `prisma/schema.prisma:53`. Today the field is written post-dispatch by telemetry. After this feature, the field is written at `prisma.job.create(...)` time inside `handleTicketTransition` with the resolved model (or left `null` when the effective agent is not Claude or the command is not one of the 5 configurable stages). Telemetry may still update it with finer-grained values but the initial value MUST match the dispatched model (FR-016).

### Migration

Single Prisma migration adding 10 columns, all nullable, no defaults, no data backfill. Existing rows stay `NULL` on every new column, which — per the resolution algorithm — produces identical dispatch behavior to pre-feature (FR-007, SC-003).

---

## Entities

### ProjectModelConfig (logical, backed by Project columns)

| Attribute       | Type                        | Required | Notes                                                                                                     |
|-----------------|-----------------------------|----------|-----------------------------------------------------------------------------------------------------------|
| `specifyModel`  | `ClaudeModelId \| null`     | no       | Null → global fallback (Opus 4.7). Smart default on new projects: `claude-opus-4-7`.                      |
| `planModel`     | `ClaudeModelId \| null`     | no       | Same semantics. Smart default: `claude-opus-4-7`.                                                         |
| `implementModel`| `ClaudeModelId \| null`     | no       | Smart default: `claude-sonnet-4-6`.                                                                       |
| `quickImplModel`| `ClaudeModelId \| null`     | no       | Smart default: `claude-sonnet-4-6`.                                                                       |
| `verifyModel`   | `ClaudeModelId \| null`     | no       | Smart default: `claude-sonnet-4-6`.                                                                       |

**Validation (FR-002, FR-019)**: When a column is written with a non-null value, it MUST be in `CLAUDE_MODEL_IDS`. Rejections return `400 { error, code: 'INVALID_MODEL_ID' }`.

**Invariants**:
- On project creation (`POST /api/projects`), all five columns are populated with `SMART_DEFAULTS` as part of the same `prisma.$transaction` that creates the project row (FR-006).
- Existing (pre-feature) projects retain all-null values until an owner/member writes one (FR-007).
- The "Apply smart defaults" action (FR-008) overwrites all five columns atomically.
- Any of the five columns may be reset to `null` by writing `null` to the PATCH endpoint (reverting that stage to fallback/default).

### TicketModelOverride (logical, backed by Ticket columns)

| Attribute       | Type                        | Required | Notes                                                                                                     |
|-----------------|-----------------------------|----------|-----------------------------------------------------------------------------------------------------------|
| `specifyModel`  | `ClaudeModelId \| null`     | no       | Null → inherit from project default (live at dispatch time).                                              |
| `planModel`     | `ClaudeModelId \| null`     | no       | Same semantics.                                                                                           |
| `implementModel`| `ClaudeModelId \| null`     | no       | Same semantics.                                                                                           |
| `quickImplModel`| `ClaudeModelId \| null`     | no       | Same semantics.                                                                                           |
| `verifyModel`   | `ClaudeModelId \| null`     | no       | Same semantics.                                                                                           |

**Validation**: Non-null values MUST be in `CLAUDE_MODEL_IDS`. Null is always legal (represents "inherit").

**Invariants**:
- "A ticket with no overrides at all MAY have no physical record" — satisfied because the 5 columns are all-null on every ticket until an override is written. No separate override row is needed.
- Overrides are preserved across agent changes (FR-013, SC-010) — the columns are never auto-cleared; only the resolution function chooses to ignore them when effective agent is not Claude.
- "Reset all to project defaults" (FR-011) → a single UPDATE setting all 5 columns to null.

### ClaudeModelWhitelist (logical, code-owned)

Defined in **`lib/models/claude-models.ts`** (new file):

```ts
export const CLAUDE_MODEL_IDS = [
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
] as const;

export type ClaudeModelId = typeof CLAUDE_MODEL_IDS[number];

export const CLAUDE_MODEL_LABELS: Record<ClaudeModelId, string> = {
  'claude-opus-4-7':            'Claude Opus 4.7',
  'claude-opus-4-6':            'Claude Opus 4.6',
  'claude-sonnet-4-6':          'Claude Sonnet 4.6',
  'claude-haiku-4-5-20251001':  'Claude Haiku 4.5',
};

export const CLAUDE_GLOBAL_FALLBACK_MODEL: ClaudeModelId = 'claude-opus-4-7';

export type StageModelKey =
  | 'specifyModel'
  | 'planModel'
  | 'implementModel'
  | 'quickImplModel'
  | 'verifyModel';

export const SMART_DEFAULTS: Record<StageModelKey, ClaudeModelId> = {
  specifyModel:   'claude-opus-4-7',
  planModel:      'claude-opus-4-7',
  implementModel: 'claude-sonnet-4-6',
  quickImplModel: 'claude-sonnet-4-6',
  verifyModel:    'claude-sonnet-4-6',
};

export function isClaudeModelId(value: unknown): value is ClaudeModelId {
  return typeof value === 'string' && (CLAUDE_MODEL_IDS as readonly string[]).includes(value);
}
```

**Properties**:
- Closed set of 4 IDs (FR-002).
- Single source of truth for UI labels, Zod refinement, and smart defaults.
- Adding a new model requires a code change — no runtime registry (per spec Trade-off #2).

### Job (existing — `model` field reused)

- `model: String? @db.VarChar(50)` at `prisma/schema.prisma:53`.
- Populated at Job creation (transition dispatch) with the resolved model, or left null when agent is not Claude or command is outside the 5 configurable stages (FR-015, FR-017).
- Never mutated by this feature after creation — retries create new Job rows per existing patterns.

---

## Resolution algorithm

Implemented by `resolveStageModel(ticket, command, effectiveAgent)` in `lib/workflows/model-resolution.ts`:

```
Input:
  ticket (with project), command ('specify' | 'plan' | 'implement' | 'quick-impl' | 'verify' | other), effectiveAgent (Agent)

Output:
  ClaudeModelId | null  // null means "do not send model in workflow dispatch"

Steps:
  1. Map command → StageModelKey:
        'specify'    → 'specifyModel'
        'plan'       → 'planModel'
        'implement'  → 'implementModel'
        'quick-impl' → 'quickImplModel'
        'verify'     → 'verifyModel'
     Otherwise → return null (FR-017)
  2. If effectiveAgent !== Agent.CLAUDE → return null (FR-015)
  3. ticketValue = ticket[key]
     if ticketValue && isClaudeModelId(ticketValue) → return ticketValue
  4. projectValue = ticket.project[key]
     if projectValue && isClaudeModelId(projectValue) → return projectValue
  5. Return CLAUDE_GLOBAL_FALLBACK_MODEL (FR-014)
```

**Stale value handling (spec Edge Case "Model removed from whitelist")**: If a stored value is not in the whitelist (e.g., deprecated), the check at step 3 or 4 fails its `isClaudeModelId` guard and resolution continues to the next layer. Write-time validation still rejects unknown IDs.

---

## State transitions

No enum-driven state machines change. The only state that flows:

- **Project creation** → 5 smart-default values persisted (FR-006).
- **Owner/member writes to `/api/projects/:id` PATCH** → one or more of the 5 columns updated.
- **Owner/member clicks "Apply smart defaults"** → all 5 columns overwritten atomically.
- **Owner/member writes to ticket model-config PATCH** → one or more of the ticket's 5 columns updated (or reset to null).
- **Owner/member clicks "Reset all to project defaults"** → all 5 ticket columns set to null.
- **Workflow dispatch (transition)** → resolution runs; `Job.model` set on creation; workflow input includes `model` when non-null.
- **Agent switch to non-Claude** → stored values untouched; resolution returns null on subsequent dispatches (FR-013).
- **Agent switch back to Claude** → no data change needed; subsequent dispatches use stored values.

---

## Referential integrity

- All 10 new columns belong to existing models (`Project`, `Ticket`) — cascade-delete semantics are inherited from the parent row (Project → Ticket → Job remains unchanged).
- No new indexes needed. The 5 columns on `Project` are read only when dispatching from a ticket in that project (already joined in the transition path via `ticket.project`). The 5 columns on `Ticket` are read in the same query that fetches the ticket for transition.

---

## Validation rules summary

| Rule                                                                                 | Enforced where                                                                                | Error code            |
|--------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|-----------------------|
| Value, if present, must be in `CLAUDE_MODEL_IDS`                                     | Zod `claudeModelIdSchema.refine(isClaudeModelId)` on every endpoint accepting these fields     | `INVALID_MODEL_ID`    |
| Only owner or member may read/write project-level model config                       | `verifyProjectAccess(projectId, request)`                                                     | (existing 401/403)    |
| Only owner or member may read/write ticket-level model override                      | `verifyTicketAccess(ticketId, request)`                                                       | (existing 401/403)    |
| Ticket override applies only when effective agent is Claude                          | `resolveStageModel()` early-returns null for non-Claude (FR-015)                              | n/a (silent)          |
| Unknown stored value falls through to next resolution layer                          | `isClaudeModelId` guard in resolution steps 3 & 4                                             | n/a (silent)          |
| Smart defaults seeded on every new project                                           | `prisma.$transaction` in `POST /api/projects` — seed is atomic with project creation (FR-006) | (transaction rollback)|
| "Apply smart defaults" overwrites all 5 columns atomically                           | Single `prisma.project.update` with all 5 fields set                                          | n/a                   |
| "Reset all to project defaults" sets all 5 ticket columns to null atomically         | Single `prisma.ticket.update` with all 5 fields set to null                                   | n/a                   |
