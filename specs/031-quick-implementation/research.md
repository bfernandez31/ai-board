# Phase 0 Research: Quick Implementation Workflow

**Feature**: 031-quick-implementation
**Date**: 2025-01-15
**Purpose**: Technical discovery and test impact analysis for INBOX → BUILD fast-track feature

## Executive Summary

The Quick Implementation feature introduces a new transition path (INBOX → BUILD) that bypasses the SPECIFY and PLAN stages for simple tasks. This research document identifies all affected components, existing test files requiring modification, and test patterns available for reuse.

**Key Finding**: Existing test infrastructure is comprehensive and can be extended without creating new test files. Primary test files requiring modification:
- `tests/api/ticket-transition.spec.ts` (API contract tests)
- `tests/e2e/board/drag-drop.spec.ts` (UI behavior tests)
- `lib/stage-validation.ts` (validation logic - requires special case handling)

---

## 1. Test Impact Analysis

### 1.1 Existing Test Files Requiring Modification

#### **PRIMARY: tests/api/ticket-transition.spec.ts** (1079 lines)

**Current Coverage**:
- 10 main transition tests (INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP)
- Job completion validation tests (15 tests in nested describe block)
- Error handling: invalid transitions, cross-project access, concurrency conflicts
- Helper function: `transitionThrough()` for multi-stage setup

**Required Modifications**:

1. **Update Test Line 211-240**: "should reject invalid transition (skipping stages)"
   - **Current Behavior**: Rejects INBOX → BUILD with 400 error
   - **New Behavior**: INBOX → BUILD should be VALID (quick-impl mode)
   - **Action**: Split test into two cases:
     - `should allow INBOX → BUILD transition (quick-impl mode)` - NEW TEST
     - `should reject other skipped stages (INBOX → PLAN/VERIFY/SHIP)` - MODIFIED TEST

2. **Add Quick-Impl Workflow Test**: After line 240
   - **Test Name**: "should transition ticket from INBOX to BUILD via quick-impl workflow"
   - **Reuse Pattern**: Copy structure from "should transition ticket from INBOX to SPECIFY" (lines 24-56)
   - **Key Differences**:
     - `targetStage: 'BUILD'` (not 'SPECIFY')
     - `command: 'quick-impl'` (not 'specify')
     - Verify modal confirmation happened (requires UI coordination - see section 1.2)

3. **Add Job Validation Exception Test**: Inside "Job Completion Validation" describe block (after line 894)
   - **Test Name**: "should allow INBOX→BUILD transition without job validation (quick-impl)"
   - **Reuse Pattern**: Copy structure from "should allow INBOX→SPECIFY transition without job validation" (lines 879-894)
   - **Assertion**: Verify no job validation occurs for INBOX → BUILD

4. **Update Concurrency Test (line 383-422)**: Modify to test quick-impl concurrency
   - **Scenario**: Two users drag same INBOX ticket to BUILD simultaneously
   - **Expected**: First-write-wins with version conflict handling

**Test Patterns to Reuse**:
- `setupTestData()` helper (from `tests/helpers/db-setup.ts`)
- `transitionThrough()` helper (lines 4, 140, 175, etc.) - **extend to support quick-impl**
- Job completion helper pattern (lines 77-87, 479-497)
- Error response validation pattern (lines 226-230)

---

#### **SECONDARY: tests/e2e/board/drag-drop.spec.ts** (413 lines)

**Current Coverage**:
- Sequential drag through workflow (INBOX → SPECIFY → PLAN) - Test T005
- Invalid transitions: skipping stages, backwards movement - Tests T006, T007
- Concurrent updates with version conflict - Test T008
- Offline detection - Test T009
- Touch/mobile support - Test T010
- Performance (<100ms latency) - Test T011

**Required Modifications**:

