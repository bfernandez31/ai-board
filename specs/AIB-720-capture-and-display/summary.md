# Implementation Summary: Capture and display agent execution logs (Claude/Codex/Mistral/Gemini)

**Branch**: `AIB-720-capture-and-display` | **Date**: 2026-04-23
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented persisted agent execution logs end to end: added the `JobExecutionLog` Prisma model and migration, workflow-side log bundle capture/upload, workflow/member log APIs, summary/detail UI in the ticket modal and timeline, retention/pruning helpers, clone-safety, and targeted unit/integration coverage for upload, retrieval, previews, and audit states.

## Key Decisions

Kept full transcripts out of the hot `Job` row by storing compressed artifacts in a dedicated table; allowed log upload while jobs are still `RUNNING` so workflows can upload before the final status callback; created a terminal-status fallback that records `UNAVAILABLE` when no artifact arrives; preserved summary metadata after pruning so users can distinguish pruned logs from capture failure.

## Files Modified

`prisma/schema.prisma`, `prisma/migrations/20260423000000_add_job_execution_logs/`, `app/api/jobs/[id]/logs/route.ts`, `app/api/jobs/[id]/status/route.ts`, `app/api/projects/[projectId]/jobs/[jobId]/logs/route.ts`, ticket/timeline UI files, `lib/job-logs/*`, `.github/scripts/run-agent.sh`, `.github/workflows/{speckit,quick-impl,iterate,verify,ai-board-assist}.yml`, and targeted tests/docs under `tests/` and `specs/AIB-720-capture-and-display/workflows/`.

## ⚠️ Manual Requirements

None
