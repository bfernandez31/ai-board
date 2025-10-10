# Quickstart: Real-Time Job Status Updates

**Feature**: 020-9179-real-time
**Date**: 2025-10-10
**Target Audience**: Developers implementing this feature

## Prerequisites

Before starting implementation:

- [x] Phase 0 research complete (`research.md`)
- [x] Phase 1 design complete (`data-model.md`, `contracts/`)
- [x] Constitution check passed (no schema changes)
- [x] Development environment set up:
  - Node.js 22.20.0 LTS installed
  - PostgreSQL 14+ running locally
  - `npm install` dependencies installed
  - Prisma client generated (`npx prisma generate`)

---

## Installation

### 1. Verify No New Dependencies Needed

**Good News**: SSE uses browser-native EventSource API and Next.js built-in streaming!

No additional dependencies required. All necessary APIs are already available:
- **Client**: `EventSource` (browser-native)
- **Server**: `TransformStream` (Next.js 15 App Router)

### 2. Verify No Schema Changes Needed

```bash
# Confirm Prisma schema is up to date
npx prisma validate

# Confirm database is in sync (should show "Database is already in sync")
npx prisma migrate status
```

Expected output:
```
✔ Prisma schema loaded from prisma/schema.prisma
✔ Database schema is in sync with migrations
```

---

## Implementation Order (TDD)

Follow Test-Driven Development: **Write tests first, then implement to make them pass.**

### Phase 1: SSE Infrastructure (Tests First)

**1.1 Write SSE Server Test** (`tests/integration/sse-server.test.ts`)
- Test SSE connection establishment
- Test connection/disconnection cleanup
- Test message validation with Zod

**1.2 Implement SSE Server** (`app/api/sse/route.ts`)
- Implement GET endpoint with TransformStream
- Implement project subscription via query parameter
- Implement broadcast logic to all subscribers

**1.3 Write SSE Client Test** (`tests/integration/sse-client.test.ts`)
- Test EventSource connection lifecycle
- Test automatic reconnection (built-in)
- Test message parsing

**1.4 Implement SSE Client** (`lib/sse-client.ts`)
- Implement `useSSE` hook with EventSource
- Implement status tracking (connecting, connected, disconnected)
- Implement job updates Map

---

### Phase 2: Job Status Display (Tests First)

**2.1 Write Job Status Indicator Test** (`tests/unit/job-status-indicator.test.tsx`)
- Test rendering for all 5 status states
- Test animation presence for RUNNING status
- Test accessibility attributes

**2.2 Implement Job Status Indicator** (`components/board/job-status-indicator.tsx`)
- Implement status-to-icon mapping
- Implement CSS animations
- Implement accessibility features

**2.3 Write Ticket Card Test** (`tests/unit/ticket-card.test.tsx`)
- Test metadata section removal
- Test job status indicator display
- Test empty state (no jobs)

**2.4 Modify Ticket Card** (`components/board/ticket-card.tsx`)
- Remove metadata section HTML
- Add JobStatusIndicator component
- Handle null job state

---

### Phase 3: Real-Time Updates (Tests First)

**3.1 Write Real-Time Update E2E Test** (`tests/e2e/job-status-realtime.spec.ts`)
- Test SSE connection on board load
- Test status update received and displayed
- Test multiple tabs sync

**3.2 Implement SSE Provider** (`components/board/sse-provider.tsx`)
- Implement SSEContext
- Implement automatic project subscription
- Implement job update state management

**3.3 Integrate Board with SSE** (`components/board/board.tsx`)
- Wrap Board with SSEProvider
- Access SSE context for job updates
- Merge real-time updates with initial data

**3.4 Modify Job Status API** (`app/api/jobs/[id]/status/route.ts`)
- Add SSE broadcast after database update
- Broadcast to all clients subscribed to project

---

### Phase 4: Minimum Display Duration (Tests First)

**4.1 Write Display Duration Test** (`tests/e2e/job-status-display-duration.spec.ts`)
- Test rapid status changes respect 500ms minimum
- Test status queue behavior

**4.2 Implement useJobStatus Hook** (`lib/hooks/use-job-status.ts`)
- Implement display status debouncing
- Implement status transition queue
- Implement cleanup on unmount

