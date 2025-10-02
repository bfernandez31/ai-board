# Quickstart: Add SPECIFY Stage to Kanban Workflow

**Date**: 2025-10-02
**Feature**: 006-specify-add-specify
**Estimated Time**: 5-10 minutes

## Purpose

This quickstart guide validates that the SPECIFY stage has been correctly integrated into the kanban workflow. It covers all critical user flows defined in the feature specification.

---

## Prerequisites

✅ **Environment Setup**:
- Node.js 22.20.0 LTS installed
- PostgreSQL 14+ running locally or accessible
- Dependencies installed: `npm install`
- Database migrated: `npx prisma migrate dev`
- Prisma client generated: `npx prisma generate`

✅ **Verification Commands**:
```bash
# Check Node version
node --version  # Expected: v22.20.0 or higher

# Check PostgreSQL connection
psql $DATABASE_URL -c "SELECT version();"

# Verify migration applied
psql $DATABASE_URL -c "SELECT enum_range(NULL::\"Stage\");"
# Expected output: {INBOX,SPECIFY,PLAN,BUILD,VERIFY,SHIP}

# Verify Prisma client includes SPECIFY
npm run type-check  # Should compile without errors
```

---

## Test Scenario: Complete SPECIFY Workflow

### Step 1: Start Development Environment

```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Expected output:
# ▲ Next.js 15.0.0
# - Local:        http://localhost:3000
# - Ready in XXXms
```

**Verification**:
- Server starts without errors
- No TypeScript compilation errors
- No Prisma client errors

---

### Step 2: Open Application

1. Open browser to `http://localhost:3000`
2. Board should display **6 columns** in this order:
   - INBOX (gray theme)
   - **SPECIFY** (yellow/amber theme) ← **NEW COLUMN**
   - PLAN (blue theme)
   - BUILD (green theme)
   - VERIFY (orange theme)
   - SHIP (purple theme)

