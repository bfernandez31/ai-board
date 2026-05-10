# Contract: Admin Insights API

**Branch**: `AIB-777-admin-section-with`
**Date**: 2026-05-10

This document is the wire contract for every HTTP endpoint introduced by AIB-777. It pins methods, paths, auth model, request schemas, response shapes, and status codes. Implementations and integration tests both bind to it.

## Auth model summary

Two authentication classes apply; routes are partitioned exactly into one of the two. There is no overlap and no fallback chain.

| Route group | Auth | Failure response |
|-------------|------|------------------|
| **User-facing admin routes** (page render, list, run trigger, HTML proxy) | NextAuth session via `auth()`; `session.user.email` MUST be in `ADMIN_ALLOWLIST_EMAILS` | **404 Not Found**, byte-equivalent to a genuinely missing route. No JSON body. No `WWW-Authenticate`, no `Set-Cookie` differential. (FR-003, SC-002) |
| **Workflow callback routes** (status PATCH, HTML PUT) | `Authorization: Bearer ${WORKFLOW_API_TOKEN}` validated by `validateWorkflowAuth` (`app/lib/auth/workflow-auth.ts`) | **401 Unauthorized** with `{ error: "Unauthorized" }` (matches the existing job-status / artifact PUT shape — these endpoints are not advertised on the user surface, so the 401 is non-leaky). |

The dichotomy mirrors the existing app: workflows use Bearer tokens (`/api/jobs/:id/status`, `/api/jobs/:id/logs/raw-artifact`), users use NextAuth sessions, never both.

---

## 1. `GET /admin/insights` — page render (Server Component)

**Auth**: User. **Failure**: 404 baseline (P5).

This is a Next.js App Router page (`app/admin/insights/page.tsx`), not an API endpoint. Documented here for completeness because the page is what the operator visits.

The page Server Component:
1. Calls `await requireAdmin()`. Throws on failure → caught at the top of the component → `notFound()` from `next/navigation` → Next renders the 404 page identically to a non-existent path.
2. Lazy-reconciles orphaned reports (D2).
3. Reads:
   - The latest `COMPLETED` report (for the inline rendering).
   - The current `RUNNING` report (if any) — fed to the page so the trigger button can be disabled.
   - The list of past reports, capped at `INSIGHTS_LIST_MAX = 200` (FR-017), ordered by `createdAt desc`.
4. Renders the metadata header (FR-019 phrasing), the iframe pointing at the HTML proxy endpoint (sec. 4), and the past-reports list (FR-016).

The page does **not** fetch the HTML body itself; the iframe loads it via `GET /api/admin/insights/reports/:id/html` so the body never enters the host page's React tree.

---

## 2. `GET /api/admin/insights/reports` — list past reports

**Auth**: User. **Failure**: 404 baseline.

### Request

`GET /api/admin/insights/reports?limit=200`

| Query param | Type | Default | Bound |
|-------------|------|---------|-------|
| `limit` | integer | 200 | min 1, max 200 (FR-017) |

### Response — 200 OK

```json
{
  "reports": [
    {
      "id": 42,
      "status": "COMPLETED",
      "periodStart": "2026-04-12T08:13:55.000Z",
      "periodEnd":   "2026-05-09T11:00:21.000Z",
      "sessionsCount": 312,
      "ticketsCount": 47,
      "errorReason": null,
      "triggeredByEmail": "alice@example.com",
      "startedAt":   "2026-05-09T11:00:21.000Z",
      "completedAt": "2026-05-09T11:14:09.000Z",
      "createdAt":   "2026-05-09T11:00:21.000Z"
    },
    {
      "id": 41,
      "status": "FAILED",
      "periodStart": "2026-04-01T00:00:00.000Z",
      "periodEnd":   "2026-04-12T08:13:55.000Z",
      "sessionsCount": null,
      "ticketsCount": null,
      "errorReason": "Insights analyzer exited non-zero",
      "triggeredByEmail": "alice@example.com",
      "startedAt":   "2026-04-12T08:13:55.000Z",
      "completedAt": "2026-04-12T08:18:11.000Z",
      "createdAt":   "2026-04-12T08:13:55.000Z"
    }
  ],
  "runningReportId": null
}
```

