# Research: Capture native Claude Code session JSONL alongside normalized logs

**Branch**: `AIB-783-copy-of-capture` | **Date**: 2026-05-08
**Source spec**: `specs/AIB-783-copy-of-capture/spec.md`

This research consolidates the existing capture pipeline (AIB-715 + AIB-724 + AIB-744) so the AIB-783 plan can extend the right files instead of inventing new ones. Every "NEEDS CLARIFICATION" from the spec is resolved here.

---

## Decisions

### D1. Storage key shape for the raw native artifact
- **Decision**: `raw-logs/<projectId>/<ticketId>/<jobId>.jsonl.gz` — same `(projectId, ticketId, jobId)` tuple as the normalized key, distinct prefix (`raw-logs/` vs `logs/`).
- **Rationale**: The CONSERVATIVE policy in the spec mandates a *separate* artifact under the same grouping with a deterministically derivable key (matching AIB-724 hardening). A sibling builder `buildJobLogRawArtifactKey` keeps the construction logic next to `buildJobLogArtifactKey` so they can never drift. Sharing the same prefix (e.g. appending `.raw.jsonl.gz`) would risk Vercel Blob's per-prefix listing semantics treating them as variants of the same object.
- **Alternatives considered**:
  - `logs/<projectId>/<ticketId>/<jobId>.raw.jsonl.gz` — rejected: pruning queries blob list under `logs/` and would have to filter; mixing extensions per-row is brittle.
  - Query-parameter retrieval (`?format=raw-native`) — rejected by the spec ("alternatives like a query parameter were rejected because they complicate caching and authorization audits").

### D2. Where to gate on agent type in the runner
- **Decision**: Gate on `${AGENT_UPPER}` inside `.github/scripts/capture-agent-logs.sh` immediately after Phase 5 (existing normalized upload) succeeds. Phases 1–5 are unchanged. A new Phase 5b *only runs when* `AGENT_UPPER == CLAUDE` AND a non-empty `${CLAUDE_AGGREGATED}` exists.
- **Rationale**: Phase 1 already aggregates the native session files into `${CLAUDE_AGGREGATED}` for Claude (target/.github/scripts/capture-agent-logs.sh:59-76). Reusing that file avoids re-reading from `~/.claude/projects/...` and inherits the trailing-newline fix (capture-agent-logs.sh:67-71). Gating *before* the new phase short-circuits all wasted work for non-Claude jobs (FR-008, US3).
- **Alternatives considered**:
  - Apply the redactor to the same in-memory event array used for normalization — rejected: the normalized array has already lost native fields (FR-002 violation).
  - Run raw capture *before* normalized — rejected: the spec requires raw failure to never affect the normalized artifact (FR-010); doing raw first risks polluting the runner state.

### D3. Where to gate on agent type in the retrieval endpoint
- **Decision**: The new `GET .../logs/raw-native` endpoint resolves `Ticket.agent` (already on the schema, see prisma/schema.prisma:182) for the job's parent ticket and returns 404 if the agent isn't `CLAUDE`. It also returns 404 if `JobLog.rawArtifactKey` is null. The same canonical-key re-derivation is applied (AIB-724 pattern from raw/route.ts:51-63).
- **Rationale**: Tickets carry the agent (`agent Agent?` on Ticket). Joining via `Job → Ticket` is one extra `select` (already required to verify membership). The "not Claude" and "no raw artifact" outcomes both collapse to 404, matching FR-008 and the "no information leaked about the artifact's existence" edge case.
- **Alternatives considered**:
  - Storing agent on JobLog at write-time — rejected: redundant; the Ticket source-of-truth already carries it. Avoids a denormalization that could drift.
  - Inferring agent from artifact-key prefix — rejected: presence of `raw-logs/...` only confirms a successful past upload, not the agent identity for the *current* request.

