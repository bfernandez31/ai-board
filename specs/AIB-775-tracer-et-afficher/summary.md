# Implementation Summary: Tracer et afficher la version du plugin et de l'agent sur chaque job

**Branch**: `AIB-775-tracer-et-afficher` | **Date**: 2026-05-08
**Spec**: [spec.md](spec.md)

## Changes Summary

Added two optional VarChar(100) columns (pluginVersion, agentCliVersion) to Job, a workflow-token POST /api/jobs/:id/versions endpoint with first-write-wins semantics, plugin/CLI version capture in the ticket detail panel with "Non disponible" placeholder, a runner-side capture-versions.sh script, and the corresponding workflow step inserted into all five agent-running workflows (verify, speckit, quick-impl, iterate, ai-board-assist).

## Key Decisions

- Two nullable columns on Job (no new entity), no backfill, no index — values are read-only display data per data-model.md.
- First-write-wins via in-handler read-then-write (mirrors workflowRunId pattern). Subsequent POSTs no-op on already-set columns.
- Capture script always exits 0; bash `set -o pipefail` only — capture failure cannot block the job (FR-004).
- Native `title` attribute for the "Non disponible" tooltip — no new shadcn primitive.

## Files Modified

- prisma/schema.prisma (+migration 20260508120000_add_job_versions)
- app/api/jobs/[id]/versions/route.ts (NEW)
- app/lib/job-versions-validator.ts (NEW)
- app/api/projects/[projectId]/tickets/[id]/jobs/route.ts
- lib/types/job-types.ts; lib/utils/job-snapshots.ts; components/ticket/jobs-timeline.tsx; components/board/board.tsx
- .github/scripts/capture-versions.sh (NEW); 5 workflow YAMLs (verify, speckit, quick-impl, iterate, ai-board-assist)
- 3 test files: versions-post (NEW), ticket-jobs (extended), jobs-timeline (extended)

## ⚠️ Manual Requirements

Apply the new Prisma migration to live environments (`prisma migrate deploy`). Integration tests not run locally — dev server has a pre-existing Prisma/Turbopack loading issue unrelated to this change; unit tests, type-check, and lint all pass.
