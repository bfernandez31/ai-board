# Contract: GET /api/projects/:projectId/tickets/:id/jobs/:jobId/logs/raw-native

**New endpoint.** Mirrors `GET /api/projects/:projectId/tickets/:id/jobs/:jobId/logs/raw` (existing) but serves the raw native Claude Code JSONL artifact instead of the normalized one.

## Authorization
- Session auth via `verifyTicketAccess(ticketId, request)` — project owner OR member.
- Error mapping (verbatim from existing raw route, P8 in research.md):
  - `Unauthorized` → `401 { error: "Unauthorized" }`
  - `Ticket not found` → `403 { error: "Forbidden" }`
  - any other thrown error → `500 { error: "Internal server error" }`

## Path parameters
- `projectId`, `id` (ticketId), `jobId` — all positive integers. `400 { error: "Invalid path parameters" }` if any is non-finite or ≤ 0.

## Server-side processing
1. Validate path params.
2. `verifyTicketAccess` (above). Persist the returned `ticket` for filename derivation.
3. Resolve `Job` by `id` selecting `{ id, ticketId, projectId }`. If missing or any field mismatches the path, `404 { error: "Job not found" }`. (This is the same pattern as the normalized route — *not* `403`. We intentionally avoid leaking existence vs. non-existence beyond what the normalized endpoint already does.)
4. Resolve the parent `Ticket.agent` (cheap follow-up `select`). If `agent !== 'CLAUDE'`, return `404 { error: "Artifact not available" }` — same shape as "no raw artifact for this Claude job" so a non-Claude lookup is indistinguishable from a Claude-no-data lookup. **Do not** emit a different error code; the spec edge case mandates "no information leaked about the artifact's existence".
5. Read `JobLog` for `jobId`, selecting `{ captureStatus, rawArtifactKey }`. If `captureStatus !== 'CAPTURED'` *or* `rawArtifactKey === null`, return `404 { error: "Artifact not available" }`.
6. Re-derive `artifactKey = buildJobLogRawArtifactKey(projectId, ticketId, jobId)` and assert `log.rawArtifactKey === artifactKey`. On mismatch: `console.error('[GET /logs/raw-native] Stored artifact key mismatch', { jobId, expectedArtifactKey, actualArtifactKey, rawUrl })` and return `500 { error: "Artifact key mismatch", code: "ARTIFACT_KEY_MISMATCH" }` (P1 in research.md).
7. Stream via `streamJobLogArtifact(artifactKey)`. On unexpected error: `502 { error, code: "BLOB_UNREACHABLE" }`. On `null` (404 from Blob): `404 { error: "Artifact not found" }`.

## Success response
- `200` with body = the gzipped Blob stream.
- Headers:
  - `Content-Type: application/gzip`
  - `Cache-Control: private, max-age=60`
  - `Content-Length: <bytes>`
  - `Content-Disposition: attachment; filename="${ticketKey}-job-${jobId}-raw.jsonl.gz"` if `?format=jsonl`. Note the `-raw` infix to distinguish downloads from the normalized endpoint's filename. (Existing normalized filename is `${ticketKey}-job-${jobId}.jsonl.gz`.)
- **MUST NOT** set `Content-Encoding: gzip`. The body is an opaque archive, not a gzip-encoded response. Setting it would trigger transparent decompression in `fetch()`. (Verbatim invariant from raw/route.ts:83-88.)

## Caching
Identical 60-second private cache as the normalized endpoint. Browsers may reuse for the same authenticated session.

## Out of scope
- No range-request support (parity with normalized).
- No content-type negotiation; always returns gzip.
- No on-the-fly decompression — clients that want JSONL run `gunzip` themselves.

## Error response shape
All errors `{ error: string, code?: string }`. Codes used: `ARTIFACT_KEY_MISMATCH`, `BLOB_UNREACHABLE`. Codes used by `verifyTicketAccess` mappings: none — only HTTP status conveys the auth failure mode.
