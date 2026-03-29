# Research: Health Dashboard - Workflow health-scan.yml

**Branch**: `AIB-372-health-dashboard-workflow` | **Date**: 2026-03-29

## Research Task 1: Workflow Authentication for Ticket Creation

### Context
The spec (Decision 2) states the workflow creates tickets by calling `POST /api/projects/:projectId/tickets`. However, the workflow authenticates via `WORKFLOW_API_TOKEN` (Bearer token), not a user session.

### Findings
- The ticket creation endpoint (`app/api/projects/[projectId]/tickets/route.ts`) calls `verifyProjectAccess()` which delegates to `requireAuth(request)` — this requires a **user session**, not a Bearer token.
- The `validateWorkflowAuth()` function exists in `app/lib/workflow-auth.ts` but is NOT used by the ticket creation endpoint.
- The endpoint also checks subscription limits via user session context, which is incompatible with headless workflow calls.

### Decision: Workflow-side ticket creation via API with workflow auth support
- **Chosen approach**: Add workflow token authentication to the ticket creation endpoint as an alternative auth path. When authenticated via workflow token, skip subscription limit checks (workflow-generated tickets are system operations, not user-initiated).
- **Rationale**: This is the simplest approach that follows existing patterns. The scan status PATCH endpoint already uses `validateWorkflowAuth()` successfully. Adding the same pattern to ticket creation is consistent.
- **Alternative considered**: Creating a separate `/api/workflows/tickets` endpoint — rejected because it duplicates ticket creation logic unnecessarily.
- **Alternative considered**: Having the PATCH status endpoint create tickets server-side — rejected because it conflates scan status updates with ticket creation, making the API less composable.

## Research Task 2: Scan Command Mapping & Execution

### Context
The workflow needs to execute health scan commands via `run-agent.sh`. The spec references commands `health-security`, `health-compliance`, `health-tests`, `health-spec-sync`.

### Findings
- **No health scan commands exist yet** in `.claude-plugin/commands/`. The spec explicitly states (Decision 4, Reviewer Notes): "The health scan commands themselves are NOT part of this workflow ticket."
- The `run-agent.sh` script supports the pattern: `run-agent.sh AGENT_TYPE COMMAND ARGS`
- For Claude: invokes `claude --dangerously-skip-permissions "/COMMAND ARGS"`
- Commands are discovered from `.claude/commands/` directory (symlinked from `.claude-plugin/commands/`)

### Decision: Map scan_type to command name with argument passing
- **Chosen approach**: Map `SECURITY` → `health-security`, `COMPLIANCE` → `health-compliance`, etc. Pass `scan_id`, `project_id`, `base_commit`, `head_commit` as arguments to the command.
- **Rationale**: Follows the established pattern from speckit.yml where command names map directly to slash command files.
- **Output contract**: Commands must produce structured JSON to stdout matching the report schemas in `lib/health/report-schemas.ts`. The workflow captures stdout, parses JSON, and sends it via the PATCH status endpoint.

## Research Task 3: Telemetry Capture Pattern

### Context
The workflow must record telemetry (durationMs, tokensUsed, costUsd) on the HealthScan record.

### Findings
- Existing workflows use OTEL environment variables for Claude Code telemetry export
- The `fetch-telemetry.sh` script aggregates telemetry from OTEL endpoint for job comparisons
- However, for health scans, the telemetry needs to be sent directly via the PATCH status endpoint
- Wall-clock duration is straightforward: capture `$SECONDS` before and after command execution
- Token/cost data: Claude Code outputs a summary that can be parsed, or the OTEL endpoint collects it
- The HealthScan model has: `durationMs Int?`, `tokensUsed Int?`, `costUsd Float?`

### Decision: Capture wall-clock duration + parse Claude output for tokens/cost
- **Chosen approach**:
  1. Record `$SECONDS` before command start for wall-clock `durationMs`
  2. Configure OTEL telemetry export (same pattern as speckit.yml) with `scan_id` as resource attribute
  3. Parse Claude Code's output summary for token counts and cost (Claude outputs a JSON summary when `--output-format json` is used)
  4. Fall back to duration-only telemetry if token parsing fails (Codex has different output format)
