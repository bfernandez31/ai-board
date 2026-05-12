# API Contract: `GET /api/admin/home`

**Status**: Draft · **Owner**: AIB-797 · **Implements**: FR-027, FR-028, FR-032, SC-001, SC-002, SC-010

## Purpose

Single consolidated endpoint that returns the entire admin home dashboard payload. The page polls this endpoint every 30s (FR-025). One poll cycle = at most 1 HTTP request to this route (SC-010).

## Authentication & Authorization

- **Auth source**: NextAuth session (browser-issued request).
- **Guard**: `requireAdminOrNotFound(request)` from `app/lib/auth/admin.ts`.
- **Non-admin response**: byte-equivalent 404 produced by `adminNotFoundResponse()` — empty body, `Content-Type: text/html; charset=utf-8`, status 404. **MUST NOT return 401/403** (FR-032, SC-002 — existence-leak prevention).

## Request

```
GET /api/admin/home
```

- No request body, no query parameters, no path parameters.
- `Cache-Control: no-store` enforced via `export const dynamic = 'force-dynamic'` in the route module.

## Response — 200 OK

```json
{
  "generatedAt": "2026-05-12T14:32:17.123Z",
  "alerts": [
    {
      "kind": "job-success",
      "id": "job-success",
      "payload": {
        "kind": "job-success",
        "successRatePct": 0.84,
        "failedCount": 18,
        "windowDays": 7
      },
      "actionLabel": "Voir les jobs failed",
      "actionHref": "/projects?jobStatus=FAILED&since=7d"
    }
  ],
  "pulse": {
    "users": {
      "id": "users",
      "label": "Utilisateurs",
      "value": 1247,
      "unit": "count",
      "deltas": [
        { "label": "Δ7j", "value": 42, "unit": "absolute", "goodDirection": "up" },
        { "label": "Δ30j", "value": 168, "unit": "absolute", "goodDirection": "up" }
      ],
      "sparkline": [3, 5, 4, 6, /* … 30 numbers total */ 7],
      "tooltip": "Total inscrits sur la plateforme."
    },
    "mau": { /* same shape, sparkline len 30 */ },
    "mrr": { /* unit: 'cents', value e.g. 184500 */ },
    "paying": { /* unit: 'count' */ }
  },
  "businessHealth": {
    "planDistribution": { "free": 1100, "pro": 120, "team": 27 },
    "activationFunnel": [
      { "id": "signups",       "label": "Inscriptions",  "count": 240, "conversionFromPrevious": null },
      { "id": "first_project", "label": "1er projet",    "count": 168, "conversionFromPrevious": 0.70 },
      { "id": "first_job",     "label": "1er job",       "count": 132, "conversionFromPrevious": 0.79 },
      { "id": "paid",          "label": "Activation payante", "count": 19, "conversionFromPrevious": 0.144 }
    ],
    "churn": {
      "cancellationsCount": 4,
      "downgradesCount": 1,
      "mrrLostCents": 7500,
      "netMrrDeltaCents": 22500
    }
  },
  "trends": {
    "signupsPerDay": [{ "date": "2026-04-13", "value": 3 }, /* …29 more */ ],
    "jobsPerDay":    [{ "date": "2026-04-13", "completed": 12, "failed": 1 }, /* … */ ],
    "mrrPerMonth":   [{ "month": "2025-06",   "mrrCents": 60000 }, /* …11 more */ ]
  },
  "actionable": {
    "newPayingUsers":     [/* up to 25 PaidUserRow */],
    "recentCancellations":[/* up to 25 CancellationRow */],
    "topActiveUsers":     [/* up to 5 TopUserRow */],
    "topProjects":        [/* up to 5 TopProjectRow */]
  },
  "meta": {
    "newPayingUsersTotal": 32,
    "recentCancellationsTotal": 5,
    "currencyMinorUnit": "cents"
  }
}
```

**TypeScript type**: see `app/lib/admin/home/types.ts` (`DashboardSnapshot`).

### Field-level rules

- `generatedAt`: ISO 8601 UTC, server clock.
- `alerts`: empty array when no alerts triggered (FR-004 — empty array, not `null`; client renders nothing when length === 0).
- `alerts` array is ordered: job-success first, stripe-webhook second, cron alerts third (sorted by `workflowName` ascending). Order is stable across polls (SC-008 spirit).
- `pulse.*.sparkline`: exactly 30 elements, oldest-first.
- `pulse.mrr.value`: cents (integer).
- `pulse.mrr.deltas[*].value`: cents delta when `unit==='absolute'`; ratio (e.g., 0.12 for +12%) when `unit==='percent'`.
- `pulse.paying.deltas`: one delta is `Δ30j` absolute; the other is the FREE→PAID conversion rate as a percent (FR-013).
- `pulse.mau.deltas`: one delta is "vs. mois précédent" (signed integer); the other is the `MAU/totalUsers` ratio as percent (FR-011).
- `businessHealth.activationFunnel`: exactly 4 elements in the documented order; counts are monotone non-increasing.
- `businessHealth.activationFunnel[0].conversionFromPrevious === null`.
- `trends.signupsPerDay.length === 30`; `trends.jobsPerDay.length === 30`; `trends.mrrPerMonth.length === 12`.
- `actionable.newPayingUsers.length ≤ 25` and `meta.newPayingUsersTotal` is the un-capped count.
- `actionable.recentCancellations.length ≤ 25` and `meta.recentCancellationsTotal` is the un-capped count.
- `actionable.topActiveUsers.length ≤ 5`; `actionable.topProjects.length ≤ 5`.
- `meta.currencyMinorUnit` is `"cents"` (constant — documents the unit so a future change is breaking and visible).

