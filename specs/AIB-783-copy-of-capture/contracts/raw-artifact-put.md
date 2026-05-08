# Contract: PUT /api/jobs/:id/logs/raw-artifact

**New endpoint.** Mirrors `PUT /api/jobs/:id/logs/artifact` (existing) for the raw native Claude Code session artifact.

## Authorization
Workflow-token only (`Authorization: Bearer ${WORKFLOW_API_TOKEN}`), validated via `validateWorkflowAuth(request)`. Returns `401 Unauthorized` on missing/invalid token.

## Path parameters
- `id` — `Job.id` as a positive integer. Returns `400 { error: "Invalid job ID" }` otherwise.

## Request
- `Content-Type: application/gzip` (case-insensitive `startsWith`). Returns `415 { error, code: "UNSUPPORTED_MEDIA_TYPE" }` otherwise.
- `Content-Length` — if present and `> 25 * 1024 * 1024`, returns `413 { error, code: "PAYLOAD_TOO_LARGE" }` without reading the body.
- Body — gzip-compressed UTF-8 NDJSON of *native* Claude Code session events. Empty body → `400 { error: "Empty body" }`.

## Server-side processing
1. Resolve `Job` by `id`. Returns `404 { error: "Job not found" }` if missing.
2. Read parent `Ticket.agent`. Returns `409 { error: "Raw artifact not allowed for non-Claude job", code: "AGENT_NOT_CLAUDE" }` if `Ticket.agent !== 'CLAUDE'` (defensive — the runner is supposed to gate this, but the server enforces too).
3. Re-derive canonical key: `buildJobLogRawArtifactKey(job.projectId, job.ticketId, job.id)` → `raw-logs/<projectId>/<ticketId>/<jobId>.jsonl.gz`.
4. Read existing `JobLog` row by `jobId`. If `existingLog?.rawArtifactKey === artifactKey`, emit info log `[PUT /jobs/:id/logs/raw-artifact] Overwriting existing raw artifact for retried job run` with `{ jobId, artifactKey }` (P2 in research.md).
5. `uploadJobLogArtifact(artifactKey, buffer, buffer.byteLength)` — same client helper as normalized. On upload error returns `502 { error, code: "BLOB_UPLOAD_FAILED" }`.

## Success response
- `201 { rawArtifactKey: string, rawArtifactSize: number }` — JSON only, no body bytes echoed.
- The runner stores `rawArtifactKey` from this response and includes it in the subsequent `POST /api/jobs/:id/logs` summary submission. The runner does NOT reconstruct the key client-side (mirrors the normalized contract; see capture-agent-logs.sh:217-225).

## Error response shape
All errors `{ error: string, code?: string }`. Codes used: `UNSUPPORTED_MEDIA_TYPE`, `PAYLOAD_TOO_LARGE`, `AGENT_NOT_CLAUDE`, `BLOB_UPLOAD_FAILED`.

## Idempotency
The Blob client uses `addRandomSuffix: false` and `allowOverwrite: true` (existing). Repeated PUTs for the same `jobId` overwrite the same key. The overwrite is logged.

---

# Contract: DELETE /api/jobs/:id/logs/raw-artifact

**New endpoint.** Mirrors `DELETE /api/jobs/:id/logs/artifact` (existing). Used by the runner's `delete_orphan_artifact()` cleanup path when the *summary* submission fails after a successful raw upload.

## Authorization
Workflow-token only.

## Behavior
1. Resolve `Job` by `id`. `404` if missing.
2. Re-derive canonical key.
3. `deleteJobLogArtifact(artifactKey)`. Returns `200 { deleted: boolean }`. Idempotent: a 404 from Blob is mapped to `{ deleted: false }`, not an error.
4. On unexpected Blob error: `502 { error, code: "BLOB_DELETE_FAILED" }`.

## Notes
- This endpoint does **not** mutate the JobLog row. It only deletes the Blob object. Cleanup of `JobLog.rawArtifactKey` happens implicitly because the summary write that *would* have set it never succeeded.
- This endpoint is also the safe escape hatch for an operator-initiated cleanup of an orphaned raw artifact (e.g., rare partial failure between Blob upload and DB write); same shape as the normalized DELETE.
