# Quickstart: Comparisons Hub Page With Project List, Inline Detail, and VERIFY Launch

## Implementation Order

1. Replace the legacy project comparisons list route with Prisma-backed `ComparisonRecord` pagination and add a project-scoped detail route.
2. Add a candidate route and launch route that validate selected VERIFY tickets, create the same `Comment` + `Job` pattern as the current `@ai-board /compare` flow, and dispatch the existing AI-BOARD workflow.
3. Build `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/comparisons/page.tsx` with a paginated summary list, inline comparison viewer, launch CTA, and pending/error/empty states.
4. Add the `Comparisons` navigation destination and extend `/home/runner/work/ai-board/ai-board/target/hooks/use-comparisons.ts` with project-scoped queries plus launch mutation invalidation.
5. Add integration tests for list/detail/launch behavior and component tests for selection, inline detail switching, and launch validation states.

## Key Reuse Points

- Reuse comparison normalization from `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-detail.ts` instead of building a second detail formatter.
- Reuse workflow dispatch behavior from `/home/runner/work/ai-board/ai-board/target/app/lib/workflows/dispatch-ai-board.ts`.
- Reuse the compare command contract by generating `@ai-board /compare #KEY ...` comment content against a deterministic selected source ticket.
- Reuse existing comparison dashboard components from `/home/runner/work/ai-board/ai-board/target/components/comparison/`.

## Verification Commands

Run from `/home/runner/work/ai-board/ai-board/target`:

```bash
bun run test:unit
bun run test:integration
bun run type-check
bun run lint
```

## Expected Outcomes

- `/projects/[projectId]/comparisons` is reachable from project navigation.
- Saved comparisons render newest-first with pagination and inline detail.
- Launching from two or more VERIFY tickets produces a visible pending state and resolves into refreshed history.
- Ticket-detail comparison history and detail routes continue to behave exactly as before.
