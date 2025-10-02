# Tasks: Inline Ticket Editing

**Input**: Design documents from `/Users/b.fernandez/Workspace/ai-board/specs/007-enable-inline-editing/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓), quickstart.md (✓)

## Execution Flow (main)
```
1. Load plan.md from feature directory
   ✓ Tech stack: TypeScript 5.6, Next.js 15, React 18, Prisma 6.x, Zod 4.x, shadcn/ui
   ✓ Libraries: @dnd-kit, Playwright
   ✓ Structure: Next.js App Router monorepo
2. Load optional design documents:
   ✓ data-model.md: No new entities (extends existing Ticket model)
   ✓ contracts/: patch-ticket.yaml → 6 contract tests
   ✓ research.md: 4 technical decisions → validation, hooks, components
3. Generate tasks by category:
   ✓ Setup: Zod validation, custom hooks, UI components
   ✓ Tests: 6 contract tests, 15 E2E tests (8 acceptance + 7 edge cases)
   ✓ Core: PATCH API endpoint, modal UI extensions
   ✓ Integration: Toast notifications, board refresh
   ✓ Polish: Accessibility, performance
4. Apply task rules:
   ✓ Different files = marked [P] for parallel
   ✓ Same file (ticket-detail-modal.tsx) = sequential
   ✓ Tests before implementation (TDD)
5. Number tasks sequentially (T001-T024)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   ✓ All 6 contract scenarios have tests
   ✓ All 15 E2E scenarios covered
   ✓ API endpoint + UI components implemented
