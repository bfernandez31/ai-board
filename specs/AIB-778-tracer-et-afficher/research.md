# Phase 0 Research: AIB-778 Plugin & Agent CLI Version Capture

## Resolved NEEDS CLARIFICATION

The spec contained four AUTO→CONSERVATIVE auto-resolved decisions. Each is treated below as a research question and confirmed against the codebase.

### R1 — Plugin version source

- **Decision**: Read `version` from `.claude-plugin/plugin.json` at the workspace root checked out by the workflow.
- **Rationale**: Confirmed at `/home/runner/work/ai-board/ai-board/target/.claude-plugin/plugin.json:3` (`"version": "1.0.1"`). It is the only file at the AI-Board plugin root that publishes a stable, single-string version. No alternative manifest (e.g., `package.json`, `manifest.toml`) carries a plugin-level version.
- **Alternatives considered**:
  - `package.json` version → rejected: that's the Next.js app version, not the plugin.
  - `git rev-parse HEAD` SHA → rejected by spec auto-decision (low confidence) in favor of a single human-readable identifier.

### R2 — Per-agent CLI version capture command

- **Decision**: Each agent's standard `--version` (or equivalent) invocation, parsed into a single line:
  | Agent | Binary | Capture command | Notes |
  |-------|--------|----------------|-------|
  | CLAUDE | `claude` | `claude --version` | Outputs single line like `1.x.y (Claude Code)` |
  | CODEX | `codex` | `codex --version` | Outputs `codex-cli x.y.z` |
  | GEMINI | `gemini` | `gemini --version` | Single semver line |
  | MISTRAL | `vibe` | `vibe --version` | Single semver line |