1. **Add Visual Feedback Test**: After line 154 (after test T005)
   - **Test Name**: "user sees color-coded drop zones during INBOX drag (quick-impl)"
   - **Reuse Pattern**: Use `dragTicketToColumn()` helper (lines 139-153) with pause before drop
   - **Assertions**:
     - SPECIFY column: `border-blue-400`, `bg-blue-50`, memo icon (📝)
     - BUILD column: `border-green-400`, `bg-green-50`, lightning icon (⚡), "Quick Implementation" badge
     - PLAN/VERIFY/SHIP columns: `opacity-50`, prohibited icon (🚫)
     - Invalid zones: cursor `not-allowed`
   - **New Helper Needed**: `startDragWithoutDrop(page, ticketId)` to pause mid-drag for visual inspection

2. **Add Modal Confirmation Test**: After visual feedback test
   - **Test Name**: "user must confirm modal before INBOX → BUILD transition"
   - **Reuse Pattern**: Modal interaction patterns from `tests/e2e/tickets/creation-modal.spec.ts`
   - **Scenario 1**: Drop INBOX → BUILD, click "Cancel" → ticket returns to INBOX
   - **Scenario 2**: Drop INBOX → BUILD, click "Proceed" → transition executes
   - **Assertion**: Modal appears 100% of the time (no "don't show again" option)

3. **Modify Test T006 (line 212-239)**: "user cannot skip stages when dragging"
   - **Current Behavior**: PLAN → SHIP is invalid (test passes)
   - **New Behavior**: INBOX → BUILD is now VALID (test would fail)
   - **Action**: Update test to use PLAN → SHIP scenario (keep test valid)
   - **Add Assertion**: Verify INBOX → BUILD does NOT show error (complementary test)

4. **Add Quick-Impl Complete Workflow Test**: After line 206
   - **Test Name**: "user can drag ticket from INBOX to BUILD via quick-impl"
   - **Reuse Pattern**: Sequential drag pattern from test T005 (lines 159-206)
   - **Flow**: INBOX → BUILD (with modal confirmation) → verify BUILD column → verify database
   - **New Helper**: `confirmModal(page, action: 'proceed' | 'cancel')`

**Test Patterns to Reuse**:
- `createTicket()` helper (lines 42-105) - supports stage parameter
- `dragTicketToColumn()` helper (lines 139-153) - mouse event simulation
- `getTicket()` helper (line 110-112) - database verification
- `completeJobForTicket()` helper (lines 118-133) - job workflow simulation
- Database state assertions (lines 183-185, 203-205)

**New Test Data Pattern**:
- Create tickets with `[e2e]` prefix (existing convention)
- Use project ID 1 (test project) consistently
- Clean up via `cleanupDatabase()` in beforeEach

---

#### **TERTIARY: lib/stage-validation.ts** (92 lines)

**Current Implementation**:
- `isValidTransition(fromStage, toStage)` - strict sequential validation
- Only allows transitions to immediately next stage
- Line 68-71: `return nextStage === toStage;`

**Required Modifications**:

1. **Extend isValidTransition() Logic** (lines 68-71):
   ```typescript
   export function isValidTransition(fromStage: Stage, toStage: Stage): boolean {
     // Special case: Quick-impl allows INBOX → BUILD
     if (fromStage === Stage.INBOX && toStage === Stage.BUILD) {
       return true;
     }

     // Default: Sequential validation
     const nextStage = getNextStage(fromStage);
     return nextStage === toStage;
   }
   ```

2. **Add Unit Tests**: Create `tests/unit/stage-validation.spec.ts` (NEW FILE)
   - **Test Cases**:
     - Normal transitions: INBOX → SPECIFY ✓
     - Quick-impl: INBOX → BUILD ✓
     - Invalid quick-impl: SPECIFY → BUILD ✗
     - Invalid skips: INBOX → PLAN ✗, INBOX → VERIFY ✗
   - **Pattern**: Copy unit test structure from `tests/unit/job-state-machine.test.ts`

