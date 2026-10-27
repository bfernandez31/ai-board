# Quickstart: verify AIB-894 locally

1. `bun run dev`, open a project board (project id ≥ 3) with > 50 SHIP tickets (seed: move `[e2e]` tickets to SHIP via Prisma Studio or the integration helper in `tests/integration/tickets/ship-pagination.test.ts`).
2. Desktop: scroll the SHIP column — next batch appears ~300px before the end; spinner at bottom while loading; header shows `100/123` etc.; no "Load more" button.
3. DevTools → Network → Offline, scroll to the end → "Couldn't load more shipped tickets." + Retry; scrolling sends no request. Go online, click Retry → tickets append, auto-load resumes.
4. Tall viewport (zoom out to 33%): batches load one after another until the column scrolls or all are loaded.
5. Load 2+ batches, wait for a job to finish (or refocus the tab) → loaded tickets remain, counter unchanged.
6. Drag a VERIFY ticket to SHIP while near the bottom → no load mid-drag; ticket appears once.
7. Mobile (DevTools iPhone/Pixel emulation + a real device if available): swipe inside SHIP, use floating up/down buttons, swipe horizontally between columns.
8. `bun run test:unit tests/unit/ship-pagination.test.ts tests/unit/use-load-more-ship-tickets.test.ts tests/unit/components/board/stage-column-infinite-scroll.test.tsx`
9. `bun run test:integration tests/integration/tickets/ship-pagination.test.ts`
10. `bun run type-check && bun run lint`
