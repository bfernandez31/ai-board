# Quickstart Guide: Simplified Job Status Display

**Feature**: `047-design-job-status`
**Date**: 2025-10-24
**Branch**: `047-design-job-status`

## Implementation Overview

This feature simplifies job status display through 3 main changes:

1. **Remove stage prefix from workflow jobs** → Show only status icon + label
2. **Add compact AI-BOARD indicator** → Icon-only display with tooltips
3. **Single-line layout** → Horizontal layout with right-aligned AI-BOARD icon

**Estimated Time**: 2-3 hours (including tests)

---

## Prerequisites

### Verify Dependencies

```bash
# Check if Tooltip component exists
ls components/ui/tooltip.tsx

# If not found, install shadcn/ui Tooltip:
npx shadcn@latest add tooltip
```

### Environment Setup

```bash
# Ensure on feature branch
git checkout 047-design-job-status

# Install dependencies (if needed)
npm install

# Run existing tests to establish baseline
npm run test:unit
npm run test:e2e
```

---

## Implementation Steps

### Step 1: Create Timestamp Utility (15 minutes)

**File**: `lib/utils/format-timestamp.ts` (NEW)

**Test First** (TDD):

```bash
# Create unit test file
touch tests/unit/format-timestamp.test.ts
```

```typescript
// tests/unit/format-timestamp.test.ts
import { describe, it, expect } from 'vitest';
import { formatTimestamp } from '@/lib/utils/format-timestamp';

describe('formatTimestamp', () => {
  it('handles null input', () => {
    expect(formatTimestamp(null)).toBe('Unknown time');
  });

  it('formats current time as "just now"', () => {
    const now = new Date();
    expect(formatTimestamp(now)).toBe('just now');
  });

  it('formats recent time as relative', () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    expect(formatTimestamp(twoMinutesAgo)).toBe('2 minutes ago');
  });

  it('handles invalid input', () => {
    expect(formatTimestamp('invalid-date')).toBe('Unknown time');
  });
});
```

**Run Test** (should fail):

```bash
npm run test:unit -- format-timestamp
```

**Implement Utility**:

```typescript
// lib/utils/format-timestamp.ts
/**
 * Format timestamp for tooltip display
 */
export function formatTimestamp(timestamp: Date | string | null): string {
  try {
    if (timestamp === null) {
      return 'Unknown time';
    }

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    if (isNaN(date.getTime())) {
      return 'Unknown time';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    // Just now (< 1 minute)
    if (diffMinutes < 1) {
      return 'just now';
    }

    // X minutes ago (< 1 hour)
    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    }

    // Same day: show time only
    const isToday = now.toDateString() === date.toDateString();
    if (isToday) {
      return date.toLocaleTimeString(navigator.language || 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    // Older: show date + time
    return date.toLocaleString(navigator.language || 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch (error) {
    console.error('formatTimestamp error:', error);
    return 'Unknown time';
  }
}
```

**Verify Tests Pass**:

```bash
npm run test:unit -- format-timestamp
# All tests should pass ✅
```

---

### Step 2: Modify JobStatusIndicator Component (30 minutes)

**File**: `components/board/job-status-indicator.tsx` (MODIFY)

**Search for Existing Tests**:

```bash
# Find existing tests for JobStatusIndicator
npx grep -r "JobStatusIndicator" tests/
```

**Update Existing Tests** (TDD approach):

Locate test file and add new test cases for simplified display:

```typescript
// Example test updates (adjust based on actual test file location)
test('workflow job displays without stage prefix', async () => {
  const { getByTestId } = render(
    <JobStatusIndicator
      status="COMPLETED"
      command="build"
      jobType={JobType.WORKFLOW}
      stage="BUILD"
    />
  );

  const indicator = getByTestId('job-status-indicator');
  // Should NOT contain "BUILD :" prefix
  expect(indicator.textContent).not.toContain('BUILD :');
  // Should contain only status
  expect(indicator.textContent).toContain('COMPLETED');
});

test('AI-BOARD job displays compact icon with tooltip', async () => {
  const { getByRole, getByText } = render(
    <JobStatusIndicator
      status="RUNNING"
      command="comment-build"
      jobType={JobType.AI_BOARD}
    />
  );

  // Icon should be present
  const icon = getByRole('img');
  expect(icon).toBeTruthy();

  // No text label visible
  expect(icon.textContent).not.toContain('RUNNING');

  // Hover to show tooltip
  await userEvent.hover(icon);
  expect(getByText('AI-BOARD is working on this ticket')).toBeTruthy();
});
```