**No Existing Unit Test File Found**: Need to create new file following project patterns.

---

### 1.2 Existing Test Files NOT Requiring Modification

**tests/integration/tickets/ticket-branch-assignment.spec.ts**:
- **Reason**: Tests branch field updates via `/branch` endpoint
- **Quick-Impl Impact**: Quick-impl uses same `/branch` endpoint after workflow execution
- **Verdict**: NO CHANGES NEEDED (existing tests cover quick-impl branch assignment)

**tests/api/polling/job-status.spec.ts**:
- **Reason**: Tests job polling for all command types
- **Quick-Impl Impact**: New command="quick-impl" jobs poll identically to existing jobs
- **Verdict**: NO CHANGES NEEDED (existing tests are command-agnostic)

**tests/e2e/jobs/status-update.spec.ts**:
- **Reason**: Tests job status lifecycle (PENDING → RUNNING → COMPLETED/FAILED)
- **Quick-Impl Impact**: Quick-impl jobs follow same lifecycle
- **Verdict**: NO CHANGES NEEDED (job status machine unchanged)

---

### 1.3 Test Reuse Strategy Summary

| Test File | Action | Reuse Pattern | New Tests |
|-----------|--------|---------------|-----------|
| `ticket-transition.spec.ts` | MODIFY | `setupTestData()`, `transitionThrough()`, job helpers | +3 tests |
| `drag-drop.spec.ts` | MODIFY | `createTicket()`, `dragTicketToColumn()`, database assertions | +2 tests, modify 1 test |
| `stage-validation.ts` | MODIFY | N/A (logic change) | N/A |
| `stage-validation.spec.ts` | CREATE | Unit test pattern from `job-state-machine.test.ts` | +6 tests |
| `ticket-branch-assignment.spec.ts` | NO CHANGE | N/A | 0 |
| `job-status.spec.ts` | NO CHANGE | N/A | 0 |

**Total New Tests**: 11 tests across 2 modified files + 1 new unit test file

---

## 2. Component Modification Analysis

### 2.1 Backend Components

#### **lib/workflows/transition.ts** (Lines 1-331)

**Current Behavior**:
- Line 12-19: `STAGE_COMMAND_MAP` maps BUILD → "implement"
- Line 174: `isValidTransition()` call enforces sequential transitions
- Line 189: Command lookup from `STAGE_COMMAND_MAP[targetStage]`

**Required Changes**:

1. **Add Quick-Impl Detection Logic** (after line 180):
   ```typescript
   // Detect quick-impl mode: INBOX → BUILD
   const isQuickImpl = currentStage === Stage.INBOX && targetStage === Stage.BUILD;
   ```

2. **Override Command for Quick-Impl** (modify line 189):
   ```typescript
   const command = isQuickImpl ? 'quick-impl' : STAGE_COMMAND_MAP[targetStage];
   ```

3. **Dispatch Correct Workflow** (modify line 261):
   ```typescript
   workflow_id: isQuickImpl ? 'quick-impl.yml' : 'speckit.yml',
   ```

4. **Skip Job Validation for INBOX → BUILD** (modify line 182-186):
   ```typescript
   // Skip job validation for quick-impl (no prior job in INBOX)
   if (!isQuickImpl) {
     const jobValidation = await validateJobCompletion(ticket, targetStage);
     if (!jobValidation.success) {
       return jobValidation;
     }
   }
   ```

**Test Coverage**: Lines 174, 189, 261, 182-186 all covered by `tests/api/ticket-transition.spec.ts`

---

#### **app/api/projects/[projectId]/tickets/[id]/transition/route.ts** (Lines 1-239)

**Current Behavior**:
- Line 130-133: Calls `handleTicketTransition()` from `lib/workflows/transition.ts`
- Line 135-161: Error handling with status code mapping

**Required Changes**:
- **NONE** - All logic changes happen in `handleTicketTransition()`
- Transition endpoint is transparent to quick-impl mode