- **Rationale**: All four CLIs are installed by the existing `install_*` functions in `.github/scripts/run-agent.sh:364-689` and respond to `--version`. The capture must happen AFTER the corresponding `install_*` call (binary present) and BEFORE `invoke_*` (so the value reflects what's about to run). Output is bounded — we cap to first line, trim, and truncate to `VarChar(40)`.
- **Alternatives considered**:
  - Per-CLI bespoke parsing (extract semver substring) → rejected: spec explicitly notes "capture is not validation"; raw first line is honest.
  - Reading from `package.json` of the npm-installed CLI → rejected: drifts when binary is symlinked or installed via curl (Mistral case).

### R3 — Capture timing

- **Decision**: Inside `dispatch_agent` (`.github/scripts/run-agent.sh:759-795`), after `install_*` (and `auth_*` where applicable) but before `invoke_*`. Both values are captured into bash vars `PLUGIN_VERSION` and `AGENT_CLI_VERSION` then included in the existing RUNNING-status PATCH callback emitted by the parent workflow step.
- **Rationale**: The workflow already issues a `PATCH /api/jobs/:id/status` with `{"status":"RUNNING", "workflowRunId": ...}` immediately after `run-agent.sh` is invoked (see `.github/workflows/speckit.yml:228`, `verify.yml:208`, `quick-impl.yml:202`). Adding two optional fields to that single payload avoids a second round trip and stays within the existing state-machine path.
- **Alternatives considered**:
  - New endpoint `PATCH /api/jobs/:id/runtime-versions` → rejected: adds API surface and a second call without any state-machine concern that warrants isolation. Versions are immutable per job and naturally belong with the RUNNING transition.
  - Capture after the agent completes → rejected: spec FR-009 mandates "before the agent CLI begins its main task".

### R4 — Missing-value rendering

- **Decision**: When `pluginVersion` or `agentCliVersion` is `null`, render the same em-dash `—` (U+2014) the timeline already uses for missing duration/cost in the trigger row (`components/ticket/jobs-timeline.tsx:145, 150`). Render as a compact span using the same Tailwind classes as the existing model badge (`text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded`).
- **Rationale**: Direct match for FR-007 ("discreet placeholder rather than hiding the label"). Using the existing badge style keeps the layout stable for jobs with and without the data and avoids introducing new color tokens.
- **Alternatives considered**:
  - Hide the badge when null → rejected: violates FR-007's "render a placeholder, not omit".
  - "—" inline next to model → rejected: makes the model badge ambiguous when versions are missing.

## Existing Files

Mandatory inventory before implementation. Every path verified to exist; no invented file names.

### Source files to MODIFY

| Path | Currently covers | Change |
|------|------------------|--------|
| `prisma/schema.prisma:29-75` | `Job` model definition | Add two nullable `String? @db.VarChar(40)` columns: `pluginVersion`, `agentCliVersion` |
| `app/lib/job-update-validator.ts` | `jobStatusUpdateSchema` Zod schema for status PATCH | Add `pluginVersion: z.string().max(40).optional()` and `agentCliVersion: z.string().max(40).optional()` |
| `app/api/jobs/[id]/status/route.ts:182-226` | PATCH handler — builds `updateData`, calls `prisma.job.updateMany` | Persist version fields when present in body and `requestedStatus === 'RUNNING'`; first-write-wins like `workflowRunId` (line 204) |
| `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts:128-160` | GET — `select` clause for the jobs list | Add `pluginVersion: true, agentCliVersion: true` |
| `lib/types/job-types.ts:55-76` | `TicketJobWithTelemetry` interface | Add `pluginVersion: string \| null; agentCliVersion: string \| null;` |
| `components/ticket/jobs-timeline.tsx:115-180` | `JobRow` trigger layout (status icon, command, model badge, duration, cost) | Add two compact spans next to the model badge — show value or em-dash |
| `.github/scripts/run-agent.sh:759-795` | `dispatch_agent` — central agent dispatch case statement | Capture plugin manifest version + per-agent CLI version into env vars consumed by the parent workflow step |
| `.github/workflows/speckit.yml:228` | "Update Job Status - Running" step | Read captured env vars and append to the JSON body of the PATCH call |
| `.github/workflows/verify.yml:208` | Same step | Same modification |
| `.github/workflows/quick-impl.yml:202` | Same step | Same modification |
| `.github/workflows/iterate.yml` | Same step (presence confirmed by `Grep` of `api/jobs.*status` across `.github/workflows/`) | Same modification |
| `.github/workflows/ai-board-assist.yml` | Same step | Same modification |

### New file to CREATE

| Path | Reason | Verification that no existing file covers it |
|------|--------|---------------------------------------------|
| `prisma/migrations/<timestamp>_add_job_runtime_versions/migration.sql` | Adds columns to `jobs` table | `prisma/migrations/` directory exists (e.g., `20260425061714_add_job_context_metrics/`); each schema change is its own migration directory |

### Test files to EXTEND (per constitution §III)

| Path | Currently covers | Add |
|------|------------------|-----|
| `tests/unit/components/jobs-timeline.test.tsx` | `JobRow` expanded breakdown (Avg Context, Turn Count) | Three new cases: (a) both versions render, (b) both null → em-dash, (c) plugin-only present (em-dash for CLI) |
| `tests/integration/jobs/status.test.ts` | PATCH /api/jobs/:id/status state-machine + workflowRunId persistence | Two new cases: (a) PATCH with `pluginVersion` + `agentCliVersion` on RUNNING transition persists both; (b) values >40 chars are rejected with 400 |
| `tests/integration/jobs/ticket-jobs.test.ts:60-208` | GET ticket jobs returns telemetry fields | One new case: response includes `pluginVersion` and `agentCliVersion` fields (null for jobs without capture, populated when set) |
| `tests/unit/scripts/run-command.test.ts` | Script unit tests for run-agent.sh wrappers | Two new cases: (a) `read_plugin_version` returns trimmed value from JSON, (b) `read_plugin_version` returns empty when manifest missing |

No new test files. No E2E.

## Patterns to Follow

The feature parallels existing telemetry-capture and state-update flows. The following concrete patterns from the reference code MUST be reused.

### P1 — First-write-wins on RUNNING (state-update pattern)

**Reference**: `app/api/jobs/[id]/status/route.ts:204`
```ts
if (requestedStatus === 'RUNNING' && validationResult.data.workflowRunId && !job.workflowRunId) {
  updateData.workflowRunId = BigInt(validationResult.data.workflowRunId);
}
```
**Apply to**: `pluginVersion` and `agentCliVersion`. Both fields are written ONLY when (a) `requestedStatus === 'RUNNING'`, (b) the body contains a value, and (c) the existing column is null. Idempotent retries of the RUNNING PATCH must not overwrite a populated value with a different one. Use the same conditional shape — extend the existing `select` (`route.ts:117-123`) to include `pluginVersion` and `agentCliVersion` so the guard can compare.

### P2 — Atomic conditional update (state machine pattern)

**Reference**: `app/api/jobs/[id]/status/route.ts:223-226`
```ts
const transitionResult = await prisma.job.updateMany({
  where: { id: jobId, status: currentStatus },
  data: updateData,
});
```
**Apply to**: The version fields are added to the same `updateData` object, persisted in the same `updateMany` call. No separate DB round trip. The `where: { status: currentStatus }` guard ensures duplicate workflow callbacks don't double-write.

### P3 — Capture failure must not block the job (error-handling pattern)

**Reference**: `.github/scripts/run-agent.sh:419-446` — `persist_codex_token` logs failure with `log_info "Failed to persist Codex OAuth token (HTTP $HTTP_CODE) — next run may need re-auth"` and returns 0 unconditionally. The agent task continues regardless.

**Apply to**: The new `read_plugin_version` and `read_agent_cli_version` bash helpers. Each MUST:
1. Wrap the read/invocation in a guarded form (`<cmd> 2>/dev/null || true`).
2. Empty stdout → empty env var (NOT a sentinel string like "unknown" or "ERROR").
3. Failure logged via existing `log_info` (NOT `log_error` since it's not a fatal condition for the agent run).
4. Never `exit` or `return` non-zero from the helper.

This matches FR-004 ("If capture fails for either value, the job MUST continue to run normally") and FR-010 ("Capture failures MUST be recorded in runner-side logs … but MUST NOT propagate to job status").

### P4 — Compact metric badge styling (UI pattern)

**Reference**: `components/ticket/jobs-timeline.tsx:135-139`
```tsx
{job.model && (
  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded hidden sm:inline">
    {job.model}
  </span>
)}
```
**Apply to**: `pluginVersion` and `agentCliVersion` badges. Same span shape; same Tailwind classes. Difference: render even when the value is null (showing `—` inside) so the slot is stable, satisfying FR-007. Use `data-testid={\`job-plugin-version-${job.id}\`}` and `…-cli-version-…` to mirror the existing test-ID convention used for duration/cost (lines 144, 149).

### P5 — Em-dash placeholder convention

**Reference**: `components/ticket/jobs-timeline.tsx:145, 150`
```tsx
{job.durationMs != null ? formatDuration(job.durationMs) : '-'}
{job.costUsd != null ? formatCost(job.costUsd) : '-'}
```
**Apply to**: Use the same `'-'` literal (rendered glyph: hyphen-minus, matching the trigger-row convention). The spec calls this "em-dash" but the existing code uses ASCII hyphen-minus for the same slot — staying consistent with the existing trigger row beats introducing a new glyph and is what the user already sees for missing duration/cost.

### P6 — Workflow JSON body assembly (workflow pattern)

**Reference**: `.github/workflows/speckit.yml:228-232`, `verify.yml:208-211`
```yaml
HTTP_CODE=$(curl -X PATCH "${APP_URL}/api/jobs/${{ inputs.job_id }}/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}" \
  -d '{"status": "RUNNING", "workflowRunId": ${{ github.run_id }}}' \
  -s -o /dev/null -w "%{http_code}") || true
```
**Apply to**: Same pattern. Use `jq -nc` to safely build the JSON body so empty version vars become absent fields (not empty strings) — that way the optional Zod schema treats them as "not provided" and the route handler keeps the column null. Example replacement:
```yaml
BODY=$(jq -nc \
  --arg status RUNNING \
  --argjson runId "${{ github.run_id }}" \
  --arg plugin "${PLUGIN_VERSION:-}" \
  --arg cli "${AGENT_CLI_VERSION:-}" \
  '{status:$status, workflowRunId:$runId} + (if $plugin == "" then {} else {pluginVersion:$plugin} end) + (if $cli == "" then {} else {agentCliVersion:$cli} end)')
```

### P7 — Per-agent abstraction in dispatch (extensibility pattern)

**Reference**: `.github/scripts/run-agent.sh:759-795` — `dispatch_agent` uses a `case "$AGENT_TYPE"` switch where each branch installs/authenticates/invokes the right CLI.

**Apply to**: Version capture follows the same shape. Add a per-agent capture function (`capture_claude_version`, `capture_codex_version`, `capture_mistral_version`, `capture_gemini_version`) and wire each into its existing case branch right between `install_*` and `invoke_*`. Adding a fifth agent later is then a localized change, satisfying the spec's edge case "A new agent type is added in the future: the version-capture abstraction should make adding a fifth agent a localized change".

## Open Questions

None. Every NEEDS CLARIFICATION from the spec auto-resolution has been confirmed against the codebase, and every reference pattern has been verified at the cited file:line.