### D4. Persisting raw-artifact metadata
- **Decision**: Add two nullable columns to `JobLog`: `rawArtifactKey VARCHAR(300)` and `rawArtifactSize INT`. The existing `captureStatus` is *not* extended; raw capture is treated as a sub-state within the normalized capture record. A non-null `rawArtifactKey` means "raw artifact present and retrievable"; null means "absent" (which covers Claude-no-data, non-Claude, and raw-upload-failure cases — all 404 from the API).
- **Rationale**: One JobLog row per job is the existing invariant (jobId is `@unique`). Adding columns rather than a sibling table keeps the upsert in `POST /api/jobs/:id/logs` atomic and matches AIB-744's pattern of evolving JobLog with optional metric columns rather than splitting into a side table. Re-using `captureStatus` for the raw substate would force a 6-state enum that would drift from the normalized semantics.
- **Alternatives considered**:
  - New `JobRawLog` table — rejected: doubles the upsert surface, doubles the prune-query scope, no value while raw is 1:1 with normalized.
  - Skipping DB persistence and probing Blob on every retrieval — rejected: the canonical-key check from AIB-724 *requires* a stored value to compare against; without storage we could not detect a stored-vs-derived mismatch.

### D5. Failure isolation between normalized and raw uploads
- **Decision**: The raw-capture phase runs only after `put_artifact` (normalized) returns success. Any failure in the raw phase is logged and ignored — `CAPTURE_STATUS` remains `CAPTURED`, the summary submission proceeds with normalized-only metadata, and the script still exits 0 (matching capture-agent-logs.sh:14 invariant). The summary submission is extended to *optionally* include `rawArtifactKey`/`rawArtifactSize`; absence of those fields is the "raw not captured" signal.
- **Rationale**: FR-010 mandates raw failures never change the job's terminal status, never affect the normalized artifact, and never change the script's exit code. Running raw after normalized success is the simplest realization. The summary endpoint already supports an optional payload with refine() validation (schema.ts:75-100) — we mirror that pattern.
- **Alternatives considered**:
  - Run raw and normalized in parallel — rejected: complicates failure isolation, and raw cannot succeed if normalized never started.
  - Retry raw upload on failure — rejected: spec says "The capture is not retried within the same workflow run".

### D6. Redaction over native JSONL
- **Decision**: Stream the aggregated native JSONL line-by-line through a new helper `redactNativeJsonl(line)` in `app/lib/logs/redactor.ts` (and its `.mjs` sibling). The helper parses each line as JSON, applies `deepRedact()` to every nested string, and re-serializes. Lines that fail to parse pass through `redactString()` as plain text (defensive: never let an unparseable line carry an unredacted secret).
- **Rationale**: `deepRedact()` already exists in both redactor copies and walks arbitrary nested objects (redactor.mjs:40-53). Native session events are arbitrary JSON objects; reusing the same walker is mandatory for FR-003 and the spec's "redaction must run over the *aggregated* native JSONL (every event line, every nested string field)". Falling back to `redactString()` on parse failure is a safety net, not the primary path.
- **Alternatives considered**:
  - Apply `redactEvents()` (which switches on `event.type` for normalized events) — rejected: native events use entirely different types (`user`, `assistant`, `tool_use`, `summary`, etc.) and the switch would silently no-op them, breaking redaction.
  - Regex over the raw byte stream — rejected: would corrupt JSON encoding and false-positive on JSON syntax characters.

### D7. Retention pruning extension
- **Decision**: Extend the existing `POST /api/maintenance/prune-logs` handler (app/api/maintenance/prune-logs/route.ts) to also call `deleteJobLogArtifact(rawArtifactKey)` before each row's `updateMany` clears the row. The same batch loop, the same skipping-when-Blob-unconfigured logic, and the same idempotency. No second cron, no second endpoint.
- **Rationale**: The pruning workflow runs nightly and processes both normalized and raw rows together — the spec's "deleted together" guarantee is naturally satisfied because they share a JobLog row. Idempotency is preserved because `deleteJobLogArtifact` returns `{deleted: false}` on 404.
- **Alternatives considered**:
  - Separate `prune-raw-logs` cron — rejected: spec says "the existing pruning job is extended (rather than duplicated) so a job's normalized and raw artifacts are deleted together".
  - Deleting raw via blob list-prefix scan — rejected: list-prefix scans don't enforce idempotency on a per-job basis and risk orphan deletions.

### D8. Empty / no-session-data Claude jobs
- **Decision**: When `${CLAUDE_AGGREGATED}` is empty *or* doesn't exist, the runner emits an info-level log line `capture-agent-logs: raw_capture skipped reason=no_session_data jobId=${JOB_ID}` and proceeds. No upload attempt, no error log. The summary submission omits `rawArtifactKey`/`rawArtifactSize`.
- **Rationale**: FR-009 requires this case be distinguishable from a failure in the runner logs. The literal token `no_session_data` (vs `upload_failed`/`redaction_failed`) is greppable and matches the existing "FAILED status=... reason=..." log shape (capture-agent-logs.sh:204).
- **Alternatives considered**:
  - Upload an empty artifact to mark "we tried" — rejected: violates "no raw artifact uploaded" and would confuse the retrieval 404 logic.