**Test Coverage**: Existing tests in `ticket-transition.spec.ts` cover this endpoint

---

### 2.2 Frontend Components

#### **components/board/board.tsx** (Lines 1-end)

**Current Features**:
- Drag-and-drop with DndContext, PointerSensor, TouchSensor
- Optimistic updates with rollback on error
- Version conflict handling (409 status)
- Job polling integration

**Required Changes** (based on file structure):

1. **Add Modal Confirmation State**:
   ```typescript
   const [pendingTransition, setPendingTransition] = useState<{
     ticket: TicketWithVersion;
     targetStage: Stage;
   } | null>(null);
   ```

2. **Detect Quick-Impl in handleDragEnd**:
   ```typescript
   const handleDragEnd = useCallback(async (event: DragEndEvent) => {
     const ticket = active.data.current?.ticket;
     const targetStage = over.data.current?.stage;

     // Detect quick-impl: INBOX → BUILD
     if (ticket.stage === 'INBOX' && targetStage === 'BUILD') {
       setPendingTransition({ ticket, targetStage });
       return; // Wait for modal confirmation
     }

     // Normal transitions proceed immediately
     await executeTransition(ticket, targetStage);
   }, []);
   ```

3. **Add Modal Confirmation Handler**:
   ```typescript
   const handleQuickImplConfirm = async () => {
     if (!pendingTransition) return;
     await executeTransition(pendingTransition.ticket, pendingTransition.targetStage);
     setPendingTransition(null);
   };

   const handleQuickImplCancel = () => {
     setPendingTransition(null); // Reset state, no API call
   };
   ```

4. **Add Visual Feedback in DndContext**:
   ```typescript
   const [isDragging, setIsDragging] = useState(false);
   const [dragSource, setDragSource] = useState<Stage | null>(null);

   const handleDragStart = (event: DragStartEvent) => {
     setIsDragging(true);
     setDragSource(event.active.data.current?.stage);
   };

   // Pass isDragging and dragSource to column components
   ```

5. **Create Modal Component**: `components/board/quick-impl-modal.tsx` (NEW FILE)
   - Use shadcn/ui Dialog component (existing pattern)
   - Props: `open`, `onConfirm`, `onCancel`
   - Content: Warning message, "Cancel" and "Proceed" buttons

**Test Coverage**:
- Modal logic tested in `tests/e2e/board/drag-drop.spec.ts` (new tests)
- Visual feedback tested in `tests/e2e/board/drag-drop.spec.ts` (new visual test)

---

### 2.3 Validation Logic

#### **lib/stage-validation.ts** (92 lines)

**Analysis**: Covered in section 1.1 (TERTIARY test file)

**Summary**:
- Extend `isValidTransition()` with special case for INBOX → BUILD
- Add unit tests in new file `tests/unit/stage-validation.spec.ts`

---

## 3. GitHub Workflow Analysis

### 3.1 New Workflow File

**File**: `.github/workflows/quick-impl.yml` (NEW FILE)

**Requirements**:
- Clone structure from `.github/workflows/speckit.yml`
- Accept inputs: `ticket_id`, `project_id`, `ticket_title`, `ticket_description`, `job_id`
- Run `create-new-feature.sh --mode=quick-impl`
- Execute `/quick-impl` Claude command (NEW COMMAND)
- Update ticket branch via `PATCH /api/projects/:projectId/tickets/:id/branch`
- Update job status via `PATCH /api/jobs/:id/status`

**No Tests Required**: GitHub Actions workflows tested manually via workflow dispatch

---

### 3.2 Script Modification

**File**: `.specify/scripts/bash/create-new-feature.sh`

**Current Behavior**:
- Creates feature branch with format `{num}-{description}`
- Initializes full spec.md template

