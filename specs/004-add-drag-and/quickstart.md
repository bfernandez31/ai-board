# Quickstart: Drag-and-Drop Ticket Movement

**Feature**: 004-add-drag-and
**Date**: 2025-10-01

## Purpose

This quickstart guide provides executable test scenarios to validate the drag-and-drop feature. All scenarios are derived from user stories in spec.md and serve as acceptance criteria.

## Prerequisites

1. **Database Setup**:
   ```bash
   # Apply migrations
   npx prisma migrate dev

   # Verify migration applied
   npx prisma migrate status
   ```

2. **Dependencies Installed**:
   ```bash
   npm install @dnd-kit/core @dnd-kit/sortable
   ```

3. **Development Server Running**:
   ```bash
   npm run dev
   # Server should be at http://localhost:3000
   ```

4. **Test Data**:
   ```bash
   # Seed database with test tickets (optional)
   npx prisma db seed
   ```

## Test Scenarios

### Scenario 1: Successful Sequential Stage Transition

**Given**: A ticket in INBOX stage
**When**: User drags ticket to PLAN column
**Then**: Ticket moves to PLAN stage immediately, database updates successfully

**E2E Test** (tests/drag-drop.spec.ts):
```typescript
test('user can drag ticket from INBOX to PLAN', async ({ page }) => {
  // Setup: Create ticket in INBOX
  const ticket = await createTicket({ stage: 'INBOX' });

  // Navigate to board
  await page.goto('/board');

  // Verify ticket is in INBOX column
  const inboxColumn = page.locator('[data-stage="INBOX"]');
  await expect(inboxColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();

  // Drag ticket to PLAN column
  const ticketCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
  const planColumn = page.locator('[data-stage="PLAN"]');

  await ticketCard.dragTo(planColumn);

  // Verify ticket moved to PLAN column
  await expect(planColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();
  await expect(inboxColumn.locator(`[data-ticket-id="${ticket.id}"]`)).not.toBeVisible();

  // Verify database updated
  const updatedTicket = await getTicket(ticket.id);
  expect(updatedTicket.stage).toBe('PLAN');
  expect(updatedTicket.version).toBe(2); // Version incremented
});
```

**Manual Test**:
1. Open http://localhost:3000/board
2. Locate a ticket in the INBOX column
3. Click and hold the ticket card
4. Drag to the PLAN column
5. Release mouse button
6. ✅ Ticket should appear in PLAN column immediately
7. ✅ Original position in INBOX should be empty
8. ✅ Animation should be smooth

---

### Scenario 2: Reject Invalid Stage Transition (Skipping)

**Given**: A ticket in PLAN stage
**When**: User attempts to drag ticket to SHIP column (skipping BUILD and VERIFY)
**Then**: Drop is rejected, ticket returns to PLAN column with visual feedback

**E2E Test**:
```typescript
test('user cannot skip stages when dragging', async ({ page }) => {
  // Setup: Create ticket in PLAN
  const ticket = await createTicket({ stage: 'PLAN' });

  await page.goto('/board');

  // Attempt to drag from PLAN to SHIP (invalid)
  const ticketCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
  const shipColumn = page.locator('[data-stage="SHIP"]');

  await ticketCard.dragTo(shipColumn);

  // Verify ticket returned to PLAN column
  const planColumn = page.locator('[data-stage="PLAN"]');
  await expect(planColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();
  await expect(shipColumn.locator(`[data-ticket-id="${ticket.id}"]`)).not.toBeVisible();

  // Verify error message displayed
  await expect(page.locator('[role="alert"]')).toContainText('Invalid stage transition');

  // Verify database unchanged
  const unchangedTicket = await getTicket(ticket.id);
  expect(unchangedTicket.stage).toBe('PLAN');
  expect(unchangedTicket.version).toBe(1); // Version not incremented
});
```

**Manual Test**:
1. Open http://localhost:3000/board
2. Drag a ticket from PLAN to SHIP (skipping BUILD and VERIFY)
3. ✅ Ticket should return to PLAN column with animation
4. ✅ Error message should appear
5. ✅ SHIP column drop zone should show visual indicator (e.g., red border)

