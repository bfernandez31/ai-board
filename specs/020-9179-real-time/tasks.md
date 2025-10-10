# Tasks: Real-Time Job Status Updates with Visual Indicators

**Feature**: 020-9179-real-time
**Branch**: `020-9179-real-time`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- All tasks follow TDD: Tests MUST be written and MUST FAIL before implementation

---

## Phase 3.1: Setup & Dependencies

- [X] **T001** Install WebSocket dependency: `npm install ws@^8.18.0 @types/ws@^8.5.10`
  - File: `package.json`
  - Verify: `npm list ws` shows version 8.18.3 ✓
  - Constitutional check: Confirm TypeScript types included ✓

---

## Phase 3.2: WebSocket Infrastructure - Tests First ⚠️ MUST FAIL

**CRITICAL: These tests MUST be written and MUST FAIL before ANY infrastructure implementation**

- [X] **T002** Write Zod schemas for WebSocket messages in `lib/websocket-schemas.ts`
  - Create `ClientMessageSchema` (subscribe, unsubscribe, ping) ✓
  - Create `ServerMessageSchema` (connected, subscribed, job-status-update, error, pong) ✓
  - Export TypeScript types using `z.infer` ✓
  - Reference: `contracts/websocket-api.md` lines 497-561

- [X] **T003** [P] Write E2E test for WebSocket connection establishment in `tests/e2e/websocket-connection.spec.ts`
  - Test: HTTP upgrade to WebSocket succeeds (101 Switching Protocols) ✓
  - Test: Server sends `connected` message with clientId ✓
  - Test: Invalid upgrade request returns 400 ✓
  - Expected: **FAIL** (no WebSocket server yet) - Tests written, will fail until T006 complete

- [X] **T004** [P] Write E2E test for project subscription in `tests/e2e/websocket-subscription.spec.ts`
  - Test: Client sends `subscribe` message → receives `subscribed` acknowledgment ✓
  - Test: Client sends `unsubscribe` → receives `unsubscribed` acknowledgment ✓
  - Test: Invalid projectId returns error message ✓
  - Expected: **FAIL** (no subscription logic yet) - Tests written, will fail until T007 complete

- [X] **T005** [P] Write E2E test for job status broadcast in `tests/e2e/websocket-job-broadcast.spec.ts`
  - Test: Job status update triggers WebSocket broadcast to subscribed clients ✓
  - Test: Multiple clients receive same update simultaneously ✓
  - Test: Unsubscribed clients do not receive updates ✓
  - Expected: **FAIL** (no broadcast logic yet) - Tests written, will fail until T008 complete

---

## Phase 3.3: WebSocket Infrastructure - Implementation

- [X] **T006** Implement WebSocket server in `app/api/ws/route.ts`
  - Handle HTTP upgrade (check `upgrade: websocket` header) ✓
  - Initialize WebSocket server from `ws` library ✓
  - Send `connected` message with UUID clientId ✓
  - Validate messages with Zod schemas ✓
  - Success criteria: T003 test passes (connection establishment)

- [X] **T007** Implement subscription management in `lib/websocket-server.ts`
  - Maintain Map of clientId → Set<projectId> subscriptions ✓
  - Handle `subscribe` message → add to subscription map → send `subscribed` ✓
  - Handle `unsubscribe` message → remove from map → send `unsubscribed` ✓
  - Validate projectId exists in database ✓
  - Success criteria: T004 test passes (subscription)

- [X] **T008** Implement broadcast logic in `lib/websocket-server.ts`
  - Export `broadcastJobStatusUpdate(message: JobStatusUpdate)` function ✓
  - Find all clients subscribed to message.projectId ✓
  - Send message to each client's WebSocket connection ✓
  - Handle disconnected clients gracefully ✓
  - Success criteria: T005 test passes (broadcast)

- [X] **T009** Integrate WebSocket broadcast into job status API in `app/api/jobs/[id]/status/route.ts`
  - After Prisma update succeeds, call `broadcastJobStatusUpdate` ✓
  - Include projectId (from job.ticket.projectId), ticketId, jobId, status, command ✓
  - Handle broadcast errors without failing API request ✓
  - Success criteria: T005 test passes (end-to-end broadcast)

---

