# Tasks: Ticket Detail Modal

**Feature**: 005-add-ticket-detail
**Branch**: `005-add-ticket-detail`
**Input**: Design documents from `/specs/005-add-ticket-detail/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Summary

**Total Tasks**: 22
**Parallel Tasks**: 8 E2E tests (T004-T011)
**Critical Path**: Tests → Component → Integration → Validation

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- All file paths are absolute from repository root

---

## Phase 3.1: Setup & Prerequisites

### T001: Verify shadcn/ui Dialog component is installed
**File**: `package.json`, `components/ui/dialog.tsx`
**Description**: Confirm `@radix-ui/react-dialog` is in dependencies and `components/ui/dialog.tsx` exists. If missing, install using shadcn/ui CLI.
**Command**:
```bash
# Check if Dialog exists
ls components/ui/dialog.tsx
# If missing, install
npx shadcn-ui@latest add dialog
```
**Expected Outcome**: Dialog component available for use

### T002: Verify date-fns is installed
**File**: `package.json`
**Description**: Confirm `date-fns` is in dependencies (should already be installed per plan.md). If missing, install it.
**Command**:
```bash
npm list date-fns
# If missing: npm install date-fns
```
**Expected Outcome**: `date-fns` available for date formatting

### T003: Review existing TicketCard component structure
**File**: `components/board/ticket-card.tsx`
**Description**: Read and understand the current TicketCard implementation, including drag-and-drop setup, props interface, and event handlers. Note how `isDragging` state is managed.
**Expected Outcome**: Understanding of integration points for adding onClick handler

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL**: These tests MUST be written and MUST FAIL before ANY implementation begins. This is Test-Driven Development (Red-Green-Refactor).

### T004 [P]: E2E test - Basic modal open and close
**File**: `tests/ticket-detail-modal.spec.ts` (create new file)
**Description**: Write Playwright E2E test for Scenario 1 from quickstart.md. Test should:
- Navigate to /board
- Click first ticket card
- Assert modal is visible with `[role="dialog"]`
- Assert ticket title is displayed
- Click close button
- Assert modal is hidden
**Test must FAIL** (modal doesn't exist yet)
**Expected Outcome**: Failing test ready for implementation

### T005 [P]: E2E test - ESC key dismissal
**File**: `tests/ticket-detail-modal.spec.ts`
**Description**: Write Playwright E2E test for Scenario 2. Test should:
- Navigate to /board
- Click ticket card to open modal
- Press ESC key
- Assert modal closes
**Test must FAIL**
**Expected Outcome**: Failing test ready

### T006 [P]: E2E test - Click outside to close
**File**: `tests/ticket-detail-modal.spec.ts`
**Description**: Write Playwright E2E test for Scenario 3. Test should:
- Open modal by clicking ticket
- Click overlay area (outside modal content)
- Assert modal closes
- Verify clicking modal content does NOT close modal
**Test must FAIL**
**Expected Outcome**: Failing test ready

### T007 [P]: E2E test - Multiple tickets display correctly
**File**: `tests/ticket-detail-modal.spec.ts`
**Description**: Write Playwright E2E test for Scenario 4. Test should:
- Click first ticket, verify its title in modal
- Close modal
- Click second ticket, verify different title in modal
- Assert no data persistence from previous modal
**Test must FAIL**
**Expected Outcome**: Failing test ready

### T008 [P]: E2E test - Mobile responsive (full-screen)
**File**: `tests/ticket-detail-modal.spec.ts`
**Description**: Write Playwright E2E test for Scenario 5. Test should:
- Set viewport to mobile size (375px width)
- Click ticket card
- Assert modal has full-screen classes
- Verify no rounded corners
- Verify close button accessible
**Test must FAIL**
**Expected Outcome**: Failing test ready

### T009 [P]: E2E test - Desktop responsive (centered)
**File**: `tests/ticket-detail-modal.spec.ts`
**Description**: Write Playwright E2E test for Scenario 6. Test should:
- Set viewport to desktop size (1280px width)
- Click ticket card
- Assert modal is centered with max-width
- Verify rounded corners visible
- Verify overlay visible
**Test must FAIL**
**Expected Outcome**: Failing test ready

### T010 [P]: E2E test - Long content scrolling
**File**: `tests/ticket-detail-modal.spec.ts`
**Description**: Write Playwright E2E test for Scenario 7. Test should:
- Create ticket with long description (>500 chars) in beforeEach
- Click ticket with long description
- Verify description area is scrollable
- Assert layout not broken
**Test must FAIL**
**Expected Outcome**: Failing test ready

### T011 [P]: E2E test - Stage badge colors
**File**: `tests/ticket-detail-modal.spec.ts`
**Description**: Write Playwright E2E test for Scenario 8. Test should:
- For each stage (INBOX, PLAN, BUILD, VERIFY, SHIP):
  - Click ticket in that stage
  - Assert badge has correct color class
  - Close modal
**Test must FAIL**
**Expected Outcome**: Failing test ready

**🛑 CHECKPOINT**: Run `npm run test:e2e` - All 8 tests must FAIL before proceeding

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### T012: Create TicketDetailModal component shell
**File**: `components/board/ticket-detail-modal.tsx` (create new file)
**Description**: Create component file with:
- `"use client"` directive
- TypeScript interface for props (ticket, open, onOpenChange)
- Empty component returning null
- Export statement
**Dependencies**: T004-T011 must be failing
**Expected Outcome**: Component file exists, importable

### T013: Implement basic modal structure with Dialog
**File**: `components/board/ticket-detail-modal.tsx`
**Description**: Import and compose shadcn/ui Dialog components:
- Dialog root with `open` and `onOpenChange` props
- DialogContent wrapper
- DialogHeader with DialogTitle
- DialogClose button
- Return early if `ticket` is null
**Expected Outcome**: Modal opens/closes (T004, T005, T006 may start passing)

### T014: Add ticket data display elements
**File**: `components/board/ticket-detail-modal.tsx`
**Description**: Add ticket information display:
- Title in DialogTitle (large, bold)
- Description text with proper styling
- Layout structure for dates section
**Expected Outcome**: Basic ticket info displayed (T007 may pass)

### T015: Add date formatting with date-fns
**File**: `components/board/ticket-detail-modal.tsx`
**Description**:
- Import `format` from `date-fns`
- Create helper function `formatTicketDate(date: Date): string`
- Use format: `MMM d, yyyy h:mm a`
- Display Created and Last Updated dates with labels
- Add error handling for invalid dates
**Expected Outcome**: Dates display in readable format

### T016: Add stage badge with color mapping
**File**: `components/board/ticket-detail-modal.tsx`
**Description**:
- Import Badge from `@/components/ui/badge`
- Create `stageBadgeConfig` mapping stages to colors:
  - INBOX: `bg-zinc-600 text-zinc-50`
  - PLAN: `bg-blue-600 text-blue-50`
  - BUILD: `bg-green-600 text-green-50`
  - VERIFY: `bg-orange-600 text-orange-50`
  - SHIP: `bg-purple-600 text-purple-50`
- Display badge with ticket.stage
**Expected Outcome**: Stage badge shows with correct color (T011 passes)

### T017: Add responsive styling (mobile full-screen, desktop centered)
**File**: `components/board/ticket-detail-modal.tsx`
**Description**: Add Tailwind classes to DialogContent:
- Mobile (<768px): `h-screen w-screen`
- Desktop (≥768px): `sm:h-auto sm:max-w-2xl sm:rounded-lg`
- Add max-height for description with scrolling: `max-h-96 overflow-y-auto`
**Expected Outcome**: Responsive behavior works (T008, T009 pass)

### T018: Add dark theme styling
**File**: `components/board/ticket-detail-modal.tsx`
**Description**: Apply consistent dark theme:
- Background: `bg-zinc-900`
- Borders: `border-zinc-700`
- Text colors: `text-zinc-100` (primary), `text-zinc-400` (labels)
- Close button: `text-zinc-400 hover:text-zinc-100`
**Expected Outcome**: Dark theme consistent with app

### T019: Add scrolling for long content
**File**: `components/board/ticket-detail-modal.tsx`
**Description**:
- Wrap description in scrollable container
- Add `overflow-y-auto` and `max-h-96` classes
- Ensure title and dates remain visible (sticky or outside scroll area)
**Expected Outcome**: Long descriptions scroll (T010 passes)

**🛑 CHECKPOINT**: Run E2E tests - T004-T006, T011 should now PASS

---

## Phase 3.4: Integration with Board

### T020: Add onClick prop to TicketCard component
**File**: `components/board/ticket-card.tsx`
**Description**:
- Add optional prop: `onTicketClick?: (ticket: TicketWithVersion) => void`
- Create `handleClick` function that:
  - Checks if `!isDragging`
  - Calls `onTicketClick?.(ticket)` if not dragging
- Add `onClick={handleClick}` to wrapper div
- Ensure drag-and-drop functionality not affected
**Dependencies**: T012-T019 complete
**Expected Outcome**: TicketCard clickable without breaking drag

### T021: Add modal state management to Board component
**File**: `components/board/board.tsx`
**Description**:
- Import TicketDetailModal
- Add state: `const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)`
- Add state: `const [isModalOpen, setIsModalOpen] = useState(false)`
- Create `handleTicketClick` handler that sets both states
- Create `handleModalClose` handler that clears both states
- Render TicketDetailModal with props at end of JSX
**Dependencies**: T020 complete
**Expected Outcome**: Modal state managed by Board

### T022: Wire up ticket click handlers
**File**: `components/board/board.tsx`
**Description**:
- Pass `onTicketClick={handleTicketClick}` to all TicketCard instances
- Verify prop is passed in all render locations (stage columns)
**Dependencies**: T021 complete
**Expected Outcome**: Clicking tickets opens modal (T007 passes)

**🛑 CHECKPOINT**: Run ALL E2E tests - ALL should PASS (T004-T011)

---

## Phase 3.5: Polish & Validation

### T023: Add TypeScript type safety validation
**File**: `components/board/ticket-detail-modal.tsx`
**Description**:
- Ensure all props have explicit types
- Add JSDoc comments for props interface
- Add type guard for null checking: `if (!ticket) return null`
- Run `npm run type-check` to verify strict mode compliance
**Expected Outcome**: No TypeScript errors, strict mode compliance

### T024: Add accessibility attributes
**File**: `components/board/ticket-detail-modal.tsx`
**Description**:
- Add `aria-label="Close"` to DialogClose button
- Verify `aria-labelledby` on dialog title (should be automatic)
- Test keyboard navigation (Tab, ESC)
- Verify focus management (focus trap working)
**Expected Outcome**: Keyboard and screen reader accessible

### T025 [P]: Run manual quickstart validation
**File**: `specs/005-add-ticket-detail/quickstart.md`
**Description**: Execute all 10 quickstart scenarios manually:
- Test on Chrome, Firefox, Safari
- Verify mobile and desktop views
- Check all edge cases
- Document any issues found
**Dependencies**: T004-T024 complete
**Expected Outcome**: All quickstart scenarios pass

### T026 [P]: Performance validation
**File**: N/A (manual testing)
**Description**:
- Use DevTools Performance tab
- Measure modal open time (should be <100ms)
- Test with 10+ tickets on board
- Verify smooth animations (60fps)
- Check for memory leaks (open/close 10 times)
**Expected Outcome**: Performance goals met

### T027: Code cleanup and formatting
**File**: `components/board/ticket-detail-modal.tsx`, `components/board/ticket-card.tsx`, `components/board/board.tsx`
**Description**:
- Remove any console.log statements
- Remove commented-out code
- Run `npm run format` (Prettier)
- Run `npm run lint` and fix any warnings
- Add JSDoc comments to exported functions
**Dependencies**: T023-T026 complete
**Expected Outcome**: Clean, formatted, linted code

### T028: Final E2E test suite run
**File**: `tests/ticket-detail-modal.spec.ts`
**Description**:
- Run full E2E test suite: `npm run test:e2e`
- Verify all 8 tests pass consistently
- Test in headless mode
- Test in UI mode for visual verification
- Fix any flaky tests
**Dependencies**: T027 complete
**Expected Outcome**: All tests pass reliably

---

## Dependencies Graph

```
Setup (T001-T003)
    ↓
