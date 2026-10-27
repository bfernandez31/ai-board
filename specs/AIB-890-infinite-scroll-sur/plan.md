# Implementation Plan: Infinite scroll on the SHIP column (replaces "Load more")

**Branch**: `AIB-890-infinite-scroll-sur` | **Date**: 2026-10-27 | **Spec**: `specs/AIB-890-infinite-scroll-sur/spec.md`
**Input**: Feature specification from `specs/AIB-890-infinite-scroll-sur/spec.md`

## Summary

Remove the SHIP column "Load more (N remaining)" button and load the next 50-ticket batch automatically when a bottom sentinel enters a 300px pre-load margin of the column's own scroll viewport (IntersectionObserver rooted on the Radix `ScrollArea` viewport — works for wheel, keyboard focus and iOS/Android touch momentum). A rewritten client hook guarantees one request in flight (synchronous ref guard), id-based dedupe of every appended batch, a hard stop at `shipTotal` / empty batch / all-duplicate batch, and an `error` state that disables auto-loading until the user presses **Retry**. The board's background refresh is fixed to keep SHIP tickets loaded by scrolling (today it silently drops them). Loading is paused while a drag is active. No API, DB or batch-size change.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), React 18, Next.js 16 App Router
**Primary Dependencies**: TanStack Query v5 (existing tickets cache), `@radix-ui/react-scroll-area` via `components/ui/scroll-area.tsx`, `@dnd-kit/core`, `lucide-react` (`Loader2`), existing `lib/hooks/use-intersection-observer.ts`
**Storage**: N/A (PostgreSQL untouched; existing `GET /api/projects/:id/tickets?stage=SHIP&offset&limit`)
**Testing**: Vitest unit (pure helpers), Vitest + RTL component (happy-dom, mocked `IntersectionObserver`), Vitest integration (API pagination boundaries), one Playwright mobile scenario
**Target Platform**: Desktop browsers + iOS Safari / Chrome Android
**Project Type**: Web application (Next.js monolith)
**Performance Goals**: Next batch visible before the user reaches the last card in ≥90% of loads (300px pre-load ≈ 2–3 cards); zero extra requests after exhaustion
**Constraints**: ≤1 SHIP request in flight; no duplicates; no layout shift on append; no change to other columns or activity feed
**Scale/Scope**: Projects with hundreds of SHIP tickets; batch 50; 4 source files modified + 1 new pure helper module

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-first | ✅ | Typed `ShipLoadStatus`, helper signatures; no `any` |
| II. Component-driven | ✅ | shadcn `Button` for Retry, `Loader2`; no new UI lib; no sub-component extraction needed (load region is <40 lines JSX inside `StageColumn`, which stays ≈ 360 lines after removing the button block). Reuses existing `useIntersectionObserver` instead of adding a library. Semantic tokens only (`text-muted-foreground`, `text-destructive`), literal class strings |
| III. TDD / Testing Trophy | ✅ | Pure helpers → unit; component behavior → RTL; API boundaries → integration (extends existing file); only touch-scroll on mobile viewport → 1 E2E. Assertions unconditional |
| IV. Security | ✅ | No new endpoint/input; existing Zod validation + `verifyProjectAccess` unchanged |
| V. Database integrity | ✅ N/A | No schema/mutation change |
| Error handling | ✅ | Fetch failure throws → surfaced as `error` state with actionable copy + Retry; never swallowed |
| State management | ✅ | TanStack Query cache + `useState`/`useRef`; no new state lib. Read-only append ⇒ no optimistic update requirement |
| Spec guardrails | ✅ | Auto-resolved CONSERVATIVE decisions honored (300px margin, manual retry, id dedupe, batch 50, a11y live regions) |

**Gate result**: PASS (pre- and post-design). No violations → Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```
specs/AIB-890-infinite-scroll-sur/
├── plan.md              # This file
├── research.md          # Phase 0: decisions, Existing Files, Patterns to Follow
├── data-model.md        # Phase 1: client state + helpers
├── contracts/
│   └── ship-column-ui.md  # Hook/component/DOM contract (API unchanged)
└── tasks.md             # Phase 2 (/ai-board.tasks — not created here)
```

No `workflows/` — the spec has no internal processes.

### Source Code (repository root)

