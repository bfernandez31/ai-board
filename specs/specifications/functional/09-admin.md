# Admin Area - Functional Specification

## Purpose

The Admin area is a hidden, allowlist-restricted section of AI Board where authorized administrators can review AI agent activity across the entire platform. Its only page today is the Claude Code Insights dashboard, which runs Claude Code's `/insights` analyzer over captured agent session transcripts and surfaces usage patterns, friction points, wins, and suggested `CLAUDE.md` additions.

## Accessing the Admin Area

The admin area lives at `/admin`. Visiting `/admin` redirects to `/admin/insights` (the only admin page).

Access is gated by an email allowlist. Users whose email appears on the allowlist see the admin layout — a sidebar with a single **Insights** entry and the active page on the right. Users not on the allowlist, and unauthenticated visitors, receive the standard 404 response. The admin area never identifies itself to non-admins: failed access returns the same page as a nonexistent route, with no hint that an admin area exists.

If the allowlist is empty or unconfigured, no one has admin access (fail-closed).

## Insights Dashboard

The Insights page (`/admin/insights`) renders Claude Code session analysis reports.

### Layout

- **Header**: page title "Insights", a "Run new analysis" button, and a running indicator when an analysis is in progress
- **Past Reports panel** (left): a chronological list of completed reports, newest first, each labeled with its completion date and analyzed period
- **Report viewer** (right): the selected report rendered inline with a metadata header

When no reports have been generated, the page shows a centered empty state inviting the admin to run the first analysis.

### Running a New Analysis

Clicking **Run new analysis** triggers a background analysis run. The button is disabled while a run is in progress and while the request is pending. Two pre-flight checks gate the trigger:

- **Blob storage configured**: if Vercel Blob is not configured, the trigger is refused with a clear error
- **New shipped tickets exist**: if no Claude-agent ticket has shipped since the last successful run, the trigger is refused with a message naming the date of the last run

A successful trigger immediately starts a background job and shows the "Analysis running..." indicator. Subsequent clicks are blocked until the run reaches a terminal state. While an analysis is in progress, the page polls every 5 seconds; when no run is active, polling slows to every 30 seconds. When the run completes, the new report appears in the past-reports list and the indicator disappears.

If the run fails, the page surfaces the error message and re-enables the trigger button so the admin can retry.

### Browsing and Viewing Reports

The past-reports panel shows up to 50 completed reports, newest first. Each entry shows:

- Completion date
- The analyzed period (start date – end date)

Selecting a past report swaps it into the viewer; clicking the currently-displayed latest report deselects, returning to the latest view. The viewer shows a metadata header with completion date, analyzed period, number of Claude sessions analyzed, and number of tickets covered, followed by the report itself.

The report HTML is the genuine output of Claude Code's `/insights` analyzer — narratives, friction categories, wins, suggested `CLAUDE.md` additions, and any other sections the analyzer produces. It is rendered inside a sandboxed iframe with no script execution and no same-origin privileges, so any markup in the report cannot interact with the parent application.

## Analysis Behavior

An analysis run covers all shipped tickets where the effective agent is Claude. Tickets with an explicit non-Claude agent are excluded, as are tickets whose agent inherits from a project whose default agent is not Claude. Sessions from Codex, Mistral, and Gemini agents never appear in the analysis input.

### Analyzed Window

- **First-ever run**: covers all shipped Claude tickets with available session artifacts (no time bound)
- **Subsequent runs**: cover the window from the previous successful run's end date up to the current trigger time

If a shipped ticket's raw session artifact has been pruned by retention policy, the run skips that session silently. If every artifact in the window is unavailable, the run fails with a descriptive error.

### Run Lifecycle

A run progresses through four states:

1. **PENDING** — created by the trigger, awaiting the background worker
2. **RUNNING** — downloading session artifacts and invoking the `/insights` analyzer
3. **COMPLETED** — HTML report is available; metadata reflects the analyzed sessions and tickets
4. **FAILED** — pre-flight, artifact download, CLI invocation, or upload failed; an error message is surfaced

Each run has a 30-minute timeout. A stuck `PENDING` or `RUNNING` run that has passed its timeout no longer blocks new triggers — the next admin trigger proceeds despite the stuck row.

## Edge Cases

- **Empty allowlist or missing env var**: the admin area is inaccessible to everyone, including users who would otherwise be on the list
- **Stuck analysis run**: after the 30-minute timeout, a new trigger is allowed; the stuck row remains in the past-runs list but never blocks again
- **Missing blob token**: triggers are refused with a configuration error; no partial work is done
- **Pruned session artifacts**: the run proceeds with whatever artifacts remain; pruned sessions are silently excluded; if everything is pruned, the run fails
- **Admin removed mid-session**: subsequent API calls return 404; the page becomes non-functional until the admin navigates away
- **Empty or invalid `/insights` output**: the run fails with a descriptive error; no empty report is persisted

## What's Out of Scope

The Admin area today is intentionally minimal. There are no other admin pages (no global stats, no evals, no user management UI), no database-backed admin roles, no automated scheduling, no multi-agent analysis, no filters or custom date ranges on the report list, no editing or annotating reports, and no notifications when a run completes.