**Run Tests** (should fail):

```bash
npm run test:e2e -- job-status-indicator
```

**Implement Component Changes**:

```typescript
// components/board/job-status-indicator.tsx
'use client';

import { Clock, Pen, CheckCircle2, XCircle, Ban, BotMessageSquare } from 'lucide-react';
import { JobStatus } from '@prisma/client';
import { cn } from '@/lib/utils';
import { JobType } from '@/lib/types/job-types';
import { getJobTypeConfig } from '@/lib/utils/job-type-classifier';
import { getContextualLabel } from '@/lib/utils/job-label-transformer';
import { formatTimestamp } from '@/lib/utils/format-timestamp';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface JobStatusIndicatorProps {
  status: JobStatus;
  command: string;
  jobType?: JobType;
  stage?: string;
  className?: string;
  animated?: boolean;
  ariaLabel?: string;
  completedAt?: Date | string | null; // NEW: For tooltip timestamp
}

export function JobStatusIndicator({
  status,
  command,
  jobType,
  className,
  animated = true,
  ariaLabel,
  completedAt,
}: JobStatusIndicatorProps) {
  const displayLabel = getContextualLabel(command, status);
  const statusConfig = getStatusConfig(status);
  const shouldAnimate = status === 'RUNNING' && animated;

  // AI-BOARD compact icon-only mode
  if (jobType === JobType.AI_BOARD) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              data-testid="job-status-indicator"
              className={cn('inline-flex', className)}
              role="img"
              aria-label={ariaLabel || getAIBoardAriaLabel(status)}
            >
              <BotMessageSquare
                className={cn(
                  'h-4 w-4 cursor-help',
                  getAIBoardColor(status)
                )}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{getAIBoardTooltip(status, completedAt)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Workflow simplified display (no prefix)
  return (
    <div
      data-testid="job-status-indicator"
      className={cn('flex items-center gap-1.5', className)}
      role="img"
      aria-label={ariaLabel || `Job ${command} is ${displayLabel.toLowerCase()}`}
    >
      <div
        className={cn(
          'flex items-center justify-center',
          shouldAnimate && 'animate-quill-writing'
        )}
        style={shouldAnimate ? { willChange: 'transform' } : undefined}
      >
        {statusConfig.icon}
      </div>
      <span className={cn('text-sm font-medium', statusConfig.textColor)}>
        {displayLabel}
      </span>
    </div>
  );
}

// Helper functions
function getStatusConfig(status: JobStatus) {
  const configs = {
    PENDING: {
      icon: <Clock className="h-4 w-4 text-gray-500" />,
      textColor: 'text-gray-500',
    },
    RUNNING: {
      icon: <Pen className="h-4 w-4 text-blue-500" />,
      textColor: 'text-blue-500',
    },
    COMPLETED: {
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      textColor: 'text-green-500',
    },
    FAILED: {
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      textColor: 'text-red-500',
    },
    CANCELLED: {
      icon: <Ban className="h-4 w-4 text-gray-400" />,
      textColor: 'text-gray-400',
    },
  };
  return configs[status];
}

function getAIBoardColor(status: JobStatus): string {
  if (status === 'FAILED') return 'text-red-500';
  if (status === 'CANCELLED') return 'text-gray-500';
  return 'text-purple-500'; // PENDING, RUNNING, COMPLETED
}

function getAIBoardTooltip(status: JobStatus, completedAt?: Date | string | null): string {
  switch (status) {
    case 'PENDING':
      return 'AI-BOARD is preparing...';
    case 'RUNNING':
      return 'AI-BOARD is working on this ticket';
    case 'COMPLETED':
      return `AI-BOARD assisted on ${formatTimestamp(completedAt)}`;
    case 'FAILED':
      return 'AI-BOARD assistance failed';
    case 'CANCELLED':
      return 'AI-BOARD assistance cancelled';
  }
}

function getAIBoardAriaLabel(status: JobStatus): string {
  switch (status) {
    case 'PENDING':
      return 'AI-BOARD is preparing';
    case 'RUNNING':
      return 'AI-BOARD is working on this ticket';
    case 'COMPLETED':
      return 'AI-BOARD assistance completed';
    case 'FAILED':
      return 'AI-BOARD assistance failed';
    case 'CANCELLED':
      return 'AI-BOARD assistance cancelled';
  }
}
```

