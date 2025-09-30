# Quickstart: Ticket Creation Modal

**Feature**: 003-add-new-ticket
**Date**: 2025-09-30
**Purpose**: Validate that ticket creation modal feature works end-to-end

## Prerequisites

- Development environment set up (Node.js 20.x, dependencies installed)
- PostgreSQL database running (see DATABASE_SETUP.md)
- Prisma migrations applied: `npx prisma migrate dev`
- Development server running: `npm run dev` on http://localhost:3000

## Quickstart Validation Steps

### 1. Visual Inspection
**Goal**: Verify UI elements are present and styled correctly

1. Navigate to http://localhost:3000/board
2. Locate the IDLE column
3. Verify "+ New Ticket" button exists at the top of IDLE column
4. Check button styling: clear, visible, accessible

**Expected Result**: ✅ Button is visible, properly styled, and clickable

---

### 2. Open Modal
**Goal**: Verify modal opens and displays form

1. Click the "+ New Ticket" button
2. Observe modal animation and overlay
3. Verify modal contains:
   - Dialog title: "Create New Ticket" or similar
   - Title input field with label
   - Description textarea field with label
   - Cancel button
   - Create button
4. Check that title field is auto-focused

**Expected Result**: ✅ Modal opens smoothly, form is visible, title field has focus

---

### 3. Create Valid Ticket
**Goal**: Verify happy path - successful ticket creation

1. Type in title field: "Test Ticket from Quickstart"
2. Type in description field: "This ticket was created to validate the modal functionality."
3. Click "Create" button
4. Observe loading state (button disabled, spinner if present)
5. Verify modal closes
6. Check IDLE column for new ticket

**Expected Result**: ✅ Ticket appears in IDLE column with correct title

---

### 4. Validate Required Fields
**Goal**: Verify empty field validation

1. Click "+ New Ticket" to open modal
2. Leave both fields empty
3. Try to click "Create" button

**Expected Result**: ✅ Create button is disabled (cannot be clicked)

Alternative:
1. Click "+ New Ticket"
2. Type "Test" in title, leave description empty
3. Try to click "Create" button

**Expected Result**: ✅ Create button is disabled

---

### 5. Validate Character Limits
**Goal**: Verify length validation

**Test A: Title too long (>100 chars)**
1. Click "+ New Ticket"
2. Paste a string >100 characters in title field:
   ```
   This is a very long title that exceeds one hundred characters and should trigger a validation error message
   ```
3. Type "Valid description" in description field
4. Observe validation error message

**Expected Result**: ✅ Error shown: "Title must be 100 characters or less", Create button disabled

**Test B: Description too long (>1000 chars)**
1. Click "+ New Ticket"
2. Type "Valid title" in title field
3. Paste a string >1000 characters in description field (generate or repeat text)
4. Observe validation error message

**Expected Result**: ✅ Error shown: "Description must be 1000 characters or less", Create button disabled

---

### 6. Validate Special Characters
**Goal**: Verify pattern validation (alphanumeric + basic punctuation only)

1. Click "+ New Ticket"
2. Type in title: "Test ticket with emoji 🚀"
3. Type valid description: "Test description"
4. Observe validation error

**Expected Result**: ✅ Error shown: "can only contain letters, numbers, and basic punctuation", Create button disabled

**Test allowed punctuation:**
1. Click "+ New Ticket"
2. Type in title: "Test, ticket! How? Yes-it works."
3. Type in description: "This description has periods, commas, hyphens, spaces, question marks, and exclamation points!"
4. Click "Create"

**Expected Result**: ✅ Ticket created successfully with punctuation intact

---

### 7. Cancel Modal
**Goal**: Verify modal can be closed without creating ticket

**Test A: Cancel button**
1. Click "+ New Ticket"
2. Type some text in title and description
3. Click "Cancel" button
4. Verify modal closes
5. Check IDLE column - no new ticket

**Expected Result**: ✅ Modal closes, no ticket created

**Test B: Click outside modal**
1. Click "+ New Ticket"
2. Type some text in title and description
3. Click on the backdrop (outside modal)
4. Verify modal closes