### D9. Overwrite-logging parity with AIB-724
- **Decision**: The new raw-upload route handler (or the extended PUT handler — see D10) emits the same overwrite-detected info log (capture-agent-logs.sh callers; route.ts:70-75 pattern) when `existingLog?.rawArtifactKey === artifactKey`. Same shape, same key fields (`{ jobId, artifactKey }`).
- **Rationale**: FR-012 mandates overwrites are observable. Reusing the existing log shape keeps grep patterns the same.
- **Alternatives considered**: None — this is a direct port.

### D10. Upload endpoint shape (new vs. extended)
- **Decision**: Add a new `PUT /api/jobs/:id/logs/raw-artifact` endpoint as a sibling of the existing `PUT /api/jobs/:id/logs/artifact`, plus a sibling `DELETE /api/jobs/:id/logs/raw-artifact` for orphan cleanup. The handler is a near-copy of `artifact/route.ts` differing only in the key builder used.
- **Rationale**: A single endpoint with a query param (`?kind=raw`) would force the runner-side `put_artifact` to fork on the URL. Two endpoints keep each handler small and let test fixtures target one without polluting the other. The orphan-cleanup `DELETE` is needed because `delete_orphan_artifact()` in capture-agent-logs.sh:276-282 is what unwinds a successful upload when the summary write fails — we need that same safety net for raw.
- **Alternatives considered**:
  - One endpoint, multipart body — rejected: gzip streams aren't naturally multipart-friendly.
  - Combine in `artifact/route.ts` with a header switch — rejected: header-driven routing is less obvious than a path.

### D11. Redactor sync between TS and MJS
- **Decision**: Add `redactNativeJsonl(line: string): string` to *both* `app/lib/logs/redactor.ts` and `.github/scripts/lib/redactor.mjs`. The TS version is exported only for testability; the runner uses the MJS copy. The patterns array remains shared by hand-sync (per the comment at redactor.mjs:1-3).
- **Rationale**: The runner runs Node directly from `.github/scripts/` and cannot import from `app/lib/...` (the path alias `@/` is Next.js-only). The existing dual-copy is already a maintenance reality, with a sync test at `tests/unit/logs/redactor.test.ts` to catch drift.
- **Alternatives considered**:
  - Build-time generation of the MJS from the TS — rejected: runner runs in CI before any build step; out of scope for this ticket.

### D12. Runner-side gzip + size cap
- **Decision**: Reuse the same `gzip -c` invocation pattern from capture-agent-logs.sh:187. Use the same `ARTIFACT_MAX_BYTES = 25 MB` limit (app/lib/logs/schema.ts:6) on the server side; the runner does *not* enforce a client-side limit because gzip ratios on JSONL are typically 8-15× and a 25 MB compressed cap is generous. If the server returns 413, the runner logs and skips raw upload (failure-isolation per D5).
- **Rationale**: Consistency with normalized; the size cap is one of two server-validated invariants (the other is content-type), and there's no value to duplicating it client-side.
- **Alternatives considered**:
  - Higher cap for raw (e.g. 100 MB) — rejected: storage doubling is already the cost of this feature; raising the cap would compound it. Spec assumption #3 says ~2x storage is acceptable, not >2x.

---

## Existing Files

This inventory was collected from the codebase before any implementation. Each path is real; the plan extends or creates next to these files only — never invents alternative locations.

