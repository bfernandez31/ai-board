# Quick Implementation: Harden agent log capture: redaction coverage, timestamps, and defense-in-depth

**Feature Branch**: `AIB-724-harden-agent-log`
**Created**: 2026-04-23
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Problem

Now that AIB-715 (agent log capture) has shipped, a pre-merge code review surfaced seven follow-up items that did not block the merge but should be addressed before the feature sees heavy production use. They fall into four themes:

### 1. Redaction coverage gaps and dead patterns

The redactor has one leaker-style pattern that, in practice, almost never fires on the content it was intended to catch — it was written against a configuration-file-style surrounding context that never appears in captured agent output. Its presence creates a false sense of coverage and should either be removed or redesigned. Separately, there is no test exercising a realistic form of this secret class, so the gap went unnoticed.

### 2. Log artifact timestamps are effectively meaningless

Every captured log artifact currently records its `startedAt` and `endedAt` at the same instant, because the "start of capture" timestamp is never exported from the workflow to the capture script. Users viewing the log cannot tell how long an agent run took, which undermines one of the core values of the feature (post-hoc investigation of slow or stuck jobs).

### 3. Defense-in-depth against runner-side redaction failures

Two hardening gaps exist today:

- The short log preview stored inline in Postgres is truncated to its max length **before** server-side redaction runs. If a future runner-side redaction bug ever lets a secret through into the preview, the truncation step can slice the secret mid-placeholder, leaving a partial secret visible in the UI.
- The endpoint that streams raw log artifacts trusts the artifact storage key recorded in the database without re-deriving it from the job's project/ticket/job IDs. A future bug that corrupts or mis-sets that key could let a member of one project read log data belonging to another project through the existing access-control path.

Neither has a known exploit today, but both are cheap to close before the feature gets more consumers.

### 4. Minor code hygiene

Three small items: a dead code branch in the log normalizer that can never execute, a `findFirst` query on a primary key that should use `findUnique`, and missing observability when an artifact is silently overwritten by a retried workflow run.

## Expected Behavior

- Every captured artifact has an accurate duration — `endedAt - startedAt` reflects real wall-clock capture time, not zero.
- The redactor has no effectively-dead patterns and has test coverage for every secret class it claims to scrub.
- The preview field cannot leak partial secrets even if the runner-side redactor regresses: either server-side redaction runs before length truncation, or the length cap is enforced on already-redacted content only.
- The raw-log endpoint refuses to stream any artifact whose stored storage key does not match the canonical key derived from `(projectId, ticketId, jobId)`. Mismatches are logged for alerting.
- A retried workflow run that overwrites an existing artifact emits a log entry so double-submits are visible in operations dashboards.
- Dead code and unused conditionals from the initial implementation are removed.
- `findFirst` lookups by primary key are converted to `findUnique`.

## Acceptance Criteria

- Captured log artifacts show a non-zero duration in the UI for any job that ran longer than a few milliseconds.
- No test in the redactor suite relies on a regex that never matches realistic captured content; each remaining pattern has at least one positive test with content shaped like real agent output.
- Simulating a runner-side redaction bypass (unredacted preview arriving at the API) still results in no secret fragments stored or displayed.
- Simulating a corrupted `artifactKey` pointing to a blob belonging to a different project causes the raw-log endpoint to return an error and log the mismatch instead of streaming the data.
- Observability: operators can find overwrite events in structured logs.
- No regression on any AIB-715 acceptance criterion (redaction of known secret types, hybrid storage, access control for members, retention window, compatibility with all four agents).

## Out of Scope

- New categories of secret patterns beyond what AIB-715 already covers (those belong in a separate ticket driven by incident data).
- Full-text search over logs, real-time streaming, or cross-job analytics — still out of scope per AIB-715.
- Any changes to the log-viewer UI beyond surfacing the accurate duration value.

## Why Now

The feature just shipped and usage will grow quickly. Each of these items is cheap to close individually, and they all touch the same subsystem (capture → normalize → redact → store → serve). Bundling them avoids four separate small PRs through the same code and ensures the hardening happens before the feature has many production consumers.

## Origin

Findings raised during the pre-merge code review of PR #473 (AIB-715). Only the most severe finding — an env-variable redaction gap that missed common connection-string names — was fixed before merge. The remaining seven were deemed non-blocking and are bundled here.

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
