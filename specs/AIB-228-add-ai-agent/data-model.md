# Data Model: Add AI Agent Selection

**Branch**: `AIB-228-add-ai-agent` | **Date**: 2026-03-04

## New Enum: Agent

```prisma
enum Agent {
  CLAUDE
  CODEX
}
```

**Rationale**: Matches existing enum patterns (ClarificationPolicy, Stage, WorkflowType). Extensible by adding new values (e.g., GEMINI) in future migrations.

## Modified Model: Project

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| `defaultAgent` | `Agent` | No | `CLAUDE` | New field. Follows same pattern as `clarificationPolicy @default(AUTO)` |

```prisma
model Project {
  // ... existing fields ...
  defaultAgent        Agent               @default(CLAUDE)
}
```

## Modified Model: Ticket

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| `agent` | `Agent?` | Yes | `null` | New field. Follows same pattern as `clarificationPolicy ClarificationPolicy?` |

```prisma
model Ticket {
  // ... existing fields ...
  agent               Agent?
}
```

## Inheritance Resolution

```
Effective Agent = ticket.agent ?? ticket.project.defaultAgent
```

Same pattern as: `ticket.clarificationPolicy ?? ticket.project.clarificationPolicy`

## Validation Rules

- **Project.defaultAgent**: Must be a valid `Agent` enum value. Required (non-nullable). Defaults to `CLAUDE`.
- **Ticket.agent**: Must be a valid `Agent` enum value or `null`. Nullable. When `null`, inherits from project.
- **Invalid values**: Rejected at Zod validation layer before reaching database.

## State Transitions

- `Ticket.agent` is editable only when `stage === INBOX` (same restriction as `clarificationPolicy`)
- `Project.defaultAgent` is editable at any time by the project owner

## Migration Strategy

1. Add `Agent` enum with values `CLAUDE`, `CODEX`
2. Add `defaultAgent` column to `Project` with `@default(CLAUDE)` — existing rows get `CLAUDE`
3. Add `agent` column to `Ticket` as nullable — existing rows get `null` (inherit project default)
4. Zero-downtime migration: no data transformation needed, all existing behavior preserved