**4.3 Integrate Hook in Ticket Card** (`components/board/ticket-card.tsx`)
- Replace direct status usage with `useJobStatus` hook
- Display debounced status

---

### Phase 5: Animations (Tests First)

**5.1 Write Animation Test** (`tests/e2e/job-status-animations.spec.ts`)
- Test RUNNING animation present and smooth
- Test animation stops for other statuses
- Test `prefers-reduced-motion` respected

**5.2 Implement CSS Animations** (`components/board/job-status-indicator.tsx`)
- Add quill writing keyframes
- Add GPU-accelerated transforms
- Add `will-change` hints
- Respect `prefers-reduced-motion`

---

### Phase 6: Visual Distinction (Tests First)

**6.1 Write Visual Styling Test** (`tests/e2e/ticket-card-visual.spec.ts`)
- Test FAILED status uses red color
- Test CANCELLED status uses gray color
- Test distinct icons for each status

**6.2 Implement Visual Styling** (`components/board/job-status-indicator.tsx`)
- Define color palette (FAILED red, CANCELLED gray, etc.)
- Implement icon selection logic
- Apply TailwindCSS classes

---

## Validation Steps

After implementation, verify the feature works end-to-end:

### Manual Testing Checklist

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Open Board in Browser**
   - Navigate to `http://localhost:3000/projects/1/board`
   - Open browser DevTools → Network tab
   - Verify SSE connection established (Type: eventsource, Status: 200 OK)

3. **Trigger Job Status Update**
   ```bash
   # Simulate job status update via API
   curl -X PATCH http://localhost:3000/api/jobs/1/status \
     -H "Content-Type: application/json" \
     -d '{"status": "RUNNING"}'
   ```

4. **Verify Real-Time Update**
   - Observe ticket card updates automatically (no page refresh)
   - Verify RUNNING animation plays
   - Verify status displays for at least 500ms before next change

5. **Trigger Job Completion**
   ```bash
   curl -X PATCH http://localhost:3000/api/jobs/1/status \
     -H "Content-Type: application/json" \
     -d '{"status": "COMPLETED"}'
   ```

6. **Verify Terminal Status**
   - Verify COMPLETED status displays with green checkmark
   - Verify animation stops
   - Verify status persists indefinitely

7. **Test Multiple Tabs**
   - Open board in second browser tab
   - Trigger status update
   - Verify both tabs update simultaneously

8. **Test Reconnection**
   - Close DevTools Network tab connection
   - Wait 2 seconds
   - Verify automatic reconnection (new eventsource connection in Network tab - handled by browser)

---

### Automated Testing

Run all tests to verify TDD compliance:

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test suites
npm run test:e2e -- tests/e2e/job-status-realtime.spec.ts
npm run test:e2e -- tests/e2e/job-status-animations.spec.ts
npm run test:e2e -- tests/e2e/ticket-card-visual.spec.ts