## Phase 3.4: Client WebSocket Hook - Tests First ⚠️ MUST FAIL

- [ ] **T010** [P] Write integration test for `useWebSocket` hook in `tests/integration/use-websocket.test.tsx`
  - Test: Hook connects to WebSocket on mount
  - Test: Hook maintains connection status (connecting → connected)
  - Test: Hook receives job status updates and updates state
  - Test: Hook cleans up connection on unmount
  - Expected: **FAIL** (no hook yet)

- [ ] **T011** [P] Write integration test for WebSocket reconnection in `tests/integration/websocket-reconnection.test.tsx`
  - Test: Hook automatically reconnects after disconnect
  - Test: Exponential backoff (1s, 2s, 4s delays)
  - Test: Hook fetches latest job status on reconnect
  - Expected: **FAIL** (no reconnection logic yet)

---

## Phase 3.5: Client WebSocket Hook - Implementation

- [ ] **T012** Implement `useWebSocket` hook in `lib/websocket-client.ts`
  - Accept WebSocket URL parameter
  - Manage connection lifecycle with `useEffect`
  - Track connection status state (connecting, connected, disconnected)
  - Maintain Map<ticketId, JobStatusUpdate> for job updates
  - Validate incoming messages with Zod schema
  - Success criteria: T010 test passes

- [ ] **T013** Implement automatic reconnection in `lib/websocket-client.ts`
  - Detect disconnect via `onclose` event
  - Retry with exponential backoff (1s, 2s, 4s, 8s, 16s max)
  - After reconnect, re-subscribe to previous projectId
  - Fetch latest job statuses after reconnect
  - Success criteria: T011 test passes

- [ ] **T014** Implement `WebSocketProvider` context in `components/board/websocket-provider.tsx`
  - Create React Context with `WebSocketContextValue` interface
  - Wrap `useWebSocket` hook in Provider component
  - Accept projectId prop and subscribe on mount
  - Export `useWebSocket` hook for child components
  - Reference: `contracts/component-interfaces.md` lines 220-327

---

## Phase 3.6: Job Query Functions - Tests First ⚠️ MUST FAIL

- [X] **T015** [P] Write integration test for `getMostRecentActiveJob` in `tests/integration/job-queries.test.ts`
  - Test: Returns most recent RUNNING job if exists ✓
  - Test: Returns most recent PENDING job if no RUNNING ✓
  - Test: Falls back to most recent COMPLETED if no active jobs ✓
  - Test: Returns null if no jobs for ticket ✓
  - Expected: **FAIL** (no function yet) - Tests written

- [X] **T016** [P] Write integration test for `getJobsForTickets` batch query in `tests/integration/job-queries.test.ts`
  - Test: Returns Map of ticketId → Job for all tickets ✓
  - Test: Prioritizes active jobs over terminal jobs ✓
  - Test: Single database query (no N+1) ✓
  - Expected: **FAIL** (no function yet) - Tests written

---

## Phase 3.7: Job Query Functions - Implementation

- [X] **T017** Implement `getMostRecentActiveJob` function in `lib/job-queries.ts`
  - Query for most recent PENDING or RUNNING job (use composite index) ✓
  - If not found, query for most recent terminal job ✓
  - Return Job | null ✓
  - Reference: `data-model.md` lines 114-135
  - Success criteria: T015 test passes

- [X] **T018** Implement `getJobsForTickets` batch function in `lib/job-queries.ts`
  - Fetch all jobs for ticketIds array in single query ✓
  - Client-side filtering: active jobs first, then terminal jobs ✓
  - Return Map<ticketId, Job> ✓
  - Reference: `data-model.md` lines 153-182
  - Success criteria: T016 test passes

---

## Phase 3.8: JobStatusIndicator Component - Tests First ⚠️ MUST FAIL

- [ ] **T019** [P] Write visual regression test for JobStatusIndicator in `tests/e2e/job-status-visual.spec.ts`
  - Test: PENDING status shows gray clock icon
  - Test: RUNNING status shows blue quill with animation
  - Test: COMPLETED status shows green checkmark
  - Test: FAILED status shows red X-circle
  - Test: CANCELLED status shows gray ban icon
  - Capture Playwright screenshots for each status
  - Expected: **FAIL** (no component yet)

