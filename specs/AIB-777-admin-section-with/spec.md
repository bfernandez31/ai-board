# Feature Specification: Admin section with Claude Code Insights report

**Feature Branch**: `AIB-777-admin-section-with`
**Created**: 2026-05-10
**Status**: Draft
**Input**: Ticket AIB-777 — Admin section with Claude Code Insights report

> AI-Board has no application-wide vantage point today. Project owners can inspect their own jobs and tickets, but no one can step back and look at the platform as a whole — what AI agents are actually doing across every project, where they get stuck, what wins they produce. Claude Code already ships an `/insights` analyzer that synthesises usage patterns, recurring frictions, big wins, and suggested CLAUDE.md additions from native session JSONL. This feature adds the smallest possible Admin shell at `/admin` and one page inside it (`/admin/insights`) that hosts a manually triggered, archived series of those Insights reports — built strictly on top of the raw Claude Code session JSONL artifacts captured by the dependency ticket. No automated schedule, no DB-backed admin role system, no other admin pages.

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

*Effective Policy: AUTO → resolved as CONSERVATIVE*
*Provided Policy: AUTO*
*Applied on: 2026-05-10*

**AUTO scoring**: Sensitive/access-control signals (application-wide admin area, allowlist, "no leak of the area's existence", aggregated cross-tenant content) ≈ +3; reliability/integrity signals (read-only artifacts, single-flight job, idempotent pre-flight check, alignment with existing artifact persistence) ≈ +2; neutral feature context (new UI shell hosting one read-only page) ≈ +1; no speed/internal-only directives that would push toward PRAGMATIC. Net score ≈ +6 with one dominant bucket → **High confidence (0.9)**. Selected policy: **CONSERVATIVE**.

---

- **Decision**: Where reports are stored — Blob for the HTML body, database for metadata
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The HTML document produced by `/insights` is persisted as an artifact in the same durable blob storage as agent log artifacts (gzipped, retention managed by an existing pruning lifecycle). A small database row holds the report's identity and metadata (generated timestamp, period start/end, sessions count, tickets count, run status, error reason if any, pointer to the blob key).
  2. Storage costs scale with run frequency rather than with job volume; the HTML body can be hundreds of kilobytes and is unsuitable for a row column. Querying the list of past reports stays a fast indexed database lookup; rendering a report fetches one blob.
- **Reviewer Notes**: Plan must specify the canonical blob key shape (analogous to `logs/<projectId>/<ticketId>/<jobId>.jsonl.gz`), the retention rule (independent from the 30-day log retention — reports are reference material, not transient logs), and ensure the metadata row is created **before** the analysis run so failures still leave an auditable record.

- **Decision**: Admin allowlist mechanism — environment configuration only, no DB schema
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Admin access is granted by listing user identifiers (email addresses associated with authenticated accounts) in a single configuration value resolved at request time. No new database column, no new role table, no UI to grant/revoke admin status. The list is small (operators only) and changes rarely; deploys carry the source of truth.
  2. Granting/revoking admin access requires a configuration change and a redeploy (or environment variable rotation), not a runtime action. Acceptable for a tiny operator set; unacceptable as a general permission system, which is explicitly out of scope.
- **Reviewer Notes**: The lookup must compare against the **authenticated session's** verified identity, not a header or claim trusted from the client. Session must be present AND identity must appear in the allowlist; either failure produces the same indistinguishable response (see next decision).

- **Decision**: Unauthorized response shape — Not Found, never Forbidden
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Every admin route (page render, API endpoints, asset routes) returns a Not Found response to unauthenticated users and to authenticated users absent from the allowlist. The response is byte-equivalent to a genuine "no such page" so probing cannot distinguish "I exist but you can't see me" from "I do not exist". No mention of `/admin` appears in the global navigation for non-allowlisted users.
  2. A real navigation typo from a legitimate admin will look identical to an unauthorized access attempt; the legitimate admin must verify they are signed into the right account. Acceptable trade-off given the small operator set and the need to keep the area unadvertised.
