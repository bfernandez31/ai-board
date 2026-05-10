# Admin Area - Functional Specification

## Purpose

The Admin area is an application-level workspace for tools that operate across all projects rather than within a single one. It is reached from `/admin` and is restricted to a small allowlist of users; non-admins receive the same response as a missing page so the area's existence is not leaked.

The area currently hosts a single tool: **Claude Code Insights**, which runs Claude Code's built-in `/insights` analyzer over the AI agent sessions captured by AI-Board.

## Accessing the Admin Area

The Admin area lives at `/admin` and is independent of any project context. Visiting `/admin` redirects to the first available admin tool (`/admin/insights`).

**Access rules**:
- Admin status is determined by the user's email. Admins are a configured allowlist; ownership of a project does not grant admin access.
- Unauthenticated visitors and signed-in users who are not on the allowlist both receive a `404 Not Found` response on any `/admin` route or `/api/admin/*` endpoint. The response gives no hint that the area exists.
- A signed-in admin sees a sidebar with one entry — **Insights** — and the corresponding tool in the main panel. The sidebar collapses below `md` breakpoint.

## Claude Code Insights

The Insights page (`/admin/insights`) renders the most recent Claude Code `/insights` report inline and lets an admin trigger a fresh analysis.

### Report viewer

The page is split into a left rail listing past reports and a main panel showing one report at a time.

**Header metadata** (always shown above the report body):
- Generation date (completion time when available, otherwise start time)
- Period analyzed (`periodStart → periodEnd`)
- Number of Claude Code sessions analyzed
- Number of tickets covered
- Title summarizing the run, e.g., "Analyzed N Claude Code sessions across M tickets" (COMPLETED), "Analysis in progress" (RUNNING), "Analysis failed" (FAILED)

**Report body**:
- COMPLETED: the genuine HTML output produced by Claude Code's `/insights` command (narratives, charts, friction categories, suggested CLAUDE.md additions, big wins, horizon section). It is rendered inside a sandboxed iframe so the embedded HTML cannot run scripts or navigate the parent page.
- RUNNING: a "generating report…" placeholder. The page polls every 5 seconds while a report is in progress and refreshes automatically when it completes.
- FAILED: the error message recorded during the run.

Reports are read-only; admins can view them but cannot edit or annotate them.

### Past reports list

The left rail lists up to 50 most recent reports, newest first. Each entry shows:
- Date (completion time when available, otherwise start time)
- Status badge: COMPLETED (green), RUNNING (amber), FAILED (red)
- Session count and ticket count

Selecting a past report displays it in the main panel. No filters, search, or per-period custom range selection — chronological order only.

### Triggering a new analysis

A **Run new analysis** button sits above the report panel. Its enabled state depends on three conditions:

| Condition | Behavior |
|-----------|----------|
| Another analysis is RUNNING | Button shows "Running…" and is disabled. The page surfaces "An analysis is already running." |
| No new shipped tickets since the last successful run | Button is disabled. The page surfaces "No new shipped tickets since last run on {date}." (or "No shipped tickets are available to analyze yet" on a first run with empty data) |
| New shipped tickets are available | Button is enabled. Hover hint shows "{N} new shipped ticket(s) since last run." |

**Trigger behavior** (when the button is enabled):
1. The system creates an InsightsReport record in RUNNING state and records the analyzed scope (period, ticket count, session count).
2. A background workflow downloads the relevant raw Claude session artifacts, runs Claude Code's `/insights` analyzer, and persists the resulting HTML report.
3. The page immediately switches to the new report and shows the "generating report…" placeholder.
4. While the run is in flight the button stays disabled, double-trigger is impossible, and the page polls every 5 seconds for status updates.
5. On completion the report's HTML appears in the panel and the entry moves to the top of the past-reports list.
6. On failure the entry is marked FAILED and the recorded error message is displayed.

### Analyzed scope

The trigger refuses to run when there are no `TicketOutcome` rows shipped strictly after the previous successful run. This guarantees no analysis is wasted on a corpus identical to the previous one.

For runs that do proceed:
- The **first ever run** analyzes every shipped ticket available.
- **Each subsequent run** analyzes the period strictly after the previous successful run's `periodEnd` up to the new run's start time.
- Only sessions from `agent = CLAUDE` jobs that captured a raw native session artifact are included; other agents are silently filtered out.
- The report header makes the analyzed scope explicit (sessions, tickets, period bounds).

### Manual only

Insights runs are manual only. There is no schedule, no nightly job, and no notification when a run completes — the admin returns to the page to see the result.

## Out of Scope

- No other admin tools (no global stats, evals, or user management UI).
- No DB-backed admin role system — config-driven email allowlist only.
- No automated scheduling of Insights runs.
- No multi-agent analysis — Codex, Mistral, and Gemini sessions are excluded.
- No filters, search, or custom period selection on the report list.
- No editing or annotating reports.
- No notifications or emails on run completion.
