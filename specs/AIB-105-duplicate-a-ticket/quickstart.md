# Quickstart: Duplicate a Ticket

**Date**: 2025-12-11
**Feature**: AIB-105-duplicate-a-ticket

## Overview

This feature adds a duplicate button to the ticket detail modal that creates a new ticket in INBOX with copied content (title with "Copy of" prefix, description, clarification policy, and image attachments).

## Files to Create/Modify

### New Files

1. **`app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts`**
   - POST endpoint for duplicating a ticket
   - Uses existing auth and createTicket patterns

2. **`lib/utils/ticket-title.ts`**
   - Pure utility function for title truncation
   - `createDuplicateTitle(originalTitle: string): string`

3. **`tests/unit/ticket-title.test.ts`**
   - Vitest unit tests for title truncation logic

4. **`tests/e2e/duplicate-ticket.spec.ts`**
   - Playwright E2E tests for full duplicate flow

### Modified Files

1. **`components/board/ticket-detail-modal.tsx`**
   - Add duplicate button in metadata row
   - Add `handleDuplicate` function with loading state
   - Add toast notification with "View" action

## Implementation Steps

### Step 1: Create Title Utility (TDD - Red)

```bash
# Create test file first
touch tests/unit/ticket-title.test.ts
```

Write failing tests:
```typescript
// tests/unit/ticket-title.test.ts
import { describe, it, expect } from 'vitest';
import { createDuplicateTitle } from '@/lib/utils/ticket-title';

describe('createDuplicateTitle', () => {
  it('prefixes short title with "Copy of "', () => {
    expect(createDuplicateTitle('Fix bug')).toBe('Copy of Fix bug');
  });

  it('truncates long titles to fit within 100 chars', () => {
    const longTitle = 'A'.repeat(95);
    const result = createDuplicateTitle(longTitle);
    expect(result.length).toBe(100);
    expect(result.startsWith('Copy of ')).toBe(true);
  });

  it('handles exactly 92 char titles without truncation', () => {
    const title = 'A'.repeat(92);
    const result = createDuplicateTitle(title);
    expect(result.length).toBe(100);
    expect(result).toBe(`Copy of ${'A'.repeat(92)}`);
  });
});
```

### Step 2: Implement Title Utility (TDD - Green)

```typescript
// lib/utils/ticket-title.ts
const PREFIX = 'Copy of ';
const MAX_LENGTH = 100;

export function createDuplicateTitle(originalTitle: string): string {
  const maxOriginalLength = MAX_LENGTH - PREFIX.length;
  const truncatedTitle = originalTitle.length > maxOriginalLength
    ? originalTitle.slice(0, maxOriginalLength)
    : originalTitle;
  return `${PREFIX}${truncatedTitle}`;
}
```

Run tests:
```bash
bun run test:unit
```

### Step 3: Create API Endpoint

```typescript
// app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { createTicket } from '@/lib/db/tickets';
import { createDuplicateTitle } from '@/lib/utils/ticket-title';
import { ProjectIdSchema } from '@/lib/validations/ticket';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
) {
  try {
    const { projectId: projectIdString, id: ticketIdString } = await context.params;

    // Validate IDs
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const ticketId = parseInt(ticketIdString, 10);
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid ticket ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);

    // Verify access
    await verifyProjectAccess(projectId);

    // Fetch source ticket
    const sourceTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        description: true,
        clarificationPolicy: true,
        attachments: true,
        projectId: true,
      },
    });

    if (!sourceTicket) {
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (sourceTicket.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Create duplicate
    const duplicateTitle = createDuplicateTitle(sourceTicket.title);
    const newTicket = await createTicket(projectId, {
      title: duplicateTitle,
      description: sourceTicket.description,
      clarificationPolicy: sourceTicket.clarificationPolicy,
      attachments: sourceTicket.attachments as any,
    });

    return NextResponse.json(
      {
        id: newTicket.id,
        ticketNumber: newTicket.ticketNumber,
        ticketKey: newTicket.ticketKey,
        title: newTicket.title,
        description: newTicket.description,
        stage: newTicket.stage,
        version: newTicket.version,
        projectId: newTicket.projectId,
        branch: newTicket.branch,
        autoMode: newTicket.autoMode,
        workflowType: newTicket.workflowType,
        clarificationPolicy: newTicket.clarificationPolicy,
        attachments: newTicket.attachments,
        createdAt: newTicket.createdAt.toISOString(),
        updatedAt: newTicket.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    // Handle errors similar to existing ticket routes
    // ...
  }
}
```

### Step 4: Add UI Button

In `ticket-detail-modal.tsx`, add to metadata row (around line 791):

```tsx
import { Copy } from 'lucide-react';
import { ToastAction } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';

// Inside component:
const router = useRouter();
const [isDuplicating, setIsDuplicating] = useState(false);

const handleDuplicate = async () => {
  if (!localTicket) return;

  setIsDuplicating(true);
  try {
    const response = await fetch(
      `/api/projects/${projectId}/tickets/${localTicket.id}/duplicate`,
      { method: 'POST' }
    );

    if (!response.ok) {
      throw new Error('Failed to duplicate');
    }

    const newTicket = await response.json();

    toast({
      title: 'Ticket duplicated',
      description: newTicket.ticketKey,
      action: (
        <ToastAction
          altText="View duplicated ticket"
          onClick={() => {
            router.push(`/projects/${projectId}/board?ticket=${newTicket.id}&tab=details`);
          }}
        >
          View
        </ToastAction>
      ),
    });
  } catch (error) {
    toast({
      variant: 'destructive',
      title: 'Error',
      description: 'Failed to duplicate ticket. Please try again.',
    });
  } finally {
    setIsDuplicating(false);
  }
};

// In JSX metadata row:
<Button
  variant="ghost"
  size="sm"
  onClick={handleDuplicate}
  disabled={isDuplicating}
  className="h-6 px-2 text-xs"
  data-testid="duplicate-button"
  title="Duplicate ticket"
>
  <Copy className="w-3 h-3 mr-1" />
  {isDuplicating ? 'Duplicating...' : 'Duplicate'}
</Button>
```

### Step 5: Write E2E Tests

```typescript
// tests/e2e/duplicate-ticket.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Duplicate Ticket', () => {
  test('duplicates ticket and shows in INBOX', async ({ page }) => {
    // Navigate to board
    await page.goto('/projects/1/board');

    // Open a ticket modal
    await page.click('[data-testid="ticket-card"]');

    // Click duplicate button
    await page.click('[data-testid="duplicate-button"]');

    // Verify toast appears
    await expect(page.locator('text=Ticket duplicated')).toBeVisible();

    // Click View action
    await page.click('text=View');

    // Verify new ticket modal opens with "Copy of" title
    await expect(page.locator('[data-testid="ticket-title"]')).toContainText('Copy of');
  });
});
```

## Verification Checklist

- [ ] `bun run test:unit` passes (title truncation tests)
- [ ] `bun run test:e2e` passes (duplicate flow tests)
- [ ] `bun run type-check` passes
- [ ] Manual test: Duplicate button visible in modal
- [ ] Manual test: Toast shows new ticket key
- [ ] Manual test: "View" action navigates to new ticket
- [ ] Manual test: Title truncation works for 90+ char titles
- [ ] Manual test: Attachments copied correctly

## Dependencies

- No new npm packages required
- Uses existing: shadcn/ui Button, lucide-react Copy icon, existing toast pattern
