# Contract — `GET /api/admin/home`

Returns the full admin-home snapshot in one round trip. Designed for a 30-second poll from the admin dashboard.

## Auth

- Guarded by `requireAdminOrNotFound(request)` (from `app/lib/auth/admin.ts`).
- Non-admin and unauthenticated callers receive the byte-equivalent 404 already used by the rest of `/admin/*` (empty body, `Content-Type: text/html; charset=utf-8`). This contract is the same as `/api/admin/insights/*` and must pass the existing `parity-404` test pattern.

## Request

- Method: `GET`
- Path: `/api/admin/home`
- Query parameters: **none** (the route is intentionally parameter-free to keep the polling client trivial and cacheable on the server side per-request).
- Body: none.

## Response 200

`Content-Type: application/json`

```json
{
  "generatedAt": "2026-05-12T10:00:00.000Z",
  "alerts": [
    {
      "kind": "LOW_SUCCESS_RATE",
      "message": "Job success rate 78% over last 7 days (28 of 36 jobs)",
      "href": "/admin/insights"
    }
  ],
  "pulse": {
    "users": {
      "value": 1342,
      "delta7d": 28,
      "delta30d": 102,
      "spark": [{"d":"2026-04-13","v":1240}, ... 30 points]
    },
    "mau": {
      "value": 612,
      "deltaPrev30d": 47,
      "shareOfBase": 0.456,
      "spark": [{"d":"2026-04-13","v":580}, ... 30 points]
    },
    "mrr": {
      "valueUsd": 18450,
      "deltaUsdThisMonth": 450,
      "proCount": 110,
      "teamCount": 26,
      "proUsd": 1650 * 100,
      "teamUsd": 30 * 26 * 100,
      "spark": [{"d":"2026-04-13","v":17900}, ... 30 points]
    },
    "activePaying": {
      "value": 136,
      "delta30d": 9,
      "conversionRate": 0.1014,
      "spark": [{"d":"2026-04-13","v":127}, ... 30 points]
    }
  },
  "business": {
    "planDistribution": [
      {"plan": "FREE", "count": 1206},
      {"plan": "PRO", "count": 110},
      {"plan": "TEAM", "count": 26}
    ],
    "activationFunnel": {
      "cohortSize": 102,
      "steps": [
        {"key": "SIGNUP",        "count": 102, "stepRate": null},
        {"key": "FIRST_PROJECT", "count":  74, "stepRate": 0.7255},
        {"key": "FIRST_JOB",     "count":  58, "stepRate": 0.7838},
        {"key": "FIRST_PAID",    "count":  11, "stepRate": 0.1897}
      ]
    },
    "churn": {
      "cancellations": 3,
      "downgrades": 1,
      "mrrLostUsd": 6000,
      "netMrrDeltaUsd": -1500
    }
  },
  "trends": {
    "signupsDaily": [{"d":"2026-04-13","v":4}, ... 30 points],
    "jobsDaily":    [{"d":"2026-04-13","completed":120,"failed":7}, ... 30 points],
    "mrrMonthly":   [{"m":"2025-06","v":12000}, ... up to 12 points]
  },
  "tables": {
    "newPaying":     [{"email":"a@b.co","plan":"PRO","accountAgeDays":92,"subscribedAt":"2026-04-30T..."}],
    "cancellations": [{"email":"x@y.co","lostPlan":"TEAM","accountAgeDays":410,"canceledAt":"2026-05-04T..."}],
    "topUsers":      [{"email":"u@u.co","plan":"PRO","jobsThisMonth":58}],
    "topProjects":   [{"projectKey":"AIB","ownerEmail":"o@o.co","jobsThisMonth":204}]
  }
}
```

### Field rules

- Every numeric value MUST be derivable from current platform data (FR-028, SC-003).
- Currency fields are integer USD cents (`*Usd`), matching `PLANS[].priceMonthly`.
- `deltaXX` fields are absolute differences in the same unit as `value`, not percentages. The client computes display percentages.
- `conversionRate`, `shareOfBase`, `stepRate` are floats in `[0, 1]`, or `null` when the prior step / denominator is zero (FR-029).
- Spark arrays are length 30 (one point per day, oldest first). When the platform is younger than 30 days, missing days are emitted as `{ "d": "...", "v": 0 }` so the array length stays constant.
- `mrrMonthly` is length **≤ 12** (the platform may be younger than a year — emit only months that exist).
- `tables.newPaying` and `tables.cancellations` are capped at 50 rows (per R-6); `tables.topUsers` and `tables.topProjects` are capped at 5 (FR-024/025).
- All emails are returned verbatim — they are admin-only data; no redaction. Internal numeric ids are NOT included (constitution §IV "Never expose sensitive data").

## Response 404

- Body: empty.
- Header: `Content-Type: text/html; charset=utf-8`.
- Triggered by: non-admin session, unauthenticated request, blocked test override.

## Response 500

- Body: `{ "error": "Internal server error" }` (constitution §"Error Handling").
- Triggered by: unhandled error inside any aggregator. The route wraps all aggregators in a single try/catch; partial failures NEVER yield a partial response — the entire snapshot fails so the client keeps showing the last known good data (FR-027).

## Caching

- `Cache-Control: no-store` — the polling client expects fresh data and the response is admin-only.
- No CDN involvement.

## Polling contract

- The client polls every 30 seconds via TanStack Query (FR-026).
- The client uses `placeholderData: keepPreviousData` so the previous snapshot remains rendered while the new one is in flight (FR-026, D-9).
- On a 5xx, the client keeps the previous snapshot and lets TanStack Query retry on the next interval (FR-027). A small `aria-live="polite"` indicator surfaces the failed-refresh state.
