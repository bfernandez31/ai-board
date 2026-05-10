# Quick Implementation: Admin section with Claude Code Insights report

**Feature Branch**: `AIB-786-admin-section-with`
**Created**: 2026-05-10
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Context

We want a way to step back and look at AI-Board as a whole — not project by project, but at the application level. Specifically, we want to run Claude Code's built-in `/insights` analyzer over the AI agent sessions that AI-Board generates, so we can see usage patterns, recurring frictions, big wins, suggested CLAUDE.md additions, and other meta-feedback that helps us improve the platform.

This is the **first feature of an Admin area** that may later host other application-level tools (evals, global stats, etc.). For now, we only build the minimum admin shell needed to host the Insights page — no other admin features in this ticket.

## Dependency

This ticket depends on the prior ticket "Capture native Claude Code session JSONL alongside normalized logs" being merged first. Without raw native sessions, the `/insights` analyzer cannot run.

## What we want

### Admin shell (minimal)

- A new `/admin` area at the application level (not under any project).
- Access restricted to a small allowlist of users, controlled by configuration (no DB schema for admin roles in this ticket).
- Unauthorized users get a clear "not allowed" response, no leak of the area's existence.
- A simple admin layout with a sidebar/nav containing one entry: **Insights**.

### Insights page

- Path: `/admin/insights`.
- Displays:
  - The **latest report** rendered inline (it's an HTML document produced by `/insights`).
  - Metadata header: date the report was generated, period analyzed, number of sessions and tickets it covers.
  - A **"Run new analysis"** button to manually trigger a fresh report.
  - A list (or simple dropdown) of past reports, viewable individually.
- Trigger semantics:
  - Triggering kicks off a background job that downloads the relevant raw Claude session artifacts, runs Claude Code's `/insights` analyzer on them, and persists the produced HTML report plus its metadata.
  - **Pre-flight check**: before launching, the system verifies there are tickets that have shipped since the previous run. If none, the trigger is refused with a clear message ("No new shipped tickets since last run on ...") — no wasted work.
  - The first-ever run analyzes all available sessions.
  - Each subsequent run analyzes the period since the previous successful run.
  - The user sees a "Running..." state while the job is in flight, with no double-trigger possible.
- Reports are read-only artifacts; the user can view them but not edit them.

### Manual only

- No automated schedule (no cron, no nightly). Trigger is exclusively manual from the page.
- This is explicitly different from health-scans, which are scheduled. We may add scheduling later as a separate ticket if needed.

## Acceptance criteria

- An authorized user navigating to `/admin/insights` sees the latest report rendered inline, with its metadata.
- An unauthorized user attempting to access `/admin` or `/admin/insights` is denied with a clear response.
- Clicking "Run new analysis" when there ARE new shipped tickets starts a job, the page reflects "running", and on completion the new report appears as the latest.
- Clicking "Run new analysis" when there are NO new shipped tickets since the last run shows a friendly refusal message without launching a job.
- A user can pick a previous report from the list and view it.
- The report is the genuine HTML output of Claude Code's `/insights` command (with its narratives, charts, friction categories, suggested CLAUDE.md lines, big wins, horizon section, etc.) — not a re-implementation.
- Only sessions from `agent = CLAUDE` jobs are included in the analysis (other agents are silently filtered out).
- The report header makes the analyzed scope explicit (e.g., "Analyzed N Claude Code sessions across M tickets shipped between DATE and DATE").

## Out of scope

- No other admin pages (no global stats, no evals, no user management UI).
- No DB-backed admin role system — config-driven allowlist only.
- No automated scheduling.
- No multi-agent analysis (Codex/Mistral/Gemini sessions are excluded).
- No filters, search, or per-period custom range selection on the report list — just chronological list of past runs.
- No editing or annotating reports.
- No notifications/emails when a run completes.

## Open question to confirm during SPECIFY

- Where reports are stored (Blob vs DB) — the SPECIFY stage should pick the option that aligns best with how existing artifacts (logs, etc.) are persisted.

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Implementation

Implementation will be done directly by Claude Code based on the description above.
