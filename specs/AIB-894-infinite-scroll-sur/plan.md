# Implementation Plan: Infinite scroll on the SHIP column (replaces Load more)

**Branch**: `AIB-894-infinite-scroll-sur` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-894-infinite-scroll-sur/spec.md`

## Summary

Replace the SHIP column's "Load more (N remaining)" button with an IntersectionObserver-driven sentinel inside the column's own Radix scroll viewport (300px pre-load margin). The existing offset endpoint and flat `projects.tickets` cache are kept; the load-more hook gains a synchronous single-flight guard, id-based dedupe, an error state that pauses auto-loading until Retry, and an empty-batch stop. Two small, backward-compatible server fixes are needed for correctness: a deterministic `id DESC` tie-breaker on SHIP ordering, and an optional `shipLimit` query param so background refetches keep every batch the user already loaded (today any refetch silently drops them). Loading pauses during drag and drop. Details: [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22, Next.js 16 App Router, React 18
**Primary Dependencies**: TanStack Query v5 (`useMutation`, `setQueryData`), `@radix-ui/react-scroll-area` (via shadcn `ScrollArea`), `@dnd-kit/core`, lucide-react, native `IntersectionObserver` (no new dependency)
**Storage**: PostgreSQL via Prisma. No schema change, only `orderBy` tweaks.
**Testing**: Vitest unit (pure helpers + hook), Vitest + RTL component, Vitest integration (API)
**Target Platform**: Modern desktop browsers + iOS Safari / Chrome Android
**Project Type**: Web (Next.js monolith)
**Performance Goals**: Next batch visible before the user reaches the end in ≥ 90% of normal-pace scrolls (SC-003); no scroll jank (observer-based, no scroll handlers added)
**Constraints**: ≤ 1 batch request in flight; no duplicates; no auto-retry; no layout shift on append; batch size stays 50
**Scale/Scope**: 4 source files modified, 2 created; 1 integration test extended, 3 unit/component test files created

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-first | ✅ | Typed props/return shapes in `contracts/ship-column-ui.md`; no `any` |
| II. Component-driven | ✅ | shadcn `Button` for Retry, `lucide` spinner; footer extracted because it owns an effect and `stage-column.tsx` is 364 lines (rule II-extract (b)+(c)); client component already |
| III. Tests | ✅ | Searched existing tests first: extend `tests/integration/tickets/ship-pagination.test.ts`; new files only where no coverage exists (see Testing Strategy). No E2E: no browser-only requirement can't be covered by RTL + IO stub |
| IV. Security | ✅ | New `shipLimit` validated with Zod (`int`, `min 1`, `max 1000`); same `verifyProjectAccess` path; no new data exposed |
| V. Database integrity | ✅ | No schema/migration; read-only query change |
| State management | ✅ | TanStack Query + React hooks only. The load-more mutation reads, it doesn't change server state, so the optimistic-update requirement doesn't apply |
| Error handling | ✅ | Fetch errors surface as UI error + Retry (never swallowed); route keeps existing try/catch + structured errors |
| Colors / Tailwind | ✅ | Semantic tokens only; static class strings |

**Post-design re-check**: ✅ No violations. Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```
specs/AIB-894-infinite-scroll-sur/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── tickets-api.md
│   └── ship-column-ui.md
└── tasks.md             # created by /ai-board.tasks
```

### Source Code (repository root)

```
lib/
├── tickets/ship-pagination.ts          # NEW: SHIP_BATCH_SIZE, SHIP_REFETCH_MAX, appendUniqueTickets, computeShipRefetchLimit, countShipTickets
└── db/tickets.ts                       # MODIFY: id DESC tie-breaker; use SHIP_BATCH_SIZE
app/
├── api/projects/[projectId]/tickets/route.ts   # MODIFY: optional shipLimit on default branch
└── lib/hooks/queries/useTickets.ts             # MODIFY: refetch with shipLimit; load-more guard/dedupe/error/empty-stop
components/board/
├── ship-infinite-scroll-footer.tsx     # NEW: sentinel + observer + spinner/error/retry
├── stage-column.tsx                    # MODIFY: remove Load more button, render footer for SHIP
├── board-grid.tsx                      # MODIFY: pass shipInfiniteScroll (paused = isDragging)
└── board.tsx                           # MODIFY: wire new hook shape
tests/
├── integration/tickets/ship-pagination.test.ts            # EXTEND
├── unit/ship-pagination.test.ts                           # NEW
├── unit/use-load-more-ship-tickets.test.ts                # NEW
└── unit/components/board/stage-column-infinite-scroll.test.tsx  # NEW
```

**Structure Decision**: Existing Next.js monolith layout; new files sit beside their closest peers (`lib/tickets/`, `components/board/`).

## Implementation Phases

### Phase A: Shared helpers + server correctness (FR-005, FR-006, FR-010)

1. **Create `lib/tickets/ship-pagination.ts`** per `data-model.md`. Import `TicketWithVersion` type only (no Prisma runtime import) so the client hook can use it.
2. **`lib/db/tickets.ts`**:
   - `getTicketsByStage` (L204) default `shipLimit = SHIP_BATCH_SIZE`; SHIP `orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]` (L218).
   - `getMoreShipTickets` (L253) default `limit = SHIP_BATCH_SIZE`; same `orderBy` (L261).
   - `getTicketsWithJobs` (L657, used for board page SSR): default `shipLimit = SHIP_BATCH_SIZE`, and the same `orderBy` on its SHIP query (L677) so the first page from SSR matches the API order.
3. **`app/api/projects/[projectId]/tickets/route.ts`**:
   - Add `shipLimit: z.coerce.number().int().min(1).max(SHIP_REFETCH_MAX).optional()` to `ticketFiltersSchema` (L46), read `searchParams.get('shipLimit')`. Follows the existing Zod + `VALIDATION_ERROR` pattern (research Pattern 5).
   - Default branch (L83): `getTicketsByStage(projectId, shipLimit ?? SHIP_BATCH_SIZE)`. Do **not** add `shipLimit` to the filtered-branch condition at L72 (Pattern 6).
   - Offset branch (L67): `limitParam ?? SHIP_BATCH_SIZE`.

### Phase B: Data hook (FR-004, FR-005, FR-006, FR-008, FR-010)

File: `app/lib/hooks/queries/useTickets.ts`

1. `fetchTicketsFromAPI(projectId, shipLimit)` → `fetch(\`/api/projects/${projectId}/tickets?shipLimit=${shipLimit}\`)`.
2. `makeTicketsQueryFn`: before fetching, `const loaded = countShipTickets(queryClient.getQueryData(queryKeys.projects.tickets(projectId)))`; pass `computeShipRefetchLimit(loaded)` (research D8). Keep writing `_shipTotal` to the `shipTotal` cache as today.
3. `useLoadMoreShipTickets(projectId)`:
   - `inFlightRef = useRef(false)`; `loadMore = useCallback(() => { if (inFlightRef.current) return; inFlightRef.current = true; const offset = countShipTickets(queryClient.getQueryData(...)); mutation.mutate({ offset }); }, …)` (D3).
   - `mutationFn` unchanged except `limit = SHIP_BATCH_SIZE`; still throws on `!response.ok` (Pattern 4).
   - `onSuccess(newTickets)`: `setQueryData(key, (old) => appendUniqueTickets(old ?? [], newTickets).tickets)` and compute `addedCount` inside the updater (Pattern 3). If `addedCount === 0` → `setQueryData(shipTotal key, countShipTickets(updated))` (D6).
   - `onSettled`: `inFlightRef.current = false`.
   - Return `{ loadMore, isLoading: mutation.isPending, error: mutation.error }`.
   - Use a stable reference to `mutation.mutate` (not the `mutation` object) in `useCallback` deps to avoid recreating `loadMore` every render (which would recreate the observer).

### Phase C: UI (FR-001, FR-002, FR-003, FR-008, FR-009, FR-011, FR-013, FR-014, FR-015)

1. **Create `components/board/ship-infinite-scroll-footer.tsx`** (`'use client'`) per `contracts/ship-column-ui.md`:
   - Observer effect modeled on `stage-column.tsx:228-236` (create in effect, `disconnect` in cleanup). `root: rootRef.current`, `rootMargin: '0px 0px 300px 0px'`. Deps: `[hasMore, isLoading, error, paused, ticketCount, onLoadMore, rootRef]` → re-observation emits an initial entry, which implements fill-tall-columns (D2).
   - Guard `typeof IntersectionObserver === 'undefined'` → no-op (SSR/old browsers).
   - Footer wrapper `aria-live="polite"`, `min-h-8` to avoid shifts (D11). Spinner `Loader2 h-4 w-4 animate-spin text-muted-foreground` + `sr-only` text inside `role="status"`. Error: `role="alert"`, `text-xs text-destructive`, shadcn `Button variant="ghost" size="sm"` "Retry".
2. **`components/board/stage-column.tsx`**:
   - Replace props `onLoadMore`/`isLoadingMore` with `shipInfiniteScroll?` (contract). Remove the Load more `<Button>` block (L310-328) and now-unused imports (`ChevronDown`, `Button` if unused).
   - Render `<ShipInfiniteScrollFooter rootRef={scrollViewportRef} ticketCount={ticketCount} {...shipInfiniteScroll} />` after the ticket map when `shipInfiniteScroll` is provided.
   - Header badge logic (L263-265) unchanged (FR-007).
   - Mobile buttons: `checkScrollPosition` already re-runs on `tickets` change (L223-225), so "scroll down" stays visible as batches append (FR-014). No change.
3. **`components/board/board-grid.tsx`** (L29-32, L138-142): replace `hasMoreShipTickets/onLoadMoreShip/isLoadingMoreShip` props with `shipLoadState: { hasMore, isLoading, error, onLoadMore }`. For SHIP: always pass `totalCount: shipTotal` and `shipInfiniteScroll: { ...shipLoadState, paused: isDragging }` (D9).
4. **`components/board/board.tsx`** (L54-59, L341-344): `const { loadMore, isLoading, error } = useLoadMoreShipTickets(projectId)`; `hasMore = shipTicketCount < shipTotal`; memoize `shipLoadState` with `useMemo`. Delete `handleLoadMoreShip`.

### Phase D: Cleanup & checks

- `grep -rn "Load more" components/board` → zero hits. Activity feed untouched (FR-016).
- `bun run type-check`, `bun run lint`, run test files below.

## Testing Strategy

Per constitution §III decision tree; extend before creating.

| Test file | Type | Cases |
|-----------|------|-------|
| `tests/integration/tickets/ship-pagination.test.ts` (**extend**) | Integration | (1) default GET with `shipLimit=75` returns 75 SHIP + correct `_shipTotal`; (2) no `shipLimit` → 50 (regression); (3) `shipLimit=0`, `1001`, `abc` → 400 `VALIDATION_ERROR`; (4) tickets with identical `updatedAt` (set via Prisma): `offset=0,limit=50` ∪ `offset=50,limit=50` has no duplicate ids and covers all; (5) order is `updatedAt desc, id desc` |
| `tests/unit/ship-pagination.test.ts` (**new**, pure) | Unit | `appendUniqueTickets` drops ids already present (any stage), preserves order, reports `addedCount`; `computeShipRefetchLimit` (0→50, 120→120, 5000→1000); `countShipTickets` (undefined→0, mixed stages) |
| `tests/unit/use-load-more-ship-tickets.test.ts` (**new**, `renderHook` + QueryClient, pattern from `tests/unit/useJobPolling.test.ts`; mock global `fetch`) | Unit (hook) | two synchronous `loadMore()` calls → `fetch` called once (FR-004); offset = SHIP count in cache; duplicate ids not appended (FR-005); empty batch sets `shipTotal` = loaded count (FR-006); failure → `error` set, cache unchanged; next `loadMore()` succeeds and clears error (FR-008); refetch queryFn requests `shipLimit` = loaded count when > 50 (FR-010) |
| `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` (**new**; render pattern from `stage-column-selection.test.tsx`; IO stub via `vi.stubGlobal`, D13) | Component (RTL) | no "Load more" button (`queryByRole('button', { name: /load more/i })` null) (FR-001); intersect → `onLoadMore` once; intersect while `isLoading` / `error` / `paused` → not called (FR-004/008/011); `hasMore=false` → no sentinel, no status (FR-006); loading → `getByRole('status')` (FR-003/015); error → `getByRole('alert')` + `userEvent.click(getByRole('button', { name: 'Retry' }))` calls `onLoadMore` (FR-008); header badge shows `50/120` (FR-007); observer `root` is the viewport element and `rootMargin` bottom = 300px (FR-002) |

Not covered by automated tests (manual, see `quickstart.md`): real touch scrolling on iOS/Android (FR-012), visual scroll stability (FR-013). E2E skipped: drag pause is covered at the prop level, and IntersectionObserver geometry is browser-native.

## Complexity Tracking

None. No constitution violations.
