# Contract: Drift Dashboard API

**Branch**: `AIB-773-copy-of-analysis`

## Endpoint

```
GET /api/projects/:projectId/drift
```

## Authentication & Authorization

- NextAuth session cookie OR `Authorization: Bearer <PAT>` (mirrors existing project APIs).
- **Owner-only** via `verifyProjectOwnership(projectId, request)` (`lib/db/auth-helpers.ts:97-120`).
  - Members → 404 with `{ "error": "Project not found" }` (FR-007: deny "as if the resource did not exist").
  - Owners of a project they once owned but transferred → 404 (re-checked at request time).
  - Anonymous → 401 from `requireAuth`.

## Request

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `projectId` (path) | int | — | Project numeric id |
| `cursor` (query) | string opt. | — | Opaque cursor for pagination of `recentPairings` |
| `pageSize` (query) | int 1–50 | 30 | Validated via Zod; bounded per spec auto-resolved decision |

## Response — 200 OK

```json
{
  "projectId": 42,
  "generatedAt": "2026-05-05T12:00:00.000Z",
  "sampleSize": 27,
  "unpairedCount": 1,
  "pendingCount": 2,

  "friction": {
    "incomparable": 0,
    "matrix": { "tp": 10, "fp": 3, "tn": 12, "fn": 2 },
    "precision": 0.769,
    "recall": 0.833
  },

  "cost": {
    "incomparable": 1,
    "inRange": 18,
    "under": 4,
    "over": 4
  },

  "quality": {
    "incomparable": 0,
    "inRange": 21,
    "under": 5,
    "over": 1
  },

  "usage": {
    "analysedShipped": 28,
    "leftInbox": 60,
    "ratio": 0.467
  },

  "recentPairings": [
    {
      "ticketId": 501,
      "ticketKey": "AIB-501",
      "shippedAt": "2026-05-04T16:32:11.000Z",
      "frictionMatch": true,
      "costInRange": true,
      "qualityInRange": true,
      "recommendationMatch": false
    }
  ],
  "nextCursor": "eyJzaGlwcGVkQXQiOiIyMDI2LTA1LTA0VDE2OjMyOjExLjAwMFoiLCJpZCI6NTAxfQ=="
}
```

## Error Responses

| Status | Body | Cause |
|--------|------|-------|
| 401 | `{ "error": "Unauthorized" }` | No session, no valid Bearer token |
| 404 | `{ "error": "Project not found" }` | Not project owner OR project does not exist |
| 400 | `{ "error": "Invalid query params", "code": "BAD_REQUEST" }` | Zod validation failure on `cursor` / `pageSize` |
| 500 | `{ "error": "Internal server error" }` | Unhandled DB error; logged with request id and userId |

## Invariants (Tested)

- **I1**: `friction.matrix.tp + fp + tn + fn + friction.incomparable === sampleSize` — confusion matrix totals reconcile with sample size.
- **I2**: `cost.inRange + cost.under + cost.over + cost.incomparable === sampleSize`.
- **I3**: `quality.inRange + quality.under + quality.over + quality.incomparable === sampleSize`.
- **I4**: `precision === null` when `matrix.tp + matrix.fp === 0`; otherwise rounded to 3 decimals.
- **I5**: `recall === null` when `matrix.tp + matrix.fn === 0`; otherwise rounded to 3 decimals.
- **I6**: `usage.ratio === 0` when `usage.leftInbox === 0`; otherwise `analysedShipped / leftInbox` rounded to 3 decimals.
- **I7**: Cross-project isolation — request as Owner-A for Project-B always returns 404 (verified by integration test seeding two projects with disjoint owners).

## Performance Budget

- p95 < 1.5s end-to-end (well under SC-002 < 2s p95).
- Single Prisma query for paired rows (`groupBy` on per-dimension counters), single `prisma.ticket.count` for inbox-leaver denominator, single `findMany` for `recentPairings` page.

---

# Contract: Maintenance Sweep API

## Endpoint

```
POST /api/maintenance/sweep-unpaired-pairings
```

## Authentication

- `Authorization: Bearer ${WORKFLOW_API_TOKEN}` ONLY (no session auth). Same shape as `app/api/maintenance/prune-logs/route.ts`.

## Request

No body. No query params.

## Response — 200 OK

```json
{
  "examinedPending": 12,
  "pairedNow": 8,
  "expired": 1,
  "windowHours": 24
}
```

- `examinedPending`: rows with `pendingOutcome=true AND unpairedReason IS NULL`.
- `pairedNow`: rows that became paired during this sweep (outcome arrived; pairing succeeded).
- `expired`: rows transitioned to `unpairedReason='outcome_missing_24h'` (24h elapsed, outcome still missing).

## Error Responses

| Status | Body | Cause |
|--------|------|-------|
| 401 | `{ "error": "Unauthorized" }` | Missing or invalid Bearer token |
| 500 | `{ "error": "Sweep failed", "details": "..." }` | DB error during sweep |