- [ ] **T020** [P] Write animation test for RUNNING status in `tests/e2e/job-status-animations.spec.ts`
  - Test: RUNNING animation plays continuously (2s loop)
  - Test: Animation uses GPU-accelerated transform properties
  - Test: Animation respects `prefers-reduced-motion` media query
  - Test: No animation for PENDING/COMPLETED/FAILED/CANCELLED
  - Expected: **FAIL** (no animation yet)

- [ ] **T021** [P] Write accessibility test for JobStatusIndicator in `tests/e2e/job-status-accessibility.spec.ts`
  - Test: Icon has `role="img"` and `aria-label`
  - Test: Status is announced by screen reader
  - Test: Color is not the only differentiator (icons differ)
  - Expected: **FAIL** (no component yet)

---

## Phase 3.9: JobStatusIndicator Component - Implementation

- [ ] **T022** Implement JobStatusIndicator component in `components/board/job-status-indicator.tsx`
  - Accept JobStatusIndicatorProps (status, command, className, animated, ariaLabel)
  - Map status to icon component (lucide-react icons)
  - Map status to color (FAILED red-500, CANCELLED gray-400, etc.)
  - Render icon with accessibility attributes
  - Reference: `contracts/component-interfaces.md` lines 13-112
  - Success criteria: T019, T021 tests pass

- [ ] **T023** Implement CSS animation for RUNNING status in `components/board/job-status-indicator.tsx`
  - Define `@keyframes quill-writing` with transform + rotate
  - Apply animation only when status === 'RUNNING' and animated === true
  - Add `will-change: transform` for GPU acceleration
  - Add `@media (prefers-reduced-motion)` to disable animation
  - Reference: `contracts/component-interfaces.md` lines 93-105
  - Success criteria: T020 test passes

---

## Phase 3.10: TicketCard Refactor - Tests First ⚠️ MUST FAIL

- [ ] **T024** [P] Write E2E test for metadata removal in `tests/e2e/ticket-card-clean.spec.ts`
  - Test: Ticket card does NOT contain "PLAN:" text
  - Test: Ticket card does NOT contain "BUILD:" text
  - Test: Ticket card does NOT contain "VERIFY:" text
  - Test: Ticket card does NOT contain "messages / tools" text
  - Expected: **FAIL** (metadata still present)

- [ ] **T025** [P] Write integration test for JobStatusIndicator in TicketCard in `tests/integration/ticket-card-job-status.test.tsx`
  - Test: Ticket with RUNNING job shows JobStatusIndicator
  - Test: Ticket with no job shows clean card (no status indicator)
  - Test: JobStatusIndicator receives correct props (status, command)
  - Expected: **FAIL** (TicketCard not integrated yet)

---

## Phase 3.11: TicketCard Refactor - Implementation

- [ ] **T026** Refactor TicketCard to remove metadata section in `components/board/ticket-card.tsx`
  - Remove CardFooter with "PLAN/BUILD/VERIFY" metadata HTML
  - Verify existing ticket card tests still pass
  - Reference: `contracts/component-interfaces.md` lines 185-208
  - Success criteria: T024 test passes

- [ ] **T027** Integrate JobStatusIndicator into TicketCard in `components/board/ticket-card.tsx`
  - Accept `currentJob: Job | null` prop
  - Render JobStatusIndicator in CardFooter if currentJob exists
  - Pass currentJob.status and currentJob.command to indicator
  - Reference: `contracts/component-interfaces.md` lines 158-183
  - Success criteria: T025 test passes

---

## Phase 3.12: useJobStatus Hook - Tests First ⚠️ MUST FAIL

- [ ] **T028** [P] Write integration test for 500ms display duration in `tests/integration/use-job-status-duration.test.tsx`
  - Test: Status changes enforce 500ms minimum display
  - Test: Rapid updates (PENDING → RUNNING → COMPLETED) each display 500ms
  - Test: First status displays immediately (no delay)
  - Expected: **FAIL** (no hook yet)

- [ ] **T029** [P] Write unit test for useJobStatus hook logic in `tests/unit/use-job-status.test.ts`
  - Test: Hook tracks actualStatus vs displayStatus
  - Test: isTransitioning flag set during delay
  - Test: forceUpdate skips delay and updates immediately
  - Test: Cleanup cancels pending timeouts
  - Expected: **FAIL** (no hook yet)