**Expected Visual**:
```
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ INBOX   │ SPECIFY │  PLAN   │  BUILD  │ VERIFY  │  SHIP   │
│   [0]   │   [0]   │   [0]   │   [0]   │   [0]   │   [0]   │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ [+ New] │ No tkts │ No tkts │ No tkts │ No tkts │ No tkts │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

**Verification**:
- [ ] SPECIFY column visible between INBOX and PLAN
- [ ] SPECIFY column has yellow/amber color theme (distinct from others)
- [ ] SPECIFY column shows "No tickets" empty state message
- [ ] Ticket count badge shows [0]
- [ ] Grid layout shows 6 columns (not 5)

---

### Step 3: Create New Ticket

1. Click **"+ New Ticket"** button in INBOX column
2. Fill in ticket details:
   - **Title**: "Test SPECIFY stage workflow"
   - **Description**: "Validate drag-and-drop through SPECIFY"
3. Click **"Create Ticket"**

**Expected Behavior**:
- Modal closes
- New ticket appears in INBOX column
- Ticket shows in INBOX with ticket ID (e.g., #1)
- Badge shows "SONNET"
- No errors in console

**Verification**:
- [ ] Ticket created successfully
- [ ] Ticket appears in INBOX column (default stage)
- [ ] INBOX count badge increments to [1]
- [ ] Ticket displays with proper styling

---

### Step 4: Drag Ticket from INBOX to SPECIFY ✅

1. Click and hold on the ticket in INBOX
2. Drag ticket to SPECIFY column (column immediately to the right)
3. Release to drop

**Expected Behavior**:
- Ticket moves from INBOX to SPECIFY
- Success toast appears: "Ticket updated - Moved to SPECIFY"
- Database updates (verify with browser refresh - ticket stays in SPECIFY)
- INBOX count: [1] → [0]
- SPECIFY count: [0] → [1]

**Verification**:
- [ ] Drag operation completes successfully
- [ ] Ticket appears in SPECIFY column
- [ ] Success toast notification shown
- [ ] Ticket persists in SPECIFY after page refresh (F5)
- [ ] No console errors

---

### Step 5: Drag Ticket from SPECIFY to PLAN ✅

1. Drag ticket from SPECIFY column
2. Drop in PLAN column (column immediately to the right of SPECIFY)

**Expected Behavior**:
- Ticket moves from SPECIFY to PLAN
- Success toast: "Ticket updated - Moved to PLAN"
- SPECIFY count: [1] → [0]
- PLAN count: [0] → [1]

**Verification**:
- [ ] Drag operation completes successfully
- [ ] Ticket moves to PLAN column
- [ ] Success toast notification shown
- [ ] Ticket persists in PLAN after page refresh

---

### Step 6: Test Invalid Transition - Backwards Movement ❌

**Create a ticket in SPECIFY stage first** (repeat Steps 3-4 to create ticket #2 in SPECIFY).

1. Drag ticket from SPECIFY column
2. Attempt to drop in INBOX column (column to the left)

**Expected Behavior**:
- Drag operation **blocked**
- Error toast appears with red/destructive styling:
  - **Title**: "Invalid stage transition"
  - **Description**: "Cannot move from SPECIFY to INBOX. Tickets must progress sequentially."
- Ticket remains in SPECIFY (no movement)
- SPECIFY count unchanged [1]
- INBOX count unchanged [0]

**Verification**:
- [ ] Drag operation rejected (ticket stays in SPECIFY)
- [ ] Error toast displayed with descriptive message
- [ ] No API call made (check Network tab - no PATCH request)
- [ ] Ticket counts remain unchanged

---

### Step 7: Test Invalid Transition - Skipping SPECIFY ❌

**Create a new ticket in INBOX first** (repeat Step 3 to create ticket #3).

1. Drag ticket from INBOX column
2. Attempt to drop directly in PLAN column (skipping SPECIFY)

**Expected Behavior**:
- Drag operation **blocked**
- Error toast appears:
  - **Title**: "Invalid stage transition"
  - **Description**: "Cannot move from INBOX to PLAN. Tickets must progress sequentially."
- Ticket remains in INBOX (no movement)
- INBOX count unchanged
- PLAN count unchanged

**Verification**:
- [ ] Drag operation rejected (ticket stays in INBOX)
- [ ] Error toast displayed with descriptive message
- [ ] Ticket cannot skip SPECIFY stage
- [ ] Correct error message referencing INBOX → PLAN transition

---

### Step 8: Verify SPECIFY Badge Color

1. Observe ticket card while in SPECIFY column

**Expected Styling** (based on research):
- Column header background: `bg-yellow-950/60` or `bg-amber-950/60`
- Column background: `bg-yellow-950/40` or `bg-amber-950/40`
- Column border: `border-yellow-900/40` or `border-amber-900/40`
- Count badge background: `bg-yellow-800/70` or `bg-amber-800/70`
- Count badge text: `text-yellow-50` or `text-amber-50`
- Header text: `text-yellow-100` or `text-amber-100`

**Verification**:
- [ ] SPECIFY column uses yellow/amber color scheme
- [ ] Color is visually distinct from other stages (not gray, blue, green, orange, or purple)
- [ ] Styling follows the same pattern as other stage columns
- [ ] Badge and header styling match STAGE_CONFIG pattern

---

### Step 9: Verify Empty State Message

1. Move all tickets out of SPECIFY column (to PLAN)
2. Observe SPECIFY column empty state

**Expected**:
```
┌──────────┐
│ SPECIFY  │
│    [0]   │
├──────────┤
│          │
│ No tickets│ ← Same message as other columns
│          │
└──────────┘
```

**Verification**:
- [ ] Empty state message is "No tickets"
- [ ] Message styling matches other columns: `text-center text-sm text-zinc-400/90 py-12 font-medium`
- [ ] No custom/different empty state message for SPECIFY

---

### Step 10: Verify Migration Data Integrity

**If you have existing tickets from before migration**:

1. Check that pre-existing tickets in PLAN/BUILD/VERIFY/SHIP stages remain in their original stages
2. Verify no tickets were moved backwards to SPECIFY during migration

**Database Verification**:
```bash
# Check ticket distribution by stage
psql $DATABASE_URL -c "SELECT stage, COUNT(*) FROM \"Ticket\" GROUP BY stage ORDER BY stage;"

