# Quickstart: Ticket Comparison Dashboard

## Goal

Implement a structured comparison dashboard without breaking the existing `/compare` markdown workflow.

## Build Order

1. Update `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`
   - Add comparison persistence models and indexes.
   - Generate a Prisma migration.
   - Run `bunx prisma generate` after schema changes.

2. Add persistence and query helpers under `/home/runner/work/ai-board/ai-board/target/lib/comparison/`
   - Create a persistence mapper that converts current comparison output into Prisma create inputs.
   - Create a detail-query helper that loads saved comparison data plus live ticket/job enrichments.

3. Replace ticket comparison APIs
   - Update `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts`
   - Update `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/check/route.ts`
   - Replace the legacy filename detail route with `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/[comparisonId]/route.ts`
   - Use `verifyTicketAccess()` and Zod validation on all route params and query values.

4. Update `/compare` write path
   - Extend the current generator flow so one successful run writes markdown and persists one structured record.
   - Keep both outputs derived from the same in-memory result to satisfy FR-015.

5. Refactor the frontend comparison viewer
   - Update `/home/runner/work/ai-board/ai-board/target/hooks/use-comparisons.ts` to fetch structured history/detail payloads.
   - Split `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-viewer.tsx` into small dashboard sections for ranking, metrics, decision points, and compliance.
   - Keep the existing ticket detail entry point in `/home/runner/work/ai-board/ai-board/target/components/board/ticket-detail-modal.tsx`.

## Test-First Execution Plan

Search existing tests in `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/` and `/home/runner/work/ai-board/ai-board/target/tests/unit/components/` before adding files.

### User Story 1

- Add integration coverage for ticket history and detail authorization.
- Add integration coverage that the same comparison is returned from every participating ticket.
- Add a component test that the ticket modal shows the comparison entry point and opens the latest saved comparison.

### User Story 2

- Add integration coverage for the structured detail payload, including missing live enrichments.
- Add component coverage for:
  - ranking display
  - metrics highlighting
  - collapsible decision points
  - compliance grid rendering

### User Story 3

- Add integration coverage for structured persistence triggered by `/compare`.
- Add integration coverage for multiple historical comparison runs for the same ticket.
- Add unit coverage for pure mapping helpers that convert nullable enrichments to dashboard display states.

## Validation Commands

Run these during BUILD and before commit:

```bash
bun run test:unit -- tests/unit/comparison/comparison-record.test.ts tests/unit/components/comparison-ranking.test.tsx tests/unit/components/comparison-dashboard-sections.test.tsx tests/unit/components/ticket-detail-modal.test.tsx tests/unit/components/markdown-table-rendering.test.tsx
VITEST_INTEGRATION=1 bun vitest run tests/integration/comparisons/comparison-api.test.ts tests/integration/comparisons/comparison-detail-route.test.ts tests/integration/comparisons/comparison-dashboard-api.test.ts tests/integration/comparisons/comparison-persistence.test.ts tests/integration/comparisons/comparison-history-persistence.test.ts
bun run type-check
bun run lint
```

If the Prisma schema changes:

```bash
bunx prisma generate
```

## Acceptance Checks

1. Run `/compare` for a set of tickets and verify one markdown artifact and one structured record are created for the same run.
2. Open each participating ticket and verify the comparison appears in history from all of them.
3. Open the dashboard and verify ranking, recommendation, metrics, decision points, and compliance all render from the structured detail payload without markdown parsing.
4. Remove or omit optional telemetry/quality data in test fixtures and verify the UI labels them `pending` or `unavailable`.
5. Create multiple comparison runs with overlapping ticket sets and verify the history list distinguishes them by time, participants, and winner.
