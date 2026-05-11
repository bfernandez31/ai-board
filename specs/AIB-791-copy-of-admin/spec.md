# Feature Specification: Copy of Admin section with Claude Code Insights report

**Feature Branch**: `AIB-791-copy-of-admin`
**Created**: 2026-05-11
**Status**: Draft
**Input**: Ticket AIB-791 — Copy of Admin section with Claude Code Insights report (re-attempt of AIB-777 feature, learning from prior attempts AIB-777/AIB-786/AIB-787/AIB-790)

> AI-Board has no application-wide vantage point today. Project owners can inspect their own jobs and tickets, but no one can step back and look at the platform as a whole — what AI agents are actually doing across every project, where they get stuck, what wins they produce. Claude Code already ships an `/insights` analyzer that synthesises usage patterns, recurring frictions, big wins, and suggested CLAUDE.md additions from native session JSONL. This feature adds the smallest possible Admin shell at `/admin` and one page inside it (`/admin/insights`) that hosts a manually triggered, archived series of those Insights reports — built strictly on top of the raw native Claude Code session JSONL artifacts captured by the dependency ticket. No automated schedule, no DB-backed admin role system, no other admin pages.
>
> The ticket explicitly references a prior attempt ("ticket 777") that was buggy. Concrete failure modes observed across prior attempts (and to be ruled out by this spec) include: re-implementing `/insights` via a free-text prompt instead of running the genuine analyzer, missing orphan-row reconciliation that leaves RUNNING rows stuck forever, sandboxing the report with `sandbox=""` (blocks all scripts — breaks the analyzer's interactive output), divergence between pre-flight count and analysis-input enumeration, omitting the canonical metadata phrasing, returning JSON error bodies for unauthorized access instead of byte-identical Not Found, and unsafe non-atomic state-machine transitions that let late callbacks flip COMPLETED rows back to RUNNING. Every one of these is closed off below as a binding requirement.

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

*Effective Policy: AUTO → resolved as CONSERVATIVE*
*Provided Policy: AUTO*
*Applied on: 2026-05-11*

**AUTO scoring**: Sensitive/access-control signals (application-wide admin area, allowlist, "no leak of the area's existence", aggregated cross-tenant content) ≈ +3; reliability/integrity signals (read-only artifacts, single-flight job, idempotent pre-flight check, alignment with existing artifact persistence, explicit "lots of bugs in prior attempt" history requiring stricter guarantees) ≈ +2; neutral feature context (new UI shell hosting one read-only page) ≈ +1; no speed/internal-only directives that would push toward PRAGMATIC. Net score ≈ +6 with one dominant bucket → **High confidence (0.9)**. Selected policy: **CONSERVATIVE**.

---

- **Decision**: Where reports are stored — Blob for the HTML body, database row for metadata
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The HTML document produced by `/insights` is persisted as an artifact in the same durable blob storage used for agent log artifacts (gzipped at the storage layer, retention controlled separately from log retention). A small database row holds the report's identity and metadata (generated timestamp, period start/end, sessions count, tickets count, run status, error reason if any, pointer to the blob key). This matches how logs are persisted (key shape analogous to `logs/<projectId>/<ticketId>/<jobId>.jsonl.gz`) and keeps list queries fast.
  2. Storage costs scale with run frequency rather than with job volume; the HTML body can be hundreds of kilobytes and is unsuitable for a row column. Querying past reports stays an indexed database lookup; rendering one report fetches one blob.
- **Reviewer Notes**: Plan must specify the canonical blob key shape, the retention rule (independent from the 30-day log retention — reports are reference material, not transient logs), and ensure the metadata row is created **before** the analysis runs so failures still leave an auditable record.

- **Decision**: Admin allowlist mechanism — environment configuration only, no DB schema
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Admin access is granted by listing user identifiers (email addresses associated with authenticated accounts) in a single configuration value resolved at request time. No new database column, no new role table, no UI to grant/revoke admin status. The list is small (operators only) and changes rarely; deploys carry the source of truth.
  2. Granting/revoking admin access requires a configuration change and a redeploy (or environment variable rotation), not a runtime action. Acceptable for a tiny operator set; unacceptable as a general permission system, which is explicitly out of scope.
- **Reviewer Notes**: The lookup must compare against the **authenticated session's** verified identity, not a header or claim trusted from the client. Session must be present AND identity must appear in the allowlist; either failure produces the same indistinguishable response (see next decision).

- **Decision**: Unauthorized response shape — byte-equivalent Not Found, never a JSON error body, never Forbidden
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Every admin route (page render, API endpoints, asset routes, report-body endpoints, list endpoints, trigger endpoints) returns a Not Found response **byte-equivalent** to a request for a genuinely non-existent path (same status code, same body, same headers including Content-Type) for unauthenticated users and for authenticated users absent from the allowlist. No JSON `{error: "Forbidden"}`, no descriptive message — a probe cannot distinguish "I exist but you can't see me" from "I do not exist". No mention of `/admin` appears in the global navigation for non-allowlisted users. This explicitly closes a defect observed in a prior attempt where unauthorized callers received a JSON error body that revealed the area's existence.
  2. A real navigation typo from a legitimate admin will look identical to an unauthorized access attempt; the legitimate admin must verify they are signed into the right account. Acceptable trade-off given the small operator set and the need to keep the area unadvertised.
- **Reviewer Notes**: Tests MUST assert response parity — status code, body bytes, and headers — between a baseline "no such page" route and every admin route accessed without authorization. Server-side logs MAY differentiate the cases for operator forensics, but the wire response MUST NOT.

- **Decision**: Background job execution model — reuse the existing workflow dispatch + job pipeline
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Triggering "Run new analysis" creates a job record (new command identifier, e.g. `insights-analyze`) and dispatches a workflow that mirrors the existing centralized-execution pattern: clone, set up, download the relevant raw native session artifacts for the period via the existing authenticated read endpoint, run Claude Code's `/insights` analyzer against that corpus, capture the produced HTML, upload it to blob storage via the same authenticated artifact-upload pattern used for logs, and PATCH the job's terminal status. The web app never holds blob credentials.
  2. End-to-end latency is bounded by workflow scheduling and Claude Code execution rather than by an in-process call; acceptable because runs are manual, infrequent, and inherently batch-shaped. Reusing the pattern avoids inventing a new execution surface.
- **Reviewer Notes**: Plan must define the new job command, the workflow file, and the report metadata's lifecycle alongside the job's lifecycle (creation, RUNNING, terminal). Workflow failures MUST produce a FAILED report row with a non-secret error reason, not a silently dropped run.

- **Decision**: Insights execution — run the genuine `claude /insights` analyzer, never a free-text prompt
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The workflow MUST invoke Claude Code's built-in `/insights` slash command with the native session JSONL corpus as input and capture the HTML document it emits, unchanged. It MUST NOT substitute a hand-rolled prompt (e.g., `claude --print "Produce an HTML report …"`), which is a re-implementation, not the analyzer. This explicitly closes a defect observed in a prior attempt that produced a hallucinated, structurally inconsistent report by free-text prompting.
  2. The workflow runtime must have `@anthropic-ai/claude-code` available and authenticated, and `/insights` must accept the input/output flags the workflow uses (or equivalent). Acceptable: the dependency ticket already establishes a path for executing Claude Code in workflows with credentials.
- **Reviewer Notes**: Plan must pin the exact CLI invocation (input directory of JSONL, output HTML path, period bounds), define how authentication is supplied, and add a test that asserts the produced HTML contains structural markers only `/insights` emits (e.g., a "Suggested CLAUDE.md additions" section, a "Big wins" section, a "Horizon" section, friction-category headings, narrative paragraphs, and the report's characteristic structure). A report missing these markers MUST cause the run to FAIL, not COMPLETE.

- **Decision**: Single-flight enforcement — at most one in-flight analysis at any time, with atomic state transitions
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The trigger endpoint is the only place a run can start. Before launching, it checks both the pre-flight ("are there shipped tickets since the last successful run?") and the concurrency guard ("is there already a RUNNING report?"). When a RUNNING report exists, the endpoint refuses with the canonical "Already running since RUN_START_DATE" message and the page reflects "Running…". The button is disabled while RUNNING. Status transitions (RUNNING → COMPLETED, RUNNING → FAILED) MUST be conditional/atomic ("update WHERE id=? AND status='RUNNING'") so that a late workflow callback or a concurrent reconciliation cannot flip a row backwards. This explicitly closes a defect observed in a prior attempt that used a plain unconditional update.
  2. If a workflow becomes orphaned (e.g., dispatched but never reports terminal status), a stuck RUNNING row blocks future triggers until reconciled. The orphan timeout (see next decision) handles this.
- **Reviewer Notes**: Tests must cover: trigger refused while RUNNING, trigger refused without new shipped tickets, trigger accepted when both checks pass, terminal status transitions on success and failure, late callback after auto-FAILED reconciliation MUST be a no-op (not a backwards flip).

- **Decision**: Orphan-row reconciliation — RUNNING rows older than a configured timeout are auto-FAILED on every relevant access
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The system MUST implement a reconciliation routine that transitions any RUNNING report whose creation timestamp is older than a configured `INSIGHTS_RUN_TIMEOUT` (a single value, defaulting to a duration longer than the maximum plausible workflow runtime — e.g., 60 minutes) to FAILED with the reason "Run timed out — workflow did not report terminal status". Reconciliation MUST run lazily at both (a) every call to the list endpoint and (b) every call to the trigger endpoint, so a stuck row never blocks observation or new triggers. This explicitly closes a defect observed in a prior attempt that had no reconciliation at all.
  2. A run that legitimately takes longer than the timeout would be wrongly marked FAILED even if it ultimately succeeded. Acceptable: a conservatively large timeout (e.g., 60 minutes) is far in excess of `/insights` typical runtime on the expected corpus size; operators can raise the value via configuration if needed.
- **Reviewer Notes**: Tests must cover: a manually backdated RUNNING row is FAILED on the next list/trigger access, the late workflow callback for that run is a no-op (atomic update), and the configured timeout is read from configuration rather than hardcoded.

- **Decision**: Pre-flight check definition — "tickets shipped since the previous successful run's analysis-end timestamp"
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. "Shipped" means tickets that have transitioned to the terminal SHIP stage (consistent with the project's stage transitions). The threshold timestamp is the previous successful run's analysis-end timestamp; if no successful run exists, the check passes (first-ever run). The count is computed at trigger time, not cached.
  2. A ticket that ships, gets reverted, and ships again is counted once if its second SHIP transition crosses the threshold. Acceptable: SHIP is the canonical signal of work landing.
- **Reviewer Notes**: The pre-flight query and the workflow's analysis-input enumeration MUST share a single predicate (one function used by both) so they agree by construction. This explicitly closes a defect observed in a prior attempt where pre-flight read `TicketOutcome.shippedAt` while the workflow read jobs by agent — they disagreed in edge cases and the workflow could produce empty reports after a passing pre-flight.

- **Decision**: Period semantics — first run analyzes all available sessions; subsequent runs analyze the half-open window since the previous successful run
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The first-ever successful run has period start = the earliest available Claude Code session timestamp (the timestamp of the oldest Claude job in the system), period end = the trigger timestamp. Each subsequent run has period start = the previous successful run's analysis-end timestamp, period end = the trigger timestamp. This guarantees no overlap between consecutive reports and no gaps. A FAILED run does NOT advance the high-water mark; the next attempt re-covers the same window.
  2. If raw artifacts age out (retention) faster than runs occur, a window may begin with no available data; the report will be honest about it (the metadata header reflects the actual count of sessions found, which may be zero even when the pre-flight passed because pre-flight measures shipped tickets, not surviving artifacts).
- **Reviewer Notes**: Plan must define how the previous-run high-water mark is sourced (latest report row with status COMPLETED) and ensure the workflow reads it under a consistent transaction relative to creating the new RUNNING row.

- **Decision**: Agent scope — only Claude Code sessions are analyzed, with effective-agent fallback to project default
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Sessions from non-Claude agents (Codex, Mistral, Gemini, …) are silently filtered out before the analysis runs. A job's "effective agent" is the ticket-level `agent` if set, otherwise the project-level default agent. The filter MUST treat a job as Claude when either the ticket-level agent is `CLAUDE` OR the ticket-level agent is unset AND the project-level default is `CLAUDE`. This explicitly closes a defect observed in a prior attempt that filtered solely on `ticket.agent='CLAUDE'` and silently dropped legitimate Claude work that inherited its agent from the project default.
  2. Multi-agent friction analysis (e.g., comparing Claude vs Codex behaviour) is not possible from these reports. Acceptable: `/insights` itself only understands native Claude Code session JSONL.
- **Reviewer Notes**: The filtering MUST happen at session-enumeration time, not after attempting to feed non-Claude artifacts into `/insights`. Tests must include a window that contains (a) Claude jobs with ticket-level agent set, (b) Claude jobs inheriting agent from project default, and (c) non-Claude jobs, and assert that (a) and (b) appear in the analysis input while (c) never does.

- **Decision**: Report rendering — sandboxed inline rendering of the genuine HTML via a separate URL, with scripts permitted
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The HTML document produced by `/insights` is rendered inline within `/admin/insights` in a sandboxed iframe whose `src` points to a separate authenticated endpoint (`/api/admin/insights/reports/:id/html`). The iframe MUST be sandboxed with scripts permitted but same-origin disallowed (so the report's scripts and chart libraries function while being isolated from the host application's cookies, storage, and DOM). The serving endpoint MUST send a Content-Security-Policy that forbids embedding by other origins (`frame-ancestors 'none'` or equivalent) and an `X-Frame-Options: DENY` header on top-level navigation paths to prevent click-jacking against the admin shell. This explicitly closes a defect observed in a prior attempt that used `srcDoc` with `sandbox=""`, which disabled scripts and broke the analyzer's interactive output.
  2. The host page cannot directly style or interact with elements inside the report. Acceptable: the report is a self-contained artifact; isolation is the point.
- **Reviewer Notes**: Tests must verify that a deliberately malicious crafted report cannot read host cookies or DOM (same-origin denied), cannot navigate the host, and that the host page itself is not embeddable from another origin. The serving endpoint must enforce admin authorization identically to other admin routes.

- **Decision**: Past-reports listing — chronological, no filters, cap at a sane upper bound (200), no pagination UI
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Past reports are listed in reverse-chronological order by generated timestamp. Each entry shows the date, period covered, sessions/tickets count, and run status (COMPLETED, FAILED, RUNNING). Selecting a COMPLETED entry switches the rendered report; selecting a FAILED entry displays the failure reason in place of an HTML body; selecting the RUNNING entry (if any) displays a "Running…" placeholder. The list endpoint MUST cap returned rows at 200.
  2. No filters, search, custom range selection, or pagination UI is implemented. With manual triggers only, the list grows slowly; if growth becomes a usability problem a follow-up ticket can add pagination.
- **Reviewer Notes**: The cap must be enforced at the database query (not only at the response serialization), so even an unusually large table cannot exhaust memory.

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
4. **Given** a COMPLETED report whose HTML contains the analyzer's interactive content (scripts, charts), **When** rendered inside the sandboxed iframe, **Then** the scripts execute and the charts render (sandbox allows scripts) while the host's cookies/DOM remain unreachable from inside the iframe.

---

### User Story 2 - Block unauthorized access to the admin area (Priority: P1)

A user who is not in the admin allowlist (whether unauthenticated or signed in as a non-admin) attempts to reach `/admin` or `/admin/insights` directly via URL, or to call any admin API endpoint. The system responds with a Not Found result byte-equivalent to a genuinely missing page. No global navigation links to `/admin` for them. No error reveals the area's existence.

**Why this priority**: Access control is non-negotiable for an application-wide vantage point. Aggregated cross-tenant content (every Claude session across every project) must not be reachable, listable, or even discoverable by ordinary users. This story is independent: an admin shell with no Insights content at all still proves the boundary.

**Independent Test**: With the admin shell deployed (even with zero reports), an unauthenticated user and a signed-in non-admin user both attempt to load `/admin`, `/admin/insights`, the trigger endpoint, the list endpoint, and a report-fetch endpoint. Every response is byte-equivalent to a genuine "no such page" baseline.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user, **When** they request `/admin/insights`, **Then** they receive a Not Found response byte-equivalent (status code, body, headers) to requesting a non-existent path; no admin-area-related content appears in the response body.
2. **Given** a signed-in user not present in the admin allowlist, **When** they request `/admin/insights`, the trigger endpoint, the list endpoint, the report-body endpoint, or any admin asset path, **Then** every endpoint returns a Not Found response byte-equivalent to a non-existent path. No JSON error body, no descriptive error message, no Forbidden status.
3. **Given** a signed-in user not present in the admin allowlist viewing the application's global navigation, **When** the page renders, **Then** no link, label, or hint of an admin area is present.
4. **Given** a signed-in user whose identity has just been added to the allowlist, **When** they request `/admin/insights`, **Then** the page renders normally on the next request without requiring application restart, schema migration, or cache flush.
5. **Given** an automated probe comparing responses, **When** it sends the same authenticated-but-not-admin request to `/admin/insights` and to `/this-path-does-not-exist`, **Then** the responses are indistinguishable byte-for-byte.

---

### User Story 3 - Trigger a new Insights analysis (Priority: P1)

An authorized admin clicks "Run new analysis" on the Insights page. If at least one new ticket has shipped since the last successful run, the system creates a RUNNING report record, dispatches the analysis job, and the page reflects "Running…" with the trigger button disabled. When the job finishes, the new report becomes the latest and renders inline. If the analysis fails, the FAILED report row remains visible with its failure reason and the trigger button re-enables.

**Why this priority**: Triggering and persisting new reports is what keeps the feedback loop alive over time. Without it, the page is a museum exhibit. This story can ship after Story 1 (or alongside it on a clean cut) and is independently testable: with a seeded "previous run" and at least one shipped ticket since, a single trigger should produce a new COMPLETED report.

**Independent Test**: With a previous COMPLETED report seeded, at least one ticket transitioned to SHIP after the previous run's period end, and an authenticated allowlisted user, the user clicks "Run new analysis" and the page transitions through RUNNING to displaying the new COMPLETED report on top.

**Acceptance Scenarios**:

1. **Given** at least one ticket has shipped since the last successful run, no run is currently in flight, and the user is allowlisted, **When** they click "Run new analysis", **Then** a RUNNING report record is created **before** the workflow is dispatched, the analysis job is dispatched, the page shows "Running…" with the trigger disabled, and on successful completion the new COMPLETED report appears as the latest with its metadata header populated from the same enumeration the workflow used as input.
2. **Given** no tickets have shipped since the last successful run, **When** the user clicks "Run new analysis", **Then** the system refuses with a friendly message of the form "No new shipped tickets since last run on PREVIOUS_RUN_DATE", no job is dispatched, and no report row is created.
3. **Given** there is already a RUNNING report, **When** the user clicks "Run new analysis", **Then** the system refuses with the canonical message "Already running since RUN_START_DATE", no second job is dispatched, and no second report row is created.
4. **Given** an analysis fails (workflow error, analyzer error, upload error), **When** the workflow reports its terminal status, **Then** the report row transitions to FAILED with a non-secret, operator-actionable error reason, the page surfaces the failure to the user, the trigger re-enables, the previous-run high-water mark is NOT advanced, and the previous COMPLETED report remains the "latest viewable" report.
5. **Given** a workflow becomes orphaned (dispatched but never reports terminal status) and the configured timeout has elapsed, **When** any allowlisted user opens the page or attempts a trigger, **Then** the orphaned RUNNING row is transitioned to FAILED with reason "Run timed out — workflow did not report terminal status", the trigger re-enables, and a subsequent late callback for that run is a no-op (does not flip the row backwards or sideways).

---

### User Story 4 - Browse and view past reports (Priority: P2)

An authorized admin opens the Insights page and uses the past-reports list (sidebar list or dropdown) to pick a previous report. Selecting an entry switches the rendered HTML to that report, with its own metadata header showing the period it covered. The selection is reversible — they can return to the latest report at any time.

**Why this priority**: Once two or more reports exist, comparing across time becomes valuable (recurring frictions, are the suggested CLAUDE.md additions changing, etc.). Until then, this story has no observable effect, so it can ship after Stories 1 and 3.

**Independent Test**: With at least two COMPLETED reports persisted and an authenticated allowlisted user, the user can open the list, select an older entry, see its HTML body and metadata header replace the current view, and then return to the latest entry.

**Acceptance Scenarios**:

1. **Given** at least two COMPLETED reports exist, **When** the user opens the past-reports list, **Then** entries appear in reverse-chronological order with date, period covered, sessions count, tickets count, and run status visible per entry.
2. **Given** the user is viewing the latest report, **When** they select an older COMPLETED entry, **Then** the rendered HTML and metadata header switch to that report; the latest report remains in the list and is reachable by selecting it again.
3. **Given** a FAILED entry exists in the list, **When** the user selects it, **Then** the page displays the failure reason in place of an HTML body, without breaking navigation, and the metadata header for that row is still shown.
4. **Given** the list could grow large, **When** the listing is rendered, **Then** at most 200 entries are returned regardless of the underlying row count.

---

### Edge Cases

- A pre-flight check passes (shipped tickets exist) but the resulting window contains zero Claude sessions because raw artifacts have aged out: the analysis still runs and the produced report's metadata header honestly reports zero sessions. The run is COMPLETED, not FAILED.
- A workflow is dispatched and silently disappears (orphaned RUNNING row): the system auto-FAILs the row after `INSIGHTS_RUN_TIMEOUT` with reason "Run timed out — workflow did not report terminal status". The orphaned workflow's eventual late callback (if any) is rejected as a no-op by the atomic state-transition guard.
- The admin allowlist is rotated while a non-admin holds an open admin tab from a previous session: the next request returns Not Found like any other non-admin; the open tab cannot perform actions.
- An admin clicks "Run new analysis" twice in rapid succession before the page reflects RUNNING: the server-side guard rejects the second click with "Already running since…"; only one job is dispatched.
- A stored report's HTML attempts hostile behaviour (script injecting into the host, navigation away, cookie access): the sandboxed iframe (separate origin, `sandbox="allow-scripts"` without `allow-same-origin`) prevents host access regardless of report content.
- The system has zero successful runs ever: clicking "Run new analysis" with at least one Claude job ever existing in the system is allowed; the resulting analysis-window start is the earliest Claude session timestamp.
- The system has zero Claude jobs ever: the pre-flight refuses with a friendly cold-start message ("No shipped Claude tickets to analyze yet"), no job is dispatched.
- A previous COMPLETED report's blob has been removed (storage incident): selecting that entry shows a stable error placeholder ("Report content is no longer available") rather than a broken render; the metadata header still displays from the database row.
- A user is removed from the allowlist between page load and a button click: the trigger endpoint returns Not Found like any other non-admin; the optimistic UI is harmless because no run was started.
- A Claude job whose ticket has no agent set but whose project default agent is Claude is correctly included in the analysis (effective-agent fallback).
- A non-Claude job (Codex/Mistral/Gemini) is silently excluded from both the pre-flight count and the analysis input by the same shared predicate; the report header's session/ticket counts agree with what was actually fed into the analyzer.
- The `/insights` analyzer produces a structurally invalid output (missing the characteristic sections it always emits): the run is FAILED with a non-secret reason indicating "Insights output validation failed", not COMPLETED with a degraded report.
- A late workflow callback for a run that has already been auto-FAILED by reconciliation arrives: the conditional update finds no RUNNING row with that id and is a no-op. The COMPLETED-or-FAILED row's final status is never disturbed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose an admin area at the path `/admin` whose existence is invisible to non-allowlisted users (no global navigation entry, no link, no probe-detectable difference from a genuinely missing path).
- **FR-002**: System MUST restrict access to every admin route — page, API, asset, report-body — to users whose authenticated identity appears in a configuration-driven allowlist; no database schema for admin roles is introduced in this ticket.
- **FR-003**: System MUST return a Not Found response **byte-equivalent** to a non-existent path (matching status code, response body, and headers) for any admin route requested by an unauthenticated user or by an authenticated user not in the allowlist. No JSON error body, no descriptive error string, no Forbidden status; the response MUST NOT leak the area's existence.
- **FR-004**: System MUST provide an admin layout containing a single navigation entry labelled "Insights" that links to `/admin/insights`; no other admin pages or entries are part of this ticket.
- **FR-005**: System MUST render `/admin/insights` so that, when at least one COMPLETED report exists, the latest COMPLETED report's HTML body appears inline alongside a metadata header showing the report's generated date, the analyzed period's start and end dates, the count of Claude Code sessions analyzed, and the count of tickets in scope.
- **FR-006**: System MUST present a "Run new analysis" action on `/admin/insights` that, when activated, attempts to start a new analysis run subject to the pre-flight and concurrency checks defined below.
- **FR-007**: System MUST refuse any new-analysis trigger when zero tickets have transitioned to the SHIP stage since the previous successful run's analysis-end timestamp, returning the canonical refusal message "No new shipped tickets since last run on PREVIOUS_RUN_DATE"; no job MUST be dispatched and no report row MUST be created in this case.
- **FR-008**: System MUST refuse any new-analysis trigger while a RUNNING report exists, returning the canonical message "Already running since RUN_START_DATE"; the page MUST reflect a "Running…" state and the trigger MUST be disabled while a run is in flight.
- **FR-009**: System MUST, on the first-ever successful run, analyze the period from the earliest available Claude Code session timestamp up to the trigger timestamp; on each subsequent run, the period MUST start at the previous successful run's analysis-end timestamp and end at the current trigger timestamp.
- **FR-010**: System MUST include only sessions from Claude Code agent jobs in the analysis input, using an **effective-agent** rule: a job is treated as Claude when the ticket-level agent is `CLAUDE` OR the ticket-level agent is unset AND the project-level default agent is `CLAUDE`. Sessions from non-Claude agents MUST be silently filtered out before the analysis runs.
- **FR-011**: System MUST, when a run is triggered and accepted, dispatch a background analysis job that fetches the relevant raw native Claude Code session artifacts for the period, executes Claude Code's **built-in `/insights` slash command** over them (not a hand-rolled prompt, not a re-implementation), and captures the genuine HTML output unchanged.
- **FR-012**: System MUST persist the produced HTML report as a durable artifact in blob storage and a metadata row in the database that includes generated timestamp, period start, period end, sessions count, tickets count, run status, error reason if applicable, and a pointer/key resolving to the HTML artifact.
- **FR-013**: System MUST create the metadata row with status RUNNING **before** dispatching the workflow so that orphaned, failed, or successful runs all leave an auditable record.
- **FR-014**: System MUST transition a RUNNING report to COMPLETED upon successful upload of the HTML artifact and reporting of terminal status, or to FAILED with a non-secret, operator-actionable error reason on any workflow, analyzer, upload, or validation failure. All status transitions MUST be atomic/conditional (update WHERE id=? AND status='RUNNING') so a late callback or concurrent reconciliation can never flip a row backwards or sideways.
- **FR-015**: System MUST auto-transition any RUNNING report to FAILED with reason "Run timed out — workflow did not report terminal status" after a configured timeout `INSIGHTS_RUN_TIMEOUT` that exceeds the maximum plausible workflow runtime (default: 60 minutes). The reconciliation MUST run lazily at every list endpoint call and every trigger endpoint call, so a stuck row never permanently blocks future triggers or observation.
- **FR-016**: System MUST list past reports on `/admin/insights` in reverse-chronological order, surfacing per entry the generated date, period covered, sessions count, tickets count, and run status; selecting a COMPLETED entry MUST switch the rendered HTML and metadata header to that entry, selecting a FAILED entry MUST display the failure reason in place of an HTML body while still showing the metadata header, and selecting the RUNNING entry (if any) MUST display the "Running…" placeholder.
- **FR-017**: System MUST cap the past-reports list returned to the page at 200 entries, enforced at the database query level (not only response serialization), to defend against unbounded growth.
- **FR-018**: System MUST render every report's HTML in a sandboxed iframe whose `src` points to an authenticated report-body endpoint (`/api/admin/insights/reports/:id/html`). The iframe MUST be sandboxed with scripts permitted but without `allow-same-origin`, so the report's scripts/charts function while host cookies, storage, and DOM remain unreachable. The report-body endpoint MUST set a Content-Security-Policy preventing same-origin embedding from external origins (`frame-ancestors 'none'` or equivalent) and an `X-Frame-Options: DENY` header on top-level admin paths to prevent click-jacking of the admin shell. **`srcDoc` with `sandbox=""` (which disables scripts and breaks the analyzer's interactive output) is explicitly forbidden.**
- **FR-019**: System MUST present each report's metadata header as the exact phrasing "Analyzed N Claude Code sessions across M tickets shipped between START_DATE and END_DATE" so the scope of the report is unambiguous. N and M MUST be derived from the same enumeration the workflow used as analysis input (no drift between header and content).
- **FR-020**: System MUST treat reports as read-only artifacts; no edit, annotation, rename, or delete capability is exposed to any user, including admins.
- **FR-021**: System MUST NOT trigger any analysis on a schedule (no cron, no nightly, no recurring job); the trigger surface is exclusively the manual action on `/admin/insights`.
- **FR-022**: System MUST NOT send any notification (email, push, in-app, webhook) on run start, run completion, or run failure; observation is exclusively pull-based via the page itself.
- **FR-023**: System MUST allow a graceful empty state when no successful run has ever completed — `/admin/insights` MUST render a clear empty state explaining that no analysis has been run yet and MUST still expose the "Run new analysis" action subject to the same pre-flight check (including a cold-start refusal when no Claude jobs exist at all).
- **FR-024**: System MUST, when the past-reports list contains a COMPLETED entry whose HTML artifact is no longer retrievable (storage incident), surface a stable error placeholder ("Report content is no longer available") rather than crashing the page, and MUST still display the metadata header derived from the database row.
- **FR-025**: System MUST ensure the pre-flight count and the workflow's analysis-input enumeration use a **single shared predicate** for "Claude jobs whose ticket has shipped within the window" so they cannot drift. Implementations MUST NOT reference one entity (e.g., `TicketOutcome.shippedAt`) in pre-flight while the workflow references another (e.g., raw job records); both MUST call the same query function.
- **FR-026**: System MUST validate the `/insights` analyzer's output before marking a run COMPLETED — the produced HTML MUST contain the structural markers `/insights` is known to emit (e.g., a "Suggested CLAUDE.md additions" section, a "Big wins" section, a "Horizon" section, friction-category headings). A run that produces output missing these markers MUST transition to FAILED with reason "Insights output validation failed", not COMPLETED with a degraded report.
- **FR-027**: System MUST source `INSIGHTS_RUN_TIMEOUT` and the admin allowlist from configuration (environment variables or equivalent), not from hardcoded constants, so operators can adjust them without code changes.

### Key Entities *(include if feature involves data)*

- **Insights Report**: One row per analysis attempt. Carries the run's identity, run status (RUNNING, COMPLETED, FAILED), generated timestamp, analyzed period start, analyzed period end, count of Claude Code sessions, count of tickets, error reason (when FAILED), and a pointer to the HTML artifact in blob storage. A COMPLETED row's metadata never changes after creation; a RUNNING row transitions to exactly one of COMPLETED/FAILED. State transitions are atomic/conditional.
- **Insights Report Artifact**: The genuine HTML document produced by Claude Code's `/insights` analyzer for a given run. Stored as a durable artifact addressed by a key derivable from the Insights Report row's identity. Read-only after upload.
- **Admin Allowlist (configuration value, not data)**: The set of authenticated identities permitted to access the admin area. Resolved at request time from configuration; not persisted in the database.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Insights Analysis Process**: An asynchronous, manually triggered process that produces one Insights Report per run.
  - **Input**: The trigger context (allowlisted user identity, current timestamp), the previous successful run's analysis-end timestamp (if any), and read-access to the universe of raw native Claude Code session artifacts captured by the dependency feature.
  - **Phases**:
    1. **Pre-flight gate** — Verify, via the shared predicate, that at least one ticket has transitioned to SHIP since the previous successful run's analysis-end timestamp (treating the previous-run high-water mark as the epoch on first run); refuse otherwise with the canonical refusal message.
    2. **Concurrency gate** — Verify no Insights Report row is currently in RUNNING status (lazy reconciliation runs first, so orphaned rows are cleared); refuse otherwise with the canonical "Already running since…" message.
    3. **Run-record creation** — Create an Insights Report row in RUNNING status with the trigger timestamp and the computed analysis-period bounds (first-run vs incremental semantics).
    4. **Workflow dispatch** — Hand off to the centralized workflow execution surface, passing the analysis-period bounds and the run record's identity.
    5. **Artifact enumeration** — Within the workflow, list all raw native Claude Code session artifacts whose owning job's effective agent (ticket-level agent OR project-default-agent fallback) is Claude and whose timestamp falls within the analysis period; non-Claude jobs are filtered out at this step by the same shared predicate used by pre-flight.
    6. **Insights execution** — Feed the enumerated raw native session JSONL corpus into Claude Code's `/insights` analyzer (via the built-in slash command, not a free-text prompt) and capture the produced HTML document unchanged.
    7. **Output validation** — Verify the produced HTML contains the analyzer's characteristic structural markers; FAIL otherwise.
    8. **Artifact upload** — Stream the HTML through the authenticated artifact-upload pattern (consistent with how log artifacts are uploaded; the workflow never holds blob credentials directly).
    9. **Run-record finalization** — Atomically PATCH the run record with the final session/ticket counts, COMPLETED status, and the artifact pointer (conditional on current status = RUNNING). On any failure in steps 4–8, finalize as FAILED with a non-secret error reason instead.
  - **Output**: One Insights Report row in a terminal status (COMPLETED or FAILED) and, on success, one HTML artifact in durable blob storage. No notifications are emitted.
  - **Error behavior**: Failures of any phase from run-record creation onward leave a FAILED row whose error reason is non-secret and operator-actionable (e.g., "Insights analyzer exited non-zero", "Insights output validation failed", "Artifact upload rejected by storage", "Source raw artifacts unreadable"). Failures DO NOT advance the previous-successful-run high-water mark, so the next attempt re-covers the same window. Orphaned RUNNING rows are reconciled by the timeout policy (FR-015). Non-Claude session content cannot leak into the analysis even if filtering is reordered, because the shared predicate is the single source of truth and `/insights` accepts only native Claude Code session JSONL.

- **Run-Record Reconciliation Process**: A small, lazy safety net that prevents orphaned RUNNING rows from permanently blocking future triggers.
  - **Input**: The set of Insights Report rows currently in RUNNING status and the configured `INSIGHTS_RUN_TIMEOUT`.
  - **Phases**:
    1. Identify any RUNNING row whose creation timestamp is older than `INSIGHTS_RUN_TIMEOUT`.
    2. Atomically transition each such row to FAILED with reason "Run timed out — workflow did not report terminal status" (conditional on status = RUNNING).
  - **Trigger surface**: Runs lazily on every list-endpoint call and every trigger-endpoint call; no separate cron job.
  - **Output**: Auto-FAILED rows. No artifact uploads, no notifications.
  - **Error behavior**: This process is idempotent (running it twice on the same set produces the same result) and is the only place a RUNNING row can transition without the workflow's terminal report. A late workflow callback for a row already auto-FAILED is a no-op because the atomic update no longer finds a RUNNING row with that id.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An allowlisted operator can read the latest Insights report, with its metadata header, within 5 seconds of opening `/admin/insights` on a normally provisioned environment.
- **SC-002**: 100% of admin route requests from non-allowlisted callers (unauthenticated and authenticated alike) return a Not Found response **byte-equivalent** to a genuine non-existent route response across status code, body bytes, and headers.
- **SC-003**: Triggering "Run new analysis" produces exactly one report row in a terminal status (COMPLETED or FAILED) per accepted trigger; no accepted trigger ever ends with the row stuck in RUNNING for longer than `INSIGHTS_RUN_TIMEOUT`.
- **SC-004**: When zero tickets have shipped since the previous successful run, the trigger refusal arrives within 2 seconds and zero workflow dispatches are recorded for that trigger.
- **SC-005**: Every COMPLETED report's metadata header reflects the exact phrasing "Analyzed N Claude Code sessions across M tickets shipped between START_DATE and END_DATE" with N and M derived from the same enumeration the workflow used as analysis input (zero drift between header and content).
- **SC-006**: Zero non-Claude sessions appear in any analysis input, verified by inspecting the workflow's enumeration step against jobs of mixed agents (including jobs whose effective agent is inherited from the project default) in the analysis window.
- **SC-007**: The list of past reports never returns more than 200 entries to a single page render, even with thousands of historical reports.
- **SC-008**: A deliberately hostile crafted report (containing scripts attempting to read host cookies or escape its frame) cannot reach host application state when rendered inside the admin Insights page; the analyzer's legitimate interactive content (scripts, charts) still functions.
- **SC-009**: An operator added to the allowlist sees the admin area on their next page request without requiring application restart, schema migration, or cache flush — only a configuration update is required.
- **SC-010**: Each FAILED report row carries a human-readable, non-secret error reason that allows an operator to reproduce, retry, or escalate without consulting external logs.
- **SC-011**: 100% of produced reports that COMPLETE pass the analyzer-output structural-marker check; any output that would have failed the check causes the run to be marked FAILED instead.
- **SC-012**: A late workflow callback for a run that has been auto-FAILED by the reconciliation process never alters the final terminal status of that row (verified by an integration test that backdates a RUNNING row, triggers reconciliation, then delivers a synthetic late "COMPLETED" callback for the same id).

## Assumptions

- The dependency feature ("Capture native Claude Code session JSONL alongside normalized logs") has shipped before this feature, so the universe of raw native Claude Code session artifacts is populated and retrievable via the established authenticated read pattern.
- The configuration surface used by the admin allowlist (an environment variable or equivalent) is already part of the deployment process; no new secret-management primitive is introduced.
- Claude Code's `/insights` analyzer remains executable in a workflow runtime that has access to native session JSONL input and produces a self-contained HTML document on stdout (or to a known path) without requiring interactive input.
- The existing centralized workflow execution surface, the existing artifact-upload pattern (workflow → web app PUT → blob), and the existing job/status PATCH pattern can host one additional command without architectural change.
- Long-term retention of Insights reports (independent of the 30-day raw-log retention) is acceptable; reports are reference material, not transient telemetry, and operators can prune at the storage layer manually if ever needed.
- The set of admin operators is small (single digits) and changes rarely enough that configuration-based allowlist updates do not impose meaningful overhead.
- A workflow runtime of up to 60 minutes is the upper bound on plausible `/insights` execution for the expected corpus size; `INSIGHTS_RUN_TIMEOUT` defaults to this value and is configuration-tunable.

## Out of Scope

- Any other admin-area pages or features (no global stats dashboard, no evals UI, no user management UI, no project-spanning admin tools beyond the Insights page).
- Any database-backed admin role system, admin permissions hierarchy, or runtime UI to grant/revoke admin status.
- Any automated, scheduled, recurring, or event-driven triggering of Insights analyses; the trigger surface is exclusively the manual button on `/admin/insights`.
- Any analysis of non-Claude agent sessions; multi-agent friction or comparison reports are explicitly excluded.
- Any filters, search, custom date-range selection, or pagination UI on the past-reports list (a sane server-side cap of 200 is provided; pagination UI is a future ticket if needed).
- Any editing, annotating, renaming, or deletion capability for reports; reports are read-only artifacts after creation.
- Any notifications (email, push, in-app, webhook) for run start, completion, or failure.
- Any ticket-level, project-level, or per-user partitioning of reports; this is an application-wide vantage point by design.
- Any tool to migrate, mirror, or back up reports to additional locations; the durable artifact storage is authoritative.