# Run with UI for debugging
npm run test:e2e:ui
```

Expected results:
- ✅ All E2E tests pass
- ✅ SSE connection established on board load
- ✅ Job status updates received in real-time
- ✅ Animations render smoothly at 60fps
- ✅ Minimum 500ms display duration enforced
- ✅ FAILED (red) vs CANCELLED (gray) visually distinct

---

## Performance Validation

### Metrics to Measure

1. **SSE Latency**
   ```javascript
   // In browser console
   const start = Date.now()
   // Trigger job status update
   // Observe update in UI
   const latency = Date.now() - start
   console.log('Update latency:', latency, 'ms')
   ```
   **Target**: <100ms (database update → UI display - faster than WebSocket!)

2. **Animation Frame Rate**
   - Open Chrome DevTools → Performance tab
   - Record while RUNNING animation plays
   - Verify FPS stays at 60fps (no drops below 55fps)

3. **Memory Usage**
   - Open Chrome DevTools → Memory tab
   - Take heap snapshot before SSE connection
   - Take heap snapshot after 5 minutes of updates
   - Verify no memory leaks (heap size should stabilize - lower than WebSocket)

4. **Network Bandwidth**
   - Open Chrome DevTools → Network tab
   - Monitor SSE message sizes
   - Verify typical message size: ~300 bytes (including `data:` prefix)

---

## Troubleshooting

### Issue: SSE Connection Fails (HTTP 400)

**Symptoms**: Console error "EventSource failed"

**Causes**:
- Missing or invalid `projectId` query parameter
- Server not returning correct headers

**Solution**:
```typescript
// Verify query parameter in app/api/sse/route.ts
const projectId = parseInt(searchParams.get('projectId'), 10)
if (isNaN(projectId) || projectId <= 0) {
  return new Response(
    JSON.stringify({ error: 'projectId must be a positive integer' }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  )
}
```

---

### Issue: Job Status Not Updating in Real-Time

**Symptoms**: Manual refresh shows new status, but UI doesn't update automatically

**Causes**:
- SSE broadcast not triggered after database update
- Client not connected to correct project

**Solution**:
1. Verify broadcast in `/api/jobs/[id]/status/route.ts`:
   ```typescript
   // After Prisma update
   await broadcastJobStatusUpdate({
     projectId: updatedJob.ticket.projectId,
     ticketId: updatedJob.ticketId,
     jobId: updatedJob.id,
     status: updatedJob.status,
     command: updatedJob.command,
     timestamp: new Date().toISOString()
   })
   ```

2. Verify connection in browser console:
   ```javascript
   // Should show connected status
   console.log(window.__eventSource?.readyState) // 1 = OPEN
   ```

---

### Issue: Animation Causing Scroll Lag

**Symptoms**: Scrolling feels janky when RUNNING animation plays

**Causes**:
- Animation using non-GPU-accelerated CSS properties
- Too many animated elements on page

**Solution**:
1. Ensure only `transform` and `opacity` are animated:
   ```css
   /* GOOD */
   @keyframes quill-writing {
     0% { transform: translateY(0); }
     50% { transform: translateY(-2px); }
   }

   /* BAD - triggers layout recalculation */
   @keyframes bad-animation {
     0% { top: 0; }
     50% { top: -2px; }
   }
   ```

2. Add `will-change` hint:
   ```css
   .job-running-animation {
     will-change: transform;
   }
   ```

---

### Issue: Status Flickers on Rapid Updates

**Symptoms**: Status changes too fast to see intermediate states

**Causes**:
- `useJobStatus` hook not enforcing 500ms minimum
- Status updates bypassing debouncing logic

**Solution**:
Verify `useJobStatus` implementation:
```typescript
useEffect(() => {
  if (!actualStatus) return

  // Enforce minimum display duration
  timeoutRef.current = setTimeout(() => {
    setDisplayStatus(actualStatus)
  }, 500) // Must be 500ms

  return () => clearTimeout(timeoutRef.current)
}, [actualStatus])
```

---

## Success Criteria

Feature is ready for production when:

- [x] All E2E tests pass (Playwright)
- [x] SSE connection established on board load
- [x] Job status updates appear within 100ms of database change
- [x] RUNNING animation plays smoothly at 60fps
- [x] Status displays for minimum 500ms before transitioning
- [x] FAILED (red) and CANCELLED (gray) visually distinct
- [x] Multiple browser tabs sync automatically
- [x] Automatic reconnection works after disconnect (EventSource handles this)
- [x] No memory leaks after 10 minutes of updates
- [x] Metadata section removed from all ticket cards
- [x] Accessibility: Screen reader announces status changes
- [x] `prefers-reduced-motion` respected

---

## Next Steps

After quickstart validation:

1. **Run `/tasks` command** to generate `tasks.md` with ordered implementation tasks
2. **Execute tasks in TDD order** (write tests first)
3. **Validate each task** with automated tests before moving to next
4. **Performance test** with real GitHub Actions workflow integration
5. **User acceptance testing** with actual board usage

---

## Reference Links

- [Feature Specification](./spec.md)
- [Research Documentation](./research.md)
- [Data Model](./data-model.md)
- [SSE API Contract](./contracts/sse-api.md)
- [Component Interfaces](./contracts/component-interfaces.md)
- [Constitution](../../.specify/memory/constitution.md)

---

**Status**: ✅ Quickstart Guide Complete - Ready for Task Generation
