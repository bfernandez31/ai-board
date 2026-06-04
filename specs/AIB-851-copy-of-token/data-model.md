# Data Model: Token Saving via RTK + Unified Per-Ticket Run Settings

**Branch**: `AIB-851-copy-of-token` | **Date**: 2026-06-04

## Schema Changes

### Project Model (extend existing)

| Field | Type | Default | Nullable | Constraint | Purpose |
|-------|------|---------|----------|------------|---------|
| `tokenSaving` | Boolean | `false` | No | — | Project-level token saving toggle |

**Migration**: `ALTER TABLE "Project" ADD COLUMN "tokenSaving" BOOLEAN NOT NULL DEFAULT false;`

### Ticket Model (extend existing)

| Field | Type | Default | Nullable | Constraint | Purpose |
|-------|------|---------|----------|------------|---------|
| `tokenSaving` | Boolean | — | Yes (null) | — | Per-ticket override: `true` = force ON, `false` = force OFF, `null` = inherit from project |

**Migration**: `ALTER TABLE "Ticket" ADD COLUMN "tokenSaving" BOOLEAN;`

### Job Model (extend existing)

| Field | Type | Default | Nullable | Constraint | Purpose |
|-------|------|---------|----------|------------|---------|
| `tokenSavingStatus` | String | — | Yes (null) | VarChar(20) | Status: `"active"`, `"inactive"`, `"fallback"`, `"n/a"` |

**Migration**: `ALTER TABLE "Job" ADD COLUMN "tokenSavingStatus" VARCHAR(20);`

## Resolution Chain

```
Effective token saving = ticket.tokenSaving ?? project.tokenSaving ?? false

Examples:
  ticket.tokenSaving = true,  project.tokenSaving = false  → true  (ticket override wins)
  ticket.tokenSaving = false, project.tokenSaving = true   → false (ticket override wins)
  ticket.tokenSaving = null,  project.tokenSaving = true   → true  (inherits project)
  ticket.tokenSaving = null,  project.tokenSaving = false  → false (inherits project)
```

## State Transitions

### Token Saving Status (per Job)

```
                   ┌─ Agent is not Claude ──────────── "n/a"
                   │
Dispatch ──────────┼─ Effective setting is OFF ─────── "inactive"
                   │
                   └─ Effective setting is ON
                         │
                         ├─ RTK install succeeds ───── "active"
                         │
                         └─ RTK install fails ──────── "fallback"
```

Status is written once at job start and never changes.

## Validation Rules

### Project-level `tokenSaving`
- Type: `z.boolean().optional()` in `projectUpdateSchema`
- Only project owner can modify (via existing `verifyProjectOwnership`)
- Default: `false` (safe default — no surprise token compression)

### Ticket-level `tokenSaving`
- Type: `z.boolean().nullable().optional()` in `patchTicketSchema`
- Editable at any stage (not locked to INBOX like policy/agent)
- Any project member can modify (via existing `verifyProjectAccess`)

### Job `tokenSavingStatus`
- Written by runner only, not user-facing API input
- Validated as one of: `"active"`, `"inactive"`, `"fallback"`, `"n/a"`

## Entity Relationships

```
Project (1) ──── tokenSaving: Boolean ────── default for all tickets
    │
    ├── Ticket (N) ── tokenSaving: Boolean? ── override (nullable)
    │       │
    │       └── Job (N) ── tokenSavingStatus: String? ── per-run result
    │
    └── (existing: clarificationPolicy, defaultAgent, *Model fields)
```

## Clone/Copy Behavior

| Operation | Token Saving Override |
|-----------|---------------------|
| Simple copy | Preserved from source (same as `clarificationPolicy`, `agent`) |
| Full clone | Preserved from source (same as `clarificationPolicy`, `agent`) |

## Impact on Existing Models

No existing fields are modified, renamed, or removed. All changes are additive:
- 1 new column on Project
- 1 new column on Ticket
- 1 new column on Job
