# Quickstart Guide: Inline Ticket Editing

**Feature**: 007-enable-inline-editing
**Date**: 2025-10-02
**Purpose**: Quick validation steps to verify inline editing functionality works end-to-end

---

## Prerequisites

### Environment Setup
```bash
# Ensure database is running
docker ps | grep postgres || docker-compose up -d postgres

# Ensure dependencies installed
npm install

# Ensure database schema is up to date
npx prisma generate
npx prisma db push  # Or: npx prisma migrate dev
```

### Seed Test Data
```bash
# Optional: Create test tickets via Prisma Studio
npx prisma studio
# Create 2-3 tickets with different titles/descriptions
```

---

## Quick Test Scenarios

### Scenario 1: Edit Title via Inline Input

**User Story**: As a user, I want to click a ticket title and edit it inline without leaving the modal.

**Steps**:
1. Navigate to `http://localhost:3000/board`
2. Click any ticket card to open the ticket detail modal
3. **Hover over the title** in the modal header
   - ✅ Pencil icon should appear
4. **Click the title text**
   - ✅ Title should become an editable input field
   - ✅ Input should be focused automatically
   - ✅ Current title value should be selected/highlighted
5. **Type a new title**: "Updated Title via Inline Edit"
6. **Press Enter**
   - ✅ Title should save immediately
   - ✅ Input should return to display mode
   - ✅ Success toast should appear: "Ticket updated"
   - ✅ Board should refresh to show updated title

**Expected Result**: Title updated and visible on both modal and board.

---

### Scenario 2: Edit Description via Inline Textarea

**User Story**: As a user, I want to click a ticket description and edit it inline with a character counter.

**Steps**:
1. With modal still open, **hover over the description text**
   - ✅ Pencil icon should appear
2. **Click anywhere in the description region**
   - ✅ Description should become a textarea
   - ✅ Textarea should be focused automatically
   - ✅ Character counter should appear below textarea
   - ✅ Counter should show: "X characters remaining"
3. **Type new description**: "Updated description with more details about this ticket."
   - ✅ Character counter should update in real-time
4. **Click the "Save" button** (or press Ctrl+Enter if supported)
   - ✅ Loading spinner should appear briefly
   - ✅ Description should save and return to display mode
   - ✅ Success toast: "Ticket updated"
   - ✅ Character counter should disappear

**Expected Result**: Description updated and visible in modal.

---

### Scenario 3: Cancel Edit with ESC Key

**User Story**: As a user, I want to cancel my edits by pressing ESC without saving changes.

**Steps**:
1. **Click the title** to enter edit mode
2. **Change the title** to something different
3. **Press ESC key**
   - ✅ Title should revert to original value
   - ✅ Input should return to display mode
   - ✅ No API call should be made (check Network tab)
   - ✅ No toast notification

**Expected Result**: Changes discarded, original title restored.

---

### Scenario 4: Validation - Empty Title

**User Story**: As a user, I should not be able to save an empty title.

**Steps**:
1. **Click the title** to enter edit mode
2. **Delete all text** (Ctrl+A, Delete)
3. **Press Enter** or click outside
   - ✅ Inline error message should appear: "Title cannot be empty"
   - ✅ Input should remain in edit mode (not saved)
   - ✅ Save should be prevented
   - ✅ No API call made

**Expected Result**: Validation error displayed, save prevented.

---

### Scenario 5: Validation - Title Too Long

**User Story**: As a user, I should see an error when title exceeds 100 characters.

**Steps**:
1. **Click the title** to enter edit mode
2. **Type 101 characters**: "A" repeated 101 times
   - ✅ Input should prevent typing beyond 100 characters (maxLength attribute)
   - OR: Allow typing, but show error on save attempt
3. If error on save:
   - ✅ Error message: "Title must be 100 characters or less"
   - ✅ Input remains in edit mode
   - ✅ Save button disabled

**Expected Result**: Character limit enforced, validation error shown.

---

### Scenario 6: Character Counter Warning (Description)

**User Story**: As a user, I should see a warning when description approaches the 1000-character limit.

