# Quickstart: Quick Implementation Workflow

**Feature**: 031-quick-implementation
**Date**: 2025-01-15
**Purpose**: TDD implementation guide with test-first workflow

---

## Overview

This quickstart guide provides a step-by-step implementation plan following **Test-Driven Development (TDD)** principles. All tests must be written BEFORE implementation and must FAIL initially (Red phase). Implementation makes tests pass (Green phase).

**Key Principle from Constitution** (Principle III):
> "Tests must be written BEFORE implementation. Red-Green-Refactor cycle is mandatory for all critical user flows."

---

## Phase 0: Setup & Test Discovery

### Step 1: Verify Existing Test Files

```bash
# Confirm test files exist (do NOT create duplicates)
ls -la tests/api/ticket-transition.spec.ts
ls -la tests/e2e/board/drag-drop.spec.ts
ls -la lib/stage-validation.ts
```

**Expected Output**:
- `ticket-transition.spec.ts` exists (1079 lines)
- `drag-drop.spec.ts` exists (413 lines)
- `stage-validation.ts` exists (92 lines)

**Action**: EXTEND these files, do NOT create new ones

---

## Phase 1: Backend Tests (Red → Green)

### Step 1.1: Create Unit Tests for Stage Validation

**File**: `tests/unit/stage-validation.spec.ts` (NEW FILE)

```typescript
import { test, expect, describe } from '@playwright/test';
import { Stage, isValidTransition, getNextStage } from '@/lib/stage-validation';

describe('Stage Validation - Quick Implementation', () => {
  describe('isValidTransition', () => {
    test('allows INBOX → BUILD (quick-impl)', () => {
      expect(isValidTransition(Stage.INBOX, Stage.BUILD)).toBe(true);
    });

    test('allows INBOX → SPECIFY (normal)', () => {
      expect(isValidTransition(Stage.INBOX, Stage.SPECIFY)).toBe(true);
    });

    test('rejects SPECIFY → BUILD (skipping PLAN)', () => {
      expect(isValidTransition(Stage.SPECIFY, Stage.BUILD)).toBe(false);
    });

    test('rejects INBOX → PLAN (skipping SPECIFY)', () => {
      expect(isValidTransition(Stage.INBOX, Stage.PLAN)).toBe(false);
    });

    test('rejects INBOX → VERIFY (skipping multiple stages)', () => {
      expect(isValidTransition(Stage.INBOX, Stage.VERIFY)).toBe(false);
    });

    test('allows normal sequential transitions', () => {
      expect(isValidTransition(Stage.SPECIFY, Stage.PLAN)).toBe(true);
      expect(isValidTransition(Stage.PLAN, Stage.BUILD)).toBe(true);
      expect(isValidTransition(Stage.BUILD, Stage.VERIFY)).toBe(true);
    });
  });
});
```

**Run Test** (expect ALL FAIL):
```bash
npx playwright test tests/unit/stage-validation.spec.ts
```

**Expected Output**:
```
✗ allows INBOX → BUILD (quick-impl)
  Expected: true
  Received: false
```

---

### Step 1.2: Implement Stage Validation Logic (Green Phase)

**File**: `lib/stage-validation.ts` (MODIFY lines 68-71)

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

**Run Test** (expect ALL PASS):
```bash
npx playwright test tests/unit/stage-validation.spec.ts
```

**Expected Output**:
```
✓ allows INBOX → BUILD (quick-impl)
✓ rejects SPECIFY → BUILD (skipping PLAN)
✓ allows normal sequential transitions
```

---

### Step 1.3: Add API Tests for Quick-Impl Transition

**File**: `tests/api/ticket-transition.spec.ts` (ADD at line ~240)