### Determinism invariants

- Sum of `trends.signupsPerDay[*].value` equals `businessHealth.activationFunnel[0].count` (SC-005).
- `businessHealth.planDistribution.free + .pro + .team` equals `prisma.subscription.count()` (SC-006).
- `trends.mrrPerMonth[11].mrrCents` (current month) equals `pulse.mrr.value` (SC-004 spirit).

## Response — 5xx Error

```json
{
  "error": "Failed to compute dashboard snapshot",
  "code": "SNAPSHOT_FAILED"
}
```

- Status: `500 Internal Server Error`.
- Triggered when any sub-query throws. Per FR-028 & constitution §V, errors are NOT swallowed per-section.
- Client (`useAdminHomeSnapshot`) reacts to non-2xx by rendering the page-level error banner; last successful `placeholderData` may remain visible underneath.

## Performance budget

| Metric | Target | Source |
|--------|--------|--------|
| First-paint of dashboard | ≤ 5 s on typical broadband | SC-001 |
| Aggregator latency p95 | ≤ 800 ms server-side | derived from polling cadence (30s) and section count (~12) |
| Network requests per poll | ≤ 2 | SC-010 |
| Response payload size | ≤ 50 KB gzipped | derived from ~120 numbers + ~50 small rows |

The aggregator uses `Promise.all` across at most 14 parallel Prisma queries; no N+1 (top-tables join user/project once per `take: 5`).

## Side effects

None. This endpoint is **idempotent and read-only**. It writes nothing.

## Auth contract verification (mirrors `parity-404.test.ts`)

`tests/integration/api/admin/home/parity-404.test.ts` MUST mock `requireAdminOrNotFound` to return `{ok: false, response: adminNotFoundResponse()}` and assert the GET handler returns a byte-equivalent 404 (status, headers, body bytes) — exactly the assertion mechanic from `tests/integration/api/admin/insights/parity-404.test.ts:30-83`.

---

# API Contract: `POST /api/admin/cron-markers`

**Status**: Draft · **Owner**: AIB-797 · **Implements**: FR-007 (alert read side), spec §Internal Processes "Cron marker persistence"

## Purpose

Receive a "this cron just ran successfully" callback from a scheduled GitHub Actions workflow. Writes a `CronRunLog` row used by the cron-stale alert.

## Authentication & Authorization

- **Auth source**: workflow Bearer token (`WORKFLOW_API_TOKEN`).
- **Guard**: `verifyWorkflowToken(request)` from `app/lib/auth/workflow-auth.ts`. Same contract as `/api/maintenance/prune-logs`.
- **Failure response**: `401 Unauthorized` (not 404 — this endpoint is workflow-only and follows the workflow-callback convention, not the admin-page existence-leak convention).

## Request

```
POST /api/admin/cron-markers
Authorization: Bearer ${WORKFLOW_API_TOKEN}
Content-Type: application/json
```

Body:

```json
{
  "workflowName": "nightly-health",
  "durationMs": 47820,
  "runUrl": "https://github.com/org/repo/actions/runs/9876543210"
}
```

- `workflowName` (string, 1–100 chars, **required**) — accepted values are validated against the application's known list (`CRITICAL_CRONS`); unknown names return 400 to prevent typos polluting the table.
- `durationMs` (integer, optional, 0–86_400_000).
- `runUrl` (string URL, optional, ≤ 500 chars).

Zod schema is enforced before any DB write:

```ts
const schema = z.object({
  workflowName: z.enum(['nightly-health', 'nightly-log-prune']),
  durationMs: z.number().int().min(0).max(86_400_000).optional(),
  runUrl: z.string().url().max(500).optional(),
});
```

## Response — 201 Created

```json
{ "id": 12345, "ranAt": "2026-05-12T00:31:04.123Z" }
```

- `id`: the new row's primary key.
- `ranAt`: the server-recorded success timestamp.

## Response — 400 Bad Request

```json
{ "error": "Invalid request body", "code": "VALIDATION_FAILED", "details": [/* Zod issues */] }
```

## Response — 401 Unauthorized

```json
{ "error": "Unauthorized" }
```

Returned when `verifyWorkflowToken` rejects the request.

## Response — 500 Internal Server Error

```json
{ "error": "Failed to record cron marker", "code": "MARKER_WRITE_FAILED" }
```

Returned only on Prisma write failure. The workflow's marker step has `continue-on-error: true`, so this does not fail the cron itself (spec §Internal Processes).

## Side effects

1. Inserts one row into `CronRunLog`.
2. Lazy-prunes rows older than 7 days via `prisma.cronRunLog.deleteMany({ where: { ranAt: { lt: cutoff } } })`. Prune is wrapped in a try/catch so a transient delete error does not fail the marker write.

## Idempotency

This endpoint is **not** strictly idempotent — each call appends a row. That's intentional: multiple successful runs in a 36h window are valid and the dashboard always reads `findFirst({ orderBy: { ranAt: 'desc' } })`. The 7-day prune keeps the table bounded.