9. Return: SUCCESS (24 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
Repository structure (Next.js App Router monorepo):
- API routes: `/Users/b.fernandez/Workspace/ai-board/app/api/`
- Components: `/Users/b.fernandez/Workspace/ai-board/components/`
- Lib (utilities): `/Users/b.fernandez/Workspace/ai-board/lib/`
- Tests: `/Users/b.fernandez/Workspace/ai-board/tests/`

---

## Phase 3.1: Setup & Foundation

### T001 [X] [P] Create Zod validation schemas
**File**: `/Users/b.fernandez/Workspace/ai-board/lib/validations/ticket.ts`
**Description**: Create Zod schemas for ticket validation (title, description, version, patch request)
**Details**:
- `titleSchema`: min 1 (after trim), max 100, reject whitespace-only
- `descriptionSchema`: min 1 (after trim), max 1000, reject whitespace-only
- `versionSchema`: positive integer
- `patchTicketSchema`: object with optional title/description, required version, refine to ensure at least one field present
- `ticketResponseSchema`: full ticket with all fields
- Export TypeScript types: `PatchTicketInput`, `TicketResponse`
**Reference**: `specs/007-enable-inline-editing/data-model.md` (lines 18-45)

### T002 [X] [P] Create CharacterCounter UI component
**File**: `/Users/b.fernandez/Workspace/ai-board/components/ui/character-counter.tsx`
**Description**: Create reusable CharacterCounter component with warning state and accessibility
**Details**:
- Props: `current: number`, `max: number`, `warningThreshold?: number` (default 0.9)
- Use `useMemo` to calculate: count, remaining, isWarning (>90%), isError (>max)
- Render with `aria-live="polite"` and `aria-atomic="true"`
- Display: "{remaining} characters remaining"
- Show warning icon when `isWarning` (yellow/orange)
- Show error state when `isError` (red)
- TypeScript strict mode, explicit types
**Reference**: `specs/007-enable-inline-editing/research.md` (Decision 3)

### T003 [X] [P] Create useTicketEdit custom hook
**File**: `/Users/b.fernandez/Workspace/ai-board/lib/hooks/use-ticket-edit.ts`
**Description**: Create custom hook for inline edit state management with keyboard handlers
**Details**:
- Parameters: `initialValue: string`, `onSave: (value: string) => Promise<void>`, `maxLength: number`
- State: `isEditing`, `value`, `isSaving`, `error`
- Methods: `startEdit()`, `cancelEdit()` (restore original), `handleSave()` (validate + call onSave)
- Keyboard handlers: Enter → save (title only), ESC → cancel
- Auto-focus management via `useRef`
- Return: `{ isEditing, value, isSaving, error, startEdit, cancelEdit, handleChange, handleKeyDown, inputRef }`
- TypeScript: explicit return type
**Reference**: `specs/007-enable-inline-editing/research.md` (Decision 1)

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL**: These tests MUST be written and MUST FAIL before ANY implementation. Run each test file after creation to verify RED state.

### Contract Tests (API)

**Setup Pattern**: Follow `/Users/b.fernandez/Workspace/ai-board/tests/drag-drop.spec.ts` for:
- Prisma client setup (`beforeAll`, `afterAll`)
- Database cleanup (`beforeEach`: `await prisma.ticket.deleteMany({})`)
- Helper function to create test tickets via API

### T004 [X] [P] Contract test: PATCH with valid title
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/api/tickets-patch.spec.ts`
**Description**: Test PATCH /api/tickets/[id] with valid title returns 200 and increments version
**Details**:
- Create ticket via `createTicket` helper (see drag-drop.spec.ts pattern)
- PATCH `/api/tickets/${id}` with `{ title: "Updated Title", version: 1 }`
- Assert: 200 status, response has updated title, version = 2
- Verify database state with Prisma: `await prisma.ticket.findUnique({ where: { id } })`
**Reference**: `specs/007-enable-inline-editing/contracts/patch-ticket.yaml` (example: updateTitle)

### T005 [X] [P] Contract test: PATCH with valid description
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/api/tickets-patch.spec.ts` (same file as T004)
**Description**: Test PATCH /api/tickets/[id] with valid description returns 200 and increments version
**Details**:
- Create ticket via helper
- PATCH with `{ description: "Updated description", version: 1 }`
- Assert: 200 status, description updated, version = 2
**Reference**: `specs/007-enable-inline-editing/contracts/patch-ticket.yaml` (example: updateDescription)

### T006 [X] [P] Contract test: PATCH with both fields
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/api/tickets-patch.spec.ts` (same file as T004)
**Description**: Test PATCH with both title and description updates both and increments version
**Details**:
- Create ticket
- PATCH with `{ title: "New Title", description: "New Description", version: 1 }`
- Assert: 200 status, both fields updated, version = 2
**Reference**: `specs/007-enable-inline-editing/contracts/patch-ticket.yaml` (example: updateBoth)

### T007 [X] [P] Contract test: PATCH with empty title validation error
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/api/tickets-patch.spec.ts` (same file as T004)
**Description**: Test PATCH with empty/whitespace title returns 400 validation error
**Details**:
- Create ticket
- PATCH with `{ title: "   ", version: 1 }`
- Assert: 400 status
- Response body: `{ error: "Validation failed", issues: [{ path: ["title"], message: "Title cannot be empty" }] }`
**Reference**: `specs/007-enable-inline-editing/contracts/patch-ticket.yaml` (example: emptyDescription)

### T008 [X] [P] Contract test: PATCH with stale version conflict
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/api/tickets-patch.spec.ts` (same file as T004)
**Description**: Test PATCH with stale version returns 409 Conflict
**Details**:
- Create ticket (version = 1)
- Update ticket to version = 2 (via Prisma directly: `await prisma.ticket.update({ where: { id }, data: { version: 2 } })`)
- PATCH with `{ title: "Test", version: 1 }` (stale version)
- Assert: 409 status
- Response body: `{ error: "Conflict: Ticket was modified by another user", currentVersion: 2 }`
**Reference**: `specs/007-enable-inline-editing/contracts/patch-ticket.yaml` (409 response)

### T009 [X] [P] Contract test: PATCH non-existent ticket
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/api/tickets-patch.spec.ts` (same file as T004)
**Description**: Test PATCH to non-existent ticket returns 404
**Details**:
- PATCH `/api/tickets/99999` with `{ title: "Test", version: 1 }`
- Assert: 404 status
- Response body: `{ error: "Ticket not found" }`
**Reference**: `specs/007-enable-inline-editing/contracts/patch-ticket.yaml` (404 response)

### E2E Tests (User Interface)

**Setup Pattern**: Follow `/Users/b.fernandez/Workspace/ai-board/tests/drag-drop.spec.ts` for:
- Prisma client setup and cleanup
- `createTicket` helper function to create tickets via API
- Database state verification after UI interactions

### T010 [X] [P] E2E: Click title to enter inline edit mode
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/e2e/inline-editing.spec.ts`
**Description**: Test clicking ticket title activates inline edit mode with focus
**Details**:
- Create ticket via `createTicket` helper
- Navigate to `/board`, click ticket card to open modal
- Locate title element, hover to verify pencil icon appears
- Click title
- Assert: title becomes input field, input is focused, current value is selected
- Press ESC to cancel (verify no save)
**Reference**: `specs/007-enable-inline-editing/spec.md` (FR-001, FR-002, FR-003)

### T011 [X] [P] E2E: Save title with Enter key
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/e2e/inline-editing.spec.ts` (same file as T010)
**Description**: Test Enter key saves title and returns to display mode
**Details**:
- Create ticket with title "Original Title"
- Open modal, click title to edit
- Type "Updated Title", press Enter
- Assert: input returns to display mode, title shows "Updated Title"
- Wait for success toast: "Ticket updated"
- Verify database: `await getTicket(id)` shows updated title
- Close modal, verify board shows updated title
**Reference**: `specs/007-enable-inline-editing/spec.md` (FR-004, FR-025, FR-027)

### T012 [X] [P] E2E: Cancel title edit with ESC
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/e2e/inline-editing.spec.ts` (same file as T010)
**Description**: Test ESC key cancels edit and restores original value
**Details**:
- Create ticket with title "Original Title"
- Open modal, click title, type "Changed Title"
- Press ESC
- Assert: title reverts to "Original Title", input returns to display mode
- No API call made (check network tab or verify version unchanged in DB)
- No toast notification
**Reference**: `specs/007-enable-inline-editing/spec.md` (FR-005)

### T013 [X] [P] E2E: Click description to enter edit mode with counter
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/e2e/inline-editing.spec.ts` (same file as T010)
**Description**: Test clicking description activates textarea with character counter
**Details**:
- Create ticket with description "Original description"
- Open modal, hover over description (verify pencil icon)
- Click anywhere in description region
- Assert: description becomes textarea, textarea focused
- Character counter visible with format: "X characters remaining"
- Counter shows correct remaining count (1000 - current length)
**Reference**: `specs/007-enable-inline-editing/spec.md` (FR-008, FR-009, FR-010)

### T014 [X] [P] E2E: Save description via Save button
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/e2e/inline-editing.spec.ts` (same file as T010)
**Description**: Test Save button saves description and shows loading state
**Details**:
- Create ticket
- Open modal, click description to edit
- Type "Updated description with new content"
- Click "Save" button
- Assert: loading spinner appears briefly
- Textarea returns to display mode, counter disappears
- Success toast: "Ticket updated"
- Verify DB: description updated
**Reference**: `specs/007-enable-inline-editing/spec.md` (FR-015, FR-017, FR-019, FR-025)

### T015 [X] [P] E2E: Empty title validation
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/e2e/inline-editing.spec.ts` (same file as T010)
**Description**: Test empty/whitespace title shows inline error and prevents save
**Details**:
- Create ticket
- Open modal, click title, delete all text (or type only spaces)
- Press Enter or blur
- Assert: inline error message "Title cannot be empty"
- Input remains in edit mode (not saved)
- Save button disabled (if visible)
- No API call made
**Reference**: `specs/007-enable-inline-editing/spec.md` (FR-007, FR-016, FR-018)

### T016 [X] [P] E2E: Title max length enforcement
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/e2e/inline-editing.spec.ts` (same file as T010)
**Description**: Test title input prevents typing beyond 100 characters
**Details**:
- Create ticket
- Open modal, click title
- Type 101 characters (e.g., "A".repeat(101))
- Assert: input only contains 100 characters (maxLength attribute)
- OR: if maxLength not set, attempt to save 101 chars shows error "Title must be 100 characters or less"
**Reference**: `specs/007-enable-inline-editing/spec.md` (FR-006, FR-018)

### T017 [X] [P] E2E: Description character counter warning at 90%
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/e2e/inline-editing.spec.ts` (same file as T010)
**Description**: Test character counter shows warning indicator at 900+ characters
**Details**:
- Create ticket
- Open modal, click description
- Type exactly 910 characters
- Assert: character counter shows "90 characters remaining"
- Warning indicator visible (yellow/orange color or icon)
- Continue typing to 1000 characters
- Assert: counter shows "0 characters remaining"
- Input prevents further typing (maxLength)
- Save button still enabled (1000 is valid)
- Click Save, verify success
**Reference**: `specs/007-enable-inline-editing/spec.md` (FR-013, FR-012)

### T018 [X] [P] E2E: Empty description validation
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/e2e/inline-editing.spec.ts` (same file as T010)
**Description**: Test empty description shows inline error and prevents save
**Details**:
- Create ticket
- Open modal, click description, delete all text
- Click Save button
- Assert: inline error "Description cannot be empty"
- Textarea remains in edit mode
- Save button disabled
- No API call made
**Reference**: `specs/007-enable-inline-editing/spec.md` (FR-014, FR-016, FR-018)

### T019 [X] [P] E2E: Optimistic update with rollback on network error
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/e2e/inline-editing.spec.ts` (same file as T010)
**Description**: Test optimistic update rolls back on network failure
**Details**:
- Create ticket with title "Original Title"
- Open modal, click title
- Enable "Offline" mode in browser (Playwright: `await page.context().setOffline(true)`)
- Type "Updated Title", press Enter
- Assert: title updates immediately in UI (optimistic)
- After timeout, error toast appears: "Failed to save. Changes reverted."
- Title reverts to "Original Title" (rollback)
- Re-enable network: `await page.context().setOffline(false)`
**Reference**: `specs/007-enable-inline-editing/spec.md` (FR-023, FR-024, FR-026)

### T020 [X] [P] E2E: Concurrent edit conflict (409)
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/e2e/inline-editing.spec.ts` (same file as T010)
**Description**: Test concurrent edit shows conflict error and prompts refresh
**Details**:
- Create ticket (version = 1)
- Open modal in browser, click title to edit (do NOT save yet)
- Simulate concurrent update: Use Prisma to update ticket directly (`await prisma.ticket.update({ where: { id }, data: { title: "Concurrent Update", version: 2 } })`)
- Now save edit in browser (press Enter)
- Assert: API returns 409
- Optimistic update rolls back
- Error toast: "Conflict: Ticket was modified by another user"
- Toast suggests refreshing
**Reference**: `specs/007-enable-inline-editing/spec.md` (FR-020, FR-021, FR-022, FR-024)

### T021 [X] [P] E2E: Board refreshes after successful save
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/e2e/inline-editing.spec.ts` (same file as T010)
**Description**: Test board state updates after modal save
**Details**:
- Create ticket with title "Original Title"
- Navigate to board, note ticket card shows "Original Title"
- Click card to open modal, edit title to "Updated Title", save
- Wait for success toast
- Close modal
- Assert: ticket card on board shows "Updated Title" (board refreshed)
- User's scroll position/context preserved
**Reference**: `specs/007-enable-inline-editing/spec.md` (FR-027, FR-028)

### T022 [X] [P] E2E: Save button disabled when unchanged
**File**: `/Users/b.fernandez/Workspace/ai-board/tests/e2e/inline-editing.spec.ts` (same file as T010)
**Description**: Test Save button is disabled when content is unchanged
**Details**:
- Create ticket
- Open modal, click description to edit
- Do NOT change content
- Assert: Save button is disabled (or grayed out)
- Type one character (make a change)
- Assert: Save button becomes enabled
- Delete character (restore to original)
- Assert: Save button disabled again
**Reference**: `specs/007-enable-inline-editing/spec.md` (FR-016)

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

**GATE CHECK**: Before starting T023, run all tests in Phase 3.2 and verify they FAIL (RED state). If any pass, something is wrong.

### T023 [X] Implement PATCH endpoint in API route
**File**: `/Users/b.fernandez/Workspace/ai-board/app/api/tickets/[id]/route.ts`
**Description**: Add PATCH handler for updating ticket title/description with optimistic concurrency
**Details**:
- Import `patchTicketSchema` from `lib/validations/ticket.ts`
- Create `export async function PATCH(request: Request, { params }: { params: { id: string } })` handler
- Parse request body, validate with Zod: `patchTicketSchema.safeParse(body)`
- If validation fails, return 400 with `{ error: "Validation failed", issues: error.issues }`
- Parse `id` from params: `const ticketId = parseInt(params.id)`
- Use Prisma to update with version check:
  ```typescript
  const updated = await prisma.ticket.update({
    where: { id: ticketId, version: body.version },
    data: {
      ...(body.title && { title: body.title.trim() }),
      ...(body.description && { description: body.description.trim() }),
      version: { increment: 1 }
    }
  });
  ```
- If `updated` is null (version mismatch), return 409: `{ error: "Conflict: Ticket was modified by another user", currentVersion: <fetch actual version> }`
- If ticket not found (Prisma error), return 404: `{ error: "Ticket not found" }`
- On success, return 200 with updated ticket
- Wrap in try-catch, return 500 on unexpected errors
- TypeScript: explicit types for request/response
**Reference**: `specs/007-enable-inline-editing/data-model.md` (PATCH Request Schema)

### T024 [X] Extend ticket-detail-modal with inline editing UI
**File**: `/Users/b.fernandez/Workspace/ai-board/components/board/ticket-detail-modal.tsx`
**Description**: Add inline editing for title and description with all interactive states
**Details**:
- Import: `useTicketEdit` hook, `CharacterCounter` component, `Input`, `Textarea`, `toast`
- State: Create two instances of `useTicketEdit` (one for title, one for description)
- **Title inline edit**:
  - Wrap title in clickable container with hover state (show pencil icon on hover)
  - On click, call `titleEdit.startEdit()`
  - When `titleEdit.isEditing`, render `<Input>` with `ref={titleEdit.inputRef}`, `value={titleEdit.value}`, `onChange={titleEdit.handleChange}`, `onKeyDown={titleEdit.handleKeyDown}`, `maxLength={100}`
  - When NOT editing, render title as plain text
  - Show inline error if `titleEdit.error`
- **Description inline edit**:
  - Wrap description in clickable container with hover state (show pencil icon)
  - On click, call `descriptionEdit.startEdit()`
  - When `descriptionEdit.isEditing`, render `<Textarea>` with similar props, `maxLength={1000}`
  - Show `<CharacterCounter current={descriptionEdit.value.length} max={1000} />`
  - Show Save/Cancel buttons (only when editing)
  - Save button: disabled if `descriptionEdit.isSaving || descriptionEdit.error || !valueChanged`
  - Cancel button: call `descriptionEdit.cancelEdit()`
- **Save handlers**:
  - Title: calls `handleSaveTitle()` which sends PATCH request
  - Description: calls `handleSaveDescription()` which sends PATCH request
- **Optimistic updates**:
  - Update local ticket state immediately
  - On success: show success toast, refresh parent board state (call `onUpdate` callback)
  - On error: rollback local state, show error toast
- **Error handling**: Check response status, handle 400, 404, 409 specially
- TypeScript: explicit types for all functions
**Reference**: `specs/007-enable-inline-editing/research.md` (Decision 4: Optimistic Updates)

---

## Phase 3.4: Integration & Polish

### T025 Add board refresh after modal save
**File**: `/Users/b.fernandez/Workspace/ai-board/components/board/board.tsx`
**Description**: Implement callback to refresh board state after ticket update in modal
**Details**:
- Add `handleTicketUpdate` callback function that refetches tickets or updates local state
- Pass callback to `<TicketDetailModal onUpdate={handleTicketUpdate} />`
- Ensure board re-renders with updated ticket data
- Preserve user's scroll position and context
**Reference**: `specs/007-enable-inline-editing/spec.md` (FR-027, FR-028)

### T026 [P] Add accessibility improvements
**Files**:
- `/Users/b.fernandez/Workspace/ai-board/components/board/ticket-detail-modal.tsx`
- `/Users/b.fernandez/Workspace/ai-board/components/ui/character-counter.tsx`
**Description**: Enhance keyboard navigation and screen reader support
**Details**:
- Title/description: Add `aria-label="Edit title"` to clickable regions
- Pencil icon: `aria-hidden="true"` (decorative)
- Input/Textarea: `aria-invalid={!!error}`, `aria-describedby={errorId}` when error present
- Character counter: Verify `aria-live="polite"` announces changes
- Focus management: Ensure tab order is logical (title → description → save/cancel)
- Test with screen reader (manual validation in quickstart.md)
**Reference**: `specs/007-enable-inline-editing/quickstart.md` (Accessibility section)

### T027 [P] Performance optimization
**File**: `/Users/b.fernandez/Workspace/ai-board/components/ui/character-counter.tsx`
**Description**: Verify useMemo prevents unnecessary re-renders
**Details**:
- Confirm `useMemo` wraps calculation logic
- Add React DevTools profiler check: <16ms re-render time per keystroke
- If slow, consider debouncing validation (only if needed)
**Reference**: `specs/007-enable-inline-editing/research.md` (Performance Considerations)

### T028 Run quickstart validation scenarios
**File**: Manual execution of `/Users/b.fernandez/Workspace/ai-board/specs/007-enable-inline-editing/quickstart.md`
**Description**: Execute all manual test scenarios from quickstart guide
**Details**:
- Run Scenarios 1-8 manually in browser
- Run API contract tests via cURL (Tests 1-6)
- Verify performance metrics (<100ms UI, <500ms API)
- Check accessibility with keyboard navigation and screen reader
- Mark all functional requirements (FR-001 through FR-028) as passing
- Document any issues found
**Reference**: `specs/007-enable-inline-editing/quickstart.md` (all sections)

---

## Dependencies

```
Phase 3.1 (Setup) - All [P]
  ├── T001 Zod schemas
  ├── T002 CharacterCounter
  └── T003 useTicketEdit hook
       ↓
Phase 3.2 (Tests) - All [P] MUST FAIL
  ├── T004-T009 Contract tests (same file, can write together)
  └── T010-T022 E2E tests (same file, can write together)
       ↓
Phase 3.3 (Implementation) - Sequential
  ├── T023 PATCH API endpoint
  └── T024 Modal inline editing UI
       ↓
Phase 3.4 (Integration & Polish) - Mix of [P] and sequential
  ├── T025 Board refresh (depends on T024)
  ├── T026 Accessibility [P]
  ├── T027 Performance [P]
  └── T028 Quickstart validation (depends on all)
```

**Critical Blockers**:
- T023, T024 BLOCKED until ALL tests in Phase 3.2 are written and FAILING
- T025 BLOCKED by T024 (same file modification)
- T028 BLOCKED by all other tasks

---

## Parallel Execution Examples

### Example 1: Setup Phase (T001-T003)
All foundation tasks can run in parallel:
```bash
# Launch 3 agents simultaneously:
Task: "Create Zod validation schemas in lib/validations/ticket.ts"
Task: "Create CharacterCounter UI component in components/ui/character-counter.tsx"
Task: "Create useTicketEdit custom hook in lib/hooks/use-ticket-edit.ts"
```

### Example 2: Contract Tests (T004-T009)
All in same file, but can be written together (not true parallel):
```bash
# Single task - write all 6 contract tests together
Task: "Write contract tests T004-T009 in tests/api/tickets-patch.spec.ts covering all 6 API scenarios"
```

### Example 3: E2E Tests (T010-T022)
All in same file, but can be written together (not true parallel):
```bash
# Single task - write all 13 E2E tests together
Task: "Write E2E tests T010-T022 in tests/e2e/inline-editing.spec.ts covering all user scenarios"
```

### Example 4: Polish Phase (T026-T027)
Independent polish tasks can run in parallel:
```bash
# Launch 2 agents simultaneously:
Task: "Add accessibility improvements (ARIA labels, focus management)"
Task: "Verify performance optimization with useMemo and React DevTools"
```

---

## Notes

- **[P] tasks**: Different files, no dependencies—can execute in parallel
- **TDD critical**: Verify ALL Phase 3.2 tests FAIL before starting Phase 3.3
- **Test pattern**: Follow `/Users/b.fernandez/Workspace/ai-board/tests/drag-drop.spec.ts` for Prisma setup and `createTicket` helper
- **Commit strategy**: Commit after each task for clean git history
- **Avoid**: Same file conflicts (e.g., T004-T009 are same file, so not truly parallel)

---

## Task Generation Rules Applied

1. **From Contracts** ✓:
   - `patch-ticket.yaml` → 6 contract test tasks (T004-T009) [P]
   - 1 PATCH endpoint → 1 implementation task (T023)

2. **From Data Model** ✓:
   - Validation schemas → T001 [P]
   - No new entities (existing Ticket model)

3. **From User Stories** ✓:
   - 8 acceptance scenarios + 7 edge cases → 13 E2E tests (T010-T022) [P]
   - Quickstart scenarios → validation task (T028)

4. **Ordering** ✓:
   - Setup (T001-T003) → Tests (T004-T022) → Implementation (T023-T024) → Polish (T025-T028)
   - TDD enforced: all tests before implementation

---

## Validation Checklist

- [x] All contracts have corresponding tests (6 tests for patch-ticket.yaml)
- [x] All entities have model tasks (no new entities, existing Ticket model used)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks truly independent (different files marked [P])
- [x] Each task specifies exact file path (all tasks have absolute paths)
- [x] No task modifies same file as another [P] task (verified: T004-T009 same file but not [P], T010-T022 same file but not [P])

---

**Status**: ✅ Ready for execution. Run Phase 3.2 tests first, verify RED state, then proceed with implementation.
