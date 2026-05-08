# Implementation Summary: Capture native Claude Code session JSONL alongside normalized logs

**Branch**: `AIB-783-copy-of-capture` | **Date**: 2026-05-08
**Spec**: [spec.md](spec.md)

## Changes Summary

Adds a second gzipped artifact per Claude job — the aggregated native session JSONL — at `raw-logs/<p>/<t>/<j>.jsonl.gz`, served by `GET /logs/raw-native`. Two nullable columns added to `JobLog`. Runner Phase 5b runs only after normalized success, gated on Claude. Same redactor and 30-day retention. Failure isolation: raw never affects job terminal status.

## Key Decisions

Separate Blob prefix `raw-logs/` (not `.raw.jsonl.gz`) for clean prune scans. Two-column JobLog extension (no sibling table). New refine() in JobLogSubmissionSchema enforces `rawArtifactKey ⇔ rawArtifactSize ⇒ captureStatus=CAPTURED`. `redactNativeJsonl` walks every nested string via `deepRedact` (not `redactEvents`). Prune extends in-place; raw delete only after normalized succeeds; both columns nulled together.

## Files Modified

prisma/schema.prisma + new migration; app/lib/logs/{schema,artifact-key,redactor}.ts; app/api/jobs/[id]/logs/route.ts; new app/api/jobs/[id]/logs/raw-artifact/route.ts; new app/api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/raw-native/route.ts; app/api/maintenance/prune-logs/route.ts; .github/scripts/{capture-agent-logs.sh, lib/redactor.mjs}; proxy.ts; tests/unit/logs/redactor.test.ts; tests/integration/api/jobs/{logs-post,logs-raw-artifact-put,logs-raw-native-route}.test.ts; tests/integration/api/maintenance/prune-logs.test.ts; tests/e2e/capture-and-display-logs.spec.ts

## ⚠️ Manual Requirements

Run `bunx prisma migrate deploy` in each environment to apply the additive `JobLog.rawArtifactKey/rawArtifactSize` migration. E2E + manual smoke (T043/T044) deferred to CI: local dev server has a pre-existing Prisma client load error unrelated to this ticket.