```typescript
/**
 * Quick Implementation Tests
 * Feature: 031-quick-implementation
 */
test.describe('Quick Implementation (INBOX → BUILD)', () => {
  /**
   * Test: INBOX → BUILD quick-impl transition
   * Given: Ticket in INBOX stage
   * When: POST with targetStage="BUILD"
   * Then: Job created with command="quick-impl", stage updated to BUILD
   */
  test('should transition ticket from INBOX to BUILD via quick-impl', async ({ request }) => {
    // Arrange
    const { ticket } = await setupTestData();
    const prisma = getPrismaClient();

    // Act
    const response = await request.post(
      `/api/projects/1/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'BUILD' },
      }
    );

    // Assert - Response
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.jobId).toBeGreaterThan(0);
    expect(body.message).toContain('Workflow dispatched');

    // Assert - Database state
    const updatedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { jobs: true },
    });

    expect(updatedTicket?.stage).toBe('BUILD');
    expect(updatedTicket?.branch).toBeNull(); // Branch not set during transition
    expect(updatedTicket?.version).toBe(2); // Incremented from 1
    expect(updatedTicket?.jobs).toHaveLength(1);
    expect(updatedTicket?.jobs[0]?.command).toBe('quick-impl'); // NOT 'implement'
    expect(updatedTicket?.jobs[0]?.status).toBe('PENDING');
  });

  /**
   * Test: INBOX → BUILD without job validation
   * Given: Ticket in INBOX stage (no prior jobs)
   * When: POST with targetStage="BUILD"
   * Then: No job validation performed (INBOX has no prior jobs)
   */
  test('should allow INBOX→BUILD transition without job validation', async ({ request }) => {
    // Arrange
    const { ticket } = await setupTestData();

    // Act - Transition from INBOX to BUILD (no prior jobs to validate)
    const response = await request.post(
      `/api/projects/1/tickets/${ticket.id}/transition`,
      { data: { targetStage: 'BUILD' } }
    );

    // Assert
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.jobId).toBeGreaterThan(0);
  });
});
```

**ALSO MODIFY existing test** (line 211-240):

```typescript
// OLD TEST (delete):
test('should reject invalid transition (skipping stages)', async ({ request }) => {
  // Tests INBOX → BUILD (now VALID for quick-impl)
});

// NEW TESTS (replace with two tests):
test('should reject INBOX → PLAN transition (skipping SPECIFY)', async ({ request }) => {
  // Arrange
  const { ticket } = await setupTestData();
  const prisma = getPrismaClient();

  // Act - Try to skip SPECIFY stage
  const response = await request.post(
    `/api/projects/1/tickets/${ticket.id}/transition`,
    {
      data: { targetStage: 'PLAN' },
    }
  );

  // Assert - Error response
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toBe('Invalid stage transition');
  expect(body.message).toContain('Cannot transition');
  expect(body.message).toContain('INBOX');
  expect(body.message).toContain('PLAN');

  // Assert - No changes
  const unchangedTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: { jobs: true },
  });

  expect(unchangedTicket?.stage).toBe('INBOX'); // Unchanged
  expect(unchangedTicket?.jobs).toHaveLength(0); // No jobs created
});

test('should reject SPECIFY → BUILD transition (skipping PLAN)', async ({ request }) => {
  // Arrange - Ticket in SPECIFY stage
  const { ticket } = await setupTestData();
  await transitionThrough(request, ticket.id, ['SPECIFY']);

  // Act - Try to skip PLAN stage
  const response = await request.post(
    `/api/projects/1/tickets/${ticket.id}/transition`,
    {
      data: { targetStage: 'BUILD' },
    }
  );

  // Assert - Error (SPECIFY → BUILD is still invalid)
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toBe('Invalid stage transition');
  expect(body.code).toBe('INVALID_TRANSITION');
});
```

**Run Test** (expect NEW TESTS FAIL):
```bash
npx playwright test tests/api/ticket-transition.spec.ts
```

**Expected Output**:
```
✗ should transition ticket from INBOX to BUILD via quick-impl
  Expected command: 'quick-impl'
  Received command: 'implement'
