# Contract — `POST /api/maintenance/cron-heartbeat`

Records the timestamp of a successful execution for a registered critical cron. Called by the last step of each cron's GitHub Actions workflow after its functional work succeeds.

## Auth

- `Authorization: Bearer ${WORKFLOW_API_TOKEN}` (same pattern as `/api/maintenance/prune-logs`).
- Returns 401 on missing or invalid token. Never returns 404 — this is not under `/admin/*` and uses workflow-token auth, not session auth.

## Request

- Method: `POST`
- Path: `/api/maintenance/cron-heartbeat`
- Headers:
  - `Authorization: Bearer <WORKFLOW_API_TOKEN>` (required)
  - `Content-Type: application/json`
- Body:

```json
{ "cron": "NIGHTLY_LOG_PRUNE" }
```

- `cron` MUST be a member of the `CriticalCron` enum: `NIGHTLY_LOG_PRUNE | NIGHTLY_HEALTH_SCANS | BILLING_RECONCILE`. Unknown values yield 400.

## Response 200

```json
{ "cron": "NIGHTLY_LOG_PRUNE", "lastSuccessAt": "2026-05-12T01:17:33.421Z" }
```

Returned on every successful heartbeat (both first-time and subsequent). The endpoint upserts the matching `CronRun` row.

## Response 400

```json
{ "error": "Unknown cron", "code": "UNKNOWN_CRON" }
```

- Triggered by: body fails Zod validation (missing field, unknown enum value).

## Response 401

```json
{ "error": "Unauthorized" }
```

- Triggered by: missing `Authorization` header or token mismatch with `WORKFLOW_API_TOKEN` env var.

## Response 500

```json
{ "error": "Internal server error" }
```

- Triggered by: database write failure. The workflow step that calls this endpoint MUST treat any non-2xx as a step failure so the cron is observably broken in GitHub Actions.

## Invariants

- The endpoint is idempotent at the row level: repeated calls for the same `cron` overwrite `lastSuccessAt` with the request-time `now()`. There is no "earliest wins" or history kept.
- The endpoint does NOT validate `lastSuccessAt` against a client-supplied timestamp — the server is the clock authority, eliminating drift between distributed runners.
- The endpoint MUST NOT accept a `lastSuccessAt` field in the body; only `cron`. Extra fields are rejected by the Zod schema (`z.object({ cron: z.nativeEnum(CriticalCron) }).strict()`).
