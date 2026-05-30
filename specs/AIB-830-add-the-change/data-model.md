# Data Model — Per-Stage Model Selection for Codex Agent (AIB-830)

**Date**: 2026-05-29
**Source schema**: `prisma/schema.prisma` (authoritative)

## Overview

Five new nullable VarChar(50) columns on `Project` and five matching columns on `Ticket`. Storage shape mirrors the Claude per-stage columns from AIB-678 verbatim. No new tables, no new enums, no schema-level constraints beyond `VarChar(50)`.

## Entities

### Project (extend existing model)

Add the following columns (alphabetically grouped next to existing `*Model` columns for readability):

```prisma
model Project {
  // … existing fields …

  // Claude per-stage (existing, AIB-678)
  specifyModel        String?  @db.VarChar(50)
  planModel           String?  @db.VarChar(50)
  implementModel      String?  @db.VarChar(50)
  quickImplModel      String?  @db.VarChar(50)
  verifyModel         String?  @db.VarChar(50)

  // Codex per-stage (new, AIB-830)
  codexSpecifyModel   String?  @db.VarChar(50)
  codexPlanModel      String?  @db.VarChar(50)
  codexImplementModel String?  @db.VarChar(50)
  codexQuickImplModel String?  @db.VarChar(50)
  codexVerifyModel    String?  @db.VarChar(50)
}
```

**Field semantics**:
- `null` = "use the next layer of the resolver" (project-level fallback → global fallback `gpt-5.5`).
- Non-null = a valid `CodexModelId` (whitelisted). Stale/deprecated values are tolerated in storage (treated as `null` by the resolver, see Pattern P3 in research.md).
- Column-length cap of 50 matches Claude columns and accommodates all current Codex IDs (longest = `gpt-5.4-mini`, 12 chars).

### Ticket (extend existing model)

Symmetric to Project — five new ticket-level override columns:

```prisma
model Ticket {
  // … existing fields …

  // Claude per-stage overrides (existing, AIB-678)
  specifyModel        String?  @db.VarChar(50)
  planModel           String?  @db.VarChar(50)
  implementModel      String?  @db.VarChar(50)
  quickImplModel      String?  @db.VarChar(50)
  verifyModel         String?  @db.VarChar(50)

  // Codex per-stage overrides (new, AIB-830)
  codexSpecifyModel   String?  @db.VarChar(50)
  codexPlanModel      String?  @db.VarChar(50)
  codexImplementModel String?  @db.VarChar(50)
  codexQuickImplModel String?  @db.VarChar(50)
  codexVerifyModel    String?  @db.VarChar(50)
}
```

**Field semantics**:
- `null` = "use the project-level Codex default" (which itself may resolve to global fallback).
- Non-null = a ticket-specific override of `CodexModelId`.

### Job (no schema change)

`Job.model: String? @db.VarChar(50)` already exists and is agent-agnostic. The resolver returns a string; the create call at `lib/workflows/transition.ts:223` and `:241` writes it. No new column needed.

## Constants (TypeScript only — no DB)

### `CODEX_MODEL_IDS`

```ts
export const CODEX_MODEL_IDS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.2',
] as const;

export type CodexModelId = (typeof CODEX_MODEL_IDS)[number];
```

### `CODEX_MODEL_LABELS`

```ts
export const CODEX_MODEL_LABELS: Record<CodexModelId, string> = {
  'gpt-5.5':       'GPT-5.5',
  'gpt-5.4':       'GPT-5.4',
  'gpt-5.4-mini':  'GPT-5.4 mini',
  'gpt-5.3-codex': 'GPT-5.3 Codex',
  'gpt-5.2':       'GPT-5.2',
};
```

### `CODEX_GLOBAL_FALLBACK_MODEL`

```ts
export const CODEX_GLOBAL_FALLBACK_MODEL: CodexModelId = 'gpt-5.5';
```

### `CODEX_STAGE_MODEL_KEYS` and `CODEX_STAGE_MODEL_LABELS`

```ts
export type CodexStageModelKey =
  | 'codexSpecifyModel'
  | 'codexPlanModel'
  | 'codexImplementModel'
  | 'codexQuickImplModel'
  | 'codexVerifyModel';

export const CODEX_STAGE_MODEL_KEYS: readonly CodexStageModelKey[] = [
  'codexSpecifyModel',
  'codexPlanModel',
  'codexImplementModel',
  'codexQuickImplModel',
  'codexVerifyModel',
] as const;

export const CODEX_STAGE_MODEL_LABELS: Record<CodexStageModelKey, string> = {
  codexSpecifyModel:   'SPECIFY',
  codexPlanModel:      'PLAN',
  codexImplementModel: 'IMPLEMENT',
  codexQuickImplModel: 'QUICK-IMPL',
  codexVerifyModel:    'VERIFY',
};
```

### `CODEX_SMART_DEFAULTS`