```

---

### Step 1.4: Implement Transition Logic (Green Phase)

**File**: `lib/workflows/transition.ts` (MODIFY multiple sections)

#### Change 1: Add Quick-Impl Detection (after line 180)

```typescript
// After line 180 (after validation check)
// Detect quick-impl mode: INBOX → BUILD
const isQuickImpl = currentStage === Stage.INBOX && targetStage === Stage.BUILD;
```

#### Change 2: Skip Job Validation for Quick-Impl (modify lines 182-186)

```typescript
// Skip job validation for quick-impl (no prior job in INBOX)
if (!isQuickImpl) {
  const jobValidation = await validateJobCompletion(ticket, targetStage);
  if (!jobValidation.success) {
    return jobValidation;
  }
}
```

#### Change 3: Override Command for Quick-Impl (modify line 189)

```typescript
// Check if target stage has automated workflow
const command = isQuickImpl ? 'quick-impl' : STAGE_COMMAND_MAP[targetStage];
```

#### Change 4: Dispatch Correct Workflow (modify line 261)

```typescript
// Dispatch GitHub Actions workflow
await octokit.actions.createWorkflowDispatch({
  owner: ticket.project.githubOwner,
  repo: ticket.project.githubRepo,
  workflow_id: isQuickImpl ? 'quick-impl.yml' : 'speckit.yml',
  ref: 'main',
  inputs: workflowInputs,
});
```

#### Change 5: Add Quick-Impl Workflow Inputs (after line 237)

```typescript
// Add ticket context for SPECIFY stage
if (targetStage === Stage.SPECIFY) {
  // Existing specifyPayload logic...
}

// Add ticket context for quick-impl mode (NEW)
if (isQuickImpl) {
  workflowInputs.ticketTitle = ticket.title;
  workflowInputs.ticketDescription = ticket.description;
}
```

**Run Test** (expect ALL PASS):
```bash
npx playwright test tests/api/ticket-transition.spec.ts
```

**Expected Output**:
```
✓ should transition ticket from INBOX to BUILD via quick-impl
✓ should allow INBOX→BUILD transition without job validation
✓ should reject INBOX → PLAN transition (skipping SPECIFY)
✓ should reject SPECIFY → BUILD transition (skipping PLAN)
```

---

## Phase 2: Frontend Tests (Red → Green)

### Step 2.1: Add Visual Feedback Test

**File**: `tests/e2e/board/drag-drop.spec.ts` (ADD after line 206)

```typescript
/**
 * Quick Implementation Visual Feedback Tests
 * Feature: 031-quick-implementation
 */
test('user sees color-coded drop zones during INBOX drag (quick-impl)', async ({ page, request }) => {
  // Arrange
  const ticket = await createTicket(request, 'INBOX');

  await page.goto(`${BASE_URL}/projects/1/board`);
  await page.waitForLoadState('domcontentloaded');

  // Act - Start drag from INBOX (do NOT complete drop)
  const ticketCard = page.locator(`[data-ticket-id="${ticket.id}"]`);
  const ticketBox = await ticketCard.boundingBox();

  if (ticketBox) {
    await page.mouse.move(
      ticketBox.x + ticketBox.width / 2,
      ticketBox.y + ticketBox.height / 2
    );
    await page.mouse.down();
    await page.waitForTimeout(100); // Pause to observe visual feedback
  }

  // Assert - SPECIFY column (blue, normal workflow)
  const specifyColumn = page.locator('[data-stage="SPECIFY"]');
  await expect(specifyColumn).toHaveClass(/border-blue-400/);
  await expect(specifyColumn).toHaveClass(/bg-blue-50/);
  await expect(specifyColumn.locator('text=📝')).toBeVisible();

  // Assert - BUILD column (green, quick-impl)
  const buildColumn = page.locator('[data-stage="BUILD"]');
  await expect(buildColumn).toHaveClass(/border-green-400/);
  await expect(buildColumn).toHaveClass(/bg-green-50/);
  await expect(buildColumn.locator('text=⚡')).toBeVisible();
  await expect(buildColumn.locator('text=Quick Implementation')).toBeVisible();

  // Assert - PLAN column (gray, invalid)
  const planColumn = page.locator('[data-stage="PLAN"]');
  await expect(planColumn).toHaveClass(/opacity-50/);
  await expect(planColumn.locator('text=🚫')).toBeVisible();

  // Cleanup - cancel drag
  await page.mouse.up();
});
```

**Run Test** (expect FAIL):
```bash
npx playwright test tests/e2e/board/drag-drop.spec.ts -g "color-coded"
```

**Expected Output**:
```
✗ user sees color-coded drop zones during INBOX drag (quick-impl)
  Expected class: /border-blue-400/
  Received class: (none)