```
lib/tickets/
└── ship-pagination.ts                  # NEW: SHIP_BATCH_SIZE, appendShipBatch, mergeRefreshedTickets

app/lib/hooks/queries/
└── useTickets.ts                       # MODIFY: useShipInfiniteLoad replaces useLoadMoreShipTickets;
                                        #         makeTicketsQueryFn merges with previous cache

components/board/
├── stage-column.tsx                    # MODIFY: remove Load more Button; sentinel + status/alert region
├── board-grid.tsx                      # MODIFY: thread shipLoad + isLoadPaused={isDragging}
└── board.tsx                           # MODIFY: use useShipInfiniteLoad

tests/unit/tickets/ship-pagination.test.ts                       # NEW
tests/unit/components/board/stage-column-infinite-scroll.test.tsx # NEW
tests/integration/tickets/ship-pagination.test.ts                # EXTEND
tests/e2e/board/responsive.spec.ts                               # EXTEND (1 mobile scenario)
```

**Structure Decision**: Existing Next.js monolith layout. Pure logic goes in `lib/tickets/` (domain folder already exists), hook stays in its current module, UI changes stay in `components/board/`.

## Implementation Phases

### Phase A — Pure helpers (`lib/tickets/ship-pagination.ts`)
1. `SHIP_BATCH_SIZE = 50` (also used as default in hook; SSR `getTicketsByStage(projectId, shipLimit = 50)` left untouched).
2. `appendShipBatch(current, batch)` — build `Set` of current ids, filter batch, return `{ tickets: [...current, ...added], addedCount }` (research D4).
3. `mergeRefreshedTickets(previous, fresh, shipTotal)` — research D7. Fresh is authoritative; append previous `stage === 'SHIP'` tickets whose id ∉ fresh ids, in previous order, while fresh SHIP count + retained < `shipTotal`.

### Phase B — Data hook (`app/lib/hooks/queries/useTickets.ts`)
1. `makeTicketsQueryFn`: after `fetchTicketsFromAPI`, `const previous = queryClient.getQueryData<TicketWithVersion[]>(queryKeys.projects.tickets(projectId))`; return `mergeRefreshedTickets(previous, tickets, shipTotal)`. Keep the `setQueryData(shipTotal)` call (pattern `useTickets.ts:24-26`).
2. Replace `useLoadMoreShipTickets` with `useShipInfiniteLoad(projectId, loadedShipCount, shipTotal)`:
   - `inFlightRef = useRef(false)`, `const [status, setStatus] = useState<ShipLoadStatus>('idle')`, `const [exhausted, setExhausted] = useState(false)`; `useEffect(() => setExhausted(false), [shipTotal])`.
   - `fetchBatch` keeps the existing fetch + `throw` on `!response.ok` (pattern `useTickets.ts:92-98`).
   - `load = async () => { if (inFlightRef.current) return; inFlightRef.current = true; setStatus('loading'); try { const batch = await fetchBatch(loadedShipCountRef.current); let added = 0; queryClient.setQueryData(key, old => { const r = appendShipBatch(old ?? [], batch); added = r.addedCount; return r.tickets; }); if (batch.length === 0 || added === 0) setExhausted(true); setStatus('idle'); } catch { setStatus('error'); } finally { inFlightRef.current = false; } }` — the catch converts the error to visible UI state (not swallowed); log with `console.error` including `projectId` and offset.
   - `loadMore` = no-op unless `status !== 'error'` ∧ `hasMore`; `retry` = `load()` only from `error`.
   - Use a ref for `loadedShipCount` so the callback is stable and always reads the latest offset.
   - Ignore results if unmounted (`mountedRef`) to satisfy "leaving the board surfaces no error".
3. Remove the old export (only consumer is `board.tsx`).

### Phase C — Column UI (`components/board/stage-column.tsx`)
1. Remove `Button` "Load more" block (L310-328) and the `ChevronDown` import if unused; keep `Button` import (Retry).
2. Props: `hasMore`, `loadStatus`, `onLoadMore`, `onRetryLoad`, `isLoadPaused` (contract table). Keep `totalCount`; header shows `${ticketCount}/${totalCount}` when `totalCount > ticketCount` (unchanged logic, `board.tsx` passes `Math.max(shipTotal, count)`).
3. Hold the viewport element in state: `const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null); useEffect(() => setViewportEl(scrollViewportRef.current), [])` — keeps `scrollViewportRef` for the existing mobile buttons (pattern: `stage-column.tsx:185-236`).
4. `sentinelRef` + `useIntersectionObserver(sentinelRef, { root: viewportEl, rootMargin: '0px 0px 300px 0px' })` (only meaningful when `onLoadMore` provided); trigger effect per contract (research D1/D2/D8).
5. Bottom region (`min-h-10 flex items-center justify-center`), only when `onLoadMore` defined and tickets exist: sentinel when `hasMore && loadStatus !== 'error'`; `role="status" aria-live="polite"` spinner when loading; `role="alert"` + Retry button when error.
6. Empty SHIP: existing "No tickets" state, no sentinel (edge case "zero tickets").