- `reports[]` ordered by `createdAt desc`. At most `limit` entries (default and ceiling 200).
- `runningReportId` is the `id` of the current `RUNNING` row (after lazy reconciliation), or `null`.
- `triggeredByEmail` is fetched via the relation; if `triggeredById` is null (deleted user), the field is `null`. `htmlBlobKey` and `htmlBlobSize` are NEVER returned to the client (the client doesn't need to know the blob path; it only needs the report id to fetch the HTML proxy).
- Cache headers: `Cache-Control: no-store, private` to prevent intermediaries from caching.

### Response — 404

Body is empty (no JSON). Status code, headers, and body MUST match the response Next.js returns for `GET /this-path-does-not-exist-aaa-bbb-ccc`. Tests MUST assert byte-equivalence (P5).

---

## 3. `POST /api/admin/insights/runs` — trigger a new analysis

**Auth**: User. **Failure**: 404 baseline.

### Request

`POST /api/admin/insights/runs` with empty body or `{}`. Body validation: `z.object({}).passthrough()` (no inputs accepted; all parameters derived server-side).

### Response — 201 Created (run accepted)

```json
{
  "id": 43,
  "status": "RUNNING",
  "periodStart": "2026-05-09T11:14:09.000Z",
  "periodEnd":   "2026-05-10T16:42:00.000Z",
  "startedAt":   "2026-05-10T16:42:00.000Z"
}
```

The row exists in DB and the workflow has been dispatched. The page polls `GET /api/admin/insights/reports` (or a single-report endpoint, see sec. 5) at 2s while a `RUNNING` row exists.

### Response — 409 Conflict (refusals — pre-flight or concurrency)

The body discriminates between the two refusal causes so the UI can render the canonical messages from spec (FR-007, FR-008). Both are 409.

**Pre-flight refusal (FR-007)**:
```json
{
  "error": "No new shipped tickets since last run on 2026-05-09T11:14:09.000Z",
  "code": "NO_NEW_SHIPPED_TICKETS",
  "previousRunAt": "2026-05-09T11:14:09.000Z"
}
```
- `previousRunAt` is the previous successful run's `periodEnd`. Null when there has never been a successful run AND there are zero Claude jobs in the system (the cold-system case from spec's edge cases). In that cold-system case the message is `"No shipped Claude tickets to analyze yet"` and `previousRunAt: null`.

**Concurrency refusal (FR-008)**:
```json
{
  "error": "Already running since 2026-05-10T16:42:00.000Z",
  "code": "ALREADY_RUNNING",
  "runStartedAt": "2026-05-10T16:42:00.000Z"
}
```

### Response — 502 Bad Gateway (workflow dispatch failed → row rolled back, P1)

```json
{
  "error": "GitHub workflow dispatch failed",
  "code": "DISPATCH_FAILED"
}
```
The pre-creation row has been deleted; the operator can retry. Mirrors `lib/workflows/transition.ts:357-388` translation. Sub-codes (401/403/404) are folded into `error` text in operator-actionable form.

### Response — 404 Not Found

Returned for unauthenticated AND non-allowlisted callers, byte-equivalent to a missing route. *Never* a 401 or 403 from this route — that would leak the area's existence (FR-003).

### Response — 400 Bad Request

The endpoint takes no inputs, so 400 only fires for malformed JSON (`Invalid JSON in request body`). The response body matches the existing route convention (`{ error: "Invalid JSON in request body" }`) — visible only to authorized admins, so no leakage concern.

---

## 4. `GET /api/admin/insights/reports/:id/html` — proxy report HTML

**Auth**: User. **Failure**: 404 baseline.

### Request

`GET /api/admin/insights/reports/42/html`

Path param: `id` — integer ≥ 1, validated.

### Response — 200 OK