**Verify Tests Pass**:

```bash
npm run test:e2e -- job-status-indicator
# All tests should pass ✅
```

---

### Step 3: Update TicketCard Layout (20 minutes)

**File**: `components/board/ticket-card.tsx` (MODIFY)

**Modify Job Status Section**:

Find this section (around line 107-130):

```typescript
// OLD: Dual-line vertical layout
{(workflowJob || aiBoardJob) && (
  <div className="border-t border-[#313244] pt-3 space-y-2">
    {workflowJob && (
      <JobStatusIndicator
        status={workflowJob.status}
        command={workflowJob.command}
        jobType={classifyJobType(workflowJob.command)}
        stage={ticket.stage}
        animated={true}
      />
    )}
    {aiBoardJob && (
      <JobStatusIndicator
        status={aiBoardJob.status}
        command={aiBoardJob.command}
        jobType={classifyJobType(aiBoardJob.command)}
        stage={ticket.stage}
        animated={true}
      />
    )}
  </div>
)}
```

**Replace with**:

```typescript
// NEW: Single-line horizontal layout
{(workflowJob || aiBoardJob) && (
  <div className="border-t border-[#313244] pt-3">
    <div className="flex items-center justify-between gap-3">
      {/* Left: Workflow job status */}
      {workflowJob && (
        <JobStatusIndicator
          status={workflowJob.status}
          command={workflowJob.command}
          jobType={classifyJobType(workflowJob.command)}
          stage={ticket.stage}
          animated={true}
          completedAt={workflowJob.completedAt}
        />
      )}

      {/* Right: AI-BOARD job status (compact icon) */}
      {aiBoardJob && (
        <JobStatusIndicator
          status={aiBoardJob.status}
          command={aiBoardJob.command}
          jobType={classifyJobType(aiBoardJob.command)}
          stage={ticket.stage}
          animated={true}
          completedAt={aiBoardJob.completedAt}
        />
      )}
    </div>
  </div>
)}
```

**No Test Changes Needed** (layout change only, behavior preserved)

---

### Step 4: Integration Testing (30 minutes)

**Create Integration Test**:

```bash
touch tests/integration/job-status-display.spec.ts
```

```typescript
// tests/integration/job-status-display.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Simplified Job Status Display', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to board with test tickets
    await page.goto('http://localhost:3000/projects/1/board');
  });

  test('workflow job displays without stage prefix', async ({ page }) => {
    // Find ticket with completed workflow job
    const ticketCard = page.locator('[data-testid="ticket-card"]').first();
    const jobIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');

    // Should show status icon and label
    await expect(jobIndicator).toContainText('COMPLETED');

    // Should NOT show stage prefix
    await expect(jobIndicator).not.toContainText('BUILD :');
  });

  test('AI-BOARD job displays as compact icon', async ({ page }) => {
    // Find ticket with AI-BOARD job
    const ticketCard = page.locator('[data-testid="ticket-card"]').first();
    const aiBoardIcon = ticketCard.locator('svg[class*="lucide-bot-message-square"]');

    // Icon should be visible
    await expect(aiBoardIcon).toBeVisible();

    // Icon should have purple color for active states
    await expect(aiBoardIcon).toHaveClass(/text-purple-500/);
  });

  test('jobs appear on single line', async ({ page }) => {
    // Find ticket with both workflow and AI-BOARD jobs
    const ticketCard = page.locator('[data-testid="ticket-card"]').first();
    const jobContainer = ticketCard.locator('.border-t');

    // Should use flex layout
    const flexContainer = jobContainer.locator('> div');
    await expect(flexContainer).toHaveClass(/flex/);
    await expect(flexContainer).toHaveClass(/justify-between/);
  });

  test('AI-BOARD tooltip shows on hover', async ({ page }) => {
    const ticketCard = page.locator('[data-testid="ticket-card"]').first();
    const aiBoardIcon = ticketCard.locator('svg[class*="lucide-bot-message-square"]');

    // Hover over icon
    await aiBoardIcon.hover();

    // Tooltip should appear
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('AI-BOARD');
  });
});
```