```

---

### Step 2.2: Add Modal Confirmation Test

**File**: `tests/e2e/board/drag-drop.spec.ts` (ADD after visual feedback test)

```typescript
test('user must confirm modal before INBOX → BUILD transition', async ({ page, request }) => {
  // Arrange
  const ticket = await createTicket(request, 'INBOX');

  await page.goto(`${BASE_URL}/projects/1/board`);
  await page.waitForLoadState('domcontentloaded');

  // Scenario 1: User cancels modal
  await dragTicketToColumn(page, ticket.id, 'BUILD');

  // Assert - Modal appears
  const modal = page.locator('[data-testid="quick-impl-modal"]');
  await expect(modal).toBeVisible();
  await expect(modal.locator('text=Quick Implementation')).toBeVisible();

  // Click Cancel
  await modal.locator('button[data-action="cancel"]').click();
  await expect(modal).not.toBeVisible();

  // Assert - Ticket returned to INBOX (no API call made)
  const inboxColumn = page.locator('[data-stage="INBOX"]');
  await expect(inboxColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();

  // Verify database unchanged
  const unchangedTicket = await getTicket(ticket.id);
  expect(unchangedTicket?.stage).toBe('INBOX');
  expect(unchangedTicket?.version).toBe(1);

  // Scenario 2: User proceeds with modal
  await dragTicketToColumn(page, ticket.id, 'BUILD');
  await expect(modal).toBeVisible();

  // Click Proceed
  await modal.locator('button[data-action="proceed"]').click();
  await expect(modal).not.toBeVisible();

  // Wait for API call and optimistic update
  await page.waitForTimeout(1000);

  // Assert - Ticket moved to BUILD
  const buildColumn = page.locator('[data-stage="BUILD"]');
  await expect(buildColumn.locator(`[data-ticket-id="${ticket.id}"]`)).toBeVisible();

  // Verify database updated
  await page.waitForTimeout(2000); // Wait for server processing
  const updatedTicket = await getTicket(ticket.id);
  expect(updatedTicket?.stage).toBe('BUILD');
  expect(updatedTicket?.version).toBe(2);
});
```

**Run Test** (expect FAIL):
```bash
npx playwright test tests/e2e/board/drag-drop.spec.ts -g "must confirm modal"
```

**Expected Output**:
```
✗ user must confirm modal before INBOX → BUILD transition
  Expected: [data-testid="quick-impl-modal"] to be visible
  Received: Element not found
```

---

### Step 2.3: Implement Frontend Logic (Green Phase)

#### Create Modal Component

**File**: `components/board/quick-impl-modal.tsx` (NEW FILE)

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface QuickImplModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function QuickImplModal({ open, onConfirm, onCancel }: QuickImplModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent data-testid="quick-impl-modal">
        <DialogHeader>
          <DialogTitle>⚡ Quick Implementation</DialogTitle>
          <DialogDescription>
            You're about to skip the specification and planning stages.
            This is recommended for simple tasks like bug fixes or minor changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <p><strong>Skipped stages:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>SPECIFY (no formal specification document)</li>
            <li>PLAN (no implementation plan)</li>
          </ul>

          <p className="mt-4">
            <strong>Best for:</strong> Typo fixes, style tweaks, simple bug fixes
          </p>
          <p>
            <strong>Not recommended for:</strong> Complex features, architectural changes
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} data-action="cancel">
            Cancel
          </Button>
          <Button onClick={onConfirm} data-action="proceed">
            Proceed with Quick Implementation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### Update Board Component

**File**: `components/board/board.tsx` (MODIFY multiple sections)

##### Change 1: Import Modal Component

```typescript
import { QuickImplModal } from './quick-impl-modal';
```

##### Change 2: Add Modal State

```typescript
const [pendingTransition, setPendingTransition] = useState<{
  ticket: TicketWithVersion;
  targetStage: Stage;
} | null>(null);
```

##### Change 3: Add Drag State for Visual Feedback

```typescript
const [isDragging, setIsDragging] = useState(false);
const [dragSource, setDragSource] = useState<Stage | null>(null);

const handleDragStart = useCallback((event: DragStartEvent) => {
  setIsDragging(true);
  setDragSource(event.active.data.current?.stage);
}, []);

const handleDragEnd = useCallback(async (event: DragEndEvent) => {
  setIsDragging(false);
  setDragSource(null);

  // Existing drag logic...
  const ticket = active.data.current?.ticket as TicketWithVersion;
  const targetStage = over.data.current?.stage as Stage;

  // Detect quick-impl: INBOX → BUILD
  if (ticket.stage === 'INBOX' && targetStage === 'BUILD') {
    setPendingTransition({ ticket, targetStage });
    return; // Wait for modal confirmation
  }

  // Normal transitions proceed immediately
  await executeTransition(ticket, targetStage);
}, []);
```

##### Change 4: Add Modal Handlers

```typescript
const handleQuickImplConfirm = useCallback(async () => {
  if (!pendingTransition) return;
  await executeTransition(pendingTransition.ticket, pendingTransition.targetStage);
  setPendingTransition(null);
}, [pendingTransition]);

const handleQuickImplCancel = useCallback(() => {
  setPendingTransition(null);
}, []);
```

##### Change 5: Update DndContext

```typescript
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  {/* Existing board layout */}
</DndContext>

<QuickImplModal
  open={!!pendingTransition}
  onConfirm={handleQuickImplConfirm}
  onCancel={handleQuickImplCancel}
/>
```

##### Change 6: Add Visual Feedback to Columns

```typescript
// Inside each column component
const getDropZoneStyle = (stage: Stage) => {
  if (!isDragging || dragSource !== 'INBOX') {
    return '';
  }

  if (stage === 'SPECIFY') {
    return 'border-blue-400 bg-blue-50 border-dashed border-2';
  }

  if (stage === 'BUILD') {
    return 'border-green-400 bg-green-50 border-dashed border-2';
  }

  if (['PLAN', 'VERIFY', 'SHIP'].includes(stage)) {
    return 'opacity-50';
  }

  return '';
};

// Apply to column
<div
  data-stage={stage}
  className={cn('column-base-classes', getDropZoneStyle(stage))}
>
  {/* Column content */}
</div>
```

**Run Tests** (expect ALL PASS):
```bash
npx playwright test tests/e2e/board/drag-drop.spec.ts
```

---

## Phase 3: Integration & Full Regression

### Step 3.1: Run Full Test Suite

```bash
npx playwright test
```

**Expected Output**:
```
✓ tests/unit/stage-validation.spec.ts (6 tests)
✓ tests/api/ticket-transition.spec.ts (12 tests, 3 new)
✓ tests/e2e/board/drag-drop.spec.ts (13 tests, 2 new)
✓ All other tests (no regressions)
```

### Step 3.2: Verify Test Coverage

```bash
# Check test coverage (if configured)
npx playwright test --reporter=html
```

**Success Criteria** (from spec.md SC-015):
- Test coverage >80% for new logic
- All quick-impl paths tested
- No regressions in existing tests

---

## Phase 4: GitHub Workflow & Script

### Step 4.1: Create Quick-Impl Workflow

**File**: `.github/workflows/quick-impl.yml` (NEW FILE - copy from speckit.yml)

```yaml
name: Quick Implementation Workflow

on:
  workflow_dispatch:
    inputs:
      ticket_id:
        description: 'Ticket ID'
        required: true
        type: string
      job_id:
        description: 'Job ID for status tracking'
        required: true
        type: string
      ticketTitle:
        description: 'Ticket title'
        required: true
        type: string
      ticketDescription:
        description: 'Ticket description'
        required: true
        type: string

jobs:
  quick-impl:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Create feature branch (quick-impl mode)
        run: |
          .specify/scripts/bash/create-new-feature.sh \
            --mode=quick-impl \
            "${{ github.event.inputs.ticketTitle }}"

      - name: Execute quick-impl command
        run: |
          npx claude-code /quick-impl

      - name: Commit and push changes
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add .
          git commit -m "feat: quick implementation for ticket #${{ github.event.inputs.ticket_id }}"
          git push origin HEAD

      - name: Update ticket branch
        run: |
          BRANCH_NAME=$(git branch --show-current)
          curl -X PATCH \
            "${{ secrets.APP_URL }}/api/projects/1/tickets/${{ github.event.inputs.ticket_id }}/branch" \
            -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d "{\"branch\": \"$BRANCH_NAME\"}"

      - name: Update job status (COMPLETED)
        if: success()
        run: |
          curl -X PATCH \
            "${{ secrets.APP_URL }}/api/jobs/${{ github.event.inputs.job_id }}/status" \
            -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"status": "COMPLETED"}'

      - name: Update job status (FAILED)
        if: failure()
        run: |
          curl -X PATCH \
            "${{ secrets.APP_URL }}/api/jobs/${{ github.event.inputs.job_id }}/status" \
            -H "Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"status": "FAILED"}'
