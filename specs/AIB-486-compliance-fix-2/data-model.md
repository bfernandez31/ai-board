# Data Model: AIB-486 Compliance Fix 2

No new database entities or schema changes are required. This ticket modifies runtime data handling only.

## Affected Entities

### ProjectConfig (Zod schema — `lib/validations/config.ts`)

**Change**: Root schema switches from `.passthrough()` to `.strict()`. Nested section schemas also become `.strict()`.

| Field | Type | Change |
|-------|------|--------|
| `ProjectConfigSchema` | `z.object({...}).strict()` | `.passthrough()` → `.strict()` |
| `ProjectSectionSchema` | `z.object({...}).strict()` | Add `.strict()` |
| `RuntimeSectionSchema` | `z.object({...}).strict()` | Add `.strict()` |
| `CommandsSectionSchema` | `z.object({...}).strict()` | Add `.strict()` |
| `AgentSectionSchema` | `z.object({...}).strict()` | Add `.strict()` |

**Validation behavior change**: Unknown fields → validation error (was: warning + passthrough)

### ServiceConfig (Zod schema — `lib/validations/config.ts`)

**Change**: No schema change. `username` and `password` remain as optional fields for validation purposes.

| Field | Type | Change |
|-------|------|--------|
| `type` | `ServiceTypeSchema` | No change |
| `version` | `z.string().min(1)` | No change |
| `database` | `z.string().optional()` | No change |
| `username` | `z.string().optional()` | Retained for validation; stripped post-validation |
| `password` | `z.string().optional()` | Retained for validation; stripped post-validation |

### Project (Prisma model — `prisma/schema.prisma`)

**Change**: No schema change. The `config` JSON field will no longer contain `username`/`password` in service entries for newly synced configs.

## New Functions

### `stripServiceCredentials(config: ProjectConfig): Record<string, unknown>`

**Location**: `lib/validations/config.ts`
**Purpose**: Removes `username` and `password` from each entry in `config.services` before storage/response.
**Input**: Validated `ProjectConfig` object
**Output**: Plain object with credentials stripped from services (and `env` stripped, folding in existing behavior)

## State Transitions

No state transitions affected. Config sync flow remains:
1. Fetch YAML from GitHub
2. Parse YAML
3. Validate via Zod (now with `.strict()` — rejects unknown fields)
4. Strip `env` section **and** service credentials (new)
5. Store sanitized config in DB
6. Return sanitized config in API response