```ts
export const CODEX_SMART_DEFAULTS: Record<CodexStageModelKey, CodexModelId> = {
  codexSpecifyModel:   'gpt-5.5',
  codexPlanModel:      'gpt-5.5',
  codexImplementModel: 'gpt-5.4',
  codexQuickImplModel: 'gpt-5.4-mini',
  codexVerifyModel:    'gpt-5.4-mini',
};
```

### Type guard

```ts
export function isCodexModelId(value: unknown): value is CodexModelId {
  return typeof value === 'string' && (CODEX_MODEL_IDS as readonly string[]).includes(value);
}
```

### Command → Codex stage key map

```ts
const CODEX_COMMAND_TO_STAGE_KEY: Record<string, CodexStageModelKey> = {
  specify:      'codexSpecifyModel',
  plan:         'codexPlanModel',
  implement:    'codexImplementModel',
  'quick-impl': 'codexQuickImplModel',
  verify:       'codexVerifyModel',
};

export function commandToCodexStageModelKey(command: string): CodexStageModelKey | null {
  return CODEX_COMMAND_TO_STAGE_KEY[command] ?? null;
}
```

The 5 commands match the Claude command map (`lib/models/claude-models.ts:54–60`). Only the value type changes.

## Migration

A single Prisma migration adds the 10 new columns. All nullable, no backfill needed.

```bash
bunx prisma migrate dev --name aib_830_codex_per_stage_models
```

**Migration safety**:
- All columns nullable → no default-value backfill.
- No indexes needed (lookup is always by parent row, never by model identifier).
- No foreign keys.
- Existing rows: all new columns start as `NULL` → resolver returns `CODEX_GLOBAL_FALLBACK_MODEL` for Codex projects, preserving the spec's "new projects without explicit configuration get the strongest recommended Codex model on every stage" property.

## Validation Rules (Zod, enforced at API boundary)

### `codexModelIdSchema` (new, in `app/lib/schemas/model-config.ts`)

```ts
export const codexModelIdSchema = z.string().refine(isCodexModelId, {
  message: `Unknown model ID. Allowed: ${CODEX_MODEL_IDS.join(', ')}`,
});
```

### `projectUpdateSchema` (extend, in `app/lib/schemas/clarification-policy.ts`)

Add 5 fields:

```ts
codexSpecifyModel:   codexModelIdSchema.nullable().optional(),
codexPlanModel:      codexModelIdSchema.nullable().optional(),
codexImplementModel: codexModelIdSchema.nullable().optional(),
codexQuickImplModel: codexModelIdSchema.nullable().optional(),
codexVerifyModel:    codexModelIdSchema.nullable().optional(),
```

### `ticketCodexModelOverrideSchema` (new, in `app/lib/schemas/model-config.ts`)

Same shape as `ticketModelOverrideSchema` but with Codex field names. Two `.refine()` guards:
1. At least one of the 5 fields OR `resetAll: true` must be set.
2. `resetAll: true` cannot be combined with individual stage fields.

### Cross-payload validation (new, in route handler)

The ticket model-config PATCH route MUST reject payloads that mix Claude and Codex field names, because they target different agents and accepting both would silently overwrite the wrong column set when the agents drift apart. Implementation: detect Claude keys (`{specify,plan,implement,quickImpl,verify}Model`) and Codex keys (`codex*Model`) in the parsed body; reject with `400 Bad Request` and code `MIXED_AGENT_PAYLOAD` if both are present.

`resetAll: true` remains agent-agnostic and clears BOTH column sets (Decision D8 in research.md).

## Resolver Behavior (state machine for Codex branch)

Inputs: `ticket` (with `project`), `command`, `effectiveAgent`.

```
1. stageKey ← commandToCodexStageModelKey(command)   // for Codex branch
   if stageKey is null → return null  (non-configurable command)

2. if effectiveAgent ≠ CODEX → return null  (Codex branch does not fire)

3. ticketValue ← ticket[stageKey]
   if ticketValue is non-null AND isCodexModelId(ticketValue) → return ticketValue

4. projectValue ← ticket.project[stageKey]
   if projectValue is non-null AND isCodexModelId(projectValue) → return projectValue

5. return CODEX_GLOBAL_FALLBACK_MODEL
```

A stored value that is not in `CODEX_MODEL_IDS` (deprecated by OpenAI) falls through at steps 3 and 4 — never throws.

## State Transitions

Not applicable beyond resolver flow above; this is configuration data with no lifecycle of its own.

## Entity relationship summary

| Entity | New columns | Cardinality | Lifecycle |
|--------|-------------|-------------|-----------|
| Project | 5 `codex*Model` (nullable) | One set per Project | Created with project (all NULL); mutated via `PATCH /api/projects/:id` and `POST .../apply-smart-defaults`; never deleted (set to NULL to reset) |
| Ticket | 5 `codex*Model` (nullable) | One set per Ticket | Created with ticket (all NULL); mutated via `PATCH .../tickets/:id/model-config`; cleared by `resetAll` |
| Job | (no change) `model` column | One value per Job | Set on `prisma.job.create` from resolver output |