### Pattern reference (READ during planning, do not modify)
- `app/api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/raw/route.ts` — Pattern reference: AIB-724 canonical-key re-derivation + `verifyTicketAccess` + 404 collapse.
- `app/api/jobs/[id]/logs/artifact/route.ts` — Pattern reference: workflow-token PUT + content-type/size validation + overwrite logging + DELETE orphan cleanup.
- `app/api/jobs/[id]/logs/route.ts` — Pattern reference: summary upsert, `redactString()` over preview, `JobLogSubmissionSchema` refine() for "X required iff CAPTURED".
- `app/api/maintenance/prune-logs/route.ts` — Pattern reference: batch loop, blob-unconfigured skip, idempotent updateMany, CYCLE_LIMIT.
- `app/lib/blob/client.ts` — Reuse as-is: `uploadJobLogArtifact`/`streamJobLogArtifact`/`deleteJobLogArtifact`/`isConfigured` work for any key shape.
- `app/lib/logs/schema.ts` — Extend: add `rawArtifactKey`/`rawArtifactSize` (optional) to the submission schema, mirror the refine() rule.
- `app/lib/logs/artifact-key.ts` — Extend: add `buildJobLogRawArtifactKey` and `buildJobLogRawNativeUrl` next to existing builders.
- `app/lib/logs/redactor.ts` — Extend: add `redactNativeJsonl(line)`.
- `.github/scripts/capture-agent-logs.sh` — Extend: append Phase 5b for Claude-only raw capture (lines 181-234 region is the model).
- `.github/scripts/lib/redactor.mjs` — Extend: add `redactNativeJsonl(line)` (must mirror the TS impl).
- `.github/workflows/nightly-log-prune.yml` — Reuse as-is: no schedule changes.
- `prisma/schema.prisma` — Extend: add `rawArtifactKey`/`rawArtifactSize` to `JobLog`. No new enum values.
- `lib/db/auth-helpers.ts` — Reuse as-is: `verifyTicketAccess` is the gate.
- `app/lib/auth/workflow-auth.ts` — Reuse as-is: `validateWorkflowAuth` for the new PUT.

### New files to create
- `app/api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/raw-native/route.ts` — New retrieval endpoint (mirrors `logs/raw/route.ts`).
- `app/api/jobs/[id]/logs/raw-artifact/route.ts` — New PUT/DELETE upload endpoint (mirrors `logs/artifact/route.ts`).
- `prisma/migrations/<timestamp>_add_job_log_raw_artifact/migration.sql` — `ALTER TABLE "JobLog" ADD COLUMN "rawArtifactKey" VARCHAR(300), ADD COLUMN "rawArtifactSize" INTEGER`.

### Existing tests to extend (preferred over creating new files)
- `tests/unit/logs/redactor.test.ts` — Extend with cases for `redactNativeJsonl()` covering: native field with token, nested tool_input field with API key, summary event with embedded `KEY=VALUE` env secret, malformed line passthrough.
- `tests/integration/api/jobs/logs-artifact-put.test.ts` *or* new `tests/integration/api/jobs/logs-raw-artifact-put.test.ts` — Decision: **new file**. Rationale: the existing file's helpers are deeply parameterized for a single endpoint and adding raw cases would force every test to switch on a kind. Mixing endpoints in one file would violate the constitution's "don't mix unrelated concerns" rule.
- `tests/integration/api/jobs/logs-post.test.ts` — Extend: add cases for the optional `rawArtifactKey`/`rawArtifactSize` submission fields (valid + invalid combinations).
- `tests/integration/api/jobs/logs-raw-route.test.ts` *or* new `tests/integration/api/jobs/logs-raw-native-route.test.ts` — Decision: **new file**. Rationale: the existing file targets the normalized retrieval; the raw-native route adds a new agent-gate code path that warrants its own fixture set.
- `tests/integration/api/maintenance/prune-logs.test.ts` — Extend: add a case where a JobLog has both `artifactKey` and `rawArtifactKey` and assert both blob keys are deleted in the same batch.
- `tests/e2e/capture-and-display-logs.spec.ts` — Extend: add an assertion that the new raw-native endpoint is reachable for a Claude job and 404s for a Codex job. Keeps E2E count flat (constitution: "E2E is expensive").

### New tests to create (only if no existing file fits)
- `tests/integration/api/jobs/logs-raw-artifact-put.test.ts` — see decision above.
- `tests/integration/api/jobs/logs-raw-native-route.test.ts` — see decision above.

---

## Patterns to Follow

These are concrete patterns extracted from the reference files. Implementation MUST follow them — not "follow existing patterns" in the abstract.

### P1. Canonical-key re-derivation (from `logs/raw/route.ts:51-63`)
```ts
const artifactKey = buildJobLogRawArtifactKey(projectId, ticketId, jobId);
if (log.rawArtifactKey !== artifactKey) {
  console.error('[GET /logs/raw-native] Stored artifact key mismatch', {
    jobId,
    expectedArtifactKey: artifactKey,
    actualArtifactKey: log.rawArtifactKey,
  });
  return NextResponse.json(
    { error: 'Artifact key mismatch', code: 'ARTIFACT_KEY_MISMATCH' },
    { status: 500 }
  );
}
```
The new raw-native GET MUST replicate this 500-with-code response, not a soft fallback.

