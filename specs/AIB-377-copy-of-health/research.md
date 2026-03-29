# Research: Health Dashboard - Workflow health-scan.yml

**Feature**: AIB-377 | **Date**: 2026-03-29

## Research Tasks & Findings

### 1. GitHub Actions Workflow Pattern for Health Scans

**Context**: The health-scan.yml workflow must follow the established speckit.yml pattern for dispatch, authentication, and status reporting.

**Decision**: Mirror speckit.yml structure — workflow_dispatch trigger, WORKFLOW_API_TOKEN Bearer auth for callbacks, actions/checkout with fetch-depth: 0, curl-based status updates.

**Rationale**: The speckit.yml pattern is proven and well-established. Reusing the same auth mechanism (WORKFLOW_API_TOKEN) avoids introducing new attack surface. The dispatch function in `lib/health/scan-dispatch.ts` already sends inputs matching this pattern.

**Alternatives Considered**:
- Custom webhook-based triggers: Rejected — adds complexity without benefit; workflow_dispatch is the standard pattern
- GitHub App authentication: Rejected — WORKFLOW_API_TOKEN is simpler and already available in all workflow contexts

### 2. Scan Command Execution via Claude Code CLI

**Context**: Each scan type maps to a specific Claude Code command. The workflow must execute these commands safely without dynamic construction.

**Decision**: Use a static bash `case` statement mapping scanType to command names. Commands are executed via `claude --command "/ai-board.{command}" --json` pattern.

**Rationale**: Static mapping prevents command injection (FR-013, security auto-resolved decision). The Claude Code CLI `--command` flag provides structured output. Adding new scan types requires a workflow update, which is an acceptable trade-off for security.

**Alternatives Considered**:
- Dynamic command string interpolation: Rejected — security risk from input injection
- Separate workflow per scan type: Rejected — 4x maintenance overhead with no security benefit; static mapping in one workflow achieves the same isolation

### 3. Remediation Ticket Grouping Strategy

**Context**: Scan results must be grouped into remediation tickets following scan-type-specific rules (FR-007).

**Decision**: Implement grouping as a pure TypeScript utility (`lib/health/ticket-creation.ts`) that accepts a typed `ScanReport` (discriminated union) and returns an array of ticket descriptors. Grouping logic:
- SECURITY: `Map<severity, issues[]>` → one ticket per severity level
- COMPLIANCE: `Map<principle, violations[]>` → one ticket per principle
- TESTS: One ticket per unfixable test failure
- SPEC_SYNC: One ticket per desynchronized spec file

**Rationale**: Pure function is easy to unit test. Discriminated union ensures exhaustive handling. Grouping in the utility (not the workflow) means the same logic can be reused if scan results are ever processed outside the workflow.

**Alternatives Considered**:
- Grouping in the workflow bash script: Rejected — harder to test, less type safety
- Single ticket per scan with all issues: Rejected — spec requires granular grouping for actionable remediation

### 4. Ticket Creation API Integration

**Context**: The workflow needs to create tickets in ai-board after scan completion.

**Decision**: Use the existing `POST /api/projects/{projectId}/tickets` endpoint. The workflow calls it via curl with WORKFLOW_API_TOKEN auth for each grouped ticket. Tickets are created with `stage: INBOX` and `workflowType: QUICK`.

**Rationale**: Reuses existing ticket creation infrastructure. QUICK workflow type means tickets go directly to BUILD when moved, matching the auto-resolved decision that remediation tickets are well-scoped by scan reports.

**Alternatives Considered**:
- Batch ticket creation endpoint: Rejected — doesn't exist; creating one adds scope; sequential creation is acceptable for typical 1-5 tickets per scan
- Creating tickets in the status callback API: Rejected — violates single responsibility; status endpoint should only update scan state

### 5. Incremental Scanning Implementation

**Context**: Subsequent scans should only analyze changes between the previous scan's headCommit and current HEAD (US-3).

**Decision**: The API (`POST /api/projects/{projectId}/health/scans`) already fetches the latest COMPLETED scan's headCommit as baseCommit. The workflow receives both baseCommit and headCommit as inputs and passes them to the scan command. When baseCommit is empty, the scan command performs a full scan.

**Rationale**: The incremental logic is already implemented in the trigger API. The workflow simply forwards the commit range to the scan command. This keeps the workflow stateless — it doesn't need to query past scans.

**Alternatives Considered**:
- Workflow queries API for previous scan: Rejected — trigger API already resolves this; duplicating the logic adds complexity and race conditions

### 6. Health Score Recalculation

**Context**: After each successful scan, the project's global health score must be recalculated (FR-009).

**Decision**: Score recalculation is already implemented in the existing PATCH status endpoint (`app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`). When status transitions to COMPLETED with a score, the endpoint upserts the HealthScore record and recalculates globalScore via `calculateGlobalScore()`.

**Rationale**: No new code needed. The existing endpoint handles the full lifecycle. The workflow only needs to send the correct COMPLETED payload.

**Alternatives Considered**:
- Separate score recalculation endpoint: Rejected — already built into status update; adding a separate endpoint would require the workflow to make an extra call

### 7. Error Handling & Telemetry

**Context**: Failed scans must report descriptive errors (FR-010); all scans must record telemetry (FR-011).

**Decision**: The workflow captures wall clock duration via bash `$SECONDS`. Token usage and cost are extracted from Claude Code CLI JSON output. On failure, stderr is captured and truncated to 2000 chars. Both success and failure paths call the PATCH status endpoint with telemetry fields.

**Rationale**: `$SECONDS` is a reliable bash builtin for duration tracking. Claude Code CLI `--json` output includes token/cost metadata. Truncation to 2000 chars matches the `errorMessage` DB field limit (`@db.VarChar(2000)`).

**Alternatives Considered**:
- External telemetry service: Rejected — over-engineered for scan-level tracking; DB fields are sufficient
- Duration from API timestamps only: Rejected — workflow-measured duration is more accurate (includes clone and setup time)