- **Rationale**: Consistent with existing workflow patterns. Duration is most reliable; token/cost are best-effort.
- **Alternative considered**: Post-processing via `fetch-telemetry.sh` — rejected because health scans don't have a Job record to aggregate against.

## Research Task 4: Repository Cloning Strategy

### Context
The workflow needs to clone the target repository for scanning. Incremental scans need both `base_commit` and `head_commit` to be valid refs.

### Findings
- speckit.yml uses `actions/checkout@v4` with `fetch-depth: 0` (full history) and `token: ${{ secrets.GH_PAT }}`
- For health scans, the workflow clones to `target/` directory and ai-board to `ai-board/` (sparse)
- The `base_commit` may not exist after force-pushes — spec edge case says: fall back to full scan
- The `head_commit` is empty on dispatch; workflow should capture `HEAD` after checkout

### Decision: Full history checkout with HEAD capture
- **Chosen approach**:
  1. Checkout target repo with `fetch-depth: 0` to `target/` (full history for incremental diffs)
  2. Checkout ai-board repo with sparse checkout (`.claude-plugin` + `.github/scripts` only)
  3. After checkout, capture `HEAD` SHA: `head_commit=$(git -C target rev-parse HEAD)`
  4. Validate `base_commit` exists: `git -C target cat-file -t $base_commit 2>/dev/null` — if invalid, treat as empty (full scan)
- **Rationale**: Full history is required for incremental scanning. HEAD capture ensures accurate commit tracking.

## Research Task 5: Error Handling & Partial Failure

### Context
The spec defines error handling for scan failures vs. ticket creation failures.

### Findings
- speckit.yml uses `continue-on-error: false` by default with explicit error handling in bash
- Job status updates use `|| echo "warning"` pattern to prevent workflow failure on non-critical steps
- The PATCH status endpoint accepts `errorMessage` (max 2000 chars) for FAILED transitions

### Decision: Layered error handling with scan-first priority
- **Chosen approach**:
  1. **Scan command failure**: Mark scan FAILED immediately with error message, skip ticket creation
  2. **Report parsing failure**: Mark scan FAILED with "Invalid scan report format" message
  3. **Ticket creation failure**: Log error, continue with remaining tickets, mark scan COMPLETED (scan itself succeeded)
  4. **All API calls**: Use `curl -f` for critical calls (status updates), `|| true` for non-critical (ticket creation)
  5. **Always execute**: Final status update runs regardless of intermediate failures (using bash trap or step conditions)
- **Rationale**: Follows spec Decision 5 — scan data is never lost due to downstream failures.

## Research Task 6: Ticket Grouping Rules

### Context
The spec defines scan-type-specific grouping for ticket creation (FR-009).

### Findings
- Report schemas define the structure that grouping operates on:
  - **SECURITY**: `issues[]` with `severity` field → group by severity (high, medium, low)
  - **COMPLIANCE**: `issues[]` with `category` field → group by category (constitution principle)
  - **TESTS**: `nonFixable[]` (auto-fixed excluded) → one ticket per non-fixable test
  - **SPEC_SYNC**: `specs[]` filtered by `status: 'drifted'` → one ticket per drifted spec
- Tickets created via `POST /api/projects/:projectId/tickets` with `title`, `description` fields

### Decision: Workflow-side grouping in bash with jq
- **Chosen approach**: Parse the JSON report with `jq` in the workflow to extract groups, then iterate and create tickets via curl. Each ticket includes:
  - Title: `"[Health:{scanType}] {group identifier}"` (e.g., `"[Health:Security] High severity issues"`)
  - Description: Formatted markdown listing all issues in the group with file paths and line numbers
  - Reference to originating scan ID in description
- **Rationale**: Keeps grouping logic in the workflow where it can operate on the report data. The API endpoint handles all validation and business rules.