**Expected Result**: ✅ Modal closes, no ticket created

**Test C: Escape key**
1. Click "+ New Ticket"
2. Type some text
3. Press Escape key
4. Verify modal closes

**Expected Result**: ✅ Modal closes, no ticket created

---

### 8. Error Handling
**Goal**: Verify error handling for network/server failures

**Test A: Network error simulation (optional - requires developer tools)**
1. Open browser DevTools → Network tab
2. Enable network throttling or go offline
3. Click "+ New Ticket"
4. Fill in valid title and description
5. Click "Create"
6. Wait for timeout (15 seconds)
7. Observe error message

**Expected Result**: ✅ Error message shown: "Unable to create ticket. Please try again." or similar

**Test B: Form re-submission after error**
1. After error appears, verify form data is still present
2. Re-enable network
3. Click "Create" again
4. Verify ticket is created successfully

**Expected Result**: ✅ Ticket created on retry, modal closes

---

### 9. Multiple Tickets
**Goal**: Verify multiple tickets can be created in sequence

1. Create ticket with title "First test ticket", description "Description 1"
2. Verify it appears in IDLE
3. Click "+ New Ticket" again
4. Create ticket with title "Second test ticket", description "Description 2"
5. Verify it appears in IDLE
6. Check that both tickets are visible

**Expected Result**: ✅ Both tickets visible in IDLE column, displayed in order (newest first or oldest first per design)

---

### 10. Real-time Validation
**Goal**: Verify validation happens as user types

1. Click "+ New Ticket"
2. Type in title field (stay under 100 chars) - no errors
3. Continue typing past 100 characters
4. Observe error appears before you stop typing
5. Delete characters back to 100 or fewer
6. Observe error disappears

**Expected Result**: ✅ Validation errors appear/disappear in real-time as user types

---

## Automated Validation

After manual quickstart validation, run automated E2E test:

```bash
npx playwright test tests/ticket-creation.spec.ts
```

**Expected Result**: ✅ All Playwright tests pass

## Success Criteria

**All quickstart steps must pass** for the feature to be considered complete:

- ✅ Modal opens and closes correctly
- ✅ Valid tickets are created and appear in IDLE
- ✅ Empty fields prevent submission
- ✅ Character limits are enforced
- ✅ Special characters are rejected (except allowed punctuation)
- ✅ Cancel/close works without creating ticket
- ✅ Error handling works for network failures
- ✅ Real-time validation provides feedback
- ✅ Multiple tickets can be created
- ✅ Automated E2E tests pass

## Troubleshooting

### Modal doesn't open
- Check console for JavaScript errors
- Verify shadcn/ui Dialog components installed: `npx shadcn@latest add dialog`
- Verify NewTicketButton has correct onClick handler

### Create button stays disabled
- Check browser console for validation errors
- Verify Zod schema is imported and used correctly
- Check form state management (useState hooks)

### Ticket doesn't appear after creation
- Check Network tab for API response (should be 201)
- Verify API route at /app/api/tickets/route.ts exists
- Check that board component refreshes after creation
- Verify Prisma migration was run: `npx prisma migrate dev`

### Validation errors don't show
- Check that validation runs on field blur and change
- Verify error state is managed with useState
- Check that error messages are rendered in UI

### Database errors
- Verify PostgreSQL is running: `docker-compose up -d` (if using Docker)
- Check DATABASE_URL in .env file
- Run migrations: `npx prisma migrate dev`
- Check Prisma Studio: `npx prisma studio`

## Rollback Plan

If feature is not working:

1. **Revert code changes**: `git restore .` or `git reset --hard <commit>`
2. **Revert database migration**: `npx prisma migrate reset` (WARNING: deletes data)
3. **Reinstall dependencies** if needed: `npm install`
4. **Restart dev server**: `npm run dev`

## Next Steps

After successful quickstart validation:

1. Run full E2E test suite: `npm run test:e2e`
2. Run type check: `npm run type-check`
3. Run linter: `npm run lint`
4. Commit changes: `git commit -m "feat: add ticket creation modal"`
5. Create pull request for review