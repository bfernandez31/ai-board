# Quickstart: Add Workflow Type Field

**Feature**: 032-add-workflow-type
**Date**: 2025-01-16

## Implementation Overview

This feature adds a `workflowType` field to track whether tickets were created via quick-implementation or full workflow, with a visual badge indicator on the board.

**Estimated Time**: 2-3 hours
**Complexity**: Low-Medium (database + backend + frontend + tests)

---

## Step-by-Step Implementation Guide

### Step 1: Database Migration (15 minutes)

**File**: `prisma/schema.prisma`

**1.1 Add WorkflowType Enum**:
```prisma
// Add after existing enums (after Stage enum)
enum WorkflowType {
  FULL   // INBOX → SPECIFY → PLAN → BUILD
  QUICK  // INBOX → BUILD (quick-impl)
}
```

**1.2 Add Field to Ticket Model**:
```prisma
model Ticket {
  // ... existing fields ...
  workflowType WorkflowType @default(FULL)

  // ... existing indexes ...
  @@index([projectId, workflowType])
}
```

**1.3 Generate and Run Migration**:
```bash
npx prisma migrate dev --name add_workflow_type
```

**Expected Output**:
```
✔ Generated Prisma Client
✔ Applied migration: 20250116_add_workflow_type
```

**1.4 Verify Migration**:
```bash
npx prisma studio
# Check that Ticket table has workflowType column
# Verify all existing tickets have workflowType=FULL
```

---

### Step 2: Update Type Definitions (10 minutes)

**File**: `lib/types.ts`

**2.1 Import WorkflowType**:
```typescript
import { Ticket as PrismaTicket, ClarificationPolicy, WorkflowType } from '@prisma/client';
```

**2.2 Export WorkflowType**:
```typescript
export type { Stage, WorkflowType };
```

**2.3 Extend TicketWithVersion Interface**:
```typescript
export interface TicketWithVersion {
  id: number;
  title: string;
  description: string | null;
  stage: Stage;
  version: number;
  projectId: number;
  branch: string | null;
  autoMode: boolean;
  clarificationPolicy: ClarificationPolicy | null;
  workflowType: WorkflowType;  // ← ADD THIS LINE
  createdAt: string;
  updatedAt: string;
  project?: {
    clarificationPolicy: ClarificationPolicy;
  };
}
```

**Verification**:
```bash
npx tsc --noEmit
# Should compile without errors
```

---

### Step 3: Update Backend Transition Logic (20 minutes)

**File**: `lib/workflows/transition.ts`

**3.1 Find Job Creation Logic** (around line 217):
```typescript
// Current code (before changes):
const job = await prisma.job.create({
  data: {
    ticketId: ticket.id,
    projectId: ticket.projectId,
    command: command,
    status: JobStatus.PENDING,
    startedAt: new Date(),
    updatedAt: new Date(),
  },
});
```

**3.2 Replace with Atomic Transaction** (when isQuickImpl=true):
```typescript
// NEW CODE - wrap Job creation in transaction with Ticket update
let job: Job;

if (isQuickImpl) {
  // Atomic transaction for quick-impl: set workflowType=QUICK with Job creation
  const [createdJob, _updatedTicket] = await prisma.$transaction([
    prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ticket.projectId,
        command: command,
        status: JobStatus.PENDING,
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.ticket.update({
      where: { id: ticket.id },
      data: { workflowType: 'QUICK' },
    }),
  ]);
  job = createdJob;
} else {
  // Normal workflow: workflowType remains FULL (default)
  job = await prisma.job.create({
    data: {
      ticketId: ticket.id,
      projectId: ticket.projectId,
      command: command,
      status: JobStatus.PENDING,
      startedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}
```

**Verification**:
```bash
npx tsc --noEmit
# Should compile without errors
```

---

### Step 4: Update Board Query (10 minutes)

**File**: `app/projects/[id]/board/page.tsx`

