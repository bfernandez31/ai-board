# Agent Selection


### Claude Model Selection

For workflows dispatched to the Claude agent, the system resolves a specific Claude model ID per stage using a priority chain.

**Model Resolution**:
1. **Ticket override** — `ticket.{stageModel}` (set individually per stage in the override dialog)
2. **Project default** — `project.{stageModel}` (configured in the AI Models card in project settings)
3. **Global fallback** — `claude-opus-4-7` (hard-coded; ensures pre-existing projects are byte-for-byte identical to before this feature)

**Configurable stages**: SPECIFY, PLAN, IMPLEMENT, QUICK-IMPL, VERIFY.

**Non-configurable stages** (`iterate`, `comment-*`, `health-scan`, `retro-spec`, `onboard`): always use the global fallback regardless of project or ticket settings.

**Non-Claude agents**: when the effective agent is not Claude, per-stage model configuration is ignored entirely; the agent uses its own current default.

The resolved model ID is:
- Passed to the workflow as the `model` dispatch input
- Written to `Job.model` at job creation for per-stage cost analytics

**Model Whitelist** (closed set; unknown values on read fall through to the next resolution layer):
- `claude-opus-4-7` — Claude Opus 4.7 (global fallback)
- `claude-opus-4-6` — Claude Opus 4.6
- `claude-sonnet-4-6` — Claude Sonnet 4.6
- `claude-haiku-4-5-20251001` — Claude Haiku 4.5

### Per-Workflow Agent Routing

Every workflow dispatch includes the resolved agent value so each workflow invokes the correct AI CLI tool.

**Agent Resolution**:

The effective agent is determined by a priority chain:
1. **Ticket override** — `ticket.agent` (optional, per-ticket setting)
2. **Project default** — `project.defaultAgent` (required, defaults to CLAUDE)
3. **System fallback** — `CLAUDE` (defensive, only if project default is somehow unset)

**Supported Agents**:
- `CLAUDE` — Anthropic Claude CLI (default)
- `CODEX` — OpenAI Codex CLI
- `MISTRAL` — Mistral vibe CLI
- `GEMINI` — Google Gemini CLI

**Scope**:
- Core ticket workflows receive the resolved agent: SPECIFY, PLAN, BUILD, VERIFY, QUICK, iterate
- Some workflows remain explicitly agent-restricted even when ticket/project resolution returns a different default. For example, ai-board-assist code review remains Claude-only, and setup / retro-spec / health-scan may reject unsupported agents before dispatch.
- Agent selection is read-only during dispatch — it flows from the database into workflow inputs without changing ticket state

## Agent Execution Log Capture & Display

Every workflow that runs an AI agent (Claude, Codex, Mistral, Gemini) captures the agent's execution transcript so project members can diagnose failures from the ai-board UI without GitHub Actions access. Capture is agent-agnostic and uniform across self-managed and external projects.

### Inline preview in the timeline

Every terminated job row on the ticket's Stats tab shows a one-line preview below the command/status header, colored per status:

| Job status | Preview content |
|---|---|
| `FAILED` | Terminal error excerpt, secrets redacted |
| `COMPLETED` | Brief summary — final agent message snippet or short tool-usage recap |
| `CANCELLED` | Cancellation cause (user-cancelled, timeout, upstream error) |
| `UNAVAILABLE` | Literal "Logs unavailable — capture failed." (capture attempt did not complete) |
| `PRUNED` | Literal notice that logs are no longer retained (>30 days old) |

The preview is capped at 280 characters with trailing `…` truncation so the timeline cannot visually balloon. It renders without user interaction — reading the preview alone lets a member form a hypothesis about each job's outcome.

### Full log viewer

A "View full logs" affordance on each timeline row opens a side sheet that renders the normalized event stream with type-specific styling — not a raw JSON dump. Each entry carries a timestamp, a type icon, and a monospace payload body. Event types:

| Event type | Meaning |
|---|---|
| `message` | Agent, user, or system message text (and `thinking` on Claude) |
| `tool_invocation` | Tool name, call ID, and input payload |
| `tool_result` | Output for a given `toolCallId`, with an `isError` flag |
| `error` | Error message and optional stack |
| `lifecycle` | `started` / `completed` / `cancelled` / `timeout` / `upstream_error` |

From the viewer, users can copy any single entry to the clipboard and trigger "Download raw" to fetch the gzipped JSONL artifact through the authenticated `/logs/raw?format=jsonl` endpoint. For `UNAVAILABLE` / `PRUNED` logs the trigger is disabled with explanatory copy; for a `502` from the Blob backend the sheet shows a clear error state while the inline preview from Postgres remains visible.

### Access control

Log access follows the parent ticket's authorization rules — project owners and project members can read; non-members cannot. Access is enforced server-side via `verifyTicketAccess`; the Blob artifact pathname is never rendered client-side and raw streams are proxied through the ai-board API on every read.

