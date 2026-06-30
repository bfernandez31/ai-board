# Implementation Summary: In-App PR Diff Viewer with Layered Grouping (Read-Only)

**Branch**: `AIB-879-visualiseur-de-diff` | **Date**: 2026-06-30
**Spec**: [spec.md](spec.md)

## Changes Summary

Added a read-only full-screen PR diff viewer opened from VERIFY/SHIP. New `GET …/pr-diff` route fetches the live PR diff + inline comments and merges the persisted layer snapshot. VERIFY code-review now emits `LAYER_DECOMPOSITION_JSON`, stored on a new nullable `Job.layerDecomposition` column. UI: Overview/Layers↔Files rail, per-file diffs with collapse, read-only inline comments (source attribution + outdated handling), and no-PR/auth/never-reviewed fallbacks.

## Key Decisions

Per-user GitHub OAuth (`createUserGitHubClient`) for the live read. Layer snapshot reuses the `qualityScore` lifecycle (marker → verify.yml → status PATCH on COMPLETED). Reconciliation routes post-review files to a synthetic "Additional changes" layer. `reviewSynthesis` returns null (no synthesis is persisted today).

## Files Modified

prisma/schema.prisma (+migration); app/lib/schemas/pr-diff.ts; lib/pr-layers.ts; lib/github/pr-state.ts; app/api/.../pr-diff/route.ts; lib/hooks/use-pr-diff.ts; components/ticket/pr-{file-diff,diff-viewer}.tsx; ticket-detail-modal.tsx; jobs status route + validator; verify.yml; code-review.md. Tests: pr-layers, pr-state, pr-diff (api), pr-diff-viewer, status, ticket-detail-modal.

## ⚠️ Manual Requirements

Integration tests (pr-diff.test.ts, status.test.ts) are authored but were not executed here: the Next dev server fails to boot in this sandbox (documented `.env`/Prisma-loader "Maximum call stack" issue). Run them in CI. Unit/component tests + type-check + lint pass.
