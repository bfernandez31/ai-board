# Quickstart: Automatic Quality Score Implementation

## Implementation Order

### Layer 1: Data Foundation
1. Add `qualityScore Int?` and `qualityScoreDetails String?` to Job model in `prisma/schema.prisma`
2. Run `bunx prisma migrate dev --name add-quality-score-to-job`
3. Run `bunx prisma generate` to regenerate client
4. Extend `jobStatusUpdateSchema` in `app/lib/job-update-validator.ts` to accept optional `qualityScore` and `qualityScoreDetails`
5. Update `PATCH /api/jobs/[id]/status/route.ts` to persist quality score fields when status is COMPLETED

### Layer 2: Data Access
6. Add `qualityScore` and `qualityScoreDetails` to select clause in `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`
7. Extend `TicketJobWithTelemetry` type in `lib/types/job-types.ts`
8. Add quality score utility functions: `getScoreThreshold()`, `getScoreColor()`, `parseQualityScoreDetails()`

### Layer 3: Ticket Card Badge (US-1)
9. Create `QualityScoreBadge` component in `components/ticket/quality-score-badge.tsx`
10. Integrate badge into `components/board/ticket-card.tsx`

### Layer 4: Stats Tab Display (US-2)
11. Create `QualityScoreSection` component in `components/ticket/quality-score-section.tsx`
12. Integrate into `components/ticket/ticket-stats.tsx`

### Layer 5: Workflow Integration (US-3)
13. Modify `.claude-plugin/commands/ai-board.code-review.md` to add scoring instructions to each agent
14. Add consolidation step that writes `quality-score.json`
15. Update `.github/workflows/verify.yml` to read `quality-score.json` and include scores in COMPLETED status update

### Layer 6: Analytics (US-4)
16. Add quality score types to `lib/analytics/types.ts`
17. Add quality score aggregation queries to `lib/analytics/queries.ts`
18. Extend analytics API endpoint to return quality score data
19. Create quality score chart components in `components/analytics/`
20. Integrate charts into `components/analytics/analytics-dashboard.tsx` (Team plan gated)

## Key Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add 2 fields to Job model |
| `app/lib/job-update-validator.ts` | Extend Zod schema |
| `app/api/jobs/[id]/status/route.ts` | Accept + persist quality score |
| `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` | Add to select clause |
| `lib/types/job-types.ts` | Extend TicketJobWithTelemetry |
| `components/board/ticket-card.tsx` | Add quality score badge |
| `components/ticket/ticket-stats.tsx` | Add quality score section |
| `.claude-plugin/commands/ai-board.code-review.md` | Add scoring to agents |
| `.github/workflows/verify.yml` | Parse + send quality score |
| `lib/analytics/types.ts` | Add quality score analytics types |
| `lib/analytics/queries.ts` | Add quality score aggregation |
| `app/api/projects/[projectId]/analytics/route.ts` | Return quality score analytics |
| `components/analytics/analytics-dashboard.tsx` | Add quality score charts |

## New Files

| File | Purpose |
|------|---------|
| `components/ticket/quality-score-badge.tsx` | Colored badge component |
| `components/ticket/quality-score-section.tsx` | Stats tab detail section |
| `lib/quality-score.ts` | Shared utilities (thresholds, colors, parsing) |
| `components/analytics/quality-score-trend-chart.tsx` | Score trend over time |
| `components/analytics/dimension-comparison-chart.tsx` | Per-dimension comparison |