**Required Changes**:
1. **Add --mode Parameter** (with default "specify"):
   ```bash
   MODE="specify"
   while [[ $# -gt 0 ]]; do
     case $1 in
       --mode)
         MODE="$2"
         shift 2
         ;;
     esac
   done
   ```

2. **Conditional Template Selection**:
   ```bash
   if [ "$MODE" = "quick-impl" ]; then
     # Minimal spec.md with title + description only
     cat > "$SPEC_FILE" <<EOF
   # Quick Implementation: ${FEATURE_DESCRIPTION}

   **Branch**: ${BRANCH_NAME}
   **Created**: $(date +%Y-%m-%d)

   ## Description
   ${TICKET_DESCRIPTION}
   EOF
   else
     # Full template (existing behavior)
     cp .specify/templates/spec-template.md "$SPEC_FILE"
   fi
   ```

**No Tests Required**: Bash scripts tested via GitHub Actions execution

---

## 4. Test Data Requirements

### 4.1 Test Fixtures

**Existing Patterns** (from `tests/helpers/db-setup.ts`):
- Test user: `test@e2e.local`
- Test projects: ID 1 and 2 (reserved for E2E)
- Ticket naming: `[e2e]` prefix for automatic cleanup

**Quick-Impl Test Data**:
```typescript
// For INBOX → BUILD transitions
const quickImplTicket = {
  title: '[e2e] Quick bug fix',
  description: 'Fix typo in button label',
  stage: 'INBOX',
  projectId: 1,
};

// For modal confirmation tests
const modalTestTicket = {
  title: '[e2e] Modal confirmation test',
  description: 'Test quick-impl modal flow',
  stage: 'INBOX',
  projectId: 1,
};

// For visual feedback tests
const visualFeedbackTicket = {
  title: '[e2e] Visual feedback test',
  description: 'Test drag zone color coding',
  stage: 'INBOX',
  projectId: 1,
};
```

**Job Test Data** (for command="quick-impl"):
```typescript
const quickImplJob = {
  ticketId: ticket.id,
  projectId: 1,
  command: 'quick-impl',
  status: 'PENDING',
  startedAt: new Date(),
  updatedAt: new Date(),
};
```

---

### 4.2 Mock Data for GitHub Workflows

**Current Mock Pattern** (from `lib/workflows/transition.ts` lines 222-223):
```typescript
const isTestMode = process.env.NODE_ENV === 'test' || !githubToken ||
                   githubToken.includes('test') || githubToken.includes('placeholder');

if (!isTestMode) {
  // Actual Octokit dispatch
}
```

**Quick-Impl Mocking**:
- Same test mode detection
- No additional mocking infrastructure needed
- Quick-impl workflow dispatch skipped in test mode

---

## 5. Edge Cases & Error Scenarios

### 5.1 Quick-Impl Specific Edge Cases (from spec.md)

1. **Offline Drop**: INBOX → BUILD while offline
   - **Expected**: Existing offline detection prevents drop
   - **Test**: Existing test T009 in `drag-drop.spec.ts` covers this
   - **Action**: NO NEW TEST NEEDED

