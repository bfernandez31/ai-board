# Quick Implementation: Capture native Claude Code session JSONL alongside normalized logs 4.6

**Feature Branch**: `AIB-780-capture-native-claude`
**Created**: 2026-05-07
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Context

When a Claude Code agent finishes a job, the runner reads the native Claude Code session files, aggregates them, then normalizes the result into AI-Board's internal log format (`schemaVersion + tool_invocation/tool_result`) before uploading to Blob. The normalized format is great for the existing log viewer but is **lossy**: parent/child threading (uuid/parentUuid), sidechain markers (Task subagents), token usage, session boundaries, summaries, and version metadata are all dropped.

This loss prevents downstream tooling from replaying or analyzing the agent runs with Claude Code's native ecosystem (notably the built-in `/insights` command, which depends on the full native event graph).

## What we want

In addition to the existing normalized artifact, every completed **Claude Code** job should also persist its **raw, native session data** as a separate Blob artifact, so that we have a faithful, replayable copy of what the agent actually did.

## Expected behavior

- Each Claude Code job that produces session data uploads two artifacts:
  - The existing normalized artifact (unchanged)
  - A new artifact containing the raw, aggregated, native Claude Code session JSONL
- The new artifact is redacted using the same secret-redaction rules as the normalized one — no secrets must ever leak.
- The new artifact is gzip-compressed, retrievable via the API the same way the normalized one is.
- Same retention policy (30 days), same project/ticket/job grouping in Blob.
- Only applies when `agent = CLAUDE`. Other agents (Codex, Mistral, Gemini) are unaffected.
- The capture must remain non-blocking: if the raw upload fails, the job still completes and the normalized log is still produced. Failures are logged but never cascade.

## Acceptance criteria

- Given a Claude Code job that completes successfully, the API exposes both the normalized artifact (existing) and the new raw artifact
- The raw artifact preserves all native fields (uuid, parentUuid, sessionId, isSidechain, usage, cwd, gitBranch, version, summary events, etc.) — verified by sampling a real artifact
- The raw artifact is properly redacted (no API keys, tokens, or secrets present even when they appeared in tool input/output)
- A non-Claude job (e.g., Codex) produces no raw artifact and no error
- A failure to upload the raw artifact is visible in the runner logs but does NOT mark the job as failed
- Retention pruning removes raw artifacts on the same schedule as normalized ones

## Out of scope

- No UI changes — this ticket is purely about persisting an additional artifact.
- No analysis or report generation — that is the next ticket (admin section + Insights workflow).
- No format change to the existing normalized artifact.

## Why this is a prerequisite

The follow-up "Admin Insights" feature needs to feed real Claude Code sessions into Claude Code's `/insights` analyzer. That tool will not work on the normalized format — it requires the native event graph. Capturing it now means we'll have a usable history when the Insights feature ships.

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