# Expected output (example):
#   stage  | count
# ---------+-------
#  INBOX   |   1   ← New tickets or tickets you moved
#  SPECIFY |   1   ← Tickets you manually moved during testing
#  PLAN    |   X   ← Pre-existing tickets (unchanged)
#  BUILD   |   Y   ← Pre-existing tickets (unchanged)
#  VERIFY  |   Z   ← Pre-existing tickets (unchanged)
#  SHIP    |   W   ← Pre-existing tickets (unchanged)
```

**Verification**:
- [ ] Pre-existing tickets unchanged by migration
- [ ] Only tickets manually moved during testing are in INBOX/SPECIFY
- [ ] Default stage for new tickets is INBOX (not SPECIFY)

---

## Success Criteria

All checkboxes above must be checked (✅) to consider the feature complete:

**Visual Integration** (Steps 1-2):
- [x] 6 columns displayed in correct order
- [x] SPECIFY column visible with yellow/amber theme
- [x] Empty state message matches other columns

**Valid Transitions** (Steps 3-5):
- [x] Ticket creation defaults to INBOX
- [x] INBOX → SPECIFY drag succeeds
- [x] SPECIFY → PLAN drag succeeds
- [x] Changes persist after refresh

**Invalid Transitions** (Steps 6-7):
- [x] SPECIFY → INBOX drag blocked with error toast
- [x] INBOX → PLAN drag blocked with error toast
- [x] Error messages are descriptive and accurate

**Styling & UX** (Steps 8-9):
- [x] SPECIFY badge colors match existing pattern
- [x] Empty state matches other columns

**Data Integrity** (Step 10):
- [x] Existing tickets unchanged by migration
- [x] New tickets default to INBOX

---

## Troubleshooting

### Issue: SPECIFY column not visible

**Possible Causes**:
- Prisma client not regenerated after schema change
- TypeScript compilation using cached types
- Browser cache showing old UI

**Solutions**:
```bash
# Regenerate Prisma client
npx prisma generate

# Clear Next.js cache and rebuild
rm -rf .next
npm run build

# Hard refresh browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
```

---

### Issue: Error toast says "Cannot move from INBOX to PLAN" when dragging to SPECIFY

**Possible Causes**:
- Stage validation logic not updated with SPECIFY
- STAGE_ORDER array missing SPECIFY

**Solutions**:
```bash
# Verify STAGE_ORDER in lib/stage-validation.ts includes SPECIFY at index 1
grep -A 6 "const STAGE_ORDER" lib/stage-validation.ts

# Expected output:
# const STAGE_ORDER: Stage[] = [
#   Stage.INBOX,
#   Stage.SPECIFY,  ← Must be present
#   Stage.PLAN,
#   ...
```

---

### Issue: Drag-and-drop doesn't work (no movement, no errors)

**Possible Causes**:
- Offline mode activated
- JavaScript errors preventing drag handler execution
- Browser compatibility issue

**Solutions**:
1. Check online indicator at top of page (should not show "Offline" badge)
2. Open browser console (F12) and check for errors
3. Try different browser (Chrome, Firefox, Safari)
4. Verify `isDraggable` prop is true in Board component

---

### Issue: Database migration failed

**Possible Causes**:
- PostgreSQL enum value already exists (re-running migration)
- Active database connections blocking ALTER TYPE
- Permission issues

**Solutions**:
```bash
# Check if SPECIFY already exists
psql $DATABASE_URL -c "SELECT enum_range(NULL::\"Stage\");"

# If SPECIFY exists, skip migration and regenerate client
npx prisma generate

# If migration failed mid-way, reset and retry
npx prisma migrate reset  # WARNING: Deletes all data in development
npx prisma migrate dev
```

---

## Performance Validation

**Acceptance Criteria**:
- [ ] API response time < 200ms for PATCH /api/tickets/[id]
- [ ] Page load time < 3s on 3G network (throttle in DevTools)
- [ ] Drag-and-drop feels responsive (no lag > 100ms)

**Testing**:
```bash
# Run E2E tests with performance metrics
npm run test:e2e

# Check API response times in Network tab
# 1. Open DevTools → Network tab
# 2. Drag ticket
# 3. Find PATCH request to /api/tickets/[id]
# 4. Check "Time" column (should be < 200ms)
```

---

## Cleanup

After validating the feature:

```bash
# Optional: Delete test tickets
psql $DATABASE_URL -c "DELETE FROM \"Ticket\" WHERE title LIKE 'Test%';"

# Stop dev server
# Press Ctrl+C in terminal running npm run dev
```

---

## Next Steps

After successful quickstart validation:

1. ✅ **Phase 1 Complete**: All design artifacts created and validated
2. ➡️ **Phase 2**: Run `/tasks` command to generate implementation tasks
3. ➡️ **Phase 3**: Execute tasks.md in TDD order
4. ➡️ **Phase 4**: Run this quickstart again to validate implementation
5. ➡️ **Phase 5**: Run full E2E test suite (`npm run test:e2e`)

---

**Last Updated**: 2025-10-02
**Status**: Ready for implementation
