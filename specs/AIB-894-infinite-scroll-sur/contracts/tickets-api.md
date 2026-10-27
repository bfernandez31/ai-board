# Contract delta: `GET /api/projects/:projectId/tickets`

Auth, error shapes, and all other branches unchanged.

## 1. Default grouped response — new optional `shipLimit`

```
GET /api/projects/:projectId/tickets?shipLimit=<int>
```

| Param | Type | Rule | Default |
|-------|------|------|---------|
| `shipLimit` | integer | `z.coerce.number().int().min(1).max(1000)` | `50` (`SHIP_BATCH_SIZE`) |

- Only applies when none of `stage`, `workflowType`, `limit`, `updatedSince`, `offset` select another branch (the grouped default branch).
- Response unchanged: `{ INBOX: [...], SPECIFY: [...], PLAN: [...], BUILD: [...], VERIFY: [...], SHIP: [...≤ shipLimit], CLOSED: [], _shipTotal: number }`.
- Invalid (`0`, `-1`, `abc`, `1001`, `1.5`) → `400 { error: 'Invalid filter parameters', code: 'VALIDATION_ERROR' }`.

## 2. SHIP batch — unchanged signature, deterministic order

```
GET /api/projects/:projectId/tickets?stage=SHIP&offset=<int>&limit=<int>
→ 200 { tickets: TicketWithVersion[] }
```

- Order is now `updatedAt DESC, id DESC` (was `updatedAt DESC` only) in both this branch and the default branch's SHIP slice, so `page(offset=0) ∪ page(offset=50)` has no overlap and no gap when `updatedAt` ties.
