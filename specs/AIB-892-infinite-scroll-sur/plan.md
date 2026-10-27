# Implementation Plan: Infinite Scroll on the SHIP Column

**Branch**: `AIB-892-infinite-scroll-sur` | **Date**: 2026-10-27 | **Spec**: `specs/AIB-892-infinite-scroll-sur/spec.md`

## Summary

Replace the SHIP column "Load more" button with automatic loading driven by an `IntersectionObserver` sentinel rooted on the column's Radix scroll viewport (≈1 viewport pre-load margin). Reuse the existing offset pagination endpoint and `useLoadMoreShipTickets` mutation; add concurrency guard, id-dedupe, error + Retry state, and make board refetches preserve already-loaded SHIP tickets via an optional `shipLimit` API param. See `research.md` for decisions.

## Technical Context

**Language/Version**: TypeScript 5.9 strict, Next.js 16 App Router, React 18
**Primary Dependencies**: TanStack Query v5, Radix ScrollArea (shadcn), lucide-react, dnd-kit (no new deps)
**Storage**: PostgreSQL via Prisma — no schema change
**Testing**: Vitest unit (RTL) + integration; Playwright only for mobile viewport (optional)
**Target Platform**: Browser incl. iOS Safari and Chrome Android
**Project Type**: Web application
**Performance Goals**: ≤1 in-flight batch; no scroll jump; 0 requests once exhausted
**Constraints**: Other columns and activity feed unchanged; semantic Tailwind tokens, static class strings
**Scale/Scope**: 5 source files + 3 test files; no NEEDS CLARIFICATION remaining

## Constitution Check

| Gate | Status |
|------|--------|
| I. TypeScript-first (strict, no `any`, explicit types) | PASS |
| II. Component-driven (shadcn/ui + Radix only, no new UI/state libs; React Query for state) | PASS — native `IntersectionObserver`, no dependency |
| III. Test-driven (extend existing tests; RTL for component, integration for API; E2E only if browser required) | PASS — see Testing Strategy |
| IV. Security-first (zod validation of new query param, auth unchanged) | PASS — `shipLimit` validated and capped at 500 |
| V. Database integrity (no schema change) | PASS / N/A |
| CLAUDE.md: no hardcoded colors, no dynamic Tailwind classes | PASS |

Post-design re-check: PASS, no violations; Complexity Tracking not needed.

## Project Structure

### Documentation
```
specs/AIB-892-infinite-scroll-sur/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
└── contracts/api.md
```

### Source Code (files touched)
```
app/api/projects/[projectId]/tickets/route.ts      # shipLimit param on default response
app/lib/hooks/queries/useTickets.ts                # dedupe, in-flight guard, isError/reset, preserve loaded SHIP on refetch
components/board/stage-column.tsx                  # remove button; sentinel + observer + spinner + error/Retry
components/board/board-grid.tsx                    # pass loadMoreError
components/board/board.tsx                         # pass isError from hook

tests/integration/tickets/ship-pagination.test.ts  # extend
tests/unit/components/board/stage-column-infinite-scroll.test.tsx  # new
tests/unit/hooks/use-load-more-ship-tickets.test.tsx               # new
tests/e2e/board/responsive.spec.ts                 # optional mobile scroll case
```

**Structure Decision**: Existing Next.js layout; changes confined to board components, ticket query hook, and one API route.

## Implementation Phases

### Phase A — API + data layer
1. `route.ts`: extend zod schema with `shipLimit: z.coerce.number().int().min(1).max(500).optional()`; default branch calls `getTicketsByStage(projectId, shipLimit ?? 50)`. Invalid → 400 like other params.
2. `useTickets.ts`:
   - `fetchTicketsFromAPI(projectId, shipLimit)` appends `?shipLimit=` when > 50; `makeTicketsQueryFn` computes `max(50, cachedShipCount)` from `queryClient.getQueryData(tickets(projectId))` (FR-008).
   - `useLoadMoreShipTickets`: ref in-flight guard (follows mutation-pending pattern, FR-004); `onSuccess` merges with id-dedupe (FR-005); return `isError`, `reset`.

### Phase B — Column UI
3. `stage-column.tsx`: delete the Load more `Button` block (and unused `Button`/`ChevronDown` imports if unused). Add `loadMoreError` prop. After tickets render, when `onLoadMore`: sentinel `div` (`data-testid="ship-load-sentinel"`, `aria-hidden`), spinner row (`role="status"`), error row (`role="alert"` + Retry `Button`, min-height reserved).
4. Observer effect: `new IntersectionObserver(cb, { root: scrollViewportRef.current, rootMargin: '0px 0px 100% 0px' })`; on intersect and `!isLoadingMore && !loadMoreError` call `onLoadMore()`. Deps include `tickets.length`, `isLoadingMore`, `loadMoreError`, `onLoadMore` so it re-observes after each batch → fills tall screens/resizes (FR-010). Disconnect on cleanup; not created when no `onLoadMore` (exhausted) → FR-006.
5. `board-grid.tsx` / `board.tsx`: thread `loadMoreError={isErrorMoreShip}`; keep `hasMoreShipTickets` gate; Retry wired to `handleLoadMoreShip` (calls `reset` then load).

### Phase C — Tests & verification
6. Tests per below; run `bun run type-check`, `bun run lint`, targeted `bun run test:unit <file>` and `bun run test:integration tests/integration/tickets/ship-pagination.test.ts`.

## Testing Strategy

| Requirement | Test | Type |
|-------------|------|------|
| FR-001/003/006/007 button absent, spinner, no sentinel when exhausted, error + Retry | `stage-column-infinite-scroll.test.tsx` (mock `IntersectionObserver`, trigger callback; render in `DndContext` as in `stage-column-selection.test.tsx`; `renderWithProviders`; `userEvent` for Retry) | RTL unit (new — existing stage-column test is bulk-selection only) |
| FR-002/010 fires on intersect and re-fires after batch while still intersecting; FR-004 no call while `isLoadingMore`; error pauses | same file | RTL unit |
| FR-004/005/008 dedupe, in-flight guard, error state, refetch preserves >50 SHIP | `use-load-more-ship-tickets.test.tsx` (mock `fetch`, test QueryClient) | hook unit (new — no existing hook tests for `useTickets`) |
| API `shipLimit` (default 50, honors N, 400 on 0/501, `_shipTotal` accurate), non-overlapping consecutive offset pages | extend `ship-pagination.test.ts` | integration |
| FR-011/012/013 touch scroll, floating buttons, horizontal swipe | optional case in `tests/e2e/board/responsive.spec.ts` (mobile viewport; real iOS/Android validated manually) | E2E |
| FR-014 | no change to activity feed; existing tests must still pass | regression |

All assertions unconditional (constitution III). Test data uses `[e2e]` prefixes.

## Risks
- iOS Safari IntersectionObserver with nested scroller: mitigated by explicit `root`; verify manually.
- Offset drift when tickets move into SHIP between pages: handled by id-dedupe; counter derives from server `_shipTotal`.