```

---

### Step 4.2: Modify create-new-feature.sh Script

**File**: `.specify/scripts/bash/create-new-feature.sh` (MODIFY)

#### Add Mode Parameter (beginning of script)

```bash
#!/bin/bash
set -e

# Default mode
MODE="specify"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --mode)
      MODE="$2"
      shift 2
      ;;
    *)
      FEATURE_DESCRIPTION="$1"
      shift
      ;;
  esac
done

# Existing branch creation logic...
```

#### Add Conditional Template Selection (after branch creation)

```bash
# Create spec directory
mkdir -p "$SPECS_DIR"

# Select template based on mode
if [ "$MODE" = "quick-impl" ]; then
  # Minimal spec.md for quick-impl
  cat > "$SPEC_FILE" <<EOF
# Quick Implementation: ${FEATURE_DESCRIPTION}

**Branch**: ${BRANCH_NAME}
**Created**: $(date +%Y-%m-%d)
**Mode**: Quick Implementation (bypassed SPECIFY and PLAN stages)

## Description

${FEATURE_DESCRIPTION}

## Implementation Notes

This feature was implemented using the quick-impl workflow, bypassing formal specification and planning stages. This approach is recommended for simple tasks like bug fixes, typo corrections, and minor improvements.
EOF

else
  # Full spec template (existing behavior)
  cp .specify/templates/spec-template.md "$SPEC_FILE"
