# Quickstart: Ticket Detail Modal

**Feature**: 005-add-ticket-detail
**Date**: 2025-10-01
**Purpose**: Validate the ticket detail modal feature through manual testing

## Prerequisites

**Before testing**:
- [x] Database is running (PostgreSQL)
- [x] Environment variables configured (`.env.local`)
- [x] Dependencies installed (`npm install`)
- [x] Database migrated (`npx prisma migrate dev`)
- [x] At least 3 tickets exist in database for testing
- [x] Development server running (`npm run dev`)

**Create Test Data** (if needed):
```bash
# Start dev server
npm run dev

# In browser, navigate to /board
# Use "New Ticket" button to create test tickets with:
# 1. Short title, short description
# 2. Long title (80+ chars), long description (500+ chars)
# 3. Minimal description ticket
```

## Quick Test Scenarios

### Scenario 1: Basic Modal Open/Close
**Goal**: Verify modal opens and closes correctly

**Steps**:
1. Navigate to `http://localhost:3000/board`
2. Click on any ticket card
3. **Expected**: Modal opens displaying ticket details
4. Click the close button (X icon top-right)
5. **Expected**: Modal closes, returns to board view

**Validation**:
- [ ] Modal opens smoothly (no lag)
- [ ] Ticket title displayed prominently
- [ ] Description visible
- [ ] Stage badge shown with correct color
- [ ] Created and Updated dates displayed
- [ ] Close button visible and clickable
- [ ] Modal closes smoothly

### Scenario 2: ESC Key Dismissal
**Goal**: Verify ESC key closes modal

**Steps**:
1. Navigate to `/board`
2. Click any ticket card
3. **Expected**: Modal opens
4. Press `ESC` key
5. **Expected**: Modal closes

**Validation**:
- [ ] ESC key closes modal
- [ ] Returns to board view
- [ ] No errors in console

### Scenario 3: Click Outside to Close
**Goal**: Verify clicking overlay closes modal

**Steps**:
1. Navigate to `/board`
2. Click any ticket card
3. **Expected**: Modal opens
4. Click on the dark overlay area (outside modal content)
5. **Expected**: Modal closes

**Validation**:
- [ ] Clicking overlay closes modal
- [ ] Clicking modal content does NOT close modal
- [ ] Returns to board view

### Scenario 4: Multiple Tickets
**Goal**: Verify different tickets display correctly

**Steps**:
1. Navigate to `/board`
2. Note the title of ticket #1
3. Click ticket #1
4. **Expected**: Modal shows ticket #1 data
5. Close modal
6. Note the title of ticket #2 (different ticket)
7. Click ticket #2
8. **Expected**: Modal shows ticket #2 data (not ticket #1)

**Validation**:
- [ ] Each ticket opens correct modal
- [ ] Data matches ticket card
- [ ] No data persistence from previous modal

### Scenario 5: Mobile Responsive (Full-Screen)
**Goal**: Verify modal is full-screen on mobile

**Setup**: Resize browser to mobile width (<768px) OR use DevTools device emulation

**Steps**:
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M)
3. Select "iPhone 12 Pro" or set width to 375px
4. Navigate to `/board`
5. Click any ticket card
6. **Expected**: Modal fills entire screen

**Validation**:
- [ ] Modal is full-screen (100% width and height)
- [ ] No rounded corners
- [ ] Close button accessible in top-right
- [ ] Content scrollable if needed
- [ ] All text readable

### Scenario 6: Desktop Responsive (Centered)
**Goal**: Verify modal is centered on desktop

**Setup**: Resize browser to desktop width (≥768px)

**Steps**:
1. Set browser width to 1280px or larger
2. Navigate to `/board`
3. Click any ticket card
4. **Expected**: Modal is centered with max-width

**Validation**:
- [ ] Modal is centered on screen
- [ ] Modal has max width (~768px)
- [ ] Rounded corners visible
- [ ] Dark overlay visible around modal
- [ ] Modal doesn't fill entire screen

### Scenario 7: Long Content Handling
**Goal**: Verify long descriptions scroll properly

**Setup**: Use ticket with long description (500+ characters)

**Steps**:
1. Navigate to `/board`
2. Click ticket with long description
3. **Expected**: Modal opens
4. Scroll within description area
5. **Expected**: Description scrolls independently

**Validation**:
- [ ] Long descriptions don't break layout
- [ ] Scrolling works smoothly
- [ ] Title remains visible (not scrolled off)
- [ ] Dates remain visible
- [ ] Max height applied to description area

### Scenario 8: Stage Badge Colors
**Goal**: Verify stage badges display with correct colors

**Steps**:
1. Navigate to `/board`
2. For each stage column (INBOX, PLAN, BUILD, VERIFY, SHIP):
   - Click a ticket in that stage
   - **Expected**: Badge shows correct color
   - Close modal

**Validation**:
- [ ] INBOX: Gray badge (`bg-zinc-600`)
- [ ] PLAN: Blue badge (`bg-blue-600`)
- [ ] BUILD: Green badge (`bg-green-600`)
- [ ] VERIFY: Orange badge (`bg-orange-600`)
- [ ] SHIP: Purple badge (`bg-purple-600`)

