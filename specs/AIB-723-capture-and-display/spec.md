# Quick Implementation: Capture and display agent execution logs

**Feature Branch**: `AIB-723-capture-and-display`
**Created**: 2026-04-23
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Problem

Today, when an AI agent (Claude Code, Codex, Mistral/vibe, Gemini) runs inside a GitHub Actions workflow to execute a ticket command (specify, plan, build, verify, ship, iterate, quick-impl, deploy-preview, health-scan, comment-*), its output is lost the moment the workflow ends. The `Job.logs` field exists in the schema but is never populated, and the UI has no way to surface what the agent actually said or did.

This creates several pain points:

- When a job fails, users have no way to understand why without opening the GitHub Actions run (which many project members cannot access on external repositories).
- The telemetry we already collect (tokens, cost, duration, tools used) has no narrative context — we know an agent used 15 tools but not which ones or in what order.
- Debugging agent behavior after the fact is impossible without re-running the job.

With the recent addition of external project support, this gap is now blocking: users working on repositories they don't own cannot diagnose issues themselves.

## Expected Behavior

Every job execution should produce a persistent, viewable log artifact that captures what the agent did. The logs must:

1. Be captured regardless of which agent is used (Claude Code, Codex, Mistral, Gemini) and normalized to a single consumable format where possible.
2. Persist beyond the lifetime of the GitHub Actions run, so they remain available even after the workflow retention window would normally expire.
3. Be viewable from the ai-board UI, inline with the existing job timeline, without requiring access to GitHub Actions.
4. Provide both a quick-glance summary (inline, in the timeline) and a full drill-down view (modal or dedicated view) for deeper investigation.
5. Include at minimum: timestamps, agent messages, tool invocations, errors, and exit status.

## Acceptance Criteria

- When a job finishes (COMPLETED, FAILED, or CANCELLED), an associated log record is available via the ai-board API and visible in the UI.
- The job timeline item shows a condensed preview of the log (e.g., last few key events or error summary) without requiring a click.
- A "View full logs" action opens a detailed view showing the complete captured output with readable formatting (not raw JSON dump).
- Logs are available for all supported agents: Claude Code, Codex, Mistral/vibe, Gemini.
- The storage approach does not bloat the Postgres database with multi-MB blobs for every job (hybrid storage is acceptable).
- Members of a project (not just the owner) can view logs for jobs in that project, with the same access rules as other ticket data.
- No regression on existing telemetry (tokens, cost, duration, tools used, quality score).
- Logs are retained for at least 30 days; older logs may be pruned automatically.
- The feature works identically for self-managed ai-board and for external projects.

## Out of Scope

- Real-time streaming of logs during job execution (this ticket covers post-completion capture only).
- Log search or full-text indexing across jobs.
- Exporting logs to third-party observability platforms (Datadog, etc.).
- Email or Slack notifications based on log content (covered by a separate ticket on failure notifications).

## Why Now

Adds observability that unlocks two things: (1) self-service debugging for external project members who cannot read GitHub Actions directly, and (2) the contextual substrate needed for the upcoming failure-notification feature, which should link to a readable failure reason rather than an opaque "job failed" message.

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
