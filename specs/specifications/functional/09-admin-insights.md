# Admin Insights - Functional Specification

## Purpose

The Admin Insights page provides platform operators with an application-wide vantage point on what AI agents are actually doing across every project. It surfaces the genuine HTML reports produced by Claude Code's `/insights` analyzer — usage patterns, recurring frictions, big wins, and suggested CLAUDE.md additions — built from the redacted native Claude Code session JSONL captured for every Claude job.

This is the only page in the admin area. There is no global stats dashboard, no user management UI, and no other admin tooling.

## Accessing the Admin Area

The admin area lives at `/admin`, with a single page at `/admin/insights`. Visiting `/admin` redirects to `/admin/insights`.

Access is restricted to operator identities listed in a configuration-driven allowlist (the `ADMIN_ALLOWLIST_EMAILS` environment variable). The list is small (single-digit operators), changes rarely, and is the only source of truth — there is no database role, no UI to grant or revoke admin status, and no role hierarchy. Adding or removing an operator requires a configuration update; the change takes effect on the next request, with no restart, migration, or cache flush.

**Discoverability**: The admin area is invisible to every non-allowlisted user. No global navigation entry, label, or hint mentions it. Probing `/admin` or any admin route as a non-allowlisted user (whether unauthenticated or signed in as a non-admin) returns a Not Found response byte-equivalent to a genuinely missing path — across status code, body, and headers. The response cannot distinguish "I exist but you can't see me" from "I do not exist".

A user removed from the allowlist between page load and a button click cannot perform any action; the trigger endpoint returns the same Not Found response as any other non-admin request.

## The Insights Page

When an allowlisted operator opens `/admin/insights`, the page renders three regions:

1. **Metadata header**: A single line describing the currently selected report's scope, in the canonical phrasing:
   > "Analyzed *N* Claude Code sessions across *M* tickets shipped between *START_DATE* and *END_DATE*"
   The counts and date range come from the workflow's actual enumeration of analyzed sessions — never from the pre-flight estimate.
2. **Report viewer**: A sandboxed inline rendering of the genuine HTML document produced by `/insights` for the currently selected report. The host page provides no styling or scripting on the report body; the report renders untouched.
3. **Past reports list**: A reverse-chronological list of prior reports, each row showing date, period covered, sessions count, tickets count, and run status. Selecting an entry switches the metadata header and viewer to that report.

The "Run new analysis" button sits in the page header. When a run is in flight, it is disabled.

### Empty State

When no analysis has ever completed, the page renders an empty state explaining that no analysis has been run yet and exposes the "Run new analysis" action (subject to the same pre-flight check as every trigger). The empty state is the natural starting point on a freshly deployed system.

## Running a New Analysis

Clicking "Run new analysis" attempts to start a new analysis run. The system enforces two gates before dispatching the analysis job:

### Pre-flight Check: Shipped Tickets Since Last Run

The system counts tickets that transitioned to the SHIP stage **since the previous successful run's analysis-end timestamp**. If the count is zero, the system refuses with a friendly message:

- When a previous successful run exists: "No new shipped tickets since last run on *PREVIOUS_RUN_DATE*"
- On a cold system with zero Claude jobs ever: "No shipped Claude tickets to analyze yet"

No job is dispatched, no report row is created, and the trigger button remains enabled.

The count includes only tickets whose work involved Claude jobs in the window — non-Claude tickets (Codex, Mistral, Gemini, and any future agent) are filtered out. This keeps the pre-flight count and the workflow's analysis input in lockstep: if pre-flight passes, the workflow has work to analyze.

### Concurrency Check: Single In-Flight Run

Only one analysis can run at a time. When a previous trigger is still in progress (its report row is still in RUNNING state), a fresh trigger is refused with:

> "Already running since *RUN_START_DATE*"

The trigger button is disabled while the page reflects a RUNNING report; the page polls every 2 seconds while a run is in flight so the state surfaces promptly.

If a workflow becomes orphaned (dispatched but never reports terminal status), the stuck RUNNING row is auto-transitioned to FAILED after a configurable timeout (default 60 minutes — long enough to exceed any plausible workflow runtime), with the error reason:

> "Run timed out — workflow did not report terminal status"

This reconciliation runs lazily on every admin page load and every trigger attempt, so future triggers are unblocked the next time the operator visits the page.

### Accepted Trigger

When both gates pass, the system:
1. Creates a report record in RUNNING state with the computed analysis period, the trigger timestamp, and the operator's identity (so future audits can attribute the run).
2. Dispatches the analysis workflow with the period bounds and the report id.
3. Returns the new report to the page; the button transitions to disabled and the page reflects "Running...".