**4.1 Find Ticket Query** (around line 50-80):
```typescript
const tickets = await prisma.ticket.findMany({
  where: { projectId: Number(params.id) },
  select: {
    id: true,
    title: true,
    description: true,
    stage: true,
    version: true,
    projectId: true,
    branch: true,
    autoMode: true,
    clarificationPolicy: true,
    workflowType: true,  // ← ADD THIS LINE
    createdAt: true,
    updatedAt: true,
    project: {
      select: {
        clarificationPolicy: true,
      },
    },
  },
  orderBy: { updatedAt: 'desc' },
});
```

**Verification**:
```bash
npm run build
# Should build without errors
```

---

### Step 5: Add Badge to Ticket Card (15 minutes)

**File**: `components/board/ticket-card.tsx`

**5.1 Import Badge and WorkflowType**:
```typescript
import { Badge } from '@/components/ui/badge';
import { WorkflowType } from '@prisma/client';
```

**5.2 Find Ticket Title Section** (usually in card header):
```tsx
// Current code:
<div className="flex items-center justify-between">
  <h3 className="font-semibold text-sm">{ticket.title}</h3>
</div>
```

**5.3 Add Conditional Badge**:
```tsx
// NEW CODE:
<div className="flex items-center justify-between gap-2">
  <h3 className="font-semibold text-sm truncate">{ticket.title}</h3>
  {ticket.workflowType === 'QUICK' && (
    <Badge
      variant="outline"
      className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 shrink-0"
    >
      ⚡ Quick
    </Badge>
  )}
</div>
```

**Verification**:
```bash
npm run dev
# Navigate to board, create quick-impl ticket, verify badge appears
```

---

### Step 6: Extend Existing Tests (30 minutes)

#### 6.1 API Tests

**File**: `tests/api/ticket-transition.spec.ts`

**Add Test Cases** (after existing tests):
```typescript
test('INBOX → BUILD sets workflowType to QUICK', async ({ request }) => {
  // Create ticket in INBOX
  const ticket = await createTicket(request, {
    title: '[e2e] Quick-impl workflow type test',
    description: 'Test workflowType field',
  });

  // Transition to BUILD (quick-impl)
  await request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
    data: { targetStage: 'BUILD' },
  });

  // Verify workflowType set to QUICK
  const updatedTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    select: { workflowType: true },
  });

  expect(updatedTicket?.workflowType).toBe('QUICK');
});

test('INBOX → SPECIFY preserves workflowType FULL', async ({ request }) => {
  const ticket = await createTicket(request, {
    title: '[e2e] Full workflow type test',
  });

  // Transition to SPECIFY (normal workflow)
  await request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
    data: { targetStage: 'SPECIFY' },
  });

  const updatedTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    select: { workflowType: true },
  });

  expect(updatedTicket?.workflowType).toBe('FULL');
});

test('workflowType immutable after setting to QUICK', async ({ request }) => {
  const ticket = await createTicket(request, {
    title: '[e2e] Immutability test',
  });

  // Transition to BUILD (sets workflowType=QUICK)
  await request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
    data: { targetStage: 'BUILD' },
  });

  // Move to VERIFY (should NOT change workflowType)
  await request.post(`/api/projects/1/tickets/${ticket.id}/transition`, {
    data: { targetStage: 'VERIFY' },
  });

  const updatedTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    select: { workflowType: true, stage: true },
  });

  expect(updatedTicket?.stage).toBe('VERIFY');
  expect(updatedTicket?.workflowType).toBe('QUICK'); // Still QUICK
});
```

#### 6.2 E2E Tests

**File**: `tests/e2e/quick-impl-visual-feedback.spec.ts`