---

### Scenario 3: Reject Backwards Stage Transition

**Given**: A ticket in BUILD stage
**When**: User attempts to drag ticket to PLAN column (backwards)
**Then**: Drop is rejected, ticket returns to BUILD column

**E2E Test**:
```typescript
test('user cannot move ticket backwards', async ({ page }) => {
  // Setup: Create ticket in BUILD
  const ticket = await createTicket({ stage: 'BUILD' });

  await page.goto('/board');

  // Attempt to drag from BUILD to PLAN (invalid)
  const ticketCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
  const planColumn = page.locator('[data-stage="PLAN"]');

  await ticketCard.dragTo(planColumn);

  // Verify ticket returned to BUILD column
  const buildColumn = page.locator('[data-stage="BUILD"]');
  await expect(buildColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();

  // Verify database unchanged
  const unchangedTicket = await getTicket(ticket.id);
  expect(unchangedTicket.stage).toBe('BUILD');
});
```

---

### Scenario 4: Handle Concurrent Updates (Conflict)

**Given**: Two users viewing the same ticket
**When**: Both attempt to drag the ticket simultaneously
**Then**: First user succeeds, second user sees conflict error and rollback

**E2E Test**:
```typescript
test('handles concurrent updates with first-write-wins', async ({ page, context }) => {
  // Setup: Create ticket in INBOX
  const ticket = await createTicket({ stage: 'INBOX' });

  // Open board in two browser contexts (simulating two users)
  const page1 = page;
  const page2 = await context.newPage();

  await page1.goto('/board');
  await page2.goto('/board');

  // User 1 drags ticket to PLAN
  const ticketCard1 = page1.locator(`[data-ticket-id="${ticket.id}"]`);
  const planColumn1 = page1.locator('[data-stage="PLAN"]');

  // User 2 also drags the same ticket to PLAN (concurrent)
  const ticketCard2 = page2.locator(`[data-ticket-id="${ticket.id}"]`);
  const planColumn2 = page2.locator('[data-stage="PLAN"]');

  // Execute both drag operations "simultaneously"
  await Promise.all([
    ticketCard1.dragTo(planColumn1),
    ticketCard2.dragTo(planColumn2),
  ]);

  // User 1 should succeed
  await expect(planColumn1.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();

  // User 2 should see conflict error and ticket should revert
  await expect(page2.locator('[role="alert"]')).toContainText('modified by another user');

  // Both users should eventually see ticket in PLAN (after page2 refreshes)
  await page2.reload();
  await expect(planColumn2.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();
});
```

**Manual Test** (requires two browser windows):
1. Open http://localhost:3000/board in Window A
2. Open http://localhost:3000/board in Window B
3. In both windows, drag the same ticket at the same time
4. ✅ One window succeeds immediately
5. ✅ Other window shows "Ticket modified by another user" error
6. ✅ Failed window reverts ticket to original position

---

### Scenario 5: Disable Drag When Offline

**Given**: User is viewing the board
**When**: Network connection is lost
**Then**: Drag-and-drop is disabled, visual indicator shows offline status

**E2E Test**:
```typescript
test('disables drag when network is offline', async ({ page, context }) => {
  await page.goto('/board');

  // Go offline
  await context.setOffline(true);

  // Verify offline indicator visible
  await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

  // Attempt to drag ticket
  const ticket = page.locator('[data-ticket-id]').first();
  const column = page.locator('[data-stage]').last();

  // Verify drag is disabled (card should not be draggable)
  await expect(ticket).toHaveAttribute('data-draggable', 'false');

  // Attempt drag anyway
  await ticket.dragTo(column);

  // Verify ticket did not move
  const originalParent = await ticket.evaluate((el) => el.parentElement?.getAttribute('data-stage'));
  await expect(ticket.locator(':scope')).toHaveAttribute('data-current-stage', originalParent);

  // Go back online
  await context.setOffline(false);

  // Verify drag re-enabled
  await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();
  await expect(ticket).toHaveAttribute('data-draggable', 'true');
});
```