- **Reviewer Notes**: Tests must assert response parity (status code, body, headers) between the "no such page" baseline and every admin route accessed without authorization. Server logs MAY differentiate the cases for operator forensics, but the wire response MUST NOT.

- **Decision**: Background job execution model — reuse the existing workflow dispatch + job pipeline
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Triggering "Run new analysis" creates a job record (new command identifier, e.g. `insights-analyze`) and dispatches a workflow that mirrors the existing centralized-execution pattern: clone, set up, fetch the relevant raw native session artifacts for the period, run Claude Code's `/insights` against that corpus, capture the produced HTML, upload it to blob storage via the same authenticated artifact-upload pattern used for logs, and PATCH the job's terminal status. The web app never holds blob credentials.
  2. End-to-end latency is bounded by workflow scheduling and Claude Code execution rather than by an in-process call; acceptable because runs are manual, infrequent, and inherently batch-shaped. Reusing the pattern avoids inventing a new execution surface.
- **Reviewer Notes**: Plan must define the new job command, the workflow file, and the report metadata's lifecycle alongside the job's lifecycle (creation, RUNNING, terminal). Failures of the workflow MUST produce a FAILED report row with a non-secret error reason, not a silently dropped run.

- **Decision**: Single-flight enforcement — at most one in-flight analysis at any time
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The trigger endpoint is the only place a run can start. Before launching, it checks both the pre-flight ("are there shipped tickets since the last successful run?") and the concurrency guard ("is there already a RUNNING report?"). When a RUNNING report exists, the endpoint refuses with a clear "Already running since DATE" message and the page reflects "Running...". The button is disabled while RUNNING.
  2. If a workflow becomes orphaned (e.g., dispatched but never reports terminal status), a stuck RUNNING row blocks future triggers until reconciled. A reconciliation policy (timeout after which a RUNNING report is auto-FAILED) is required and lives at the implementation layer.
- **Reviewer Notes**: Plan must specify the orphan timeout (e.g., longer than the maximum plausible workflow runtime). Tests must cover: trigger refused while RUNNING, trigger refused without new shipped tickets, trigger accepted when both checks pass, terminal status transitions on success and failure.