---

## Phase 3.13: useJobStatus Hook - Implementation

- [ ] **T030** Implement useJobStatus hook in `lib/hooks/use-job-status.ts`
  - Accept UseJobStatusOptions (ticketId, minDisplayDuration, enabled)
  - Maintain displayStatus state (delayed) vs actualStatus (immediate)
  - Use setTimeout to enforce minDisplayDuration (default 500ms)
  - Track isTransitioning flag during delay
  - Cleanup timeout on unmount
  - Reference: `contracts/component-interfaces.md` lines 415-463
  - Success criteria: T028, T029 tests pass

---

## Phase 3.14: Board Integration - Tests First ⚠️ MUST FAIL

- [ ] **T031** Write E2E test for real-time updates in `tests/e2e/board-realtime-updates.spec.ts`
  - Test: Board establishes WebSocket connection on load
  - Test: Job status update received via WebSocket updates ticket card
  - Test: Update happens without page refresh
  - Test: Multiple browser tabs receive same update
  - Expected: **FAIL** (Board not integrated with WebSocket yet)

- [ ] **T032** Write E2E test for initial job status load in `tests/e2e/board-initial-jobs.spec.ts`
  - Test: Board fetches initial jobs for all tickets on load
  - Test: Tickets display correct initial job status
  - Test: Tickets without jobs show clean card
  - Expected: **FAIL** (Board not loading jobs yet)

---

## Phase 3.15: Board Integration - Implementation

- [ ] **T033** Wrap Board component with WebSocketProvider in `components/board/board.tsx`
  - Extract BoardContent sub-component
  - Wrap BoardContent with WebSocketProvider
  - Pass projectId to WebSocketProvider
  - Reference: `contracts/component-interfaces.md` lines 512-521
  - Success criteria: T031 test passes (connection established)

- [ ] **T034** Integrate real-time job updates in Board in `components/board/board.tsx`
  - Use `useWebSocket` hook to access jobUpdates Map
  - Implement `getTicketJob(ticketId)` to merge initial + live data
  - Pass merged job data to TicketCard components
  - Reference: `contracts/component-interfaces.md` lines 532-544
  - Success criteria: T031 test passes (real-time updates)

- [ ] **T035** Update board page to fetch initial jobs in `app/projects/[projectId]/board/page.tsx`
  - Import `getJobsForTickets` from lib/job-queries.ts
  - Fetch jobs for all board tickets on server-side
  - Pass initialJobs Map as prop to Board component
  - Success criteria: T032 test passes (initial load)

---

## Phase 3.16: Polish & Existing Test Updates

- [ ] **T036** [P] Update existing TicketCard tests in `tests/**/*ticket-card*.spec.ts`
  - Remove assertions about metadata section presence
  - Update snapshots if using visual regression
  - Add assertions for clean card design
  - Success criteria: All existing TicketCard tests pass

- [ ] **T037** [P] Update existing Board E2E tests in `tests/e2e/*board*.spec.ts`
  - Update tests to expect WebSocket connection
  - Update visual assertions for new ticket card design
  - Ensure tests don't break due to metadata removal
  - Success criteria: All existing Board E2E tests pass

- [ ] **T038** [P] Write performance test for animations in `tests/e2e/animation-performance.spec.ts`
  - Test: RUNNING animation maintains 60fps (use Chrome DevTools)
  - Test: Board scroll performance not impacted by animations
  - Test: Memory usage stable over 5 minutes of updates
  - Success criteria: Performance targets met (see `plan.md` line 43)

- [ ] **T039** [P] Write E2E test for cross-tab synchronization in `tests/e2e/multi-tab-sync.spec.ts`
  - Test: Open board in two tabs
  - Test: Job status update appears in both tabs simultaneously
  - Test: Both tabs maintain independent WebSocket connections
  - Success criteria: <200ms latency between tabs

- [ ] **T040** Run manual validation from `quickstart.md`
  - Follow all validation steps in quickstart.md
  - Verify WebSocket connection in browser DevTools
  - Trigger job status updates via curl
  - Test reconnection by closing DevTools connection
  - Success criteria: All manual tests pass

