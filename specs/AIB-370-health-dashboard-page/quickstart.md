# Quickstart: Health Dashboard

**Branch**: `AIB-370-health-dashboard-page` | **Date**: 2026-03-28

## Implementation Order

### Layer 1: Data Foundation
1. Add `HealthScanType`, `HealthScanStatus` enums to `prisma/schema.prisma`
2. Add `HealthScan` and `HealthScore` models to `prisma/schema.prisma`
3. Add `healthScans` and `healthScore` relations to `Project` model
4. Run `bunx prisma migrate dev --name add-health-models`
5. Create `lib/health/types.ts` with TypeScript interfaces matching Prisma models
6. Create `lib/health/score-calculator.ts` with `calculateGlobalScore()` pure function

### Layer 2: API Endpoints
7. Create `app/api/projects/[projectId]/health/route.ts` — GET health score aggregate
8. Create `app/api/projects/[projectId]/health/scans/route.ts` — POST trigger scan, GET scan history
9. Create `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` — PATCH scan status callback
10. Create `lib/health/scan-dispatch.ts` — workflow dispatch function for health scans
11. Wire score recalculation into the PATCH status callback (on COMPLETED)

### Layer 3: Client Hooks
12. Add health query keys to `app/lib/query-keys.ts`
13. Create `app/lib/hooks/useHealthPolling.ts` — TanStack Query with 2s conditional polling
14. Create `app/lib/hooks/mutations/useTriggerScan.ts` — optimistic mutation for scan trigger

### Layer 4: UI Components
15. Create `components/health/health-sub-score-badge.tsx` — compact badge for each module
16. Create `components/health/health-hero.tsx` — global score hero zone with label and color
17. Create `components/health/health-module-card.tsx` — card with 4 states (never scanned, scanning, completed, failed)
18. Create `components/health/health-dashboard.tsx` — client component composing hero + 6 cards in grid

### Layer 5: Page & Navigation
19. Create `app/projects/[projectId]/health/page.tsx` — server component page entry
20. Add Health entry to `components/navigation/nav-items.ts` after Comparisons

### Layer 6: Tests
21. Unit test: `tests/unit/health/score-calculator.test.ts`
22. Component tests: `tests/unit/components/health-hero.test.tsx`, `health-module-card.test.tsx`
23. Integration tests: health-score, trigger-scan, scan-status, incremental-scan, scan-history
24. E2E test: `tests/e2e/health-navigation.spec.ts` — sidebar nav click

## Key Dependencies

| Component | Depends On |
|-----------|-----------|
| Score calculator | None (pure function) |
| API endpoints | Prisma models, score calculator, auth helpers |
| Scan dispatch | Workflow dispatch pattern, Octokit |
| Client hooks | API endpoints, query keys |
| UI components | Client hooks, score color utilities |
| Page | UI components |
| Navigation | Nav items array |

## Files Modified (Existing)

- `prisma/schema.prisma` — add models and enums
- `components/navigation/nav-items.ts` — add Health nav entry
- `app/lib/query-keys.ts` — add health query keys

## Files Created (New)

- `lib/health/types.ts`
- `lib/health/score-calculator.ts`
- `lib/health/scan-dispatch.ts`
- `app/api/projects/[projectId]/health/route.ts`
- `app/api/projects/[projectId]/health/scans/route.ts`
- `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`
- `app/lib/hooks/useHealthPolling.ts`
- `app/lib/hooks/mutations/useTriggerScan.ts`
- `components/health/health-dashboard.tsx`
- `components/health/health-hero.tsx`
- `components/health/health-module-card.tsx`
- `components/health/health-sub-score-badge.tsx`
- `app/projects/[projectId]/health/page.tsx`