### Scenario 9: Date Formatting
**Goal**: Verify dates are formatted correctly

**Steps**:
1. Navigate to `/board`
2. Click any ticket
3. Check "Created" and "Last Updated" dates
4. **Expected**: Format is "MMM d, yyyy h:mm a"

**Validation**:
- [ ] Dates are human-readable (e.g., "Oct 1, 2025 2:30 PM")
- [ ] Created date is earlier than or equal to Updated date
- [ ] Time zone is consistent

### Scenario 10: Drag-and-Drop Not Affected
**Goal**: Verify clicking doesn't interfere with dragging

**Steps**:
1. Navigate to `/board`
2. Click and hold on a ticket card
3. Drag ticket to another column
4. Release
5. **Expected**: Ticket moves, modal does NOT open
6. Click the same ticket (without dragging)
7. **Expected**: Modal opens

**Validation**:
- [ ] Drag-and-drop still works
- [ ] Dragging does NOT open modal
- [ ] Clicking (without drag) DOES open modal
- [ ] No conflicts between interactions

## Accessibility Quick Checks

### Keyboard Navigation
**Steps**:
1. Navigate to `/board` using keyboard only
2. Tab to a ticket card
3. Press `Enter` or `Space`
4. **Expected**: Modal opens
5. Tab through modal elements
6. Press `ESC`
7. **Expected**: Modal closes, focus returns

**Validation**:
- [ ] Can navigate to ticket cards with keyboard
- [ ] Enter/Space opens modal
- [ ] Tab moves focus within modal
- [ ] ESC closes modal
- [ ] Focus returns to trigger element

### Screen Reader Compatibility
**Setup**: Enable screen reader (VoiceOver on Mac, NVDA/JAWS on Windows)

**Steps**:
1. Navigate to `/board` with screen reader
2. Navigate to a ticket card
3. Activate ticket card
4. **Expected**: Screen reader announces "Dialog" or "Modal"
5. Navigate through modal content
6. **Expected**: All content is readable

**Validation**:
- [ ] Modal announced as dialog
- [ ] Title read correctly
- [ ] Description read completely
- [ ] Dates read with labels
- [ ] Close button discoverable

## Performance Quick Checks

### Modal Open Speed
**Goal**: Modal should open quickly

**Steps**:
1. Navigate to `/board`
2. Click a ticket card
3. Observe animation and rendering time

**Validation**:
- [ ] Modal opens in <100ms (feels instant)
- [ ] No lag or stutter
- [ ] Animation smooth
- [ ] No layout shift

### No Memory Leaks
**Goal**: Ensure modal cleans up properly

**Setup**: Open DevTools > Performance > Memory

**Steps**:
1. Open modal
2. Close modal
3. Repeat 10 times
4. Check memory usage

**Validation**:
- [ ] Memory usage stable (no continuous growth)
- [ ] Heap size returns to baseline after closing

## Error Scenarios

### Missing Description
**Goal**: Handle tickets with empty descriptions

**Setup**: Create ticket with empty description (if DB allows)

**Steps**:
1. Click ticket with empty description
2. **Expected**: Modal shows placeholder or empty space (no crash)

**Validation**:
- [ ] Modal opens successfully
- [ ] No JavaScript errors
- [ ] Description area shows gracefully (empty or placeholder)

### Invalid Date
**Goal**: Handle corrupted date data

**Note**: Should not occur with Prisma, but defensive coding should handle it

**Validation**:
- [ ] Dates always display (even if "Invalid date")
- [ ] No crashes from date formatting errors

## Browser Compatibility

**Test in**:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Key behaviors**:
- Modal opens/closes in all browsers
- ESC key works in all browsers
- Click outside works in all browsers
- Responsive behavior consistent

## Post-Testing Checklist

**After completing quickstart scenarios**:
- [ ] All basic scenarios pass
- [ ] All responsive scenarios pass
- [ ] All accessibility checks pass
- [ ] No console errors observed
- [ ] No visual glitches
- [ ] Performance acceptable
- [ ] Feature ready for E2E test implementation

## Troubleshooting

### Modal doesn't open
**Check**:
- Console for JavaScript errors
- `onTicketClick` handler is wired up in Board component
- `open` state is being set to `true`

### Modal doesn't close
**Check**:
- `onOpenChange` handler is implemented
- ESC key listener is active (built into Dialog)
- Overlay click handler is active (built into Dialog)

### Wrong ticket data displayed
**Check**:
- `selectedTicket` state is updated correctly
- State is cleared when modal closes
- No stale state from previous opens

### Styling issues
**Check**:
- Dark theme classes applied
- Responsive classes present (`sm:`, `md:` breakpoints)
- TailwindCSS config includes dark mode

## Success Criteria

**Feature is ready when**:
- ✅ All 10 quick test scenarios pass
- ✅ Accessibility checks pass
- ✅ Performance is acceptable
- ✅ No console errors
- ✅ Works in all major browsers
- ✅ Mobile and desktop views work correctly

**Next Steps**:
1. Document any issues found
2. Fix critical bugs
3. Write comprehensive E2E tests (tasks.md)
4. Submit for review