fi

# Existing JSON output...
```

---

### Step 4.3: Create Quick-Impl Claude Command

**File**: `.claude/commands/quick-impl.md` (NEW FILE)

```markdown
You are executing the **Quick Implementation** command for a simple task that bypassed the SPECIFY and PLAN stages.

**Context**:
- The user has chosen the fast-track workflow for simple changes
- No formal specification or plan exists (only title + description from ticket)
- Focus on direct implementation without extensive planning

**Your Task**:
1. Read the minimal spec.md in the current feature directory
2. Understand the task from the title and description
3. Implement the change directly (no need for exhaustive research)
4. Write tests for the change (TDD still applies)
5. Update CLAUDE.md if necessary (only for new patterns)

**Guidelines**:
- Keep it simple - this is meant for straightforward tasks
- If the task seems complex, warn the user and suggest using full workflow
- Follow existing code patterns and conventions
- Write tests before implementation (TDD)
- Commit changes with clear, descriptive messages

**Output**: Commit your changes to the feature branch. The GitHub workflow will handle the rest.
```

---

## Phase 5: Documentation

### Step 5.1: Update CLAUDE.md

**File**: `CLAUDE.md` (ADD section)

```markdown
## Quick Implementation Workflow

### Overview

The quick-impl workflow provides a fast-track path for simple tasks (bug fixes, typo corrections, minor improvements) that don't require formal specifications or planning.

