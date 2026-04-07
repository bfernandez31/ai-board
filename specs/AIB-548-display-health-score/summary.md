# Implementation Summary: Display health score heart indicator on project cards

**Branch**: `AIB-548-display-health-score` | **Date**: 2026-04-07
**Spec**: [spec.md](spec.md)

## Changes Summary

Added `healthSummary` to the project list contract, selected project health fields in the shared query, batched live Quality Gate averages by project, mapped the enriched payload into both the Projects page and `GET /api/projects`, and rendered a read-only heart indicator popover on project cards with scored and no-data states.

## Key Decisions

Recomputed each card’s global score from the six projected sub-scores instead of trusting stored `HealthScore.globalScore`, and derived Quality Gate from current verify-job aggregation so the card stays aligned with existing health-dashboard semantics. Kept the new UI informational-only with explicit click isolation from card navigation.

## Files Modified

`app/lib/types/project.ts`, `lib/db/projects.ts`, `lib/health/quality-gate.ts`, `app/projects/page.tsx`, `app/api/projects/route.ts`, `components/projects/project-card.tsx`, `components/projects/project-health-indicator.tsx`, `tests/integration/projects/crud.test.ts`, `tests/unit/components/projects/project-card.test.tsx`, `specs/AIB-548-display-health-score/tasks.md`

## ⚠️ Manual Requirements

None
