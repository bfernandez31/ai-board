# Quickstart: Comparisons Hub Page

**Date**: 2026-03-27 | **Branch**: `AIB-358-comparisons-hub-page`

## Implementation Order

### Phase A: Foundation (Navigation + Page Route + API)

1. **Add sidebar nav item** — `components/navigation/nav-items.ts`
   - Add `{ id: 'comparisons', label: 'Comparisons', icon: GitCompare, href: '/comparisons', group: 'views' }`
   - Position after Analytics

2. **Create page route** — `app/projects/[projectId]/comparisons/page.tsx`
   - Server component that reads `projectId` from params
   - Renders `<ComparisonsPage projectId={projectId} />`

3. **Rewrite project comparisons API** — `app/api/projects/[projectId]/comparisons/route.ts`
   - Replace filesystem scanning with `prisma.comparisonRecord.findMany({ where: { projectId } })`
   - Include participants, sourceTicket, winnerTicket relations
   - Return `ProjectComparisonSummary[]` shape

4. **Create comparison detail API** — `app/api/projects/[projectId]/comparisons/[comparisonId]/route.ts`
   - New endpoint for project-level detail fetch
   - Reuse enrichment logic from `getComparisonDetailForTicket` adapted to project access

### Phase B: Core UI (List + Inline Detail)

5. **Create project comparisons hook** — `hooks/use-project-comparisons.ts`
   - `useProjectComparisons(projectId, limit)` — list with pagination
   - `useProjectComparisonDetail(projectId, comparisonId)` — detail fetch

6. **Create comparisons page component** — `components/comparisons/comparisons-page.tsx`
   - Client component with `"use client"`
   - Manages selected comparison state
   - Renders list + inline detail layout
   - Handles empty state, loading, and error states

7. **Create comparison list item** — `components/comparisons/comparison-list-item.tsx`
   - Card showing winner ticket, score, participant count, summary, date, differentiator badges
   - Click handler to select/deselect for inline expansion
   - Active state styling when selected

8. **Create inline detail wrapper** — `components/comparisons/comparison-inline-detail.tsx`
   - Renders existing sub-components: HeroCard, ParticipantGrid, StatCards, UnifiedMetrics, DecisionPoints, ComplianceHeatmap
   - Loading skeleton while detail fetches
   - Collapse control

### Phase C: New Comparison Launcher

9. **Create VERIFY tickets API** — `app/api/projects/[projectId]/tickets/verify/route.ts`
   - Simple query: `prisma.ticket.findMany({ where: { projectId, stage: 'VERIFY' } })`

10. **Create launch comparison API** — `app/api/projects/[projectId]/comparisons/launch/route.ts`
    - Validate ticket IDs (exist, VERIFY stage, have branches, same project)
    - Create Job record, dispatch workflow
    - Return job ID for tracking

11. **Create launcher component** — `components/comparisons/new-comparison-launcher.tsx`
    - "New Comparison" button opens Dialog
    - Fetches VERIFY-stage tickets
    - Checkbox selection with min-2 validation
    - "Compare" button triggers mutation
    - Empty state when no VERIFY tickets

### Phase D: Polish + Responsive

12. **Add "Load More" pagination** to comparisons page
    - Track offset in state, append results on load more click
    - Show "Load More" button when `offset + limit < total`

13. **Responsive layout** — adapt list and detail for mobile
    - Stacked card layout on `< 768px`
    - Vertical stacking of detail sub-components on narrow viewports

### Phase E: Testing

14. **Integration tests** — `tests/integration/comparisons/comparisons-hub-api.test.ts`
    - Test rewritten GET endpoint (pagination, empty project, authorization)
    - Test comparison detail endpoint
    - Test launch endpoint (validation, dispatch)
    - Test VERIFY tickets endpoint

15. **Component tests**
    - `tests/unit/components/comparisons-page.test.tsx` — empty state, list rendering
    - `tests/unit/components/comparison-inline-detail.test.tsx` — expand/collapse
    - `tests/unit/components/new-comparison-launcher.test.tsx` — selection, validation

16. **E2E test** — `tests/e2e/comparisons-hub.spec.ts`
    - Responsive layout verification only

## Key Reuse Points

| Existing Asset | Reuse In |
|---------------|----------|
| `ComparisonHeroCard` | Inline detail |
| `ComparisonParticipantGrid` | Inline detail |
| `ComparisonStatCards` | Inline detail |
| `ComparisonUnifiedMetrics` | Inline detail |
| `ComparisonDecisionPoints` | Inline detail |
| `ComparisonComplianceHeatmap` | Inline detail |
| `toComparisonHistorySummary()` | Project list API |
| `buildComparisonDetail()` | Project detail API |
| `normalizeParticipantDetail()` | Project detail API |
| `dispatchAIBoardWorkflow()` | Launch comparison API |
| `verifyProjectAccess()` | All new endpoints |

## Risk Mitigation

- **FR-013 (no regression)**: The ticket-level Compare button is completely independent — different API endpoints, different hooks, different component tree. No shared state.
- **SC-005 (100% reuse)**: All 6 comparison sub-components are imported directly. No copy-paste or re-implementation.
- **Pending state**: Job polling at 2s intervals (existing pattern) detects completion. On completion, invalidate comparison list query to show new entry.
