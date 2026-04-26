# API Contract: Outcome Read Endpoints

**Feature**: AIB-742
**Scope**: Read-only endpoints for ticket outcomes. No PUT/PATCH/DELETE — outcome immutability is enforced at the HTTP layer.

## Common

- All endpoints are App Router routes under `app/api/projects/[projectId]/...`.
- Authentication: NextAuth session (existing pattern); test requests can use the `x-test-user-id` header against seeded users.
- Authorization: `verifyProjectAccess(projectId)` (owner or member) for reads; existing helper at `lib/auth.ts`.
- Response shape: `application/json`. Error responses use the standard `{ error: string, code?: string }` envelope per constitution §"Error Handling".

## 1. GET `/api/projects/[projectId]/tickets/[ticketId]/outcome`

**Purpose**: Fetch a single outcome by ticket. Used by the upcoming prediction-grounding feature and by ticket-detail UI consumers.

### Auth
`verifyTicketAccess(ticketId)` — denies if the caller has no access to the parent project.

### Path params
| Param | Type | Notes |
|---|---|---|
| `projectId` | integer | Project owning the ticket |
| `ticketId` | integer | Target ticket (numeric `Ticket.id`, NOT `ticketKey`) |

### Query params
None.

### Response 200
```json
{
  "id": 42,
  "ticketId": 1234,
  "projectId": 7,
  "workflowType": "FULL",
  "shippedAt": "2026-04-25T14:30:21.000Z",
  "capturedAt": "2026-04-25T14:31:02.000Z",
  "ruleSetVersion": 1,

  "totalCostUsd": 1.7234,
  "totalDurationMs": 482000,
  "totalInputTokens": 51234,
  "totalOutputTokens": 8421,
  "totalThinkingTokens": 1200,
  "totalCacheReadTokens": 91234,
  "totalCacheCreationTokens": 12345,
  "toolsUsed": ["Edit", "Read", "Bash", "Grep"],

  "pipelineJobCount": 4,
  "frictionJobCount": 0,
  "totalJobCount": 4,
  "jobCountByPrefix": { "specify": 1, "plan": 1, "implement": 1, "verify": 1 },

  "qualityScore": 88,

  "filesTouched": ["app/api/foo.ts", "lib/billing/charge.ts", "tests/integration/foo.test.ts"],
  "linesAdded": 142,
  "linesRemoved": 38,
  "testCodeRatio": 0.41,

  "domains": ["app", "lib", "tests"],
  "domainFileCounts": { "app": 1, "lib": 1, "tests": 1 },

  "touchedDbSchema": false,
  "touchedTests": true,
  "touchedCi": false,

  "frictionFree": true,

  "partial": false,
  "partialReason": null
}
```

### Response 404
- Ticket has no outcome yet (still being captured, or never reached SHIP).
- Returns `{ error: "Outcome not found for ticket", code: "OUTCOME_NOT_FOUND" }`.

### Response 403
- Caller lacks access. `{ error: "Forbidden", code: "ACCESS_DENIED" }`.

### Response 401
- No session. `{ error: "Unauthorized", code: "UNAUTHENTICATED" }`.

### Errors that MUST NOT happen by design
- 500 from a missing outcome row — those are 404s.
- 405 on PUT/PATCH/DELETE — only GET is exported, so the framework returns 405 automatically. **No write methods are implemented.**

---

## 2. GET `/api/projects/[projectId]/outcomes`

**Purpose**: List outcomes for a project with filters. Powers analytics queries (User Story 4 / SC-003).

### Auth
`verifyProjectAccess(projectId)`.

### Path params
| Param | Type | Notes |
|---|---|---|
| `projectId` | integer | |

### Query params (all optional, validated via Zod)
| Param | Type | Default | Notes |
|---|---|---|---|
| `frictionFree` | `'true' \| 'false'` | unset (no filter) | FR-018 |
| `partial` | `'true' \| 'false'` | unset (no filter) | FR-018 |
| `domain` | string | unset | Returns outcomes whose `domains` array contains this segment. Case-sensitive (filenames are case-sensitive in git). FR-018. |
| `workflowType` | `'FULL' \| 'QUICK' \| 'CLEAN'` | unset | |
| `since` | ISO-8601 date | unset | Filter `shippedAt >= since` |
| `until` | ISO-8601 date | unset | Filter `shippedAt < until` |
| `limit` | integer (1–500) | 100 | |
| `cursor` | integer | unset | `TicketOutcome.id` for pagination — return rows with `id < cursor`, ordered by `id DESC` |

### Response 200
```json
{
  "outcomes": [
    { "id": 42, "ticketId": 1234, "ticketKey": "AIB-742", "shippedAt": "...", /* full row, same shape as endpoint #1 */ }
  ],
  "nextCursor": 41,
  "totalReturned": 100
}
```

`ticketKey` is denormalised in the list response (not stored on TicketOutcome) by joining to `Ticket` — this avoids an N+1 in the dashboard.

### Performance budget
SC-003: < 1 s per project for "fraction frictionFree". This means the query must be index-supported. The composite index `@@index([projectId, frictionFree])` (data-model.md) covers it. The list query `{ projectId, shippedAt DESC }` is covered by `@@index([projectId, shippedAt(sort: Desc)])`.

### Pagination semantics
Cursor pagination by `id` (descending). Avoids OFFSET pagination's correctness issues with concurrent inserts. Caller stops when `nextCursor === null`.

### Validation errors → 400
- `limit > 500` → `{ error: "limit must be ≤ 500", code: "VALIDATION_ERROR" }`
- Invalid ISO date → `{ error: "since must be ISO-8601", code: "VALIDATION_ERROR" }`
- Mutually-exclusive filters: none (all filters AND together).

---

## 3. (Implicit) Outcome capture trigger

**There is no public endpoint to trigger outcome capture.** Capture is initiated only by:
- The SHIP transition path in `lib/tickets/transition.ts` (in-process call).
- The backfill workflow (`.github/workflows/backfill-outcomes.yml` invoking the same library functions).

This is deliberate: exposing a capture-trigger endpoint would create a path for non-idempotent retries from outside the platform and bypass the rate-limit budget. The unique constraint protects against duplicate writes, but there's no benefit to exposing the trigger.

## Error code registry (this contract)

| Code | HTTP | Meaning |
|---|---|---|
| `OUTCOME_NOT_FOUND` | 404 | Ticket exists but has no outcome row (yet, or never will if it didn't ship) |
| `ACCESS_DENIED` | 403 | Caller is not a project member/owner |
| `UNAUTHENTICATED` | 401 | No valid session |
| `VALIDATION_ERROR` | 400 | Query-string validation failed |
| `INTERNAL_ERROR` | 500 | Unexpected — logged with request context |
