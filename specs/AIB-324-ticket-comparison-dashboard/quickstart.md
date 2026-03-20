# Quickstart: Ticket Comparison Dashboard (AIB-324)

**Date**: 2026-03-20

## Implementation Order

### Layer 1: Database Schema (Prisma)

1. Add `Comparison`, `ComparisonEntry`, `ComparisonDecisionPoint` models to `prisma/schema.prisma`
2. Add reverse relations to `Ticket` and `Project` models
3. Run `bunx prisma migrate dev --name add-comparison-models`
4. Run `bunx prisma generate`

### Layer 2: Validation Schemas

1. Create `lib/schemas/comparison.ts` with Zod schemas for create comparison payload
2. Export `createComparisonSchema`, `comparisonEntrySchema`, `comparisonDecisionPointSchema`

### Layer 3: API Endpoints

1. `POST /api/projects/[projectId]/comparisons/route.ts` — Save comparison (Bearer token auth)
2. `GET /api/projects/[projectId]/comparisons/route.ts` — List project comparisons (session auth)
3. `GET /api/projects/[projectId]/comparisons/[comparisonId]/route.ts` — Get enriched comparison
4. `GET /api/projects/[projectId]/tickets/[id]/comparisons/db/route.ts` — List ticket comparisons (DB)
5. `GET /api/projects/[projectId]/tickets/[id]/comparisons/db/check/route.ts` — Check for DB comparisons

### Layer 4: TanStack Query Hooks

1. Add DB-backed hooks to `hooks/use-comparisons.ts`:
   - `useDbComparisonCheck(projectId, ticketId)` — lightweight check for tab visibility
   - `useDbComparisonList(projectId, ticketId)` — list comparisons for ticket
   - `useComparisonDetail(projectId, comparisonId)` — full enriched comparison
   - `useSaveComparison()` — mutation hook for POST

### Layer 5: UI Components

1. `components/comparison/comparison-dashboard.tsx` — Main dashboard view with 4 sections
2. `components/comparison/comparison-ranking.tsx` — Ranking cards with winner highlight
3. `components/comparison/comparison-metrics.tsx` — Recharts bar charts for code metrics
4. `components/comparison/comparison-decisions.tsx` — Collapsible decision points
5. `components/comparison/comparison-compliance.tsx` — Constitution compliance grid
6. `components/comparison/comparison-list-item.tsx` — List item for comparison history

### Layer 6: Integration

1. Update `components/board/ticket-detail-modal.tsx` — Add conditional "Comparisons" tab
2. Update `.claude-plugin/commands/ai-board.compare.md` — Add API call to save comparison to DB

## Key Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add 3 new models + reverse relations |
| `lib/schemas/comparison.ts` | New: Zod validation schemas |
| `app/api/projects/[projectId]/comparisons/route.ts` | Add POST handler alongside existing GET |
| `app/api/projects/[projectId]/comparisons/[comparisonId]/route.ts` | New: enriched comparison detail |
| `app/api/projects/[projectId]/tickets/[id]/comparisons/db/route.ts` | New: DB-backed ticket comparisons |
| `app/api/projects/[projectId]/tickets/[id]/comparisons/db/check/route.ts` | New: DB-backed check |
| `hooks/use-comparisons.ts` | Add DB-backed hooks |
| `components/comparison/comparison-dashboard.tsx` | New: main dashboard |
| `components/comparison/comparison-ranking.tsx` | New: ranking section |
| `components/comparison/comparison-metrics.tsx` | New: metrics charts |
| `components/comparison/comparison-decisions.tsx` | New: decision points |
| `components/comparison/comparison-compliance.tsx` | New: compliance grid |
| `components/comparison/comparison-list-item.tsx` | New: list item |
| `components/board/ticket-detail-modal.tsx` | Add Comparisons tab |

## Testing Strategy

| Test Type | Scope | Location |
|-----------|-------|----------|
| Integration | POST comparison API (save, validation, auth) | `tests/integration/comparisons/` |
| Integration | GET comparison API (list, detail, enrichment) | `tests/integration/comparisons/` |
| Integration | DB check endpoint | `tests/integration/comparisons/` |
| Component | ComparisonDashboard rendering | `tests/unit/components/` |
| Component | ComparisonRanking with winner highlight | `tests/unit/components/` |
| Component | ComparisonMetrics charts | `tests/unit/components/` |
| Component | Graceful degradation (missing data) | `tests/unit/components/` |
