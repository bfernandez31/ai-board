# API Contract: Bulk Ticket Operations

**Endpoint**: `POST /api/projects/[projectId]/tickets/bulk`  
**Auth**: Session cookie (verifyProjectAccess)  
**Content-Type**: `application/json`

---

## Action: Delete

### Request
```json
{
  "action": "delete",
  "ticketIds": [10, 15, 20]
}
```

### Response (200 OK)
```json
{
  "action": "delete",
  "results": {
    "succeeded": [
      { "ticketId": 10, "ticketKey": "AIB-10" },
      { "ticketId": 20, "ticketKey": "AIB-20" }
    ],
    "skipped": [
      { "ticketId": 15, "ticketKey": "AIB-15", "reason": "Ticket has an active job (RUNNING)" }
    ]
  },
  "summary": { "total": 3, "succeeded": 2, "skipped": 1 }
}
```

### Error Responses
- `400` — Invalid payload (validation error, empty ticketIds)
- `401` — Unauthorized
- `403` — Not a project member
- `404` — Project not found
- `422` — Tickets not in INBOX stage

---

## Action: Merge

### Request
```json
{
  "action": "merge",
  "ticketIds": [10, 15, 20],
  "mergedTitle": "Consolidated ticket title",
  "mergedDescription": "Combined description text...",
  "selectedAttachments": ["att-uuid-1", "att-uuid-2"]
}
```

### Response (200 OK)
```json
{
  "action": "merge",
  "baseTicket": {
    "id": 10,
    "ticketKey": "AIB-10",
    "title": "Consolidated ticket title",
    "description": "Combined description text...",
    "attachments": ["att-uuid-1", "att-uuid-2"],
    "version": 2
  },
  "deletedTickets": [
    { "ticketId": 15, "ticketKey": "AIB-15" },
    { "ticketId": 20, "ticketKey": "AIB-20" }
  ],
  "summary": { "merged": 3, "deleted": 2 }
}
```

### Error Responses
- `400` — Fewer than 2 tickets, description exceeds 10,000 chars, attachments exceed 5
- `400` — Ticket has active job (PENDING/RUNNING) — blocks entire merge
- `401` — Unauthorized
- `403` — Not a project member
- `404` — Project or ticket not found
- `409` — Concurrent modification (version conflict)
- `422` — Tickets not in INBOX stage

---

## Action: Update Agent

### Request
```json
{
  "action": "update-agent",
  "ticketIds": [10, 15, 20],
  "agent": "GEMINI"
}
```

### Response (200 OK)
```json
{
  "action": "update-agent",
  "results": {
    "succeeded": [
      { "ticketId": 10, "ticketKey": "AIB-10", "version": 2 },
      { "ticketId": 15, "ticketKey": "AIB-15", "version": 3 },
      { "ticketId": 20, "ticketKey": "AIB-20", "version": 2 }
    ],
    "skipped": []
  },
  "summary": { "total": 3, "succeeded": 3, "skipped": 0 }
}
```

### Error Responses
- `400` — Invalid agent value
- `401` — Unauthorized
- `403` — Not a project member
- `422` — Tickets not in INBOX stage

---

## Action: Update Model

### Request
```json
{
  "action": "update-model",
  "ticketIds": [10, 15, 20],
  "model": "claude-opus-4-7"
}
```

### Response (200 OK)
```json
{
  "action": "update-model",
  "results": {
    "succeeded": [
      { "ticketId": 10, "ticketKey": "AIB-10", "version": 2 },
      { "ticketId": 15, "ticketKey": "AIB-15", "version": 3 }
    ],
    "skipped": [
      { "ticketId": 20, "ticketKey": "AIB-20", "reason": "Concurrent modification" }
    ]
  },
  "summary": { "total": 3, "succeeded": 2, "skipped": 1 }
}
```

### Error Responses
- `400` — Invalid model ID
- `401` — Unauthorized
- `403` — Not a project member
- `422` — Tickets not in INBOX stage

---

## Shared Validation (All Actions)

1. `ticketIds` must be a non-empty array of positive integers
2. All referenced tickets must belong to `projectId`
3. All referenced tickets must be in INBOX stage
4. Caller must pass `verifyProjectAccess(projectId)` check

## Zod Schemas

```typescript
const bulkDeleteSchema = z.object({
  action: z.literal('delete'),
  ticketIds: z.array(z.number().int().positive()).min(1),
});

const bulkMergeSchema = z.object({
  action: z.literal('merge'),
  ticketIds: z.array(z.number().int().positive()).min(2),
  mergedTitle: z.string().min(1).max(100),
  mergedDescription: z.string().max(10000),
  selectedAttachments: z.array(z.string()).max(5).default([]),
});

const bulkUpdateAgentSchema = z.object({
  action: z.literal('update-agent'),
  ticketIds: z.array(z.number().int().positive()).min(1),
  agent: z.enum(['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']),
});

const bulkUpdateModelSchema = z.object({
  action: z.literal('update-model'),
  ticketIds: z.array(z.number().int().positive()).min(1),
  model: z.string().min(1),
});

const bulkActionSchema = z.discriminatedUnion('action', [
  bulkDeleteSchema,
  bulkMergeSchema,
  bulkUpdateAgentSchema,
  bulkUpdateModelSchema,
]);
```