2. **Job Validation Skip**: INBOX → BUILD without prior job
   - **Expected**: No validation error (INBOX has no prior jobs)
   - **Test**: NEW TEST in `ticket-transition.spec.ts` (section 1.1, #3)

3. **Modal Spam**: User rapidly clicks "Proceed"
   - **Expected**: Button disabled during API call
   - **Test**: NEW TEST in `drag-drop.spec.ts` (section 1.2, #2)

4. **Concurrent Quick-Impl**: Two users drag same INBOX ticket to BUILD
   - **Expected**: Version conflict (409), first-write-wins
   - **Test**: MODIFY existing test T008 in `drag-drop.spec.ts` (section 1.1, #4)

5. **Empty Description**: Quick-impl with null ticket description
   - **Expected**: Workflow receives empty string, Claude command handles gracefully
   - **Test**: NEW TEST in `ticket-transition.spec.ts` (edge case suite)

---

### 5.2 Validation Edge Cases

**Invalid Quick-Impl Attempts** (must be rejected):
- SPECIFY → BUILD (skipping PLAN) - **remains invalid**
- PLAN → BUILD (normal transition) - **remains valid**
- INBOX → PLAN (skipping SPECIFY) - **remains invalid**
- INBOX → VERIFY (skipping SPECIFY, PLAN, BUILD) - **remains invalid**

**Test Coverage**: Modify existing test T006 in `drag-drop.spec.ts` to verify these remain invalid

---

## 6. Dependencies & Integration Points

### 6.1 External Dependencies

**No New Dependencies Required**:
- Drag-and-drop: `@dnd-kit/core` (existing)
- Modal: `shadcn/ui Dialog` (existing)
- Validation: `Zod` (existing)
- GitHub API: `@octokit/rest` (existing)

### 6.2 Integration Points

| Component | Integration Method | Test Coverage |
|-----------|-------------------|---------------|
| Frontend → API | POST `/api/projects/:projectId/tickets/:id/transition` | `ticket-transition.spec.ts` |
| API → Transition Logic | `handleTicketTransition()` | `ticket-transition.spec.ts` |
| Transition → Validation | `isValidTransition()` | `stage-validation.spec.ts` (NEW) |
| Transition → GitHub | `octokit.actions.createWorkflowDispatch()` | Mocked in test mode |
| GitHub → API | PATCH `/api/jobs/:id/status` | `jobs/status-update.spec.ts` |
| GitHub → API | PATCH `/api/projects/:projectId/tickets/:id/branch` | `ticket-branch-assignment.spec.ts` |

**All Integration Points Have Existing Test Coverage** - No new integration test infrastructure needed

---

## 7. Test Execution Strategy

### 7.1 Test Execution Order (TDD)

**Phase 1: Backend Tests** (Red → Green)
1. Create `tests/unit/stage-validation.spec.ts` (6 tests)
   - Run: `npx playwright test tests/unit/stage-validation.spec.ts`
   - Expected: ALL FAIL (validation logic not updated)
2. Update `lib/stage-validation.ts` (add INBOX → BUILD special case)
   - Run: `npx playwright test tests/unit/stage-validation.spec.ts`
   - Expected: ALL PASS
3. Add 3 tests to `tests/api/ticket-transition.spec.ts`
   - Run: `npx playwright test tests/api/ticket-transition.spec.ts`
   - Expected: NEW TESTS FAIL (transition logic not updated)
4. Update `lib/workflows/transition.ts` (quick-impl detection)
   - Run: `npx playwright test tests/api/ticket-transition.spec.ts`
   - Expected: ALL PASS

**Phase 2: Frontend Tests** (Red → Green)
1. Add 2 tests to `tests/e2e/board/drag-drop.spec.ts`
   - Run: `npx playwright test tests/e2e/board/drag-drop.spec.ts`
   - Expected: NEW TESTS FAIL (modal and visual feedback not implemented)
2. Update `components/board/board.tsx` + create modal component
   - Run: `npx playwright test tests/e2e/board/drag-drop.spec.ts`
   - Expected: ALL PASS

**Phase 3: Full Regression** (Green)
- Run: `npx playwright test`
- Expected: ALL PASS (no regressions)

---

### 7.2 Test Helpers to Create

**NEW HELPER: tests/helpers/quick-impl-helpers.ts**

```typescript
import { Page, APIResponse, expect } from '@playwright/test';

/**
 * Start drag operation without dropping (for visual feedback tests)
 */
export async function startDragWithoutDrop(
  page: Page,
  ticketId: number
): Promise<void> {
  const ticketCard = page.locator(`[data-ticket-id="${ticketId}"]`);
  const ticketBox = await ticketCard.boundingBox();

  if (ticketBox) {
    await page.mouse.move(
      ticketBox.x + ticketBox.width / 2,
      ticketBox.y + ticketBox.height / 2
    );
    await page.mouse.down();
    // DO NOT call mouse.up() - leave drag active
  }
}

/**
 * Confirm or cancel quick-impl modal
 */
export async function confirmModal(
  page: Page,
  action: 'proceed' | 'cancel'
): Promise<void> {
  const modal = page.locator('[data-testid="quick-impl-modal"]');
  await expect(modal).toBeVisible();

  const button = action === 'proceed'
    ? modal.locator('button[data-action="proceed"]')
    : modal.locator('button[data-action="cancel"]');

  await button.click();
  await expect(modal).not.toBeVisible();
}

/**
 * Verify visual feedback on drop zone
 */
export async function verifyDropZoneStyle(
  page: Page,
  stage: string,
  expectedStyle: {
    border?: string;
    background?: string;
    opacity?: string;
    icon?: string;
  }
): Promise<void> {
  const column = page.locator(`[data-stage="${stage}"]`);

  if (expectedStyle.border) {
    await expect(column).toHaveClass(new RegExp(expectedStyle.border));
  }
  if (expectedStyle.background) {
    await expect(column).toHaveClass(new RegExp(expectedStyle.background));
  }
  if (expectedStyle.opacity) {
    await expect(column).toHaveClass(new RegExp(expectedStyle.opacity));
  }
  if (expectedStyle.icon) {
    await expect(column.locator(`text=${expectedStyle.icon}`)).toBeVisible();
  }
}
```

**MODIFY HELPER: tests/helpers/transition-helpers.ts**

```typescript
// Extend existing transitionThrough() to support quick-impl
export async function transitionThrough(
  request: any,
  ticketId: number,
  stages: string[],
  mode: 'normal' | 'quick-impl' = 'normal'
): Promise<void> {
  for (const stage of stages) {
    // If quick-impl mode and stage is BUILD, skip SPECIFY and PLAN
    if (mode === 'quick-impl' && stage === 'BUILD') {
      await transitionTo(request, ticketId, 'BUILD'); // Direct INBOX → BUILD
      await completeJob(request, ticketId); // Complete the quick-impl job
      continue;
    }

    // Normal mode: sequential transitions
    await transitionTo(request, ticketId, stage);
    await completeJob(request, ticketId);
  }
}
```

---

## 8. Unknown Technical Details (Needs Clarification)

### 8.1 Modal Component Selection

**Question**: Should quick-impl modal use existing `shadcn/ui Dialog` component or create custom modal?

**Research Findings**:
- `shadcn/ui Dialog` already used in `components/tickets/ticket-detail-modal.tsx`
- Pattern: `<Dialog>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogFooter>`
- **Recommendation**: Reuse existing Dialog component for consistency

**Test Pattern**: Copy modal interaction tests from `tests/e2e/tickets/detail-modal.spec.ts`

---

### 8.2 Visual Feedback CSS Classes

**Question**: Should visual feedback use inline styles or Tailwind classes?

**Constitution Finding** (line 41-50):
- "Use shadcn/ui components exclusively for UI primitives"
- "No custom component styling from scratch—compose shadcn/ui components instead"

**Recommendation**: Use Tailwind utility classes as specified in spec.md FR-005 to FR-009:
- SPECIFY: `border-blue-400`, `bg-blue-50`
- BUILD: `border-green-400`, `bg-green-50`
- Invalid: `opacity-50`

**Test Pattern**: Use Playwright's `toHaveClass()` assertion with regex matching

---

### 8.3 Claude Command Implementation

**Question**: How should `/quick-impl` command differ from `/specify` command?

**Research Gap**: No existing quick-impl command to analyze

**Recommendation** (for implementation phase):
1. Copy `.claude/commands/speckit.specify.md` to `.claude/commands/quick-impl.md`
2. Simplify workflow:
   - Remove clarification policy handling
   - Skip quality checklist generation
   - Focus on direct implementation from title + description
3. Output minimal spec.md (title + description only)

**No Tests Required**: Claude commands tested through workflow execution

---

## 9. Risk Assessment

### 9.1 Regression Risks

| Risk | Impact | Mitigation | Test Coverage |
|------|--------|------------|---------------|
| Breaking normal workflow | HIGH | Extensive test suite modification, not creation | `ticket-transition.spec.ts` (existing + 3 new) |
| Validation bypass | MEDIUM | Unit tests for stage validation | `stage-validation.spec.ts` (NEW, 6 tests) |
| Modal spam | LOW | Button disable during API call | `drag-drop.spec.ts` (NEW test) |
| Job validation conflict | MEDIUM | Explicit INBOX → BUILD exemption in validation logic | `ticket-transition.spec.ts` (NEW test) |

**Mitigation Strategy**: Run full test suite after each phase (section 7.1)

---

### 9.2 Test Data Isolation

**Risk**: Quick-impl tests interfere with normal workflow tests

**Mitigation**:
- Use `[e2e]` prefix for all test tickets (existing convention)
- Run `cleanupDatabase()` in `beforeEach` hooks (existing pattern)
- Use deterministic project IDs (1, 2) for tests (existing pattern)
- No shared state between test files

**Validation**: All test files use `test.beforeEach(cleanupDatabase)` pattern

---

## 10. Implementation Readiness Checklist

### Backend Components
- [x] Stage validation logic modification identified (`lib/stage-validation.ts`)
- [x] Transition logic modification identified (`lib/workflows/transition.ts`)
- [x] API endpoint analysis complete (no changes needed)
- [x] Unit test file structure defined (`stage-validation.spec.ts`)
- [x] Test patterns identified (`setupTestData()`, `transitionThrough()`)

### Frontend Components
- [x] Board component modifications identified (`components/board/board.tsx`)
- [x] Modal component structure defined (`quick-impl-modal.tsx`)
- [x] Visual feedback CSS classes specified (Tailwind utilities)
- [x] E2E test patterns identified (`createTicket()`, `dragTicketToColumn()`)
- [x] Test helpers defined (`startDragWithoutDrop()`, `confirmModal()`, `verifyDropZoneStyle()`)

### Test Infrastructure
- [x] Primary test files identified (2 files)
- [x] Test modification strategy defined (extend, not create)
- [x] Test execution order planned (TDD phases)
- [x] Test helper functions specified (`quick-impl-helpers.ts`)
- [x] Test data patterns documented (`[e2e]` prefix convention)

### GitHub Workflows
- [x] Workflow file structure identified (clone `speckit.yml`)
- [x] Script modification requirements documented (`--mode` parameter)
- [x] Claude command structure defined (simplify `/specify`)

### Edge Cases
- [x] 8 edge cases documented in spec.md
- [x] Test coverage mapped for each edge case
- [x] No new edge cases discovered during research

---

## 11. Next Steps

### Phase 1: Design & Contracts (after research approval)

1. **Create data-model.md**:
   - Extract Job entity with command="quick-impl"
   - Define TransitionMode conceptual entity
   - Document stage transition state machine with new path

2. **Generate API contracts**:
   - No new API endpoints (reuse existing)
   - Document quick-impl mode detection in `/transition` endpoint
   - Document command="quick-impl" in Job model

3. **Create quickstart.md**:
   - Test-first implementation order (section 7.1)
   - Component modification checklist
   - Test helper creation guide

### Phase 2: Task Generation

- Execute `/speckit.tasks` to generate implementation tasks
- Reference test files and patterns identified in this research
- Prioritize test creation over implementation (TDD)

---

## Research Complete

**Status**: ✅ All technical unknowns resolved
**Test Strategy**: Extend existing test files (11 new tests across 3 files)
**Risk Level**: LOW (comprehensive test coverage plan)
**Ready for Planning**: YES