**Add Test Cases** (after existing visual feedback tests):
```typescript
test('shows ⚡ Quick badge for quick-impl tickets', async ({ page }) => {
  // Create quick-impl ticket
  await prisma.ticket.create({
    data: {
      title: '[e2e] Quick Badge Test',
      description: 'Test badge visibility',
      stage: 'BUILD',
      workflowType: 'QUICK',  // ← Set explicitly for test
      projectId: 1,
      updatedAt: new Date(),
    },
  });

  // Navigate to board
  await page.goto('/projects/1/board');

  // Wait for ticket card
  const ticketCard = page.locator('text="[e2e] Quick Badge Test"').locator('..');

  // Verify badge exists and has correct text
  const badge = ticketCard.locator('text="⚡ Quick"');
  await expect(badge).toBeVisible();

  // Verify badge styling (amber color)
  const badgeClasses = await badge.getAttribute('class');
  expect(badgeClasses).toContain('bg-amber-100');
  expect(badgeClasses).toContain('text-amber-800');
});

test('does NOT show badge for full workflow tickets', async ({ page }) => {
  await prisma.ticket.create({
    data: {
      title: '[e2e] Full Workflow Badge Test',
      stage: 'BUILD',
      workflowType: 'FULL',  // ← Full workflow
      projectId: 1,
      updatedAt: new Date(),
    },
  });

  await page.goto('/projects/1/board');

  const ticketCard = page.locator('text="[e2e] Full Workflow Badge Test"').locator('..');

  // Verify badge does NOT exist
  const badge = ticketCard.locator('text="⚡ Quick"');
  await expect(badge).not.toBeVisible();
});

test('badge persists through stage transitions', async ({ page }) => {
  const ticket = await prisma.ticket.create({
    data: {
      title: '[e2e] Badge Persistence Test',
      stage: 'BUILD',
      workflowType: 'QUICK',
      projectId: 1,
      updatedAt: new Date(),
    },
  });

  await page.goto('/projects/1/board');

  // Verify badge in BUILD stage
  let ticketCard = page.locator(`text="${ticket.title}"`).locator('..');
  await expect(ticketCard.locator('text="⚡ Quick"')).toBeVisible();

  // Move to VERIFY
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { stage: 'VERIFY' },
  });

  await page.reload();

  // Verify badge still visible in VERIFY stage
  ticketCard = page.locator(`text="${ticket.title}"`).locator('..');
  await expect(ticketCard.locator('text="⚡ Quick"')).toBeVisible();
});
```

---

### Step 7: Run Tests (15 minutes)

**7.1 Run API Tests**:
```bash
npx playwright test tests/api/ticket-transition.spec.ts
# Expected: All tests pass (including 3 new workflowType tests)
```

**7.2 Run E2E Tests**:
```bash
npx playwright test tests/e2e/quick-impl-visual-feedback.spec.ts
# Expected: All tests pass (including 3 new badge tests)
```

**7.3 Run Full Test Suite**:
```bash
npm test
# Expected: All tests pass, no regressions
```

---

### Step 8: Manual Verification (10 minutes)

**8.1 Start Development Server**:
```bash
npm run dev
```

**8.2 Test Quick-Impl Flow**:
1. Navigate to `http://localhost:3000/projects/1/board`
2. Create new ticket in INBOX
3. Drag ticket directly to BUILD column
4. Confirm quick-impl modal
5. **Verify**: ⚡ Quick badge appears on ticket card
6. Move ticket to VERIFY
7. **Verify**: Badge persists

**8.3 Test Full Workflow**:
1. Create new ticket in INBOX
2. Drag to SPECIFY
3. Move through PLAN → BUILD
4. **Verify**: NO badge appears

**8.4 Test Theme Support**:
1. Toggle dark mode (if available)
2. **Verify**: Badge contrast is readable in both themes

---

### Step 9: Update Existing Quick-Impl Tickets (5 minutes)

**Manual Database Update** (for 2 existing tickets):