Tests [P] (T004-T011) ← MUST FAIL
    ↓
Component Shell (T012)
    ↓
Basic Modal (T013) → Tests T004-T006 start passing
    ↓
Data Display (T014-T016) → Test T007, T011 pass
    ↓
Responsive (T017-T019) → Tests T008-T010 pass
    ↓
Integration (T020-T022) → ALL tests pass
    ↓
Polish [P] (T023-T028)
```

## Parallel Execution Examples

### Execute All E2E Tests Together (After T012)
```bash
# All tests can run in parallel (different test cases)
npm run test:e2e -- ticket-detail-modal.spec.ts
```

### Execute Polish Tasks in Parallel (T023-T026)
```bash
# Terminal 1: Type checking
npm run type-check

# Terminal 2: Manual testing
# Follow quickstart.md scenarios

# Terminal 3: Performance testing
# Use Chrome DevTools Performance tab
```

## Task Execution Notes

### TDD Cycle
1. **Red**: Write all tests T004-T011 (tests FAIL)
2. **Green**: Implement T012-T022 (tests PASS)
3. **Refactor**: Polish T023-T028 (tests stay PASSING)

### Commit Strategy
- Commit after T003: "Setup verification complete"
- Commit after T011: "Add failing E2E tests for ticket detail modal"
- Commit after T013: "Add basic modal structure"
- Commit after T019: "Complete modal component implementation"
- Commit after T022: "Integrate modal with Board and TicketCard"
- Commit after T028: "Polish and finalize ticket detail modal feature"

### Common Pitfalls to Avoid
- ❌ Implementing before tests are written
- ❌ Skipping the "tests must fail" verification
- ❌ Breaking drag-and-drop when adding click handler
- ❌ Modal state persisting between opens
- ❌ Not testing responsive behavior on actual mobile viewport

## Validation Checklist

**Pre-Implementation** (After T011):
- [x] All contracts have corresponding tests
- [x] All test scenarios from quickstart.md covered
- [x] Tests confirmed to FAIL
- [x] Parallel tasks are independent

**Post-Implementation** (After T022 - Implementation Complete ✅):
- [x] TicketDetailModal component created with all features (T012-T019)
- [x] onClick handler added to TicketCard (T020)
- [x] Modal state management added to Board (T021-T022)
- [x] All handlers wired up correctly
- [x] TypeScript strict mode compliance verified (no new errors)
- [x] Code linted successfully (no warnings or errors)
- [ ] All E2E tests pass (ready to run with dev server)
- [ ] Manual quickstart scenarios pass (ready for testing)
- [ ] Performance goals met (<100ms open time)
- [ ] Dark theme consistent (implemented)
- [ ] Responsive behavior works (implemented: mobile full-screen, desktop centered)
- [ ] Accessibility standards met (implemented: ARIA labels, keyboard navigation)
- [ ] Drag-and-drop not affected (implemented: isDragging check)

## Success Criteria

**Feature is complete when**:
1. ✅ All 8 E2E tests pass consistently
2. ✅ All 10 quickstart scenarios validated
3. ✅ TypeScript strict mode with no errors
4. ✅ Constitution principles upheld (TDD, components, types, security)
5. ✅ Performance goals achieved (<100ms modal open)
6. ✅ No regressions in existing features (drag-and-drop works)
7. ✅ Code reviewed and approved

**Ready for**: Production deployment