- `Content-Type: text/html; charset=utf-8`
- `Cache-Control: private, no-store`
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: default-src 'self' 'unsafe-inline' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`
- `X-Frame-Options: DENY` (defence in depth alongside `frame-ancestors 'none'`; the iframe in the host page renders this body via `src=` and is sandboxed without `allow-same-origin`, so denying ancestor framing is *not* contradictory — the host page's iframe loads the body in an opaque-origin browsing context that satisfies the same-origin gate from the browser's perspective).
- Body: the genuine HTML produced by `/insights`, streamed unchanged.

### Response — 404 Not Found

Returned when:
- The caller isn't admin (baseline 404).
- The id doesn't resolve to a report.
- The id resolves to a report whose `status !== 'COMPLETED'`.
- The id resolves to a `COMPLETED` report whose blob is missing (storage incident edge case from spec).

In the third and fourth cases the response is *still* the baseline 404 (no JSON body) so a non-admin probing IDs cannot distinguish "report exists but isn't ready" from "report doesn't exist". Admins navigating the past-reports list see the human-readable "Running…" / "Failed: <reason>" / "Report content is no longer available" placeholder via the page-level rendering (FR-024) — the iframe is only used for COMPLETED reports with retrievable bodies.

### Response — 502 Bad Gateway

Reserved for transient blob-backend failures (the upstream `streamJobLogArtifact` throws something other than 404). Surfaced to admins only — this code path is unreachable for non-admins because they 404'd before the blob lookup. Body: `{ "error": "Blob backend unavailable", "code": "BLOB_READ_FAILED" }`.

---

## 5. `PATCH /api/admin/insights/reports/:id/status` — workflow callback

**Auth**: Workflow Bearer token. **Failure**: 401.

### Request

`PATCH /api/admin/insights/reports/43/status`

Headers:
- `Content-Type: application/json`
- `Authorization: Bearer ${WORKFLOW_API_TOKEN}`

Body — Zod schema:

```ts
const adminInsightsReportStatusUpdateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('RUNNING'),
    workflowRunId: z.coerce.bigint().positive().optional(),
  }),
  z.object({
    status: z.literal('COMPLETED'),
    sessionsCount: z.number().int().nonnegative(),
    ticketsCount: z.number().int().nonnegative(),
    htmlBlobKey: z.string().max(300).regex(/^insights\/reports\/\d+\.html$/),
    htmlBlobSize: z.number().int().positive().max(ARTIFACT_MAX_BYTES),
  }),
  z.object({
    status: z.literal('FAILED'),
    errorReason: z.string().min(1).max(2000),
  }),
]);
```

For `RUNNING`, the body just acknowledges the workflow has started; it sets `workflowRunId` (first-write-wins via `updateMany({ where: { id, workflowRunId: null }, data })`, mirroring `app/api/jobs/[id]/status/route.ts:248-249`).

For `COMPLETED`, the workflow MUST have already PUT the HTML body to `/api/admin/insights/reports/:id/html` and SHOULD pass back the `htmlBlobKey` it received in that response (so the row's pointer is whatever the upload endpoint actually wrote; no client-side computation of the key).

For `FAILED`, the `errorReason` is a non-secret operator-actionable string. The workflow's failure-reason script in YAML truncates to 2000 chars before posting.

### Response — 200 OK

```json
{
  "id": 43,
  "status": "COMPLETED",
  "completedAt": "2026-05-10T16:55:32.000Z"
}
```

Mirrors `app/api/jobs/[id]/status/route.ts:198-205`: minimal surface, no leak of internal state. Idempotent same-status PATCH returns 200 with no DB change. Atomic conditional update (`updateMany` with `status: 'RUNNING'` in the where clause) — if 0 rows match because the row already moved to a terminal state, re-read and return current state with 200 (P2).

### Response — 400 Bad Request

- Malformed JSON.
- Zod validation failure (invalid status, missing required fields for that status, blob-size over cap, etc.). Body: `{ error: "Invalid request", details: [{ message, path }, ...] }` matching `app/api/jobs/[id]/status/route.ts:118-126`.
- Invalid state transition (e.g., trying to write `COMPLETED` after the row is `FAILED`). Body: `{ error: "Invalid transition from FAILED to COMPLETED" }`. **Note**: idempotent same-status returns 200, not 400.

### Response — 401 Unauthorized

Missing or invalid Bearer token. Body: `{ error: "Unauthorized" }`.

### Response — 404 Not Found

The id doesn't resolve to a report. Body: `{ error: "Insights report not found" }`. Non-leaky for this route because it's Bearer-token-gated.

### Response — 409 Conflict

Reserved for the case where the row is already terminal AND the requested transition is not idempotent (e.g., `RUNNING` callback arriving after a lazy-reconciliation flip to `FAILED`). Body: `{ error: "Run already finalized", status: "FAILED" }` so the workflow can abort gracefully (mirrors the `Job already cancelled` pattern at `app/api/jobs/[id]/status/route.ts:158-163`).

---

## 6. `PUT /api/admin/insights/reports/:id/html` — workflow uploads HTML body

**Auth**: Workflow Bearer token. **Failure**: 401.

### Request

`PUT /api/admin/insights/reports/43/html`

Headers:
- `Content-Type: text/html; charset=utf-8`
- `Authorization: Bearer ${WORKFLOW_API_TOKEN}`
- `Content-Length: <size in bytes>`

Body: raw HTML bytes. Max `ARTIFACT_MAX_BYTES` (25 MB) per existing artifact ceiling (`app/lib/logs/schema.ts:6`).

### Response — 201 Created

```json
{
  "htmlBlobKey": "insights/reports/43.html",
  "htmlBlobSize": 184321
}
```

The endpoint:
1. Validates Bearer token → 401 if invalid (P3).
2. Validates `Content-Type` starts with `text/html` → 415 if not.
3. Pre-flight checks `Content-Length` against `ARTIFACT_MAX_BYTES` → 413 if over.
4. Looks up the report → 404 if missing.
5. **Refuses to overwrite a terminal row** → 409 if the row's status is already `COMPLETED` or `FAILED` (a workflow that retried after finalizing should not be able to clobber the artifact). For `RUNNING`, overwrites are allowed (idempotent retry of the upload step, mirrors the `existingLog?.rawArtifactKey === artifactKey` log line at `app/api/jobs/[id]/logs/raw-artifact/route.ts:91-96`).
6. Reads body via `arrayBuffer()` with empty-body and over-cap guards.
7. Calls `uploadInsightsReportHtml(key, buffer, size)` (thin wrapper around `app/lib/blob/client.ts:uploadJobLogArtifact` with `contentType: 'text/html; charset=utf-8'`).
8. The endpoint does NOT update `htmlBlobKey` on the row itself — that happens in the subsequent `PATCH …/status {COMPLETED, htmlBlobKey, ...}` so the COMPLETED transition is the single authoritative state-write.

### Response — 415 / 413 / 400 / 502

Same shapes and codes as `app/api/jobs/[id]/logs/raw-artifact/route.ts` — `UNSUPPORTED_MEDIA_TYPE`, `PAYLOAD_TOO_LARGE`, `Failed to read body`, `BLOB_UPLOAD_FAILED`.

---

## 7. Cancel / delete / edit endpoints

**Not provided.** Spec FR-020 + Out-of-Scope #6: reports are read-only. The plan deliberately omits any DELETE or PATCH-mutation endpoint beyond the workflow-status PATCH above. Operators who need to intervene mutate the env or revoke access; report rows persist indefinitely.

---

## Response-parity verification

The 404 baseline (FR-003, SC-002) is enforced by all of:

1. `requireAdmin()` throwing the exact same exception path that `notFound()` / Next's missing-route handling triggers (P5).
2. Page routes calling `notFound()` from `next/navigation` so Next.js renders `app/not-found.tsx` (or its default).
3. API routes returning `new NextResponse(null, { status: 404 })` (no JSON body) for non-admin callers.
4. Tests in `tests/integration/admin/response-parity.test.ts` asserting that, for each admin route in `[ '/admin/insights', '/api/admin/insights/reports', '/api/admin/insights/runs', '/api/admin/insights/reports/1/html' ]`, the response from a non-admin caller equals the response from a baseline path `/admin-this-does-not-exist-${random()}` byte-for-byte across status, body, and headers.

A subtle note: cookies set by NextAuth on response (e.g., a refreshed session cookie) are excluded from the byte-equivalence comparison because that's not a leak of admin-area existence — it's request-shape behaviour that fires regardless of path. The test fixture strips known auth headers before comparing.
