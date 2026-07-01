# Agent Selection


### Per-Stage Model Selection

For workflows dispatched to the Claude or Codex agent, the system resolves a specific model ID per stage using a priority chain. Claude and Codex configurations are stored independently so neither set is overwritten when the project owner toggles `defaultAgent`.

**Model Resolution** (per agent):
1. **Ticket override** — `ticket.{stageModel}` for Claude, `ticket.codex{StageModel}` for Codex (set individually per stage in the override dialog)
2. **Project default** — `project.{stageModel}` / `project.codex{StageModel}` (configured in the AI Models card in project settings)
3. **Global fallback** — `claude-opus-4-8` for Claude, `gpt-5.5` for Codex (hard-coded)

A stored value that is no longer in the active agent's whitelist (e.g., deprecated by the provider) is treated as "not set" and falls through to the next layer.

**Configurable stages**: SPECIFY, PLAN, IMPLEMENT, QUICK-IMPL, VERIFY.

**Non-configurable stages** (`iterate`, `comment-*`, `health-scan`, `retro-spec`, `onboard`): no `model` input is emitted; the agent's CLI uses its own default.

**Mistral / Gemini**: per-stage model configuration is not exposed; the CLI uses its own current default.

The resolved model ID is:
- Passed to the workflow as the `model` dispatch input
- Written to `Job.model` at job creation for per-stage cost analytics

**Claude model whitelist** (closed set; unknown values fall through to the next resolution layer):
- `claude-opus-4-8` — Claude Opus 4.8 (global fallback)
- `claude-opus-4-7` — Claude Opus 4.7
- `claude-opus-4-6` — Claude Opus 4.6
- `claude-sonnet-5` — Claude Sonnet 5
- `claude-sonnet-4-6` — Claude Sonnet 4.6
- `claude-haiku-4-5-20251001` — Claude Haiku 4.5

**Codex model whitelist** (closed set; unknown values fall through to the next resolution layer):
- `gpt-5.5` — GPT-5.5 (global fallback)
- `gpt-5.4` — GPT-5.4
- `gpt-5.4-mini` — GPT-5.4 mini
- `gpt-5.3-codex` — GPT-5.3 Codex
- `gpt-5.2` — GPT-5.2

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

## Token Saving (RTK output compression)

When a ticket's effective token-saving value is ON and the resolved agent is Claude, the runner activates output compression before invoking the agent so large command outputs are compressed before they enter Claude's context. This reduces token consumption on command-heavy stages without any new token-estimation machinery — savings are read from the existing per-job token telemetry (input, cache, peak context, average context).

**Effective value**:
- Resolved at workflow dispatch time as the ticket's token-saving override when set, otherwise the project's Token Saving default (Force OFF on the ticket wins over a project default of ON)
- Threaded into the Claude dispatch inputs for the standard workflow stages (specify, plan, build, verify, ship) and quick-impl

**Scope**:
- Limited to the Claude agent. Codex, Mistral, and Gemini runs ignore the setting entirely and behave unchanged regardless of the effective value
- When the effective value is OFF, the run behaves identically to before the feature existed — no install, no hook, no measurable overhead

**Activation (Claude, effective ON)**:
1. The runner installs the compression tool (RTK, "Rust Token Killer"), pinned to a known-good release rather than tracking "latest" so run behavior is reproducible
2. It registers the tool as a Claude Code PreToolUse hook so qualifying command outputs are compressed before reaching the agent
3. The agent runs as usual; when the tool cannot parse a command's output it passes the full output through unchanged, so the agent never loses information

**Graceful fallback (never fails a run)**:
- Token-saving activation is non-blocking: any network, install, or hook-activation failure is swallowed and the run continues without compression
- A token-saving failure can NEVER cause a run to fail or degrade, and is not retried within the run

**Per-job outcome**:
- Each job records a token-saving outcome surfaced in job details and used to interpret token telemetry:
  - **Active** — effective value ON for a Claude run and the tool installed + the hook activated successfully
  - **Inactive** — effective value OFF, or the agent was non-Claude (no install attempted)
  - **Fell back** — effective value ON but install/activation failed; the run continued without compression
- The outcome is reported on the RUNNING status PATCH alongside the runtime-version capture and is first-write-wins; once set it never changes for that run

## Runtime Version Capture

For every job that invokes an AI agent (Claude, Codex, Mistral, Gemini), the runner records two pieces of execution metadata so a job's behavior can be traced back to the exact toolchain that produced it:

- **Plugin version** — the version field from the active `.claude-plugin/plugin.json` (the AI-Board plugin package: commands, skills, prompts)
- **Agent CLI version** — the version reported by the underlying CLI (`claude`, `codex`, `vibe`, `gemini`)

**Capture timing**: Both values are resolved after the CLI is installed and reported once via the job-status PATCH endpoint. The values are written first-write-wins on the first RUNNING-status PATCH that carries them; later PATCH calls never overwrite an already-populated value.