If the workflow dispatch itself fails (transient GitHub outage, expired token), the system rolls back the just-created report row so no stuck record blocks future triggers, and surfaces a clear failure to the operator.

## Analysis Period Semantics

Each report covers a half-open time window `[periodStart, periodEnd)`:

- **First-ever successful run**: `periodStart` is the earliest available Claude Code session timestamp in the system. `periodEnd` is the trigger timestamp.
- **Each subsequent run**: `periodStart` is the previous successful run's `periodEnd`. `periodEnd` is the current trigger timestamp.

Consecutive reports never overlap and never leave gaps. A FAILED run does *not* advance the high-water mark; the next attempt re-covers the same window. A ticket that ships, gets reverted, and ships again is counted once toward "new shipped tickets" only when the second SHIP transition crosses the threshold.

## Analysis Scope: Claude Code Only

Reports analyze sessions exclusively from Claude Code agent jobs. Sessions from non-Claude agents (Codex, Mistral, Gemini, and any future non-Claude agent) are silently filtered out at the workflow's enumeration step — before any analyzer input is constructed. The metadata header explicitly states "*N* Claude Code sessions across *M* tickets" so the scope is unambiguous to the reader.

Multi-agent friction analysis or cross-agent comparison reports are not produced by this feature.

## Report Lifecycle and States

Each analysis attempt produces exactly one report record. A report carries:

- A unique identity (the row id)
- A status: `RUNNING`, `COMPLETED`, or `FAILED`
- The analysis period start and end
- The count of Claude Code sessions analyzed (on COMPLETED)
- The count of tickets in scope (on COMPLETED)
- A human-readable, non-secret error reason (on FAILED)
- The identity of the operator who triggered the run
- Timestamps for when the run started and when it finalized

A RUNNING row transitions to exactly one of COMPLETED or FAILED. A COMPLETED row's metadata never changes after creation. Reports are read-only artifacts: there is no edit, annotation, rename, or delete capability exposed to any user — including admins. Accidentally triggered runs cannot be retracted; the resulting row persists.

### Failure Reasons

When a run fails, the report row carries a human-readable, operator-actionable error reason such as:
- "Insights analyzer exited non-zero"
- "Artifact upload rejected by storage"
- "Source raw artifacts unreadable"
- "Run timed out — workflow did not report terminal status"

The reason is never a stack trace or a string containing secrets; an operator can use it to reproduce, retry, or escalate without consulting external logs. The previously COMPLETED report (if any) remains the "latest viewable" report after a failure, so the page does not become a wall of red on a single broken run.

## Browsing Past Reports

The past-reports list shows every past report in reverse-chronological order by generated timestamp:

- Selecting a **COMPLETED** entry switches the metadata header and the rendered HTML body to that report. The latest report remains in the list and is reachable by selecting it again.
- Selecting a **FAILED** entry replaces the HTML viewer with the failure reason inline; navigation does not break.
- The **RUNNING** entry (if any) renders a "Running..." placeholder until terminal status is reported.

The list grows slowly (manual triggers only), but the server caps the returned set at 200 entries to defend against unexpected growth. There is no filter, search, custom date-range selection, or pagination UI in this iteration.

### Storage Incident Edge Case

If a previously COMPLETED report's HTML artifact has been removed from storage (operator pruning, storage incident), selecting that entry shows a stable placeholder:

> "Report content is no longer available"

The metadata header still displays correctly from the database row; only the body is missing. The page does not crash.

## Report Rendering and Isolation

Each report's HTML document is rendered inline in a sandboxed surface that isolates the report's scripts and styles from the host application. The sandbox disallows same-origin access against the host, so a hostile report cannot read host cookies, escape its frame, or interact with the surrounding admin UI. The serving endpoint sets strict content-security and framing headers as defence in depth alongside the sandbox.

The host page contributes only the metadata header, the trigger button, and the past-reports list. The report body — narratives, friction categories, suggested CLAUDE.md additions, big wins, horizon section — is the genuine `/insights` output, captured unchanged, and rendered untouched.

## What This Feature Does Not Do

- **No automated triggering**: no cron, no nightly, no recurring job, no event-driven dispatch. The trigger surface is exclusively the manual button on `/admin/insights`.
- **No notifications**: run start, completion, and failure produce zero email, push, in-app, or webhook notifications. Observation is pull-based via the page.
- **No multi-agent analysis**: only Claude Code sessions are analyzed; cross-agent comparison reports are out of scope.
- **No per-project partitioning**: reports are application-wide vantage points by design. There is no per-project, per-user, or per-ticket filtering.
- **No editing or deletion**: reports persist indefinitely (subject to the operator's long-term storage retention). The application does not prune them.
- **No additional admin pages**: the admin area exposes Insights and nothing else.