**Run Integration Tests**:

```bash
npm run test:e2e -- job-status-display
```

---

### Step 5: Visual Verification (10 minutes)

**Start Dev Server**:

```bash
npm run dev
```

**Manual Testing Checklist**:

1. **Navigate to board**: `http://localhost:3000/projects/3/board`

2. **Verify workflow job display**:
   - [ ] Status shows only icon + label (e.g., "✅ COMPLETED")
   - [ ] No stage prefix visible (no "🔧 BUILD :")
   - [ ] Running jobs show animation

3. **Verify AI-BOARD display**:
   - [ ] Bot icon visible for AI-BOARD jobs
   - [ ] Icon colored correctly (purple/red/gray)
   - [ ] Tooltip appears on hover
   - [ ] Tooltip shows formatted timestamp for completed jobs

4. **Verify layout**:
   - [ ] Both jobs on same horizontal line
   - [ ] AI-BOARD icon right-aligned
   - [ ] Adequate spacing between indicators
   - [ ] No text wrapping or overflow

5. **Accessibility**:
   - [ ] Tab navigation works for AI-BOARD icon
   - [ ] Enter/Space shows tooltip
   - [ ] Screen reader announces status correctly

---

## Verification Checklist

### Code Quality
- [ ] TypeScript strict mode passing (no errors)
- [ ] ESLint passing (no warnings)
- [ ] All imports resolved correctly
- [ ] No console errors in browser

### Testing
- [ ] Unit tests passing (`npm run test:unit`)
- [ ] Integration tests passing (`npm run test:e2e`)
- [ ] Manual visual testing completed
- [ ] Accessibility testing completed

### Documentation
- [ ] Code comments added for complex logic
- [ ] JSDoc for formatTimestamp utility
- [ ] README updated (if applicable)

### Git
- [ ] All changes committed to feature branch
- [ ] Commit messages descriptive
- [ ] Ready for pull request

---

## Common Issues & Solutions

### Issue 1: Tooltip not appearing

**Symptom**: AI-BOARD icon visible but tooltip doesn't show on hover

**Solution**: Verify Tooltip component installed:
```bash
npx shadcn@latest add tooltip
```

### Issue 2: TypeScript errors on JobStatusIndicatorProps

**Symptom**: `completedAt` property error

**Solution**: Add `completedAt?: Date | string | null` to props interface

### Issue 3: Layout not horizontal

**Symptom**: Jobs still stacked vertically

**Solution**: Verify parent div has `flex justify-between` classes, remove `space-y-2`

### Issue 4: Tests failing after changes

**Symptom**: Existing tests expect old behavior (stage prefix)

**Solution**: Update test expectations to match new simplified display

---

## Performance Validation

**Run Performance Tests**:

```bash
# Build production bundle
npm run build

# Analyze bundle size
npm run analyze
```

**Expected Results**:
- Bundle size increase: ~2KB (Tooltip + formatTimestamp)
- No performance regression in render time
- No layout shift on status updates

---

## Next Steps

After completing implementation:

1. **Code Review**: Create pull request with detailed description
2. **QA Testing**: Deploy to staging for full user testing
3. **Documentation**: Update user guide with new UI screenshots
4. **Monitoring**: Track metrics (board scan time, confusion reports)

---

## Rollback Plan

If issues arise in production:

```bash
# Revert to previous commit
git revert HEAD

# Or cherry-pick specific fixes
git cherry-pick <commit-hash>
```

**Rollback Criteria**:
- User confusion reports > 5% (SC-005 violated)
- Accessibility violations detected
- Performance degradation > 10% (SC-004 violated)

---

## Support & Resources

- **Spec**: `specs/047-design-job-status/spec.md`
- **Contracts**: `specs/047-design-job-status/contracts/component-interfaces.md`
- **Data Model**: `specs/047-design-job-status/data-model.md`
- **Research**: `specs/047-design-job-status/research.md`

**Questions?** Refer to constitution.md for development principles and coding standards.