- **Decision**: Pre-flight check definition — "shipped tickets since the previous successful run"
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. "Shipped" means tickets that have transitioned to the terminal SHIP stage (consistent with the project's stage transitions). The threshold timestamp is the previous successful run's analysis-end timestamp; if no successful run exists, the check passes (first-ever run). The count is computed at trigger time, not cached.
  2. A ticket that ships, gets reverted, and ships again would only be counted once toward "new shipped tickets since last run" if the second SHIP transition is what crosses the threshold. Acceptable: SHIP is the canonical signal of work landing.
- **Reviewer Notes**: The pre-flight query MUST be the same query the workflow uses to enumerate sessions to analyze; consistency between "what we counted" and "what we analyzed" is required to avoid the workflow producing an empty report after a passing pre-flight.

- **Decision**: Period semantics — first run analyzes all available sessions; subsequent runs analyze the half-open window since the previous successful run
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The first-ever successful run has period start = the earliest available Claude session timestamp, period end = the trigger timestamp. Each subsequent run has period start = the previous successful run's period end, period end = the trigger timestamp. This guarantees no overlap between consecutive reports and no gaps. A FAILED run does not advance the high-water mark; the next attempt re-covers the same window.
  2. If raw artifacts age out (retention) faster than runs occur, a window may begin with no available data; the report will be honest about it (the metadata header reflects the actual count of sessions found, which may be zero even when the pre-flight passed because pre-flight measures shipped tickets, not surviving artifacts).
- **Reviewer Notes**: Plan must define how the previous-run high-water mark is sourced (latest report row with status COMPLETED) and ensure the workflow reads it under a consistent transaction relative to creating the new RUNNING row.

- **Decision**: Agent scope — only Claude Code sessions are analyzed
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Sessions from non-Claude agents (Codex, Mistral, Gemini, …) are silently filtered out before the analysis runs. The report header explicitly states "N Claude Code sessions across M tickets" so the scope is unambiguous to the reader. The pre-flight count is also restricted to tickets whose ship-stage agent is Claude (or whose work included at least one Claude job in the window) — to avoid passing pre-flight on a window that produces zero analyzable sessions.
  2. Multi-agent friction analysis (e.g., comparing Claude vs Codex behaviour) is not possible from these reports. Acceptable: `/insights` itself only understands native Claude Code session JSONL.
- **Reviewer Notes**: The filtering must happen at session-enumeration time, not after attempting to feed non-Claude artifacts into `/insights`. Tests must include a window that contains both Claude and non-Claude jobs and assert the non-Claude sessions never appear in the analysis input.

- **Decision**: Report rendering — sandboxed inline rendering of the genuine HTML
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The HTML document produced by `/insights` is rendered inline within `/admin/insights` in a sandboxed surface that isolates the report's scripts/styles from the host application. The host page provides only the metadata header, the "Run new analysis" button, and the past-reports list; the report body itself is rendered untouched.
  2. The host page cannot directly style or interact with elements inside the report. Acceptable: the report is a self-contained artifact; isolation is the point.
- **Reviewer Notes**: The sandbox MUST disallow same-origin access and arbitrary script execution against the host. Tests must verify that a deliberately malicious crafted report cannot read host cookies or DOM. The serving endpoint must set headers consistent with isolated rendering (e.g., `Content-Type: text/html; charset=utf-8`, restrictive content security headers).

- **Decision**: Past-reports listing — chronological, no filters, no pagination ceiling in this ticket
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Past reports are listed in reverse-chronological order by generated timestamp. Each entry shows the date, period covered, sessions/tickets count, and run status (COMPLETED, FAILED, RUNNING). Selecting a COMPLETED entry switches the rendered report; FAILED entries display the failure reason instead of an HTML body; the RUNNING entry, if any, displays a "Running..." placeholder.
  2. No filters, search, custom range selection, or pagination is implemented. With manual triggers only, the list grows slowly; if growth becomes a usability problem a follow-up ticket can add pagination.
- **Reviewer Notes**: Even without explicit pagination, the list endpoint MUST cap returned rows at a sane upper bound (e.g., 200) to defend against unexpected growth.

- **Decision**: Read-only artifacts — no editing, annotating, deleting, or notifying
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Reports cannot be edited, annotated, renamed, deleted, or shared via notification. The page exposes view + trigger only. Reports persist indefinitely (subject only to whatever long-term retention the operator sets at the storage layer; the application does not prune them).
  2. An accidentally triggered run cannot be retracted; the FAILED/COMPLETED row will always exist. Acceptable: this is meta-feedback material, not user-facing content; auditability is more valuable than reversibility.
- **Reviewer Notes**: The plan should not introduce delete or edit endpoints "just in case". Future cleanup, if ever needed, is a separate ticket.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View the latest Claude Code Insights report (Priority: P1)

An operator listed in the admin allowlist signs in and navigates to the Admin → Insights page. The page renders the most recent COMPLETED Insights report inline (the genuine HTML produced by Claude Code's `/insights` analyzer), with a metadata header explaining when it was generated, what window it covered, and how many Claude sessions across how many tickets it analyzed. They can read the narratives, friction categories, suggested CLAUDE.md additions, big wins, and horizon section without leaving the page.

**Why this priority**: This is the entire point of the feature. Even with no triggering, no archive, and no admin shell beyond a single page, the ability to surface the latest pre-existing report inline already delivers the meta-feedback loop the ticket is asking for. It is also the smallest demonstrable slice that proves the storage shape, the rendering pipeline, and the access control are correct.

**Independent Test**: With one COMPLETED report seeded in storage and an authenticated allowlisted user, the user navigates to `/admin/insights` and sees the report's HTML body rendered inline with the correct metadata header. No other reports, no triggering, no archive needed.

**Acceptance Scenarios**:

1. **Given** an authenticated user whose identity is in the admin allowlist and exactly one COMPLETED report exists, **When** they open `/admin/insights`, **Then** the page renders the report's HTML body inline along with a header showing the generated date, the analyzed window's start and end dates, the count of Claude Code sessions, and the count of tickets in scope.
2. **Given** an authenticated allowlisted user and no COMPLETED reports yet, **When** they open `/admin/insights`, **Then** the page shows an empty state explaining that no analysis has been run yet and offers the "Run new analysis" action.
3. **Given** the report's metadata header, **When** the user reads the scope line, **Then** the line uses the exact form "Analyzed N Claude Code sessions across M tickets shipped between START_DATE and END_DATE" so the scope of the report is unambiguous.

---

### User Story 2 - Block unauthorized access to the admin area (Priority: P1)

A user who is not in the admin allowlist (whether unauthenticated or signed in as a non-admin) attempts to reach `/admin` or `/admin/insights` directly via URL, or to call any admin API endpoint. The system responds with a Not Found result indistinguishable from a genuinely missing page. No global navigation links to `/admin` for them. No error reveals the area's existence.

**Why this priority**: Access control is non-negotiable for an application-wide vantage point. Aggregated cross-tenant content (every Claude session across every project) must not be reachable, listable, or even discoverable by ordinary users. This story is independent: an admin shell with no Insights content at all still proves the boundary.

**Independent Test**: With the admin shell deployed (even with zero reports), an unauthenticated user and a signed-in non-admin user both attempt to load `/admin`, `/admin/insights`, the trigger endpoint, the list endpoint, and a report-fetch endpoint. Every response is byte-equivalent to a genuine "no such page" baseline.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user, **When** they request `/admin/insights`, **Then** they receive a Not Found response identical to requesting a non-existent page; no admin-area-related content appears in the response body.
2. **Given** a signed-in user not present in the admin allowlist, **When** they request `/admin/insights`, the trigger endpoint, the list endpoint, or a specific report's body endpoint, **Then** every endpoint returns a Not Found response indistinguishable from a non-existent route.
3. **Given** a signed-in user not present in the admin allowlist viewing the application's global navigation, **When** the page renders, **Then** no link, label, or hint of an admin area is present.
4. **Given** a signed-in user whose identity has just been added to the allowlist, **When** they request `/admin/insights`, **Then** the page renders normally without requiring any further administrative action.

---

### User Story 3 - Trigger a new Insights analysis (Priority: P1)

An authorized admin clicks "Run new analysis" on the Insights page. If at least one new ticket has shipped since the last successful run, the system creates a RUNNING report record, dispatches the analysis job, and the page reflects "Running..." with the trigger button disabled. When the job finishes, the new report becomes the latest and renders inline. If the analysis fails, the FAILED report row remains visible with its failure reason and the trigger button re-enables.

**Why this priority**: Triggering and persisting new reports is what keeps the feedback loop alive over time. Without it, the page is a museum exhibit. This story can ship after Story 1 (or alongside it on a clean cut) and is independently testable: with a seeded "previous run" and at least one shipped ticket since, a single trigger should produce a new COMPLETED report.

**Independent Test**: With a previous COMPLETED report seeded, at least one ticket transitioned to SHIP after the previous run's period end, and an authenticated allowlisted user, the user clicks "Run new analysis" and the page transitions through RUNNING to displaying the new COMPLETED report on top.

**Acceptance Scenarios**:

1. **Given** at least one ticket has shipped since the last successful run, no run is currently in flight, and the user is allowlisted, **When** they click "Run new analysis", **Then** a RUNNING report record is created, the analysis job is dispatched, the page shows "Running..." with the trigger disabled, and on successful completion the new COMPLETED report appears as the latest with its metadata header.
2. **Given** no tickets have shipped since the last successful run, **When** the user clicks "Run new analysis", **Then** the system refuses with a friendly message of the form "No new shipped tickets since last run on PREVIOUS_RUN_DATE", no job is dispatched, and no report row is created.
3. **Given** there is already a RUNNING report, **When** the user clicks "Run new analysis", **Then** the system refuses with a clear "Already running since RUN_START_DATE" message, no second job is dispatched, and no second report row is created.
4. **Given** an analysis fails (workflow error, analyzer error, upload error), **When** the workflow reports its terminal status, **Then** the report row transitions to FAILED with a non-secret error reason, the page surfaces the failure to the user, the trigger re-enables, and the previous COMPLETED report remains the "latest viewable" report.

---

### User Story 4 - Browse and view past reports (Priority: P2)

An authorized admin opens the Insights page and uses the past-reports list (sidebar list or dropdown) to pick a previous report. Selecting an entry switches the rendered HTML to that report, with its own metadata header showing the period it covered. The selection is reversible — they can return to the latest report at any time.

**Why this priority**: Once two or more reports exist, comparing across time becomes valuable (recurring frictions, are the suggested CLAUDE.md additions changing, etc.). Until then, this story has no observable effect, so it can ship after Stories 1 and 3.

**Independent Test**: With at least two COMPLETED reports persisted and an authenticated allowlisted user, the user can open the list, select an older entry, see its HTML body and metadata header replace the current view, and then return to the latest entry.

**Acceptance Scenarios**:

1. **Given** at least two COMPLETED reports exist, **When** the user opens the past-reports list, **Then** entries appear in reverse-chronological order with date, period covered, sessions count, tickets count, and run status visible per entry.
2. **Given** the user is viewing the latest report, **When** they select an older COMPLETED entry, **Then** the rendered HTML and metadata header switch to that report; the latest report remains in the list and is reachable by selecting it again.
3. **Given** a FAILED entry exists in the list, **When** the user selects it, **Then** the page displays the failure reason in place of an HTML body, without breaking navigation.
4. **Given** the list grows large, **When** the listing is rendered, **Then** at most a sane upper bound of entries is returned (the rest are accessible by ordering, but pagination UI is not required for this ticket).

---

### Edge Cases

- A pre-flight check passes (shipped tickets exist) but the resulting window contains zero Claude sessions because raw artifacts have aged out: the analysis still runs and the produced report's metadata header honestly reports zero sessions. The run is COMPLETED, not FAILED.
- A workflow is dispatched and silently disappears (orphaned RUNNING row): the system auto-FAILs the row after a configured timeout exceeding the maximum plausible workflow runtime, with reason "Run timed out — workflow did not report terminal status". Future triggers are then unblocked.
- The admin allowlist is rotated while a non-admin holds an open admin tab from a previous session: the next request returns Not Found like any other non-admin; the open tab cannot perform actions.
- An admin clicks "Run new analysis" twice in rapid succession before the page reflects RUNNING: the server-side guard rejects the second click with "Already running since…"; only one job is dispatched.
- A stored report's HTML attempts hostile behaviour (script injecting into the host, navigation away, cookie access): the sandboxed rendering surface prevents host access regardless of report content.
- The system has zero successful runs ever: clicking "Run new analysis" with at least one Claude job ever existing in the system is allowed; the resulting analysis-window start is the earliest Claude session timestamp.
- The system has zero Claude jobs ever: the pre-flight refuses with "No new shipped tickets since last run on …" (or, on a cold system, "No shipped Claude tickets to analyze yet"), no job is dispatched.
- A previous COMPLETED report's blob has been removed (storage incident): selecting that entry shows a stable error message ("Report content is no longer available") rather than a broken render; the metadata header still displays from the database row.
- A user is removed from the allowlist between page load and a button click: the trigger endpoint returns Not Found like any other non-admin; the optimistic UI is harmless because no run was started.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose an admin area at the path `/admin` whose existence is invisible to non-allowlisted users (no global navigation entry, no link, no probe-detectable difference from a genuinely missing path).
- **FR-002**: System MUST restrict access to every admin route — page, API, and asset — to users whose authenticated identity appears in a configuration-driven allowlist; no database schema for admin roles is introduced in this ticket.
- **FR-003**: System MUST return a Not Found response, byte-equivalent to a non-existent page, for any admin route requested by an unauthenticated user or by an authenticated user not in the allowlist; no response leaks the area's existence.
- **FR-004**: System MUST provide an admin layout containing a single navigation entry labelled "Insights" that links to `/admin/insights`; no other admin pages or entries are part of this ticket.
- **FR-005**: System MUST render `/admin/insights` so that, when at least one COMPLETED report exists, the latest COMPLETED report's HTML body appears inline alongside a metadata header showing the report's generated date, the analyzed period's start and end dates, the count of Claude Code sessions analyzed, and the count of tickets in scope.
- **FR-006**: System MUST present a "Run new analysis" action on `/admin/insights` that, when activated, attempts to start a new analysis run subject to the pre-flight and concurrency checks defined below.
- **FR-007**: System MUST refuse any new-analysis trigger when zero tickets have transitioned to the SHIP stage since the previous successful run's analysis-end timestamp, returning a friendly refusal message of the form "No new shipped tickets since last run on PREVIOUS_RUN_DATE"; no job MUST be dispatched and no report row MUST be created in this case.
- **FR-008**: System MUST refuse any new-analysis trigger while a RUNNING report exists, returning a "Already running since RUN_START_DATE" message; the page MUST reflect a "Running..." state and the trigger MUST be disabled while a run is in flight.
- **FR-009**: System MUST, on the first-ever successful run, analyze the period from the earliest available Claude Code session up to the trigger timestamp; on each subsequent run, the period MUST start at the previous successful run's analysis-end timestamp and end at the current trigger timestamp.
- **FR-010**: System MUST include only sessions from Claude Code agent jobs in the analysis input; sessions from non-Claude agents (Codex, Mistral, Gemini, and any future non-Claude agent) MUST be silently filtered out before the analysis runs.
- **FR-011**: System MUST, when a run is triggered and accepted, dispatch a background analysis job that fetches the relevant raw native Claude Code session artifacts for the period, executes Claude Code's `/insights` analyzer over them, and captures the genuine HTML output unchanged (no re-implementation, no transformation that would alter the document's narratives, charts, friction categories, suggested CLAUDE.md lines, big wins, or horizon section).
- **FR-012**: System MUST persist the produced HTML report as a durable artifact in blob storage and a metadata row in the database that includes generated timestamp, period start, period end, sessions count, tickets count, run status, error reason if applicable, and a pointer/key resolving to the HTML artifact.
- **FR-013**: System MUST create the metadata row with status RUNNING **before** dispatching the workflow so that orphaned, failed, or successful runs all leave an auditable record.
- **FR-014**: System MUST transition a RUNNING report to COMPLETED upon successful upload of the HTML artifact and reporting of terminal status, or to FAILED with a non-secret error reason on any workflow, analyzer, or upload failure.
- **FR-015**: System MUST auto-transition any RUNNING report to FAILED with reason "Run timed out — workflow did not report terminal status" after a configured timeout that exceeds the maximum plausible workflow runtime, so a stuck row never permanently blocks future triggers.
- **FR-016**: System MUST list past reports on `/admin/insights` in reverse-chronological order, surfacing per entry the generated date, period covered, sessions count, tickets count, and run status; selecting a COMPLETED entry MUST switch the rendered HTML and metadata header to that entry, selecting a FAILED entry MUST display the failure reason in place of an HTML body, and selecting the RUNNING entry (if any) MUST display the "Running..." placeholder.
- **FR-017**: System MUST cap the past-reports list returned to the page at a sane upper bound to defend against unbounded growth even though manual triggering makes that growth slow.
- **FR-018**: System MUST render every report's HTML in a sandboxed surface that isolates the report's scripts and styles from the host application; the rendering surface MUST disallow same-origin access against the host.
- **FR-019**: System MUST present each report's metadata header as the exact phrasing "Analyzed N Claude Code sessions across M tickets shipped between START_DATE and END_DATE" so the scope of the report is unambiguous.
- **FR-020**: System MUST treat reports as read-only artifacts; no edit, annotation, rename, or delete capability is exposed to any user, including admins.
- **FR-021**: System MUST NOT trigger any analysis on a schedule (no cron, no nightly, no recurring job); the trigger surface is exclusively the manual action on `/admin/insights`.
- **FR-022**: System MUST NOT send any notification (email, push, in-app, webhook) on run start, run completion, or run failure; observation is exclusively pull-based via the page itself.
- **FR-023**: System MUST allow a graceful empty state when no successful run has ever completed — `/admin/insights` MUST render a clear empty state explaining that no analysis has been run yet and MUST still expose the "Run new analysis" action subject to the same pre-flight check.
- **FR-024**: System MUST, when the past-reports list contains a COMPLETED entry whose HTML artifact is no longer retrievable (storage incident), surface a stable error placeholder ("Report content is no longer available") rather than crashing the page, and MUST still display the metadata header derived from the database row.
- **FR-025**: System MUST ensure the pre-flight count and the workflow's analysis-input enumeration use consistent definitions of "shipped tickets" and "Claude session window" so the workflow never produces an empty report after a passing pre-flight (subject to artifact retention edge cases handled by FR-024 and the edge case "raw artifacts aged out").

### Key Entities *(include if feature involves data)*

- **Insights Report**: One row per analysis attempt. Carries the run's identity, run status (RUNNING, COMPLETED, FAILED), generated timestamp, analyzed period start, analyzed period end, count of Claude Code sessions, count of tickets, error reason (when FAILED), and a pointer to the HTML artifact in blob storage. A COMPLETED row's metadata never changes after creation; a RUNNING row transitions to exactly one of COMPLETED/FAILED.
- **Insights Report Artifact**: The genuine HTML document produced by Claude Code's `/insights` analyzer for a given run. Stored as a durable artifact addressed by a key derivable from the Insights Report row's identity. Read-only after upload.
- **Admin Allowlist (configuration value, not data)**: The set of authenticated identities permitted to access the admin area. Resolved at request time from configuration; not persisted in the database.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Insights Analysis Process**: An asynchronous, manually triggered process that produces one Insights Report per run.
  - **Input**: The trigger context (allowlisted user identity, current timestamp), the previous successful run's analysis-end timestamp (if any), and read-access to the universe of Claude Code raw native session artifacts captured by the dependency feature.
  - **Phases**:
    1. **Pre-flight gate** — Verify at least one ticket has transitioned to SHIP since the previous successful run's analysis-end timestamp; refuse otherwise with the canonical refusal message.
    2. **Concurrency gate** — Verify no Insights Report row is currently in RUNNING status; refuse otherwise with the canonical "Already running" message.
    3. **Run-record creation** — Create an Insights Report row in RUNNING status with the trigger timestamp and the computed analysis-period bounds (first-run vs incremental semantics).
    4. **Workflow dispatch** — Hand off to the centralized workflow execution surface, passing the analysis-period bounds and the run record's identity.
    5. **Artifact enumeration** — Within the workflow, list all raw native Claude Code session artifacts whose owning job's agent is Claude and whose timestamp falls within the analysis period; non-Claude jobs are filtered out at this step.
    6. **Insights execution** — Feed the enumerated raw native session JSONL corpus into Claude Code's `/insights` analyzer and capture the produced HTML document unchanged.
    7. **Artifact upload** — Stream the HTML through the authenticated artifact-upload pattern (consistent with how log artifacts are uploaded; the workflow never holds blob credentials directly).
    8. **Run-record finalization** — PATCH the run record with the final session/ticket counts, COMPLETED status, and the artifact pointer. On any failure in steps 4–7, finalize as FAILED with a non-secret error reason instead.
  - **Output**: One Insights Report row in a terminal status (COMPLETED or FAILED) and, on success, one HTML artifact in durable blob storage. No notifications are emitted.
  - **Error behavior**: Failures of any phase from run-record creation onward leave a FAILED row whose error reason is non-secret and operator-actionable (e.g., "Insights analyzer exited non-zero", "Artifact upload rejected by storage", "Source raw artifacts unreadable"). Failures DO NOT advance the previous-successful-run high-water mark, so the next attempt re-covers the same window. Orphaned RUNNING rows are reconciled by the timeout policy (FR-015). Non-Claude session content cannot leak into the analysis even if filtering is reordered, because the analyzer accepts only native Claude Code session JSONL.

- **Run-Record Reconciliation Process**: A small, periodic safety net that prevents orphaned RUNNING rows from permanently blocking future triggers.
  - **Input**: The set of Insights Report rows currently in RUNNING status and the configured orphan timeout.
  - **Phases**:
    1. Identify any RUNNING row whose creation timestamp is older than the configured orphan timeout.
    2. Transition each such row to FAILED with reason "Run timed out — workflow did not report terminal status".
  - **Output**: Auto-FAILED rows. No artifact uploads, no notifications.
  - **Error behavior**: This process is idempotent (running it twice on the same set produces the same result) and is the only place a RUNNING row can transition without the workflow's terminal report.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An allowlisted operator can read the latest Insights report, with its metadata header, within 5 seconds of opening `/admin/insights` on a normally provisioned environment.
- **SC-002**: 100% of admin route requests from non-allowlisted callers (unauthenticated and authenticated alike) return a Not Found response that is byte-equivalent to a genuine non-existent route response across status code, body, and headers.
- **SC-003**: Triggering "Run new analysis" produces exactly one report row in a terminal status (COMPLETED or FAILED) per accepted trigger; no accepted trigger ever ends with the row stuck in RUNNING for longer than the configured orphan timeout.
- **SC-004**: When zero tickets have shipped since the previous successful run, the trigger refusal arrives within 2 seconds and zero workflow dispatches are recorded for that trigger.
- **SC-005**: Every COMPLETED report's metadata header reflects the exact phrasing "Analyzed N Claude Code sessions across M tickets shipped between START_DATE and END_DATE" with N and M derived from the same enumeration the workflow used as analysis input (no drift between header and content).
- **SC-006**: Zero non-Claude sessions appear in any analysis input, verified by inspecting the workflow's enumeration step against jobs of mixed agents in the analysis window.
- **SC-007**: The list of past reports never returns more than the configured upper bound of entries to a single page render, even with thousands of historical reports.
- **SC-008**: A deliberately hostile crafted report (containing scripts attempting to read host cookies or escape its frame) cannot reach host application state when rendered inside the admin Insights page.
- **SC-009**: An operator added to the allowlist sees the admin area on their next page request without requiring application restart, schema migration, or cache flush — only a configuration update is required.
- **SC-010**: Each FAILED report row carries a human-readable, non-secret error reason that allows an operator to reproduce, retry, or escalate without consulting external logs.

## Assumptions

- The dependency feature ("Capture native Claude Code session JSONL alongside normalized logs") has shipped before this feature, so the universe of raw native Claude Code session artifacts is populated and retrievable via the established authenticated read pattern.
- The configuration surface used by the admin allowlist (an environment variable or equivalent) is already part of the deployment process; no new secret-management primitive is introduced.
- Claude Code's `/insights` analyzer remains executable in a workflow runtime that has access to native session JSONL input and produces a self-contained HTML document on stdout (or to a known path) without requiring interactive input.
- The existing centralized workflow execution surface, the existing artifact-upload pattern (workflow → web app PUT → blob), and the existing job/status PATCH pattern can host one additional command without architectural change.
- Long-term retention of Insights reports (independent of the 30-day raw-log retention) is acceptable; reports are reference material, not transient telemetry, and operators can prune at the storage layer manually if ever needed.
- The set of admin operators is small (single digits) and changes rarely enough that configuration-based allowlist updates do not impose meaningful overhead.

## Out of Scope

- Any other admin-area pages or features (no global stats dashboard, no evals UI, no user management UI, no project-spanning admin tools beyond the Insights page).
- Any database-backed admin role system, admin permissions hierarchy, or runtime UI to grant/revoke admin status.
- Any automated, scheduled, recurring, or event-driven triggering of Insights analyses; the trigger surface is exclusively the manual button on `/admin/insights`.
- Any analysis of non-Claude agent sessions; multi-agent friction or comparison reports are explicitly excluded.
- Any filters, search, custom date-range selection, or pagination UI on the past-reports list (a sane server-side cap is provided; pagination UI is a future ticket if needed).
- Any editing, annotating, renaming, or deletion capability for reports; reports are read-only artifacts after creation.
- Any notifications (email, push, in-app, webhook) for run start, completion, or failure.
- Any ticket-level, project-level, or per-user partitioning of reports; this is an application-wide vantage point by design.
- Any tool to migrate, mirror, or back up reports to additional locations; the durable artifact storage is authoritative.
