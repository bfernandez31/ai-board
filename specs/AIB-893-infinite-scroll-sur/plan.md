# Implementation Plan: Infinite scroll on the SHIP column (replaces "Load more")

**Branch**: `AIB-893-infinite-scroll-sur` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-893-infinite-scroll-sur/spec.md`

## Summary

Replace the SHIP column's `Load more (N remaining)` button with automatic batch loading. An `IntersectionObserver` sentinel inside the column's own scroll viewport (300px prefetch margin) calls the existing offset-paginated endpoint (`?stage=SHIP&offset=N&limit=50`, unchanged). The `useLoadMoreShipTickets` hook gains a synchronous single-flight guard, id-based dedupe, exhaustion detection and an explicit-retry error state. The board's tickets query fn merges already-loaded SHIP tickets into polling refetches so they never disappear. Loading pauses during drag. No server, schema or API changes.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), React 18, Next.js 16 App Router (client components only)
**Primary Dependencies**: TanStack Query v5 (existing tickets cache), `@radix-ui/react-scroll-area` (via `components/ui/scroll-area.tsx`), `@dnd-kit/core`, lucide-react (`Loader2`), shadcn/ui `Button`; native `IntersectionObserver` via `lib/hooks/use-intersection-observer.ts`
**Storage**: N/A (PostgreSQL untouched; client cache only)
**Testing**: Vitest unit (hook with real `QueryClient`) + Vitest/RTL component test; existing integration test `tests/integration/tickets/ship-pagination.test.ts` covers the API contract
**Target Platform**: Desktop browsers + iOS Safari, Chrome Android (IO supported on all)
**Project Type**: Web application (Next.js monorepo layout: `app/`, `components/`, `lib/`)
**Performance Goals**: Next batch visible before user reaches end in ≥90% of loads at normal pace (SC-003) → 300px prefetch; no scroll-event handlers added
**Constraints**: ≤1 request in flight; 0 auto-retries after error; no scroll jump on append; drag & drop unaffected
**Scale/Scope**: Batches of 50; projects with hundreds of SHIP tickets; 4 source files modified, 1 hook file created, 2 test files created

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. TypeScript-first | All new hook/props explicitly typed; no `any` | PASS |
| II. Component-driven | shadcn `Button` for Retry, lucide spinner; new hook in `components/board/hooks/` justified by own state/effects (rule b); inline JSX for status rows (<40 lines) stays in `stage-column.tsx`; client component already `'use client'` | PASS |
| III. TDD | Tests extend existing domains; new files only for unrelated concerns (selection test vs scroll test; no hook test exists). RTL queries by role. IO mock targets global `IntersectionObserver` used by `lib/hooks/use-intersection-observer.ts`. No assertions inside conditionals | PASS |
| IV. Security | No new inputs/endpoints; reuses Zod-validated endpoint and `verifyProjectAccess` | PASS |
| V. Database integrity | No DB changes | PASS (N/A) |
| State management | TanStack Query cache remains the single source; no new state libs; local `useState`/`useRef` only | PASS |
| Error handling | Fetch errors thrown and surfaced in UI (`role="alert"` + Retry); no empty catch | PASS |
| Colors / Tailwind | Only semantic tokens (`text-muted-foreground`, `text-destructive`); all class strings static | PASS |
| Spec guardrails | Auto-resolved decisions present in spec (CONSERVATIVE) and honored | PASS |

**Post-design re-check**: PASS — design (research.md D1–D11) introduces no violations. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```
specs/AIB-893-infinite-scroll-sur/
├── plan.md              # This file
├── research.md          # Phase 0: existing files, patterns, decisions D1–D11
├── data-model.md        # Phase 1: client view state + transitions
├── contracts/
│   └── ship-infinite-scroll.md   # API (unchanged), hook + StageColumn contracts
└── tasks.md             # Phase 2 (/ai-board.tasks — not created here)
```

No `workflows/` directory: the spec has no internal processes.

### Source Code (repository root)

```
app/lib/hooks/queries/useTickets.ts              # MODIFY: merge in makeTicketsQueryFn; extend useLoadMoreShipTickets
components/board/hooks/use-infinite-scroll-trigger.ts   # CREATE: sentinel/IO trigger hook
components/board/stage-column.tsx                # MODIFY: remove button; sentinel + status/error rows
components/board/board-grid.tsx                  # MODIFY: pass hasMore/error/retry/paused props to SHIP
components/board/board.tsx                       # MODIFY: wire extended hook