**Manual Test**:
1. Open http://localhost:3000/board
2. Open DevTools → Network tab → Select "Offline"
3. ✅ Offline indicator should appear
4. ✅ Ticket cards should show disabled state (e.g., reduced opacity, no cursor change)
5. Try to drag a ticket
6. ✅ Drag should not work
7. Go back online
8. ✅ Offline indicator disappears
9. ✅ Drag functionality restored

---

### Scenario 6: Touch Drag on Mobile

**Given**: User is on a touch device (mobile/tablet)
**When**: User long-presses and drags a ticket
**Then**: Drag-and-drop works as smoothly as with mouse

**E2E Test**:
```typescript
test('supports touch drag on mobile viewport', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });

  const ticket = await createTicket({ stage: 'INBOX' });
  await page.goto('/board');

  // Simulate touch drag
  const ticketCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
  const planColumn = page.locator('[data-stage="PLAN"]');

  // Long-press to activate drag
  await ticketCard.dispatchEvent('touchstart', {
    touches: [{ clientX: 100, clientY: 100 }],
  });

  // Wait for activation delay (250ms)
  await page.waitForTimeout(300);

  // Move to target
  await ticketCard.dispatchEvent('touchmove', {
    touches: [{ clientX: 200, clientY: 100 }],
  });

  // Release
  await ticketCard.dispatchEvent('touchend');

  // Verify ticket moved
  await expect(planColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();
});
```

**Manual Test** (use Chrome DevTools device emulation):
1. Open http://localhost:3000/board
2. Open DevTools → Toggle device toolbar (Cmd+Shift+M)
3. Select iPhone or iPad
4. Long-press a ticket card (hold for 250ms)
5. Drag to another column
6. ✅ Drag should activate after long-press
7. ✅ Visual feedback should appear (drag preview)
8. ✅ Drop should work smoothly

---

## Performance Validation

### Latency Test

**Goal**: Verify <100ms latency from drop to visual update

**E2E Test**:
```typescript
test('meets sub-100ms latency requirement', async ({ page }) => {
  const ticket = await createTicket({ stage: 'INBOX' });
  await page.goto('/board');

  const ticketCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
  const planColumn = page.locator('[data-stage="PLAN"]');

  // Measure time from drag end to visual update
  const startTime = Date.now();

  await ticketCard.dragTo(planColumn);

  // Wait for ticket to appear in new column
  await planColumn.locator(`[data-ticket-id="${ticket.id}"]`).waitFor({ state: 'visible' });

  const endTime = Date.now();
  const latency = endTime - startTime;

  // Verify <100ms latency
  expect(latency).toBeLessThan(100);
});
```

**Manual Test**:
1. Open DevTools → Performance tab
2. Start recording
3. Drag a ticket to another column
4. Stop recording
5. ✅ Measure time from drop event to DOM update
6. ✅ Should be <100ms

---

## Cleanup

After testing:

```bash
# Reset database
npx prisma migrate reset

# Or delete test data
npx prisma studio
# Manually delete test tickets
```

## Success Criteria

All scenarios must pass for feature to be considered complete:

- [ ] Scenario 1: Sequential transition succeeds
- [ ] Scenario 2: Invalid skipping rejected
- [ ] Scenario 3: Backwards movement rejected
- [ ] Scenario 4: Concurrent updates handled (first-write-wins)
- [ ] Scenario 5: Offline mode disables drag
- [ ] Scenario 6: Touch drag works on mobile
- [ ] Performance: <100ms latency achieved

## Troubleshooting

### Common Issues

**Drag not working**:
- Check DndContext is wrapping the board component
- Verify sensors are configured (PointerSensor, TouchSensor)
- Check ticket cards have `draggable` attribute

**Version conflicts not detected**:
- Verify `version` field exists in database
- Check Prisma migration applied successfully
- Ensure API compares version before update

**Offline detection not working**:
- Verify `navigator.onLine` API supported
- Check event listeners attached (`online`, `offline`)
- Test in real offline scenario (DevTools offline mode may not trigger events)

**Touch drag not activating**:
- Verify TouchSensor configured with correct delay (250ms)
- Check touch event handlers not blocked by other elements
- Test on actual mobile device (not just DevTools emulation)