```sql
-- Find existing quick-impl tickets (check Job.command)
SELECT t.id, t.title, j.command
FROM "Ticket" t
JOIN "Job" j ON j."ticketId" = t.id
WHERE j.command = 'quick-impl'
ORDER BY j."startedAt" ASC
LIMIT 1;  -- Get first BUILD job

-- Update identified tickets to workflowType=QUICK
UPDATE "Ticket"
SET "workflowType" = 'QUICK'
WHERE id IN (12, 45);  -- Replace with actual ticket IDs
```

**Verification**:
```bash
npx prisma studio
# Check that tickets 12 and 45 have workflowType=QUICK
```

---

### Step 10: Lint and Type Check (5 minutes)

**10.1 TypeScript Compilation**:
```bash
npx tsc --noEmit
# Expected: No errors
```

**10.2 ESLint**:
```bash
npm run lint
# Expected: No errors
```

**10.3 Prettier**:
```bash
npx prettier --check .
# Expected: All files formatted correctly
```

---

## Troubleshooting

### Issue: Migration Fails

**Symptom**: `ERROR: type "WorkflowType" already exists`

**Solution**:
```bash
npx prisma migrate reset  # ⚠️ Deletes all data! Use on dev only
npx prisma migrate dev --name add_workflow_type
```

### Issue: TypeScript Error on workflowType

**Symptom**: `Property 'workflowType' does not exist on type 'TicketWithVersion'`

**Solution**:
1. Verify `lib/types.ts` includes `workflowType: WorkflowType` in TicketWithVersion
2. Run `npx prisma generate` to regenerate Prisma client
3. Restart TypeScript server in IDE (`Cmd+Shift+P` → "Restart TS Server")

### Issue: Badge Not Appearing

**Symptom**: No badge visible on quick-impl tickets

**Solution**:
1. Check browser console for errors
2. Verify `ticket.workflowType === 'QUICK'` in database (Prisma Studio)
3. Verify board query includes `workflowType: true` in select
4. Inspect ticket card HTML - badge element should be present

### Issue: Tests Failing

**Symptom**: `TypeError: Cannot read property 'workflowType' of undefined`

**Solution**:
1. Verify test database has migration applied (`npx prisma migrate deploy --schema=prisma/schema.prisma`)
2. Check `beforeEach` hook creates tickets with workflowType
3. Verify cleanupDatabase() doesn't delete test tickets

---

## Checklist

- [ ] Step 1: Database migration created and applied
- [ ] Step 2: Type definitions updated in lib/types.ts
- [ ] Step 3: Backend transition logic updated with atomic transaction
- [ ] Step 4: Board query includes workflowType field
- [ ] Step 5: Badge rendering added to ticket card
- [ ] Step 6: Tests extended (3 API tests + 3 E2E tests)
- [ ] Step 7: All tests passing
- [ ] Step 8: Manual verification complete
- [ ] Step 9: Existing quick-impl tickets updated
- [ ] Step 10: Lint and type checks passing

---

## Next Steps

After completing this implementation:

1. **Run `/speckit.tasks`**: Generate detailed task breakdown (tasks.md)
2. **Code Review**: Have another developer review changes
3. **Staging Deployment**: Deploy to staging environment and verify
4. **Production Deployment**: Deploy migration + code to production
5. **Monitor**: Watch for errors in production logs (first 24 hours)

---

## Files Modified Summary

**Database**:
- `prisma/schema.prisma` (enum + field + index)
- `prisma/migrations/[timestamp]_add_workflow_type/migration.sql` (generated)

**Backend**:
- `lib/types.ts` (TicketWithVersion extension)
- `lib/workflows/transition.ts` (atomic transaction)

**Frontend**:
- `app/projects/[id]/board/page.tsx` (query update)
- `components/board/ticket-card.tsx` (badge rendering)

**Tests**:
- `tests/api/ticket-transition.spec.ts` (3 new tests)
- `tests/e2e/quick-impl-visual-feedback.spec.ts` (3 new tests)

**Total**: 8 files modified, 0 new files created
