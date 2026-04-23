# Implementation Summary: Capture and display agent execution logs (Claude/Codex/Mistral/Gemini)

**Branch**: `AIB-715-capture-and-display` | **Date**: 2026-04-22
**Spec**: [spec.md](spec.md)

## Changes Summary

End-to-end log-capture pipeline. Adds `JobLog` Postgres table + `CaptureStatus` enum, four ai-board API routes (POST/PUT for workflow capture; GET summary + GET raw stream for the UI), Vercel Blob client wrapper, shared TS+ESM secret redactor, per-agent normalizers, preview derivation, TanStack Query hooks, `LogViewerSheet` + `LogEventRow` components, JobsTimeline preview line + "View full logs" trigger, runner-side `capture-agent-logs.sh` wired into all five agent workflows, and a nightly retention prune.

## Key Decisions

Vercel Blob with proxy-only access (runner never holds the token). Schema-versioned (v1) NDJSON event stream. Shared redactor module (TS + ESM sibling) so patterns stay in lockstep between API and runner. Preview is server-re-redacted on every POST. Capture step is `if: always()` and isolated from the status PATCH so capture failure cannot block job termination. Single-pass hard-delete prune (PRUNED enum value retained for future two-pass migration).

## Files Modified

`prisma/schema.prisma` + new migration; `app/lib/{logs/*, blob/client.ts, query-keys.ts, hooks/queries/useJobLog*.ts}`; new routes under `app/api/{jobs/[id]/logs, projects/.../logs, maintenance/prune-logs}`; `components/ticket/{jobs-timeline,log-event-row,log-viewer-sheet}.tsx`; `.github/scripts/{capture-agent-logs.sh, lib/{redactor,normalize-*}.mjs}` + `run-agent.sh`; capture step in `speckit.yml`/`quick-impl.yml`/`verify.yml`/`ai-board-assist.yml`/`iterate.yml`; new `nightly-log-prune.yml`; 5 unit + 5 integration test files + 1 E2E.

## ⚠️ Manual Requirements

Provision `BLOB_READ_WRITE_TOKEN` (Vercel Blob R/W token) in Vercel env vars (dev/preview/prod). Optionally set `LOG_RETENTION_DAYS` (default 30). Run `bunx prisma generate` if pulling this branch fresh.