**Steps**:
1. **Click the description** to enter edit mode
2. **Type exactly 910 characters** (>90% of 1000)
   - ✅ Character counter should show: "90 characters remaining"
   - ✅ Warning indicator should appear (yellow/orange color or icon)
3. **Continue typing to exactly 1000 characters**
   - ✅ Counter should show: "0 characters remaining"
   - ✅ Input should prevent further typing (maxLength attribute)
   - ✅ Save button should still be enabled (1000 is valid)
4. **Save the description**
   - ✅ Should save successfully
   - ✅ Success toast appears

**Expected Result**: Warning at 90%, hard stop at 1000 characters.

---

### Scenario 7: Optimistic Update & Rollback

**User Story**: As a user, I should see immediate feedback, but changes should roll back if the server fails.

**Steps to Simulate Server Error**:
1. **Open browser DevTools → Network tab**
2. **Click the title** to enter edit mode
3. **In DevTools**: Enable "Offline" mode (Network tab)
4. **Change title** and press Enter
   - ✅ Title should update immediately in UI (optimistic)
   - ✅ After network timeout (~5s), error toast should appear
   - ✅ Title should revert to original value (rollback)
   - ✅ Error toast: "Failed to save. Changes reverted."

**Expected Result**: Optimistic update → network failure → rollback + error notification.

---

### Scenario 8: Concurrent Edit Conflict (409)

**User Story**: As a user, I should be notified if someone else edited the ticket while I was editing.

**Steps** (requires two browser sessions):

**Session A**:
1. Open ticket modal (version = 1)
2. Click title to edit
3. **Wait** (do not save yet)

**Session B**:
1. Open same ticket modal (version = 1)
2. Edit title: "Title from Session B"
3. Save successfully (version → 2)

**Session A** (resume):
4. Edit title: "Title from Session A"
5. Press Enter to save
   - ✅ API should return 409 Conflict
   - ✅ Optimistic update should roll back
   - ✅ Error toast: "Conflict: Ticket was modified by another user"
   - ✅ Toast should suggest refreshing

**Alternative**: Manually simulate via API:
```bash
# Get current ticket
curl http://localhost:3000/api/tickets/1

# Update with stale version
curl -X PATCH http://localhost:3000/api/tickets/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"New Title","version":1}'

# Should return 409 if version is now 2
```

**Expected Result**: Conflict detected, user notified, changes rolled back.

---

## API Contract Validation

### Manual API Testing (cURL)

**Test 1: Update Title**
```bash
curl -X PATCH http://localhost:3000/api/tickets/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "version": 1
  }'

# Expected: 200 OK with updated ticket (version = 2)
```

**Test 2: Update Description**
```bash
curl -X PATCH http://localhost:3000/api/tickets/1 \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description",
    "version": 2
  }'

# Expected: 200 OK with updated ticket (version = 3)
```

**Test 3: Update Both**
```bash
curl -X PATCH http://localhost:3000/api/tickets/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Title",
    "description": "New Description",
    "version": 3
  }'

# Expected: 200 OK with updated ticket (version = 4)
```

**Test 4: Validation Error (Empty Title)**
```bash
curl -X PATCH http://localhost:3000/api/tickets/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "   ",
    "version": 4
  }'

# Expected: 400 Bad Request
# {"error":"Validation failed","issues":[{"path":["title"],"message":"Title cannot be empty"}]}
```

**Test 5: Conflict (Stale Version)**
```bash
curl -X PATCH http://localhost:3000/api/tickets/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Another Update",
    "version": 1
  }'

# Expected: 409 Conflict
# {"error":"Conflict: Ticket was modified by another user","currentVersion":4}
```

**Test 6: Not Found**
```bash
curl -X PATCH http://localhost:3000/api/tickets/99999 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test",
    "version": 1
  }'

# Expected: 404 Not Found
# {"error":"Ticket not found"}
```

---

## Playwright E2E Test Execution

### Run All Tests
```bash
# Run all E2E tests for this feature
npm run test:e2e -- 007-inline-editing.spec.ts

# Run with UI mode for debugging
npm run test:e2e:ui -- 007-inline-editing.spec.ts

# Run in headed mode to watch browser
npm run test:e2e:headed -- 007-inline-editing.spec.ts
```