### P2. Overwrite logging (from `logs/artifact/route.ts:70-75`)
```ts
if (existingLog?.captureStatus === 'CAPTURED' && existingLog.rawArtifactKey === artifactKey) {
  console.info('[PUT /jobs/:id/logs/raw-artifact] Overwriting existing raw artifact for retried job run', {
    jobId,
    artifactKey,
  });
}
```
Same shape, same fields.

### P3. Failure-isolation in capture-agent-logs.sh (from lines 215-234)
The existing pattern: `put_artifact` returns 0/1; on failure, `CAPTURE_STATUS=UNAVAILABLE` and `PREVIEW=...failed.` *only* affects the normalized record. The new Phase 5b MUST follow a stricter pattern: failure of `put_raw_artifact` *never* mutates `CAPTURE_STATUS` or `PREVIEW`. It mutates only `RAW_ARTIFACT_KEY` (set to empty) and emits a structured log.

### P4. Schema refine() for "X required iff CAPTURED" (from schema.ts:88-100)
The existing rule:
```ts
.refine((data) => {
  if (data.captureStatus === 'CAPTURED') {
    return typeof data.artifactKey === 'string' && typeof data.artifactSize === 'number';
  }
  return data.artifactKey === undefined && data.artifactSize === undefined;
}, ...)
```
Add a *separate* refine() for raw — but **only one direction**: if `rawArtifactKey` is present, `rawArtifactSize` MUST also be present, and vice versa. Both being absent is valid (raw not captured / non-Claude). This is *not* tied to `captureStatus`; raw absence with `captureStatus === CAPTURED` is the no-session-data and failure-isolation case.

### P5. Atomic upsert pattern (from logs/route.ts:67-72)
Existing pattern uses `upsert` on `(jobId)`:
```ts
await prisma.jobLog.upsert({
  where: { jobId },
  create: { jobId, ...data },
  update: data,
});
```
The extended POST handler MUST keep the upsert atomic — i.e. set both `artifactKey`/`artifactSize` and the optional `rawArtifactKey`/`rawArtifactSize` in the same `data` object. Splitting into two upserts would break the row-level atomicity test (logs-post.test.ts asserts upsert behavior).

### P6. Pruning-loop extension (from prune-logs/route.ts:41-58)
Existing pattern:
```ts
if (row.artifactKey) {
  if (!blobConfigured) { skippedCount += 1; continue; }
  try { await deleteJobLogArtifact(row.artifactKey); }
  catch { skippedCount += 1; continue; }
}
confirmedIds.push(row.id);
```
For raw, run a *parallel* if-block immediately *after* the existing one, **inside the same `for (const row of batch)` iteration**. Both deletes contribute to the same `confirmedIds` decision: a row is only confirmed pruned if the normalized delete succeeded *and* the raw delete (if attempted) succeeded. A raw-delete failure increments `skippedCount` and `continue`s without confirming the row, so the next prune cycle will retry both. The `updateMany` at line 64 also clears `rawArtifactKey` and `rawArtifactSize` — same two-line addition to the `data` object as the column add in P5.

### P7. Workflow-token auth (from logs/artifact/route.ts:12-15)
```ts
const auth = validateWorkflowAuth(request);
if (!auth.isValid) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```
Identical for the new PUT/DELETE on raw-artifact.

### P8. Member auth (from logs/raw/route.ts:22-33)
The full try/catch over `verifyTicketAccess` returning 401/403/500 with the *exact* error-message string check (`'Unauthorized'`, `'Ticket not found'`) is a fragile but established pattern. Copy it verbatim for the new GET — do not "improve" the error-message strings.

### P9. Runner script gating (from capture-agent-logs.sh:59-76)
The existing Claude-aggregation gate is exactly the right shape for the new phase:
```bash
if [[ "${AGENT_UPPER}" == "CLAUDE" ]]; then
  # ... aggregation work
fi
```
Phase 5b reuses the same env var (`AGENT_UPPER`) and the same intermediate file (`${CLAUDE_AGGREGATED}`). No new env wiring required.

---

## Open questions

None. All NEEDS CLARIFICATION from the spec are resolved by D1–D12 above, anchored to existing patterns P1–P9.
