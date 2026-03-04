# API Contracts: AI Agent Selection

**Branch**: `AIB-228-add-ai-agent` | **Date**: 2026-03-04

## Enum Values

```typescript
type Agent = "CLAUDE" | "CODEX";
```

---

## PATCH /api/projects/[projectId]

**Change**: Add optional `defaultAgent` field to request body.

### Request (extended)

```json
{
  "defaultAgent": "CODEX"
}
```

### Validation Schema (Zod)

```typescript
// New file: app/lib/schemas/agent.ts
export const projectAgentSchema = z.nativeEnum(Agent);
export const ticketAgentSchema = z.nativeEnum(Agent).nullable();

// Extended in project update schema
{
  defaultAgent: projectAgentSchema.optional()
}
```

### Response (Project object includes new field)

```json
{
  "id": 1,
  "name": "My Project",
  "key": "ABC",
  "defaultAgent": "CODEX",
  "clarificationPolicy": "AUTO",
  ...
}
```

### Authorization

- Project owner only (`verifyProjectOwnership`)

### Errors

- `400`: Invalid agent value → `{ "error": "Invalid enum value. Expected 'CLAUDE' | 'CODEX'" }`
- `403`: Non-owner attempt → `{ "error": "Not authorized" }`

---

## POST /api/projects/[projectId]/tickets

**Change**: Add optional `agent` field to request body.

### Request (extended)

```json
{
  "title": "My Ticket",
  "description": "Description",
  "agent": "CODEX"
}
```

Or omit `agent` to inherit project default (field will be `null` in database).

### Validation Schema

```typescript
// Extended in CreateTicketSchema
{
  agent: ticketAgentSchema.optional()
}
```

### Response (Ticket object includes new field)

```json
{
  "id": 1,
  "ticketKey": "ABC-1",
  "title": "My Ticket",
  "agent": "CODEX",
  ...
}
```

When agent is not specified:

```json
{
  "id": 1,
  "ticketKey": "ABC-1",
  "title": "My Ticket",
  "agent": null,
  ...
}
```

---

## PATCH /api/projects/[projectId]/tickets/[id]

**Change**: Add optional `agent` field to request body.

### Request (extended)

```json
{
  "agent": "CODEX"
}
```

To clear override (revert to project default):

```json
{
  "agent": null
}
```

### Validation Schema

```typescript
// Extended in patchTicketSchema
{
  agent: ticketAgentSchema.optional()
}
```

### Authorization

- Project owner or member (`verifyProjectAccess`)
- Stage must be `INBOX` (same restriction as `clarificationPolicy`)

### Errors

- `400`: Invalid agent value
- `400`: Stage not INBOX → `{ "error": "Cannot edit agent outside INBOX stage" }`
- `403`: Not authorized

---

## GET /api/projects/[projectId]

**Change**: Response now includes `defaultAgent` field.

No request changes.

---

## GET /api/projects/[projectId]/tickets/[id]

**Change**: Response now includes `agent` field (nullable).

No request changes.