### Expected Test Results
```
✓ User can click title to enter inline edit mode
✓ User can save title by pressing Enter
✓ User can cancel title edit with ESC
✓ User can click description to enter edit mode
✓ User can save description via Save button
✓ Character counter updates in real-time
✓ Warning appears at 90% of description limit
✓ Empty title validation prevents save
✓ Title exceeding 100 chars is rejected
✓ Description exceeding 1000 chars is rejected
✓ Optimistic update rolls back on network error
✓ Concurrent edit triggers 409 conflict
✓ Board refreshes after successful save

13 passed (13)
```

---

## Performance Validation

### Metrics to Verify

**UI Response Time**:
- Title click → edit mode activation: **<100ms**
- Description click → edit mode activation: **<100ms**
- Character counter update per keystroke: **<16ms** (60fps)

**API Response Time**:
- PATCH request → response: **<500ms** (p95)

### How to Measure
```javascript
// In browser DevTools Console
console.time('edit-mode-activation');
// Click title
console.timeEnd('edit-mode-activation');
// Should be < 100ms

// In Network tab
// Filter: Method = PATCH
// Check "Time" column: should be < 500ms
```

---

## Rollback Procedure

### If Feature Breaks
```bash
# Revert database migration (if any were added)
# Note: This feature requires NO migrations

# Revert code changes
git checkout main -- components/board/ticket-detail-modal.tsx
git checkout main -- app/api/tickets/[id]/route.ts

# Restart dev server
npm run dev
```

### Known Issues & Workarounds
*None expected at this stage. Document any issues found during testing.*

---

## Success Criteria Checklist

### Functional Requirements
- [ ] **FR-001**: User can click title to enter edit mode
- [ ] **FR-002**: Pencil icon appears on hover
- [ ] **FR-003**: Input auto-focuses when edit mode activates
- [ ] **FR-004**: Enter or blur saves title changes
- [ ] **FR-005**: ESC cancels and restores original title
- [ ] **FR-006**: Title limited to 100 characters
- [ ] **FR-007**: Empty/whitespace title rejected
- [ ] **FR-008**: User can click description to enter edit mode
- [ ] **FR-009**: Pencil icon appears on description hover
- [ ] **FR-010**: Character counter displays during edit
- [ ] **FR-011**: Description minimum 1 character enforced
- [ ] **FR-012**: Description maximum 1000 characters enforced
- [ ] **FR-013**: Warning at 90% (900 chars)
- [ ] **FR-014**: Empty description rejected with error
- [ ] **FR-015**: Save/Cancel controls only visible during edit
- [ ] **FR-016**: Save disabled when invalid or unchanged
- [ ] **FR-017**: Loading state shown during save
- [ ] **FR-018**: Inline validation errors displayed
- [ ] **FR-019**: Ticket data updates immediately on success
- [ ] **FR-020**: Version conflicts detected
- [ ] **FR-021**: Conflict error message is descriptive
- [ ] **FR-022**: Refresh prompt after conflict
- [ ] **FR-023**: Optimistic UI update before server response
- [ ] **FR-024**: Rollback on save failure
- [ ] **FR-025**: Success toast on successful save
- [ ] **FR-026**: Error toast on save failure
- [ ] **FR-027**: Board state refreshes after save
- [ ] **FR-028**: User context/position preserved after save

### Performance
- [ ] UI response: <100ms
- [ ] API response: <500ms (p95)
- [ ] Character counter: <16ms per keystroke

### Accessibility
- [ ] Keyboard navigation works (Tab, Enter, ESC)
- [ ] Screen reader announces character counter
- [ ] Focus management correct
- [ ] ARIA labels present

---

## Next Steps After Validation

1. ✅ All quickstart scenarios pass
2. ✅ All E2E tests pass
3. ✅ Performance metrics meet targets
4. ✅ Accessibility requirements verified
5. → Ready for user acceptance testing (UAT)
6. → Ready for deployment to staging/production

**Feature Status**: Ready for `/tasks` command to generate implementation tasks.