---

## Dependencies

```
Setup (T001)
    ↓
Schemas (T002)
    ↓
┌───────────────────┬───────────────────┬───────────────────┐
│                   │                   │                   │
WS Tests         Job Tests          Component Tests
(T003-T005) [P]  (T015-T016) [P]    (T019-T021) [P]
    ↓                 ↓                   ↓
WS Impl          Job Impl           Component Impl
(T006-T009)      (T017-T018)        (T022-T023)
    ↓                 ↓                   ↓
    └─────────────────┴───────────────────┘
                     ↓
        Client Hook Tests (T010-T011) [P]
                     ↓
        Client Hook Impl (T012-T014)
                     ↓
    ┌────────────────┼────────────────┐
    │                │                │
TicketCard Tests  Hook Tests    Board Tests
(T024-T025) [P]  (T028-T029) [P] (T031-T032) [P]
    │                │                │
TicketCard Impl   Hook Impl      Board Impl
(T026-T027)      (T030)         (T033-T035)
    │                │                │
    └────────────────┴────────────────┘
                     ↓
            Polish & Updates
        (T036-T040) [P] (all parallel)
```

---

## Parallel Execution Examples

### Phase 1: Infrastructure Tests (Parallel)
```bash
# Launch T003-T005 together (all E2E tests, different files):
npx playwright test tests/e2e/websocket-connection.spec.ts &
npx playwright test tests/e2e/websocket-subscription.spec.ts &
npx playwright test tests/e2e/websocket-job-broadcast.spec.ts &
wait
```

### Phase 2: Component Tests (Parallel)
```bash
# Launch T019-T021 together (all JobStatusIndicator tests, different files):
npx playwright test tests/e2e/job-status-visual.spec.ts &
npx playwright test tests/e2e/job-status-animations.spec.ts &
npx playwright test tests/e2e/job-status-accessibility.spec.ts &
wait
```

### Phase 3: Polish Tasks (Parallel)
```bash
# Launch T036-T039 together (all independent test updates):
npm run test:e2e -- tests/**/*ticket-card*.spec.ts &
npm run test:e2e -- tests/e2e/*board*.spec.ts &
npx playwright test tests/e2e/animation-performance.spec.ts &
npx playwright test tests/e2e/multi-tab-sync.spec.ts &
wait
```

---

## Validation Checklist

*GATE: Verify before marking feature complete*

- [ ] All contracts have corresponding tests (WebSocket API, Component interfaces)
- [ ] All tests written before implementation (TDD compliance)
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] All unit/integration tests pass (if added)
- [ ] TypeScript type-check passes (`npm run type-check`)
- [ ] No `any` types introduced (constitutional compliance)
- [ ] WebSocket connection establishes on board load
- [ ] Real-time updates appear within 200ms
- [ ] RUNNING animation plays smoothly at 60fps
- [ ] FAILED (red) vs CANCELLED (gray) visually distinct
- [ ] Metadata section removed from all ticket cards
- [ ] 500ms minimum display duration enforced
- [ ] Multiple tabs sync automatically
- [ ] Automatic reconnection works after disconnect
- [ ] `prefers-reduced-motion` respected for animations
- [ ] Screen reader announces status changes

---

## Notes

- **[P] tasks**: Different files, no dependencies - can run in parallel
- **TDD compliance**: All tests MUST be written and MUST FAIL before implementation
- **Constitutional compliance**: All code uses TypeScript strict mode, no `any` types
- **Commit strategy**: Commit after each test passes (Green state in TDD)
- **WebSocket deployment**: Works in development (local Node.js); Vercel requires Pro/Enterprise plan for WebSocket support in production

---

## Task Execution Summary

- **Total Tasks**: 40
- **Parallel Tasks**: 20 (marked with [P])
- **Sequential Tasks**: 20 (dependencies prevent parallelization)
- **Test Tasks**: 24 (60% of all tasks - TDD focused)
- **Implementation Tasks**: 16 (40% of all tasks)

**Estimated Timeline**:
- With serial execution: ~15-20 hours
- With parallel execution: ~8-12 hours (50-60% time savings)

---

**Status**: ✅ Tasks Ready for Execution - Proceed with Phase 3.1 (Setup)