tests/unit/use-load-more-ship-tickets.test.ts                       # CREATE
tests/unit/components/board/stage-column-infinite-scroll.test.tsx   # CREATE
tests/integration/tickets/ship-pagination.test.ts                   # KEEP (comment wording only)
```

**Structure Decision**: Existing Next.js web-app layout; feature confined to the board domain (`components/board/`) and the tickets query hook (`app/lib/hooks/queries/`).

## Implementation Phases

### Phase A — Data layer (`app/lib/hooks/queries/useTickets.ts`)

1. Export `SHIP_BATCH_SIZE = 50`.
2. **Polling merge** in `makeTicketsQueryFn` (research D7, pattern #4): after `await fetchTicketsFromAPI`, read `previous = queryClient.getQueryData<TicketWithVersion[]>(tickets key)`; compute `freshIds`, `freshShipCount`; if `freshShipCount < shipTotal`, append `previous.filter(t => t.stage === Stage.SHIP && !freshIds.has(t.id))`. Then `setQueryData(shipTotal)` as today.
3. **Extend `useLoadMoreShipTickets(projectId, shipTotal)`** (contract §2, research D3–D6):
   - `inFlightRef` set synchronously before `mutate`, cleared in `onSettled`.
   - `onSuccess(newTickets, { limit })`: functional `setQueryData` (pattern #1) appending only ids not in `old`; set `isExhausted` when `newTickets.length < limit` or `added === 0`; record `exhaustedAtTotalRef = shipTotal`.
   - Clear exhaustion when `shipTotal > exhaustedAtTotalRef.current` (effect on `shipTotal`).
   - `loadMore(offset)`: return early if in flight, `mutation.isError`, or exhausted.
   - `retry(offset)`: `mutation.reset()` then same path as `loadMore` (bypasses `isError` check).
   - Keep the thrown `Error('Failed to fetch more SHIP tickets: HTTP …')` (pattern #2).

### Phase B — Trigger hook (`components/board/hooks/use-infinite-scroll-trigger.ts`)

- Capture `rootRef.current` into state in a mount effect; call `useIntersectionObserver(sentinelRef, { root: rootEl, rootMargin: '0px 0px 300px 0px', threshold: 0 })` (pattern #6). Skip observing until `rootEl` is set (pass `enabled && rootEl` gate in the effect).
- `useEffect(() => { if (isNearBottom && enabled) onTrigger(); }, [isNearBottom, enabled, onTrigger])` → provides auto-fill (research D2).
- JSDoc on the exported hook (complex logic).

### Phase C — UI (`stage-column.tsx`, `board-grid.tsx`, `board.tsx`)

1. `stage-column.tsx`: delete the `Load more` `<Button>` block (lines 310–328) and the `ChevronDown` import if unused. Add new optional props (contract §5). When `onLoadMore && hasMore`: render sentinel `div` (`aria-hidden`, `data-testid="ship-load-more-sentinel"`); when `isLoadingMore`: `role="status" aria-live="polite"` row with `Loader2` + `sr-only` text; when `loadMoreError`: `role="alert"` row with message + shadcn `Button size="sm" variant="ghost"` "Retry" → `onRetryLoadMore`. Call `useInfiniteScrollTrigger({ rootRef: scrollViewportRef, sentinelRef, enabled: !!onLoadMore && hasMore && !isLoadingMore && !loadMoreError && !isLoadMorePaused, onTrigger: onLoadMore })`. Rows use fixed height to avoid jitter (D9). Existing `useEffect([tickets])` keeps mobile scroll-button visibility correct after appends (FR-014).
2. `board-grid.tsx`: replace `hasMoreShipTickets &&` spread with SHIP-only spread `{ totalCount: shipTotal, hasMore: hasMoreShipTickets, onLoadMore, isLoadingMore, loadMoreError, onRetryLoadMore, isLoadMorePaused: isDragging }`; add new props to `BoardGridProps`.
3. `board.tsx`: `useLoadMoreShipTickets(projectId, shipTotal)`; `hasMoreShipTickets = shipTicketCount < shipTotal && !isExhausted`; `handleLoadMoreShip = () => loadMore(shipTicketCount)`, `handleRetryLoadMoreShip = () => retry(shipTicketCount)`; update the comment "SHIP stage infinite scroll".

### Phase D — Tests (see Testing Strategy), then `bun run type-check`, `bun run lint`, `bun run test:unit`.

## Testing Strategy

Per constitution §III decision tree; "Existing Files" inventory in research.md.

| Requirement | Test type | File | Cases |
|-------------|-----------|------|-------|
| FR-004, FR-005, FR-006, FR-008, FR-010 | Vitest unit (hook, real `QueryClient`, `vi.stubGlobal('fetch')`, `renderHook` from `@testing-library/react`) | **Create** `tests/unit/use-load-more-ship-tickets.test.ts` | (1) appends batch, skipping ids already in cache; (2) two `loadMore` calls in the same tick → `fetch` called once; (3) batch of `< 50` → `isExhausted`, further `loadMore` no fetch; (4) empty batch → exhausted; (5) HTTP 500 → `isError`, subsequent `loadMore` no fetch; `retry` refetches same offset and clears error; (6) `makeTicketsQueryFn` refetch with capped SHIP keeps previously appended SHIP tickets and does not duplicate a ticket that now appears in VERIFY; (7) refetch with uncapped SHIP (`fresh.length >= total`) drops stale extras |
| FR-001, FR-002, FR-003, FR-008, FR-009, FR-011, FR-015 | Vitest + RTL component | **Create** `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` (harness from `stage-column-selection.test.tsx`) with a controllable `IntersectionObserver` stub (`vi.stubGlobal`) | (1) no button `/load more/i`; (2) sentinel intersecting → `onLoadMore` called once; (3) `isLoadingMore` → `getByRole('status')` with "Loading more tickets"; no extra call while loading; (4) `loadMoreError` → `getByRole('alert')`, `onLoadMore` not called on intersection, clicking "Retry" (userEvent) calls `onRetryLoadMore`; (5) `isLoadMorePaused` → no call; un-pausing while intersecting → call (drag end); (6) auto-fill: sentinel stays intersecting, `isLoadingMore` true→false rerender → `onLoadMore` called again; (7) `hasMore=false` → no sentinel, no call; (8) header shows `50/120` |
| API contract (offset, short/empty last page) | Integration | `tests/integration/tickets/ship-pagination.test.ts` | Already covered — keep; update header comment wording only |
| FR-012, FR-013, FR-014 (touch, scroll stability, mobile buttons) | Native browser behavior of IO + append-only rendering | No new E2E (expensive, ~5s each); covered by component tests (6) and manual check in quickstart below. Optional P3: one Playwright case in `tests/e2e/board/responsive.spec.ts` seeding 60 SHIP tickets and scrolling the SHIP viewport on a mobile viewport | — |
| FR-016 | Regression | Existing activity-feed tests untouched; no other column receives `onLoadMore` | — |

Test data follows `[e2e]` prefix rule for any integration/E2E seeding.

### Manual verification (quickstart)

1. `bun run dev`, seed a project with 120 SHIP tickets (Project 3+).
2. Desktop: scroll SHIP → `100/120`, then `120/120`; no button; DevTools Network shows one request at a time.
3. Block `/api/projects/*/tickets?stage=SHIP*` in DevTools → error row + Retry; unblock → Retry loads.
4. Tall window (zoom out to 33%) → batches auto-load until scrollbar appears.
5. Mobile emulation (iPhone, Pixel): touch-scroll and floating ↓ button load batches; horizontal swipe unchanged.
6. Wait 30s+ (job polling) → SHIP count unchanged; drag a VERIFY ticket to SHIP → appears once, total increments.

## Complexity Tracking

*No constitution violations — section intentionally empty.*
