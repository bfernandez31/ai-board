# Implementation Summary: Track and display plugin and agent CLI version per job

**Branch**: `AIB-778-tracer-et-afficher` | **Date**: 2026-05-08
**Spec**: [spec.md](spec.md)

## Changes Summary

Added two nullable `VarChar(40)` columns (`pluginVersion`, `agentCliVersion`) to the `Job` model. Runner captures values via `read_plugin_version` (manifest JSON) and `capture_<agent>_version` (CLI `--version`) helpers, exports to `$GITHUB_ENV`, and PATCHes the existing status endpoint on RUNNING transition (first-write-wins). UI renders both as compact badges in `JobRow` with `-` placeholder when null.

## Key Decisions

First-write-wins on RUNNING transition (idempotent re-delivery safe). Capture is best-effort: all helpers exit 0 on failure, log via `log_info` only, never block the job. BASH_SOURCE guard added to run-agent.sh so helpers can be sourced in unit tests without invoking the agent. Workflow step gated on non-empty env vars to avoid useless API calls.

## Files Modified

`prisma/schema.prisma`, `prisma/migrations/…_add_job_runtime_versions/`, `app/lib/job-update-validator.ts`, `lib/types/job-types.ts`, `app/api/jobs/[id]/status/route.ts`, `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`, `components/ticket/jobs-timeline.tsx`, `lib/utils/job-snapshots.ts`, `components/board/board.tsx`, `.github/scripts/run-agent.sh`, `.github/workflows/{speckit,verify,quick-impl,iterate,ai-board-assist}.yml`, 3 test files extended.

## ⚠️ Manual Requirements

T037: Verify SC-006 (<1s capture overhead) via workflow run timestamps after merge. T038: Verify SC-005 (UI placeholder layout stability) in local dev UI with `bun run dev`.
