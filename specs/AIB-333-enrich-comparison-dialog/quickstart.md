# Quickstart: AIB-333 Enrich Comparison Dialog

## Summary

Enrich the comparison dialog with operational metrics (aggregated telemetry), ranking badges (workflow type, agent, quality), a quality score breakdown popover, and correct section ordering. **No database schema changes required** — all changes are TypeScript types, backend query enrichment, and new UI components.

## Key Files to Modify

### Backend (Data Layer)
1. **`lib/types/comparison.ts`** — Extend `ComparisonParticipantDetail` with `model`, `qualityScoreDetails`; extend `ComparisonTelemetryEnrichment` with `totalTokens`, `jobCount`, `hasPartialData`
2. **`lib/comparison/comparison-detail.ts`** — Replace single-job query with aggregation queries; add model resolution; include `qualityScoreDetails` in verify job select
3. **`lib/comparison/comparison-record.ts`** — Update `normalizeParticipantDetail()` and `normalizeTelemetryEnrichment()` to handle new fields

### Frontend (UI Components)
4. **`components/comparison/comparison-ranking.tsx`** — Add workflow type, agent, and quality score badges to ranking cards
5. **`components/comparison/comparison-operational-metrics.tsx`** — **NEW** — Operational metrics grid with horizontal scroll, sticky labels, best-value highlighting
6. **`components/comparison/comparison-quality-popover.tsx`** — **NEW** — Quality score dimension breakdown popover
7. **`components/comparison/comparison-viewer.tsx`** — Insert operational metrics section, update section ordering
8. **`components/comparison/types.ts`** — Add props interface for new components

## Implementation Order

1. Type extensions (types + normalization)
2. Backend query changes (aggregation + model + details)
3. Ranking badges (simplest UI change)
4. Operational metrics grid (core feature)
5. Quality score popover (P2 feature)
6. Section ordering (trivial layout change)
7. Tests

## No-Go Zones
- Do NOT modify Prisma schema — all data already exists
- Do NOT create new API endpoints — extend existing detail response
- Do NOT add new dependencies — use existing shadcn/ui components (Badge, Popover, Table)