### Workflow Comparison

| Stage | Normal Workflow | Quick-Impl Workflow |
|-------|----------------|---------------------|
| INBOX | ✓ Start here | ✓ Start here |
| SPECIFY | ✓ Create spec.md | ✗ Skipped |
| PLAN | ✓ Create plan.md, data-model.md | ✗ Skipped |
| BUILD | ✓ Implement | ✓ Implement (direct from INBOX) |
| VERIFY | ✓ Manual testing | ✓ Manual testing |
| SHIP | ✓ Deploy | ✓ Deploy |

### Usage

**Via Drag-and-Drop**:
1. Drag ticket from INBOX column to BUILD column
2. Confirm modal warning (100% required)
3. Workflow executes automatically

**When to Use**:
- Typo fixes or copy changes
- CSS/styling tweaks
- Simple bug fixes with known solutions
- Configuration changes

**When NOT to Use**:
- New features requiring design decisions
- Architectural changes
- Database schema modifications
- Complex logic requiring planning

### Technical Details

**Job Command**: `quick-impl` (not `implement`)
**Workflow File**: `.github/workflows/quick-impl.yml`
**Script Mode**: `create-new-feature.sh --mode=quick-impl`
**Claude Command**: `/quick-impl`
**Validation**: INBOX → BUILD transition allowed (special case)

### Example Tickets

**Good Candidates**:
- "Fix: Button text has typo 'Sumbit' → 'Submit'"
- "Style: Increase padding in header by 4px"
- "Config: Update API timeout from 5s to 10s"

**Bad Candidates**:
- "Feature: Add real-time collaboration"
- "Refactor: Migrate to new state management"
- "Database: Add user roles table"
```

---

## Implementation Checklist

### Backend (Phase 1)
- [ ] Create `tests/unit/stage-validation.spec.ts` (6 tests) - FAIL
- [ ] Update `lib/stage-validation.ts` (add INBOX → BUILD special case) - PASS
- [ ] Add 3 tests to `tests/api/ticket-transition.spec.ts` - FAIL
- [ ] Modify 1 test in `tests/api/ticket-transition.spec.ts` (split into 2 tests)
- [ ] Update `lib/workflows/transition.ts` (5 changes) - PASS
- [ ] Run full backend test suite - PASS

### Frontend (Phase 2)
- [ ] Add visual feedback test to `drag-drop.spec.ts` - FAIL
- [ ] Add modal confirmation test to `drag-drop.spec.ts` - FAIL
- [ ] Create `components/board/quick-impl-modal.tsx` (new file)
- [ ] Update `components/board/board.tsx` (6 changes) - PASS
- [ ] Run full frontend test suite - PASS

### Integration (Phase 3)
- [ ] Run full test suite (`npx playwright test`) - ALL PASS
- [ ] Verify test coverage >80%
- [ ] Check for regressions in existing tests

### Workflows (Phase 4)
- [ ] Create `.github/workflows/quick-impl.yml` (clone from speckit.yml)
- [ ] Modify `.specify/scripts/bash/create-new-feature.sh` (add --mode parameter)
- [ ] Create `.claude/commands/quick-impl.md` (simplified specify command)
- [ ] Test workflow manually via GitHub Actions UI

### Documentation (Phase 5)
- [ ] Update `CLAUDE.md` with quick-impl workflow section
- [ ] Update `README.md` with usage instructions (if applicable)
- [ ] Create PR with comprehensive description

---

## Success Criteria (from spec.md)

**Must Pass**:
- [ ] SC-001: Users can drag INBOX → BUILD (100% success rate)
- [ ] SC-002: Modal appears within 100ms
- [ ] SC-003: Visual feedback displays correctly
- [ ] SC-006: Zero regression in existing workflow tests
- [ ] SC-007: Optimistic updates work identically
- [ ] SC-015: Test coverage >80% for new logic
- [ ] SC-016: All E2E tests pass

---

## Quickstart Complete

**Status**: ✅ Implementation guide complete
**TDD Workflow**: Red → Green → Refactor
**Ready for Implementation**: YES