**Best-effort behavior**: Capture never blocks or fails the job. If either value cannot be resolved (missing plugin manifest, CLI not on PATH, `--version` returns nothing), the field stays `null` and the job continues normally.

**Coverage**:
- Jobs run before this feature shipped remain unannotated — there is no backfill
- All four supported agents (Claude, Codex, Mistral, Gemini) are covered
- The values are surfaced in the ticket detail Stats tab alongside the other per-job execution metrics; absent values render as a discreet placeholder (`—`) rather than an empty field

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

### Raw native session capture (Claude only)

Claude jobs additionally persist a second artifact: the aggregated native Claude Code session JSONL — the same redaction pipeline applied to the normalized stream is run over every nested string field, then the result is gzipped and uploaded under a sibling Blob key. This preserves the fields the normalized format drops (`uuid`, `parentUuid`, `sessionId`, `isSidechain`, `usage`, `cwd`, `gitBranch`, `version`, summary events) so downstream tooling — notably an Admin Insights view — can replay a Claude run with full fidelity.

Behavior:
- Gated on `agent === CLAUDE` and `captureStatus === CAPTURED`; non-Claude jobs and Claude jobs whose normalized capture failed never produce a raw artifact and never log a raw-capture line
- A Claude job that produced no session data emits an informational log distinguishing this from an upload failure; no raw artifact is uploaded
- Raw-capture failures (read, redact, gzip, upload) are non-blocking — the job's terminal status and normalized artifact are unaffected; a structured runner log entry records the failure stage so operators can grep for regressions
- Available through `GET /api/projects/:projectId/tickets/:ticketId/jobs/:jobId/logs/raw-native` with the same access-control rules as the normalized raw endpoint; non-Claude jobs and Claude jobs without a raw artifact return 404 with no leakage about the artifact's existence

### Agent Log Capture (per workflow run)

Every agent-invoking workflow — `speckit.yml`, `quick-impl.yml`, `verify.yml`, `ai-board-assist.yml`, `iterate.yml` — includes a capture step (`if: always()`) after the agent invocation and before the terminal status PATCH.

**Input**: tee'd raw agent stdout at `$RUNNER_TEMP/agent-raw-<jobId>.log`, plus agent-specific session dirs (`~/.claude/projects/...`, `~/.codex/sessions/*`, `~/.vibe/sessions/*`).

**Phases**:
1. Collect the tee'd raw log; synthesize a two-event `lifecycle:started` + `lifecycle:cancelled` pair when the log is empty (covers the cancelled-before-any-output edge case)
2. Normalize via the agent-specific script (`normalize-claude.mjs`, `normalize-codex.mjs`, `normalize-mistral.mjs`, `normalize-gemini.mjs`) into a v1 event stream
3. Apply secret redaction to every string payload
4. Derive the preview capped at 280 chars
5. Gzip and `PUT` the normalized artifact through the authenticated proxy (bounded retry: 3 attempts with 1/2/4s exponential backoff)
5b. **Claude only** — when normalized capture succeeded and aggregated native session files are present: redact the native JSONL line-by-line via the same redactor, gzip it, and `PUT /api/jobs/:id/logs/raw-artifact` with the same retry strategy. Failures here are non-blocking and never alter the normalized artifact or the job's terminal status.
6. `POST` the summary with the same retry strategy — on normalized-upload failure, set `captureStatus = UNAVAILABLE` and omit `artifactKey` / `artifactSize`; include `rawArtifactKey` / `rawArtifactSize` only when Phase 5b succeeded
7. Clean up the raw log from the runner to avoid leaving secrets on disk; if the summary `POST` fails permanently, both the normalized and raw Blob objects are explicitly deleted to prevent orphans

`verify.yml` invokes `run-agent.sh` twice (fix-tests + code-review) but appends to a single raw log, so the capture step runs once after the last agent invocation.

### Log Retention Pruning (scheduled)

A scheduled workflow `.github/workflows/nightly-log-prune.yml` triggers `POST /api/maintenance/prune-logs` once per day at 01:15 UTC. The endpoint:
- Scans `JobLog` rows older than `LOG_RETENTION_DAYS` (default 30) where `captureStatus != 'PRUNED'`
- Deletes the normalized Blob artifact first, then the raw Blob artifact when present (each `404` treated as success), then marks the row `PRUNED` and clears all four artifact columns
- Processes up to 500 rows per iteration and caps the cycle at 50 000 rows
- Returns `{ prunedCount, skippedCount, durationMs }` for GitHub Actions log visibility

Pruning is idempotent — a re-run over the same window finds no matches. Pruned jobs show the timeline entry (status, telemetry) with a "logs no longer retained" preview but no viewer. The normalized and raw artifacts age out together so the system never retains a raw artifact pointing at a job whose normalized record is already gone.