### Secret redaction

Before any transcript leaves the GitHub Actions runner, recognizable secrets are replaced with a visible `[REDACTED:<kind>]` placeholder so reviewers can see that an elision occurred. Redaction covers:
- GitHub tokens (`ghp_`, `ghs_`, `gho_`, `ghu_`, `ghr_`)
- OAuth bearer tokens
- Private SSH keys
- High-entropy `KEY=VALUE` environment pairs

The placeholder is preserved through the preview and through every event payload — `message` text, `tool_invocation.input`, `tool_result.output`, `error.message`, and `error.stack` are all passed through the redactor; the server re-runs the preview through the same redactor on submit as defense-in-depth.

### Capture failure behavior

Log capture runs in parallel with — and never blocks — the terminal status report. If capture, redaction, upload, or summary submission fails:
- The job's terminal status (`COMPLETED` / `FAILED` / `CANCELLED`) is still reported via `PATCH /api/jobs/:id/status`
- The `JobLog` row is written with `captureStatus = UNAVAILABLE` and the literal preview `"Logs unavailable — capture failed."`
- Existing telemetry (tokens, cost, duration, tools used, quality score) continues to flow through its own OTLP / batch pipeline
- The UI surfaces the unavailable state explicitly rather than silently hiding the absence

### Agent Log Capture (per workflow run)

Every agent-invoking workflow — `speckit.yml`, `quick-impl.yml`, `verify.yml`, `ai-board-assist.yml`, `iterate.yml` — includes a capture step (`if: always()`) after the agent invocation and before the terminal status PATCH.

**Input**: tee'd raw agent stdout at `$RUNNER_TEMP/agent-raw-<jobId>.log`, plus agent-specific session dirs (`~/.claude/projects/...`, `~/.codex/sessions/*`, `~/.vibe/sessions/*`).

**Phases**:
1. Collect the tee'd raw log; synthesize a two-event `lifecycle:started` + `lifecycle:cancelled` pair when the log is empty (covers the cancelled-before-any-output edge case)
2. Normalize via the agent-specific script (`normalize-claude.mjs`, `normalize-codex.mjs`, `normalize-mistral.mjs`, `normalize-gemini.mjs`) into a v1 event stream
3. Apply secret redaction to every string payload
4. Derive the preview capped at 280 chars
5. Gzip and `PUT` the artifact through the authenticated proxy (bounded retry: 3 attempts with 1/2/4s exponential backoff)
5b. **Claude only** — when an aggregated `~/.claude/projects/<cwd>/*.jsonl` session exists, deep-redact every JSON value with the same redactor used in Phase 3, gzip, and `PUT /logs/artifact-raw` with the same bounded retry. The native artifact is stored under the parallel `<jobId>.native.jsonl.gz` key. Failure here is logged to the runner but never cascades — the normalized artifact and summary still land
6. `POST` the summary with the same retry strategy — on normalized-upload failure, set `captureStatus = UNAVAILABLE` and omit `artifactKey` / `artifactSize`. When the native capture succeeded, `rawArtifactKey` / `rawArtifactSize` are included in the body
7. Clean up the raw log and aggregated native session file from the runner to avoid leaving secrets on disk

`verify.yml` invokes `run-agent.sh` twice (fix-tests + code-review) but appends to a single raw log, so the capture step runs once after the last agent invocation.

### Native Claude Code session artifact (Claude only)

For jobs whose effective agent is `CLAUDE`, capture also persists the raw, pre-normalization Claude Code session JSONL — uuid/parentUuid threading, sidechain markers, token usage, summary events, and version metadata — alongside the normalized artifact. Both artifacts share the same redaction rules, the same 30-day retention, the same project/ticket/job grouping in Blob, and the same authenticated proxy for reads.

The native artifact is non-blocking: a failure to redact, gzip, or upload it is logged to the runner but never cascades. The job still completes, the normalized artifact is still produced, and the timeline preview is unaffected. Non-Claude jobs (Codex, Mistral, Gemini) skip native capture entirely.

### Log Retention Pruning (scheduled)

A scheduled workflow `.github/workflows/nightly-log-prune.yml` triggers `POST /api/maintenance/prune-logs` once per day at 01:15 UTC. The endpoint:
- Scans `JobLog` rows older than `LOG_RETENTION_DAYS` (default 30) where `captureStatus != 'PRUNED'`
- Deletes every present Blob artifact (normalized and native) first, treating `404` as success; both deletes must succeed before the row is marked `PRUNED` so storage never leaks one half of the pair
- Processes up to 500 rows per iteration and caps the cycle at 50 000 rows
- Returns `{ prunedCount, skippedCount, durationMs }` for GitHub Actions log visibility

Pruning is idempotent — a re-run over the same window finds no matches. Because both the Blob object and the Postgres row are hard-deleted, pruned jobs show the timeline entry (status, telemetry) with a "logs no longer retained" preview but no viewer.