### Phase D — Wiring (`board.tsx`, `board-grid.tsx`)
1. `board.tsx` L54-59: `const shipLoad = useShipInfiniteLoad(projectId, shipTicketCount, shipTotal)`; pass `shipLoad` and `shipTotal={Math.max(shipTotal, shipTicketCount)}`.
2. `board-grid.tsx` L29-32/L138-142: replace props with `shipLoad`; for SHIP pass `totalCount`, `hasMore`, `loadStatus`, `onLoadMore`, `onRetryLoad`, `isLoadPaused={isDragging}` **always** (not only when `hasMore`, so the error state can render after the last partial page).
3. Other stages receive none of these props → unchanged (FR-016). Activity feed untouched.

### Phase E — Tests (see Testing Strategy)

### Phase F — Quality gates
`bun run type-check`, `bun run lint`, `bun run test:unit`, `bun run test:integration tests/integration/tickets/ship-pagination.test.ts`, targeted Playwright spec.

## Testing Strategy

Per constitution §III decision tree, using the Existing Files inventory (research.md).

| Layer | File | Action | Scenarios |
|-------|------|--------|-----------|
| Unit (pure) | `tests/unit/tickets/ship-pagination.test.ts` | NEW (no existing helper tests) | `appendShipBatch`: appends new, drops ids present in any stage, `addedCount` 0 when all dupes; `mergeRefreshedTickets`: retains scrolled-in SHIP tickets, fresh copy wins (stage moved), caps at `shipTotal`, `previous` undefined → fresh |
| Component (RTL) | `tests/unit/components/board/stage-column-infinite-scroll.test.tsx` | NEW (selection test file is a different concern) | Mock `IntersectionObserver` globally with a controllable `trigger(isIntersecting)`; render `StageColumn` (SHIP) in `DndContext` via `renderWithProviders` (pattern `stage-column-selection.test.tsx`). Cases: no `/load more/i` button; sentinel visible → `onLoadMore` called once; repeated intersections while `loadStatus='loading'` → no extra call; `role="status"` shown while loading; `hasMore=false` → no sentinel/no call; `loadStatus='error'` → `role="alert"` + Retry calls `onRetryLoad`, intersection does not call `onLoadMore`; `isLoadPaused` → no call, unpausing while visible → call; tickets length grows while sentinel still visible → next call (fill-tall-column); non-SHIP column renders no load region |
| Component (hook) | same file, `describe('useShipInfiniteLoad')` with `renderHook` + mocked `fetch` | — | Two `loadMore()` in same tick → `fetch` called once; batch containing existing ids → not duplicated in cache; empty batch → `hasMore=false`, no further fetch; failure → `status='error'`, `loadMore()` no-op, `retry()` refetches same offset and resumes; stop at total |
| Integration | `tests/integration/tickets/ship-pagination.test.ts` | EXTEND | `offset == total` (exact multiple) → `[]`; ticket moved into SHIP between page 1 and page 2 shifts offset → page 2 overlaps page 1 (documents server behavior that client dedupe handles) |
| E2E | `tests/e2e/board/responsive.spec.ts` | EXTEND (1 test) | Mobile viewport, project seeded with >50 SHIP tickets (`[e2e]` prefix), navigate to SHIP, scroll inside column → card count grows beyond 50, no "Load more" button, floating scroll buttons still visible |

Drag & drop pause is covered at component level (`isLoadPaused`); existing `tests/e2e/board/drag-drop.spec.ts` guards drag regressions unchanged.

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Refresh drops loaded pages → reload loop | `mergeRefreshedTickets` (D7) |
| Offset repeats forever when batch is all duplicates | `exhausted` on `addedCount === 0`, reset when `shipTotal` changes (D5) |
| Observer root not mounted on first render | viewport element held in state → hook effect re-subscribes (Pattern 5) |
| Stale scrolled-in ticket after it was closed elsewhere | Capped at `shipTotal`; reconciles on reload. Accepted trade-off |

## Complexity Tracking

No constitution violations — table intentionally empty.
